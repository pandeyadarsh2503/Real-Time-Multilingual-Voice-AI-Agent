import { useState, useRef, useCallback } from 'react'

/**
 * useWebRTC
 * Manages microphone capture via MediaRecorder.
 * Returns blob when stopRecording() is called.
 */
export function useWebRTC() {
  const [isRecording, setIsRecording]           = useState(false)
  const mediaRecorderRef                         = useRef(null)
  const chunksRef                                = useRef([])
  const streamRef                                = useRef(null)
  const analyserRef                              = useRef(null)
  const audioCtxRef                              = useRef(null)

  // ── Start ────────────────────────────────────────────────
  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount:      1,
          sampleRate:        16000,
          echoCancellation:  true,
          noiseSuppression:  true,
          autoGainControl:   true,
        },
      })
      streamRef.current = stream

      // WebAudio analyser for waveform visualisation
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)()
      audioCtxRef.current = audioCtx
      const source   = audioCtx.createMediaStreamSource(stream)
      const analyser = audioCtx.createAnalyser()
      analyser.fftSize = 512
      source.connect(analyser)
      analyserRef.current = analyser

      // Choose best available MIME
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm'

      const recorder = new MediaRecorder(stream, { mimeType })
      mediaRecorderRef.current = recorder
      chunksRef.current = []

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }

      recorder.start(100)   // collect every 100 ms
      setIsRecording(true)
      return true
    } catch (err) {
      console.error('Mic access denied or not available:', err)
      return false
    }
  }, [])

  // ── Stop ─────────────────────────────────────────────────
  const stopRecording = useCallback(() => {
    return new Promise((resolve) => {
      const recorder = mediaRecorderRef.current
      if (!recorder || recorder.state === 'inactive') {
        resolve(null)
        return
      }

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
        // Teardown
        if (streamRef.current)  streamRef.current.getTracks().forEach((t) => t.stop())
        if (audioCtxRef.current) audioCtxRef.current.close()
        analyserRef.current = null
        setIsRecording(false)
        resolve(blob)
      }

      recorder.stop()
    })
  }, [])

  // ── Waveform data ─────────────────────────────────────────
  const getWaveformData = useCallback(() => {
    const analyser = analyserRef.current
    if (!analyser) return null
    const data = new Uint8Array(analyser.frequencyBinCount)
    analyser.getByteTimeDomainData(data)
    return data
  }, [])

  return { isRecording, startRecording, stopRecording, getWaveformData }
}
