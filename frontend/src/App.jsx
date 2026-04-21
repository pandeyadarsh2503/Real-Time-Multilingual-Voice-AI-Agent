import { useState, useCallback, useEffect } from 'react'
import { v4 as uuidv4 } from 'uuid'
import { auth } from './firebase'
import { onAuthStateChanged, signOut } from 'firebase/auth'

import ChatWindow      from './components/ChatWindow'
import VoiceInterface  from './components/VoiceInterface'
import AppointmentCard from './components/AppointmentCard'
import OutboundPanel   from './components/OutboundPanel'
import DoctorPanel     from './components/DoctorPanel'
import Login           from './components/Login'

// ── Persistent session ID ─────────────────────────────────
function getSessionId() {
  let id = localStorage.getItem('clinicai_session')
  if (!id) { id = uuidv4(); localStorage.setItem('clinicai_session', id) }
  return id
}

// ── Left Sidebar ──────────────────────────────────────────
function LeftSidebar({ onLogout }) {
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
        {/* Logout Button */}
        <a className="nav-item" onClick={onLogout} style={{ color: '#ef4444', marginTop: '16px' }}>🚪 Logout</a>
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
  const [user, setUser]                 = useState(null)
  const [authLoading, setAuthLoading]   = useState(true)
  const [sessionId]                     = useState(getSessionId)
  const [messages, setMessages]         = useState([])
  const [status, setStatus]             = useState('ready')
  const [language, setLanguage]         = useState('en')

  // Firebase Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser)
      setAuthLoading(false)
    })
    return () => unsubscribe()
  }, [])

  const handleLogout = () => {
    signOut(auth)
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

  // Initial greeting trigger after login
  useEffect(() => {
    if (user && messages.length === 0) {
      setMessages([{
        id: uuidv4(),
        role: 'assistant',
        content: `Hello ${user.displayName || 'Guest'}! I'm your AI healthcare assistant.\nYou can book appointments, check availability, or ask me anything.`,
        language: 'en',
        ts: Date.now(),
      }])
    }
  }, [user]) // eslint-disable-line

  const isDisabled = status === 'thinking' || status === 'speaking'

  if (authLoading) {
    return <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center' }}>Loading...</div>
  }

  if (!user) {
    return <Login />
  }

  const patientName = user.displayName || 'Guest'

  return (
    <div className="app-container">
      
      <LeftSidebar onLogout={handleLogout} />

      <main className="center-content">
        <header className="top-header">
          <div className="header-titles">
            <h1>Hello, {patientName} 👋</h1>
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
        <AppointmentCard onAction={handleAppointmentAction} />
        
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
        
        <DoctorPanel onDoctorSelect={handleDoctorSelect} />
      </aside>

    </div>
  )
}
