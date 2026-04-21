import { useState, useCallback, useEffect } from 'react'
import { v4 as uuidv4 } from 'uuid'
import { auth } from './firebase'
import { onAuthStateChanged, signOut } from 'firebase/auth'

import LeftSidebar     from './components/LeftSidebar'
import HomeView        from './components/views/HomeView'
import AppointmentsView from './components/views/AppointmentsView'
import DoctorsView     from './components/views/DoctorsView'
import RemindersView   from './components/views/RemindersView'
import HistoryView     from './components/views/HistoryView'
import ProfileView     from './components/views/ProfileView'
import SettingsView    from './components/views/SettingsView'
import Login           from './components/Login'

// ── Persistent session ID ─────────────────────────────────
function getSessionId() {
  let id = localStorage.getItem('clinicai_session')
  if (!id) { id = uuidv4(); localStorage.setItem('clinicai_session', id) }
  return id
}

// ── Main App ──────────────────────────────────────────────
export default function App() {
  const [user, setUser]                 = useState(null)
  const [authLoading, setAuthLoading]   = useState(true)
  const [sessionId]                     = useState(getSessionId)
  const [messages, setMessages]         = useState([])
  const [status, setStatus]             = useState('ready')
  const [language, setLanguage]         = useState('en')
  
  // Dashboard routing state
  const [activeTab, setActiveTab]       = useState('Home')
  const [activities, setActivities]     = useState([
    { id: 1, icon: '🚀', title: 'System Online', desc: 'Command Center active', time: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) }
  ])
  const [dashboardData, setDashboardData] = useState({
    upcomingAppointment: {
      doctorName: 'Dr. Iyer',
      specialty: 'General Physician',
      status: 'Confirmed',
      date: '23 Apr 2025 (Tomorrow)',
      time: '10:00 AM',
      location: 'CityCare Clinic, Room 2',
      id: 'apt_1'
    },
    recentDoctors: [
      { id: 'dr_iyer', name: 'Dr. Iyer', specialty: 'General Physician', icon: '👨‍⚕️', imgUrl: 'https://i.pravatar.cc/150?u=driyer5' },
      { id: 'dr_mehta', name: 'Dr. Mehta', specialty: 'Dermatologist', icon: '👩‍⚕️', imgUrl: 'https://i.pravatar.cc/150?u=drmehta7' }
    ],
    quickActions: [
      { id: 'book', icon: '📅', title: 'Book Appointment', bgColor: '#f0f9ff', iconColor: '#3b82f6', prompt: 'Book an appointment' },
      { id: 'check', icon: '🗓️', title: 'Check Availability', bgColor: '#f0fdf4', iconColor: '#10b981', prompt: 'Check availability' },
      { id: 'reschedule', icon: '🔄', title: 'Reschedule Appointment', bgColor: '#fff7ed', iconColor: '#f59e0b', prompt: 'Reschedule my appointment' },
      { id: 'cancel', icon: '❌', title: 'Cancel Appointment', bgColor: '#fef2f2', iconColor: '#ef4444', prompt: 'Cancel appointment' }
    ]
  })

  const addActivity = useCallback((icon, title, desc) => {
    setActivities(prev => [{ id: uuidv4(), icon, title, desc, time: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) }, ...prev])
  }, [])

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
    if (text.toLowerCase().includes('book')) addActivity('📅', 'Booking Attempt', text)
    else if (text.toLowerCase().includes('cancel')) addActivity('❌', 'Cancellation', text)
    else addActivity('💬', 'Chat Message', text.length > 25 ? text.substring(0,25)+'...' : text)
  }, [addMessage, addActivity])

  const handleAIResponse = useCallback((text, lang) => {
    addMessage('assistant', text, lang)
    if (lang) setLanguage(lang)
  }, [addMessage])

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

  if (authLoading) {
    return <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center' }}>Loading...</div>
  }

  if (!user) {
    return <Login />
  }

  const patientName = user.displayName || 'Guest'

  const renderActiveView = () => {
    switch (activeTab) {
      case 'Home':
        return (
          <HomeView 
            patientName={patientName}
            messages={messages}
            status={status}
            language={language}
            setLanguage={setLanguage}
            sessionId={sessionId}
            handleUserMessage={handleUserMessage}
            handleAIResponse={handleAIResponse}
            setStatus={setStatus}
            activities={activities}
            dashboardData={dashboardData}
          />
        );
      case 'Appointments':
        return <AppointmentsView />;
      case 'Doctors':
        return <DoctorsView />;
      case 'Reminders':
        return <RemindersView />;
      case 'History':
        return <HistoryView />;
      case 'Profile':
        return <ProfileView user={user} />;
      case 'Settings':
        return <SettingsView />;
      default:
        return <HomeView patientName={patientName} messages={messages} status={status} language={language} setLanguage={setLanguage} sessionId={sessionId} handleUserMessage={handleUserMessage} handleAIResponse={handleAIResponse} setStatus={setStatus} activities={activities} dashboardData={dashboardData} />;
    }
  }

  return (
    <div className="app-container">
      <LeftSidebar activeTab={activeTab} setActiveTab={setActiveTab} onLogout={handleLogout} />
      
      <main className="center-content full-width">
         {renderActiveView()}
      </main>
    </div>
  )
}
