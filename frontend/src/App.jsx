import { useState, useCallback, useEffect } from 'react'
import { v4 as uuidv4 } from 'uuid'
import ChatWindow      from './components/ChatWindow'
import VoiceInterface  from './components/VoiceInterface'
import AppointmentCard from './components/AppointmentCard'
import OutboundPanel   from './components/OutboundPanel' // Still there, we can transform its look
import DoctorPanel     from './components/DoctorPanel'   // Still there, we can transform its look

// ── Persistent session ID ─────────────────────────────────
function getSessionId() {
  let id = localStorage.getItem('clinicai_session')
  if (!id) { id = uuidv4(); localStorage.setItem('clinicai_session', id) }
  return id
}

function getPatientName() {
  return localStorage.getItem('clinicai_patient_name') || ''
}

// ── Name Setup Modal ──────────────────────────────────────
function NameModal({ onSubmit }) {
  const [name, setName] = useState('')
  return (
    <div className="name-modal-overlay">
      <div className="name-modal">
        <h2>Welcome to SwasthyaAI 🏥</h2>
        <p>Your AI Healthcare Companion</p>
        <input
          autoFocus
          placeholder="Your full name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && name.trim() && onSubmit(name.trim())}
        />
        <button disabled={!name.trim()} onClick={() => onSubmit(name.trim())}>
          Get Started
        </button>
      </div>
    </div>
  )
}

// ── Left Sidebar ──────────────────────────────────────────
function LeftSidebar() {
  return (
    <aside className="left-sidebar">
      <div className="brand-logo">
        <div className="brand-icon">S</div>
        <div>
          <div className="brand-title">SwasthyaAI</div>
          <div className="brand-subtitle">Your AI Healthcare Companion</div>
        </div>
      </div>

      <nav className="nav-links">
        <a className="nav-item active">🏠 Home</a>
        <a className="nav-item">📅 Appointments</a>
        <a className="nav-item">👨‍⚕️ Doctors</a>
        <a className="nav-item">🔔 Reminders</a>
        <a className="nav-item">🕒 History</a>
        <a className="nav-item">👤 Profile</a>
        <a className="nav-item">⚙️ Settings</a>
      </nav>

      <div className="help-widget">
        <div className="help-title">📞 Need Help?</div>
        <div className="help-desc">Talk to our assistant now or call us.</div>
        <button className="help-btn">📞 Call Assistant</button>
      </div>
    </aside>
  )
}

// ── Trust Banner ──────────────────────────────────────────
function TrustBanner() {
  return (
    <div className="trust-banner">
      <div className="trust-item">
        <div className="trust-icon">🛡️</div>
        <div className="trust-text">
          <h4>Secure & Private</h4>
          <p>Your data is safe with us</p>
        </div>
      </div>
      <div className="trust-item">
        <div className="trust-icon">🕒</div>
        <div className="trust-text">
          <h4>24/7 Available</h4>
          <p>We're here anytime</p>
        </div>
      </div>
      <div className="trust-item">
        <div className="trust-icon">👥</div>
        <div className="trust-text">
          <h4>Trusted by Thousands</h4>
          <p>For better healthcare</p>
        </div>
      </div>
    </div>
  )
}

