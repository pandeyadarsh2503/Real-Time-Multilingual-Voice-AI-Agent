import { useRef, useState, useCallback, useEffect } from 'react'
import { useWebRTC } from '../hooks/useWebRTC'
import { voiceAPI, chatAPI } from '../services/api'

export default function VoiceInterface({
  onMessage,
  onResponse,
  onStatusChange,
  sessionId,
  patientName,
  language,
  setLanguage,
  disabled,
  status
}) {
  const [textValue, setTextValue] = useState('')
  const { isRecording, startRecording, stopRecording } = useWebRTC()
  const audioRef = useRef(null)

  const playAudio = useCallback(async (text, lang) => {
    try {
      onStatusChange('speaking')
      const res  = await voiceAPI.tts(text, lang)
      const url  = URL.createObjectURL(res.data)
      const audio = new Audio(url)
      audioRef.current = audio
      audio.onended = () => {
        URL.revokeObjectURL(url)
        onStatusChange('ready')
      }
      audio.onerror = () => onStatusChange('ready')
      audio.play()
    } catch {
      onStatusChange('ready')
    }
  }, [onStatusChange])

  const handleSubmit = useCallback(async (userText, lang) => {
    if (!userText.trim()) return

    onMessage(userText, lang)
    onStatusChange('thinking')

    try {
      const res = await chatAPI.send(userText, sessionId, patientName, lang)
      const { response, language: detectedLang } = res.data

      if (detectedLang && detectedLang !== lang) setLanguage(detectedLang)

      onResponse(response, detectedLang || lang)
      await playAudio(response, detectedLang || lang)
    } catch (err) {
      const errMsg = err.response?.data?.detail || 'Something went wrong. Please try again.'
      onResponse(errMsg, lang)
      onStatusChange('ready')
    }
  }, [sessionId, patientName, onMessage, onResponse, onStatusChange, setLanguage, playAudio])

  const handleMic = useCallback(async () => {
    if (disabled) return

    if (!isRecording) {
      const ok = await startRecording()
      if (ok) onStatusChange('listening')
    } else {
      const blob = await stopRecording()
      if (!blob) return
      onStatusChange('thinking')

      try {
        const sttRes = await voiceAPI.stt(blob, language)
        const { text, language: detectedLang } = sttRes.data

        if (!text.trim()) { onStatusChange('ready'); return }
        if (detectedLang) setLanguage(detectedLang)

        await handleSubmit(text, detectedLang || language)
      } catch {
        onStatusChange('ready')
      }
    }
  }, [disabled, isRecording, startRecording, stopRecording, language, setLanguage, handleSubmit, onStatusChange])

  const handleTextSend = useCallback(async () => {
    const text = textValue.trim()
    if (!text || disabled) return
    setTextValue('')
    await handleSubmit(text, language)
  }, [textValue, disabled, language, handleSubmit])

  const onKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleTextSend() }
  }

  return (
    <div className="input-overlay">
      <div className="input-pill-container">
        
        {/* Inline Mic Button on the left */}
        <button
          className={`mic-inline-btn ${isRecording ? 'recording' : ''}`}
          onClick={handleMic}
          disabled={disabled}
        >
          {isRecording ? '⏹' : '🎤'}
        </button>

        {/* Text input */}
        <input
          className="input-field"
          placeholder="Type your message..."
          value={textValue}
          onChange={(e) => setTextValue(e.target.value)}
          onKeyDown={onKeyDown}
          disabled={disabled || isRecording}
        />



        {/* Send Icon */}
        <button
          className="input-send"
          onClick={handleTextSend}
          disabled={!textValue.trim() || disabled || isRecording}
        >
          ➤
        </button>
      </div>
      <div className="input-hint">
         {status === 'thinking' ? 'Thinking...' : status === 'speaking' ? 'Speaking...' : 'Click the mic and speak or type your message 🛈'}
      </div>
    </div>
  )
}
