import { useCallback, useState } from 'react'
import toast from 'react-hot-toast'
import { useChat } from '../context/ChatContext'
import { useLiveVoice } from '../hooks/useLiveVoice'
import { usePushToTalk } from '../hooks/usePushToTalk'
import { voiceAPI } from '../services/api'

export default function VoiceInterface({ disabled }) {
  const {
    status, setStatus, language, setLanguage,
    sendChatMessage, handleUserMessage, handleAIResponse,
  } = useChat()

  const [textValue, setTextValue] = useState('')
  const [partial, setPartial] = useState('')
  const { isRecording, startRecording, stopRecording } = usePushToTalk()

  // ── Live streaming conversation (WebRTC) ────────────────
  const liveVoice = useLiveVoice({
    onPartial: setPartial,
    onFinal: (text, lang) => {
      if (lang) setLanguage(lang)
      handleUserMessage(text, lang || language)
    },
    onAgentResponse: (text, lang) => handleAIResponse(text, lang || language),
    onState: (state) => setStatus(state === 'ready' ? 'ready' : state),
    onError: (msg) => toast.error(msg),
  })

  const toggleLive = useCallback(() => {
    setPartial('')
    if (liveVoice.live) liveVoice.stop()
    else liveVoice.start()
  }, [liveVoice])

  // ── Push-to-talk (record → upload) fallback ─────────────
  const handleMic = useCallback(async () => {
    if (disabled || liveVoice.live) return

    if (!isRecording) {
      const ok = await startRecording()
      if (ok) setStatus('listening')
      else toast.error('Microphone access was denied.')
    } else {
      const blob = await stopRecording()
      if (!blob) return
      setStatus('thinking')

      try {
        const sttRes = await voiceAPI.stt(blob, language)
        const { text, language: detectedLang } = sttRes.data

        if (!text.trim()) {
          toast('No speech detected — please try again.', { icon: '🎤' })
          setStatus('ready')
          return
        }
        if (detectedLang) setLanguage(detectedLang)

        await sendChatMessage(text)
      } catch (err) {
        toast.error(err.response?.data?.detail || 'Transcription failed. Please try again.')
        setStatus('ready')
      }
    }
  }, [disabled, liveVoice.live, isRecording, startRecording, stopRecording, language, setLanguage, sendChatMessage, setStatus])

  const handleTextSend = useCallback(async () => {
    const text = textValue.trim()
    if (!text || disabled) return
    setTextValue('')
    await sendChatMessage(text)
  }, [textValue, disabled, sendChatMessage])

  const onKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleTextSend() }
  }

  const hint = liveVoice.live
    ? (partial ? `“${partial}…”` : '🎧 Live conversation — just speak naturally')
    : liveVoice.connecting
      ? 'Connecting live voice…'
      : status === 'thinking' ? 'Thinking...'
        : status === 'speaking' ? 'Speaking...'
          : 'Go Live for a hands-free conversation, or use the mic / type 🛈'

  return (
    <div className="input-overlay">
      <div className="input-pill-container">

        {/* Live conversation toggle */}
        <button
          className={`mic-inline-btn ${liveVoice.live ? 'recording' : ''}`}
          onClick={toggleLive}
          disabled={liveVoice.connecting}
          title={liveVoice.live ? 'End live conversation' : 'Start live conversation'}
        >
          {liveVoice.connecting ? '⏳' : liveVoice.live ? '🔴' : '🎧'}
        </button>

        {/* Push-to-talk mic */}
        <button
          className={`mic-inline-btn ${isRecording ? 'recording' : ''}`}
          onClick={handleMic}
          disabled={disabled || liveVoice.live}
          title="Push-to-talk"
        >
          {isRecording ? '⏹' : '🎤'}
        </button>

        {/* Text input */}
        <input
          className="input-field"
          placeholder={liveVoice.live ? 'Live conversation in progress…' : 'Type your message...'}
          value={textValue}
          onChange={(e) => setTextValue(e.target.value)}
          onKeyDown={onKeyDown}
          disabled={disabled || isRecording || liveVoice.live}
        />

        {/* Send Icon */}
        <button
          className="input-send"
          onClick={handleTextSend}
          disabled={!textValue.trim() || disabled || isRecording || liveVoice.live}
        >
          ➤
        </button>
      </div>
      <div className="input-hint">{hint}</div>
    </div>
  )
}