// ── Main App ──────────────────────────────────────────────
export default function App() {
  const [sessionId]             = useState(getSessionId)
  const [patientName, setPatientName] = useState(getPatientName)
  const [messages, setMessages] = useState([])
  const [status, setStatus]     = useState('ready')
  const [language, setLanguage] = useState('en')

  // Show name modal on first visit
  const showModal = !patientName

  const handleNameSubmit = (name) => {
    localStorage.setItem('clinicai_patient_name', name)
    setPatientName(name)
  }

  const addMessage = useCallback((role, content, lang) => {
    setMessages((prev) => [
      ...prev,
      { id: uuidv4(), role, content, language: lang, ts: Date.now() },
    ])
  }, [])

  const handleUserMessage = useCallback((text, lang) => {
    addMessage('user', text, lang)
  }, [addMessage])

  const handleAIResponse = useCallback((text, lang) => {
    addMessage('assistant', text, lang)
    if (lang) setLanguage(lang)
  }, [addMessage])

  const handleDoctorSelect = useCallback((doctorName) => {
    addMessage('user', `I'd like to see ${doctorName}`, language)
  }, [addMessage, language])

  const handleAppointmentAction = useCallback((action, appt) => {
    const msgs = {
      reschedule: `I want to reschedule appointment ${appt.id} with ${appt.doctor}`,
      cancel:     `Please cancel appointment ${appt.id}`,
    }
    if (msgs[action]) addMessage('user', msgs[action], language)
  }, [addMessage, language])

  const handleSimulatedReminder = useCallback((message) => {
    addMessage('assistant', `📞 ${message}`, language)
  }, [addMessage, language])

  useEffect(() => {
    if (patientName && messages.length === 0) {
      setMessages([{
        id: uuidv4(),
        role: 'assistant',
        content: `Hello ${patientName}! I'm your AI healthcare assistant.\nYou can book appointments, check availability, or ask me anything.`,
        language: 'en',
        ts: Date.now(),
      }])
    }
  }, [patientName]) // eslint-disable-line

  const isDisabled = status === 'thinking' || status === 'speaking'

  return (
    <>
      {showModal && <NameModal onSubmit={handleNameSubmit} />}

      <div className="app-container">
        
        <LeftSidebar />

        <main className="center-content">
          <header className="top-header">
            <div className="header-titles">
              <h1>Hello, {patientName || 'Guest'} 👋</h1>
              <p>How can I help you today?</p>
            </div>
            <div className="header-controls">
              <select className="lang-select" value={language} onChange={e => setLanguage(e.target.value)}>
                <option value="en">🌐 English</option>
                <option value="hi">🌐 Hindi</option>
                <option value="ta">🌐 Tamil</option>
              </select>
              <div className="online-badge">
                <div className="online-dot"></div> Online
              </div>
            </div>
          </header>

          <ChatWindow messages={messages} isThinking={status === 'thinking'} />
          
          <VoiceInterface
            sessionId={sessionId}
            patientName={patientName}
            language={language}
            setLanguage={setLanguage}
            onMessage={handleUserMessage}
            onResponse={handleAIResponse}
            onStatusChange={setStatus}
            disabled={isDisabled}
            status={status}
          />

          <TrustBanner />
        </main>

        <aside className="right-sidebar">
          {/* We will reuse AppointmentCard, OutboundPanel, DoctorPanel but styling them to match the new look via index.css changes */}
          <AppointmentCard onAction={handleAppointmentAction} />
          
          {/* Quick Actions (Replacing Outbound Panel visual with Quick Actions) */}
          <div className="widget-card">
            <div className="widget-header">💼 Quick Actions</div>
            <div className="actions-grid">
              <button className="action-box blue" onClick={() => handleUserMessage("Book an appointment", language)}>
                <span className="icon">📅</span> Book Appointment
              </button>
              <button className="action-box green" onClick={() => handleUserMessage("Check availability", language)}>
                <span className="icon">🗓️</span> Check Availability
              </button>
              <button className="action-box orange" onClick={() => handleUserMessage("Reschedule my appointment", language)}>
                <span className="icon">🔄</span> Reschedule Appointment
              </button>
              <button className="action-box red" onClick={() => handleUserMessage("Cancel appointment", language)}>
                <span className="icon">✂️</span> Cancel Appointment
              </button>
            </div>
          </div>
          
          {/* Outbound as an invisible/mini tool or at bottom to preserve feature */}
          <DoctorPanel onDoctorSelect={handleDoctorSelect} />
        </aside>

      </div>
    </>
  )
}
