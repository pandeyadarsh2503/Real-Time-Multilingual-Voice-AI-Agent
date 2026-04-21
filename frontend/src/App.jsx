import { useState, useCallback, useEffect, useRef } from 'react'
import { v4 as uuidv4 } from 'uuid'
import { auth } from './firebase'
import { onAuthStateChanged, signOut } from 'firebase/auth'
import { appointmentsAPI, doctorsAPI, chatAPI, voiceAPI } from './services/api'

import LeftSidebar     from './components/LeftSidebar'
import HomeView        from './components/views/HomeView'
import AppointmentsView from './components/views/AppointmentsView'
import DoctorsView     from './components/views/DoctorsView'
import HistoryView     from './components/views/HistoryView'
import ProfileView     from './components/views/ProfileView'
import SettingsView    from './components/views/SettingsView'
import Login           from './components/Login'

// ── Persistent session ID ─────────────────────────────────
function getSessionId() {
  // Always start a fresh chat session on reload so backend memory doesn't leak
  // into a blank frontend.
  return uuidv4()
}

// ── Main App ──────────────────────────────────────────────
export default function App() {
  const audioRef = useRef(null)
  const [user, setUser]                 = useState(null)
  const patientName                     = user?.displayName || 'Guest'
  const [authLoading, setAuthLoading]   = useState(true)
  const [sessionId]                     = useState(getSessionId)
  const [messages, setMessages]         = useState([])
  const [status, setStatus]             = useState('ready')
  const [language, setLanguage]         = useState('en')
  
  // Dashboard routing state
  const [activeTab, setActiveTab]       = useState('Home')
  const [activities, setActivities]     = useState([])
  const [dashboardData, setDashboardData] = useState({
    upcomingAppointment: null,
    recentDoctors: [],
    quickActions: [
      { id: 'book', icon: '📅', title: 'Book Appointment', bgColor: '#f0f9ff', iconColor: '#3b82f6', prompt: 'Book an appointment' },
      { id: 'check', icon: '🗓️', title: 'Check Availability', bgColor: '#f0fdf4', iconColor: '#10b981', prompt: 'Check availability' },
      { id: 'reschedule', icon: '🔄', title: 'Reschedule Appointment', bgColor: '#fff7ed', iconColor: '#f59e0b', prompt: 'Reschedule my appointment' },
      { id: 'cancel', icon: '❌', title: 'Cancel Appointment', bgColor: '#fef2f2', iconColor: '#ef4444', prompt: 'Cancel appointment' }
    ]
  })

  useEffect(() => {
    if (!user) return;
    const fetchDashboardData = async () => {
      try {
        const [upcomingRes, doctorsRes] = await Promise.all([
          appointmentsAPI.upcoming(1, user?.displayName || 'Guest'),
          doctorsAPI.list()
        ]);
        
        const upcomingAppts = upcomingRes.data;
        let upcomingAppointment = null;
        if (upcomingAppts && upcomingAppts.length > 0) {
          const apt = upcomingAppts[0];
          upcomingAppointment = {
            id: apt.id,
            doctorName: apt.doctor,
            specialty: 'Specialist',
            status: apt.status === 'scheduled' ? 'Confirmed' : apt.status,
            date: apt.date,
            time: apt.time,
            location: 'Clinic',
          };
        }

        const docs = doctorsRes.data.map(d => ({
          id: d.name,
          name: d.name,
          specialty: d.specialty,
          icon: d.icon,
          imgUrl: `https://ui-avatars.com/api/?name=${encodeURIComponent(d.name)}&background=random`
        }));

        setDashboardData(prev => ({
          ...prev,
          upcomingAppointment,
          recentDoctors: docs
        }));
      } catch (err) {
        console.error('Failed to load dashboard data:', err);
      }
    };
    
    fetchDashboardData();
    const intervalId = setInterval(fetchDashboardData, 15000);
    return () => clearInterval(intervalId);
  }, [user]);

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

  const playAudio = useCallback(async (text, lang) => {
    try {
      setStatus('speaking')
      const res  = await voiceAPI.tts(text, lang)
      const url  = URL.createObjectURL(res.data)
      const audio = new Audio(url)
      audioRef.current = audio
      audio.onended = () => {
        URL.revokeObjectURL(url)
        setStatus('ready')
      }
      audio.onerror = () => setStatus('ready')
      audio.play()
    } catch {
      setStatus('ready')
    }
  }, [])

  const sendChatMessage = useCallback(async (userText) => {
    if (!userText.trim()) return
    handleUserMessage(userText, language)
    setStatus('thinking')
    try {
      const res = await chatAPI.send(userText, sessionId, patientName, language)
      const { response, language: detectedLang } = res.data
      if (detectedLang && detectedLang !== language) setLanguage(detectedLang)
      handleAIResponse(response, detectedLang || language)
      await playAudio(response, detectedLang || language)
    } catch (err) {
      const errMsg = err.response?.data?.detail || 'Something went wrong. Please try again.'
      handleAIResponse(errMsg, language)
      setStatus('ready')
    }
  }, [sessionId, patientName, language, handleUserMessage, handleAIResponse, playAudio])

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
            sendChatMessage={sendChatMessage}
            setActiveTab={setActiveTab}
          />
        );
      case 'Appointments':
        return <AppointmentsView patientName={patientName} />;
      case 'Doctors':
        return <DoctorsView 
          onBook={(docName) => {
            setActiveTab('Home');
            setTimeout(() => sendChatMessage(`I want to book an appointment with ${docName}`), 100);
          }} 
        />;
      case 'History':
        return <HistoryView />;
      case 'Profile':
        return <ProfileView user={user} />;
      case 'Settings':
        return <SettingsView />;
      default:
        return <HomeView patientName={patientName} messages={messages} status={status} language={language} setLanguage={setLanguage} sessionId={sessionId} handleUserMessage={handleUserMessage} handleAIResponse={handleAIResponse} setStatus={setStatus} activities={activities} dashboardData={dashboardData} sendChatMessage={sendChatMessage} setActiveTab={setActiveTab} />;
    }
  }

  return (
    <div className="app-container">
      <LeftSidebar activeTab={activeTab} setActiveTab={setActiveTab} onLogout={handleLogout} />
      
      <main className="center-content full-width" style={{ position: 'relative' }}>
         {renderActiveView()}
      </main>
    </div>
  )
}
