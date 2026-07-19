import { useCallback, useState } from 'react'
import { useChat } from '../context/ChatContext'

/**
 * VoiceInterface — the input dock: Live toggle, push-to-talk mic, and
 * the text field. All voice logic lives in useVoiceSession (owned by
 * HomeView so the VoiceStage above shares the same session).
 */
export default function VoiceInterface({ session, disabled }) {
  const { sendChatMessage } = useChat()
  const [textValue, setTextValue] = useState('')
  const { live, connecting, isRecording, toggleLive, handleMic } = session

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

        {/* Live conversation toggle */}
        <button
          className={`mic-inline-btn ${live ? 'recording' : ''}`}
          onClick={toggleLive}
          disabled={connecting}
          title={live ? 'End live conversation' : 'Start live conversation'}
        >
          {connecting ? '⏳' : live ? '🔴' : '🎧'}
        </button>

        {/* Push-to-talk mic */}
        <button
          className={`mic-inline-btn ${isRecording ? 'recording' : ''}`}
          onClick={handleMic}
          disabled={disabled || live}
          title="Push-to-talk"
        >
          {isRecording ? '⏹' : '🎤'}
        </button>

        {/* Text input */}
        <input
          className="input-field"
          placeholder={live ? 'Live conversation in progress…' : 'Type your message...'}
          value={textValue}
          onChange={(e) => setTextValue(e.target.value)}
          onKeyDown={onKeyDown}
          disabled={disabled || isRecording || live}
        />

        {/* Send */}
        <button
          className="input-send"
          onClick={handleTextSend}
          disabled={!textValue.trim() || disabled || isRecording || live}
        >
          ➤
        </button>
      </div>
    </div>
  )
}
