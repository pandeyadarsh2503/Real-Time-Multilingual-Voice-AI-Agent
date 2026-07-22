import { useCallback, useState } from 'react'
import { useChat } from '../context/ChatContext'
import { t } from '../i18n'

/**
 * VoiceInterface — the input dock: Live toggle, push-to-talk mic, text
 * field, and the honest status line (live partials + the agent's real
 * tool activity). Voice logic lives in useVoiceSession, owned by HomeView.
 */
export default function VoiceInterface({ session, disabled }) {
  const { sendChatMessage, language } = useChat()
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
          title={live ? t(language, 'aria.endLive') : t(language, 'aria.live')}
          aria-label={live ? t(language, 'aria.endLive') : t(language, 'aria.live')}
          aria-pressed={live}
        >
          <span aria-hidden="true">{connecting ? '⏳' : live ? '🔴' : '🎧'}</span>
        </button>

        {/* Push-to-talk mic */}
        <button
          className={`mic-inline-btn ${isRecording ? 'recording' : ''}`}
          onClick={handleMic}
          disabled={disabled || live}
          title={isRecording ? t(language, 'aria.stopMic') : t(language, 'aria.mic')}
          aria-label={isRecording ? t(language, 'aria.stopMic') : t(language, 'aria.mic')}
          aria-pressed={isRecording}
        >
          <span aria-hidden="true">{isRecording ? '⏹' : '🎤'}</span>
        </button>

        {/* Text input */}
        <input
          className="input-field"
          aria-label={t(language, 'chat.placeholder')}
          placeholder={live ? t(language, 'chat.liveInProgress') : t(language, 'chat.placeholder')}
          value={textValue}
          onChange={(e) => setTextValue(e.target.value)}
          onKeyDown={onKeyDown}
          disabled={disabled || isRecording || live}
        />

        {/* Send */}
        <button
          className="input-send"
          onClick={handleTextSend}
          aria-label={t(language, 'aria.send')}
          disabled={!textValue.trim() || disabled || isRecording || live}
        >
          <span aria-hidden="true">➤</span>
        </button>
      </div>

      {/* One honest status line: live partial transcript, the agent's
          real tool activity, or a gentle default */}
      <div className="input-hint" aria-live="polite">
        {session.statusLine || t(language, 'chat.hint')}
      </div>
    </div>
  )
}
