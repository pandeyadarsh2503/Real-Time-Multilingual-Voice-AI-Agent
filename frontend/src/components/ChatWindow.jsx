import { useEffect, useRef } from 'react'

function formatTime(ts) {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function Bubble({ msg }) {
  const isUser = msg.role === 'user'
  return (
    <div className={`message-row ${isUser ? 'user' : 'assistant'}`}>
      <div className={`chat-avatar-container ${isUser ? 'user' : 'assistant'}`}>
        {isUser ? '👤' : '🤖'}
      </div>
      <div className="bubble-wrap">
        <div className={`bubble ${isUser ? 'user' : 'assistant'}`}>
          {msg.content}
        </div>
        <div className="bubble-meta">
          <span>{formatTime(msg.ts)}</span>
          {isUser && <span className="status-ticks">✓✓</span>}
        </div>
      </div>
    </div>
  )
}

function TypingIndicator() {
  return (
    <div className="message-row assistant">
      <div className="chat-avatar-container assistant">🤖</div>
      <div className="bubble-wrap">
        <div className="bubble assistant" style={{ padding: '14px 20px', display: 'flex', gap: '4px', alignItems: 'center' }}>
          <span style={{width:'6px',height:'6px',background:'#9ca3af',borderRadius:'50%',animation:'bounce 1s infinite'}}></span>
          <span style={{width:'6px',height:'6px',background:'#9ca3af',borderRadius:'50%',animation:'bounce 1s infinite 0.2s'}}></span>
          <span style={{width:'6px',height:'6px',background:'#9ca3af',borderRadius:'50%',animation:'bounce 1s infinite 0.4s'}}></span>
        </div>
      </div>
    </div>
  )
}

export default function ChatWindow({ messages, isThinking }) {
  const bottomRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isThinking])

  return (
    <div className="chat-window">
      {messages.length === 0 && (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', flex: 1, gap: 12, opacity: 0.4,
          marginTop: 60,
        }}>
          <span style={{ fontSize: 48 }}>🏥</span>
          <p style={{ fontSize: 13, textAlign: 'center', maxWidth: 260 }}>
            Hello! I'm SwasthyaAI.<br />
            Speak or type to book an appointment.
          </p>
        </div>
      )}

      {messages.map((msg) => (
        <Bubble key={msg.id} msg={msg} />
      ))}

      {isThinking && <TypingIndicator />}

      <div ref={bottomRef} />
    </div>
  )
}
