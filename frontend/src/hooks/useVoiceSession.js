import { useCallback, useEffect, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { useChat } from '../context/ChatContext'
import { STRINGS, t } from '../i18n'
import { voiceAPI } from '../services/api'
import { useLiveVoice } from './useLiveVoice'
import { usePushToTalk } from './usePushToTalk'

/**
 * useVoiceSession — everything the voice-first home screen needs:
 * live WebRTC + push-to-talk, a single mic-level source, the helix
 * state machine (including real success/error flashes), and
 * intelligent status lines driven by the agent's ACTUAL tool calls
 * (streamed over the DataChannel) — never a fake spinner narrative.
 */

export function useVoiceSession() {
  const {
    status, setStatus, language, setLanguage,
    sendChatMessage, handleUserMessage, handleAIResponse,
    celebration, mishap,
  } = useChat()

  const [partial, setPartial] = useState('')
  const [toolLabel, setToolLabel] = useState('')
  const toolTimer = useRef(null)

  const onTool = useCallback((name) => {
    const key = `tool.${name}`
    setToolLabel(t(language, STRINGS.en[key] ? key : 'tool.generic'))
    clearTimeout(toolTimer.current)
    toolTimer.current = setTimeout(() => setToolLabel(''), 6000)
  }, [language])

  const liveVoice = useLiveVoice({
    onPartial: setPartial,
    onFinal: (text, lang) => {
      if (lang) setLanguage(lang)
      handleUserMessage(text, lang || language)
    },
    onAgentResponse: (text, lang) => {
      setToolLabel('')
      handleAIResponse(text, lang || language)
    },
    onState: (s) => setStatus(s === 'ready' ? 'ready' : s),
    onTool,
    onError: (msg) => toast.error(msg),
  })

  const ptt = usePushToTalk()

  // ── helix state: transient success/error flashes override the base ──
  const [flash, setFlash] = useState(null)
  const flashTimer = useRef(null)
  useEffect(() => {
    if (!celebration) return
    setFlash('success')
    clearTimeout(flashTimer.current)
    flashTimer.current = setTimeout(() => setFlash(null), 1900)
  }, [celebration])
  useEffect(() => {
    if (!mishap) return
    setFlash('error')
    clearTimeout(flashTimer.current)
    flashTimer.current = setTimeout(() => setFlash(null), 1700)
  }, [mishap])
  useEffect(() => () => { clearTimeout(flashTimer.current); clearTimeout(toolTimer.current) }, [])

  const baseState =
    status === 'listening' ? 'listening'
    : status === 'thinking' ? 'thinking'
    : status === 'speaking' ? 'speaking'
    : 'idle'
  const helixState = flash || baseState

  // one mic-level source for helix + waveform, whichever mode is active
  const getLevel = liveVoice.live ? liveVoice.getLevel : ptt.getLevel

  // ── status line under the helix ──
  const statusLine = partial
    ? `“${partial}…”`
    : status === 'listening' ? t(language, 'status.listening')
    : status === 'thinking' ? (toolLabel || t(language, 'status.thinking'))
    : status === 'speaking' ? t(language, 'status.speaking')
    : liveVoice.live ? t(language, 'status.live')
    : ''

  // ── push-to-talk flow ──
  const handleMic = useCallback(async () => {
    if (liveVoice.live) return

    if (!ptt.isRecording) {
      const ok = await ptt.startRecording()
      if (ok) setStatus('listening')
      else toast.error(t(language, 'toast.micDenied'))
    } else {
      const blob = await ptt.stopRecording()
      if (!blob) return
      setStatus('thinking')

      try {
        const sttRes = await voiceAPI.stt(blob, language)
        const { text, language: detectedLang } = sttRes.data

        if (!text.trim()) {
          toast(t(language, 'toast.noSpeech'), { icon: '🎤' })
          setStatus('ready')
          return
        }
        if (detectedLang) setLanguage(detectedLang)
        await sendChatMessage(text)
      } catch (err) {
        toast.error(err.response?.data?.detail || t(language, 'toast.sttFailed'))
        setStatus('ready')
      }
    }
  }, [liveVoice.live, ptt, language, setLanguage, sendChatMessage, setStatus])

  const toggleLive = useCallback(() => {
    setPartial('')
    if (liveVoice.live) liveVoice.stop()
    else liveVoice.start()
  }, [liveVoice])

  return {
    live: liveVoice.live,
    connecting: liveVoice.connecting,
    isRecording: ptt.isRecording,
    toggleLive,
    handleMic,
    partial,
    statusLine,
    helixState,
    getLevel,
  }
}
