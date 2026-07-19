import { useCallback, useRef, useState } from 'react'
import api from '../services/api'

/**
 * useLiveVoice — real WebRTC streaming conversation.
 *
 * mic ──RTCPeerConnection──▶ backend (aiortc)
 *   ◀── agent audio track   ◀── DataChannel events
 *
 * Events surfaced via callbacks:
 *   onPartial(text)              — live partial transcript while speaking
 *   onFinal(text, lang)          — completed user utterance
 *   onAgentResponse(text, lang)  — agent reply text
 *   onState('listening'|'thinking'|'speaking')
 */
export function useLiveVoice({ onPartial, onFinal, onAgentResponse, onState, onTool, onError }) {
  const pcRef = useRef(null)
  const streamRef = useRef(null)
  const audioRef = useRef(null)
  const audioCtxRef = useRef(null)
  const analyserRef = useRef(null)
  const levelBufRef = useRef(null)
  const [live, setLive] = useState(false)
  const [connecting, setConnecting] = useState(false)

  /** 0..1 microphone energy right now — safe to call every frame. */
  const getLevel = useCallback(() => {
    const analyser = analyserRef.current
    if (!analyser) return 0
    const buf = levelBufRef.current
    analyser.getByteTimeDomainData(buf)
    let sum = 0
    for (let i = 0; i < buf.length; i++) {
      const v = (buf[i] - 128) / 128
      sum += v * v
    }
    return Math.min(1, Math.sqrt(sum / buf.length) * 3.2)
  }, [])

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    pcRef.current?.close()
    pcRef.current = null
    audioCtxRef.current?.close().catch(() => {})
    audioCtxRef.current = null
    analyserRef.current = null
    if (audioRef.current) {
      audioRef.current.srcObject = null
      audioRef.current = null
    }
    setLive(false)
    onState?.('ready')
  }, [onState])

  const start = useCallback(async () => {
    if (pcRef.current) return
    setConnecting(true)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      })
      streamRef.current = stream

      // local analyser: drives the waveform + the helix's reaction to you
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)()
      audioCtxRef.current = audioCtx
      const analyser = audioCtx.createAnalyser()
      analyser.fftSize = 512
      audioCtx.createMediaStreamSource(stream).connect(analyser)
      analyserRef.current = analyser
      levelBufRef.current = new Uint8Array(analyser.frequencyBinCount)

      const pc = new RTCPeerConnection()
      pcRef.current = pc
      stream.getTracks().forEach((t) => pc.addTrack(t, stream))

      // Agent audio comes back as a remote track.
      pc.ontrack = (event) => {
        const el = new Audio()
        el.autoplay = true
        el.srcObject = event.streams[0]
        audioRef.current = el
      }

      const dc = pc.createDataChannel('events')
      dc.onmessage = (msg) => {
        let event
        try { event = JSON.parse(msg.data) } catch { return }
        switch (event.type) {
          case 'partial_transcript': onPartial?.(event.text); break
          case 'final_transcript':   onPartial?.(''); onFinal?.(event.text, event.language); break
          case 'agent_response':     onAgentResponse?.(event.text, event.language); break
          case 'state':              onState?.(event.value); break
          case 'tool':               onTool?.(event.name); break
          case 'interrupted':        onPartial?.(''); break
          case 'error':              onError?.(event.message); break
          default: break
        }
      }

      pc.onconnectionstatechange = () => {
        if (['failed', 'closed', 'disconnected'].includes(pc.connectionState)) stop()
      }

      const offer = await pc.createOffer()
      await pc.setLocalDescription(offer)

      // Wait for ICE gathering so the offer carries our candidates
      // (no trickle-ICE round trips needed against our own backend).
      await new Promise((resolve) => {
        if (pc.iceGatheringState === 'complete') return resolve()
        const check = () => {
          if (pc.iceGatheringState === 'complete') {
            pc.removeEventListener('icegatheringstatechange', check)
            resolve()
          }
        }
        pc.addEventListener('icegatheringstatechange', check)
        setTimeout(resolve, 1500) // safety valve
      })

      const res = await api.post('/voice/rtc/offer', {
        sdp: pc.localDescription.sdp,
        type: pc.localDescription.type,
      })
      await pc.setRemoteDescription(res.data)

      setLive(true)
      onState?.('listening')
    } catch (err) {
      console.error('Live voice failed to start:', err)
      onError?.(err.response?.data?.detail || 'Could not start live voice.')
      stop()
    } finally {
      setConnecting(false)
    }
  }, [onPartial, onFinal, onAgentResponse, onState, onTool, onError, stop])

  return { live, connecting, start, stop, getLevel }
}
