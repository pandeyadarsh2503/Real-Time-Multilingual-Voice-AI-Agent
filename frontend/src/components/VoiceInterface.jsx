import { useState, useCallback } from 'react'
import { useWebRTC } from '../hooks/useWebRTC'
import { voiceAPI } from '../services/api'

export default function VoiceInterface({
  sendChatMessage,
  onStatusChange,
  language,
  setLanguage,
  disabled,
  status
}) {
  const [textValue, setTextValue] = useState('')
  const { isRecording, startRecording, stopRecording } = useWebRTC()



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

        await sendChatMessage(text)
      } catch {
        onStatusChange('ready')
      }
    }
  }, [disabled, isRecording, startRecording, stopRecording, language, setLanguage, sendChatMessage, onStatusChange])

  const handleTextSend = useCallback(async () => {
    const text = textValue.trim()
    if (!text || disabled) return
    setTextValue('')
    await sendChatMessage(text)
  }, [textValue, disabled, sendChatMessage])

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
