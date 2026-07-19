import { onAuthStateChanged, signOut } from 'firebase/auth'
import { useCallback, useEffect, useState } from 'react'
import toast, { Toaster } from 'react-hot-toast'
import { auth } from './firebase'
import { appointmentsAPI, doctorsAPI } from './services/api'

import { ChatProvider, useChat } from './context/ChatContext'

import LeftSidebar from './components/LeftSidebar'
import Login from './components/Login'
import SplashScreen from './components/SplashScreen'
import AppointmentsView from './components/views/AppointmentsView'
import DoctorsView from './components/views/DoctorsView'
import HistoryView from './components/views/HistoryView'
import HomeView from './components/views/HomeView'
import ProfileView from './components/views/ProfileView'
import SettingsView from './components/views/SettingsView'

// ── Main App ──────────────────────────────────────────────
export default function App() {
  const [user, setUser] = useState(null)
  const [userPhone, setUserPhone] = useState('')
  const [authLoading, setAuthLoading] = useState(true)
  const [splashDone, setSplashDone] = useState(false)

  // Firebase Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser)
      // Phone lives in localStorage — Firebase's phoneNumber property is
      // read-only and can't be set from the email/password flow.
      setUserPhone(currentUser ? localStorage.getItem(`phone_${currentUser.uid}`) || '' : '')
      setAuthLoading(false)
    })
    return () => unsubscribe()
  }, [])

  // Animated splash on open — doubles as the auth-loading screen.
  // Signed-in users auto-dismiss into the app; everyone else gets a
  // Get Started button that leads to the login page.
  if (!splashDone) {
    return (
      <>
        <Toaster position="top-right" />
        <SplashScreen
          ready={!authLoading}
          autoDismiss={!authLoading && !!user}
          onDone={() => setSplashDone(true)}
        />
      </>
    )
  }

  if (authLoading) {
    return <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center' }}>Loading...</div>
  }

  if (!user) {
    return (
      <>
        <Toaster position="top-right" />
        <Login />
      </>
    )
  }

  return (
    <ChatProvider user={user}>
      <Toaster position="top-right" />
      <AuthedApp user={user} userPhone={userPhone} />
    </ChatProvider>
  )
}

function AuthedApp({ user, userPhone }) {
  const { sendChatMessage, patientName } = useChat()
  const [activeTab, setActiveTab] = useState('Home')
  const [dashboardData, setDashboardData] = useState({
    upcomingAppointment: null,
    recentDoctors: [],
    quickActions: [
      { id: 'book', icon: '📅', title: 'Book Appointment', bgColor: '#f0f9ff', iconColor: '#3b82f6', prompt: 'Book an appointment' },
      { id: 'check', icon: '🗓️', title: 'Check Availability', bgColor: '#f0fdf4', iconColor: '#10b981', prompt: 'Check availability' },
      { id: 'reschedule', icon: '🔄', title: 'Reschedule Appointment', bgColor: '#fff7ed', iconColor: '#f59e0b', prompt: 'Reschedule my appointment' },
      { id: 'cancel', icon: '❌', title: 'Cancel Appointment', bgColor: '#fef2f2', iconColor: '#ef4444', prompt: 'Cancel appointment' },
    ],
  })

  // Dashboard data polling
  useEffect(() => {
    let failedOnce = false
    const fetchDashboardData = async () => {
      try {
        const [upcomingRes, doctorsRes] = await Promise.all([
          appointmentsAPI.upcoming(1),
          doctorsAPI.list(),
        ])

        const apt = upcomingRes.data?.[0]
        const upcomingAppointment = apt ? {
          id: apt.id,
          doctorName: apt.doctor,
          status: apt.status === 'scheduled' ? 'Confirmed' : apt.status,
          date: apt.date,
          time: apt.time,
        } : null

        const docs = doctorsRes.data.map((d) => ({
          id: d.name,
          name: d.name,
          specialty: d.specialty,
          icon: d.icon,
          imgUrl: `https://ui-avatars.com/api/?name=${encodeURIComponent(d.name)}&background=random`,
        }))

        setDashboardData((prev) => ({ ...prev, upcomingAppointment, recentDoctors: docs }))
        failedOnce = false
      } catch (err) {
        console.error('Failed to load dashboard data:', err)
        if (!failedOnce) {
          failedOnce = true
          toast.error('Could not reach the server — retrying in the background.')
        }
      }
    }

    fetchDashboardData()
    const intervalId = setInterval(fetchDashboardData, 15000)
    return () => clearInterval(intervalId)
  }, [])

  const handleLogout = () => signOut(auth)

  const chatHandoff = useCallback((prompt) => {
    setActiveTab('Home')
    setTimeout(() => sendChatMessage(prompt), 100)
  }, [sendChatMessage])

  const renderActiveView = () => {
    switch (activeTab) {
      case 'Home':
        return <HomeView dashboardData={dashboardData} setActiveTab={setActiveTab} />
      case 'Appointments':
        return (
          <AppointmentsView
            patientName={patientName}
            userPhone={userPhone}
            onNewBooking={() => chatHandoff('I want to book a new appointment. Which doctors are available and when?')}
            onReschedule={(appt) => chatHandoff(`I want to reschedule my appointment ${appt.id} with ${appt.doctor} on ${appt.date}.`)}
          />
        )
      case 'Doctors':
        return <DoctorsView onBook={(docName) => chatHandoff(`I want to book an appointment with ${docName}`)} />
      case 'History':
        return <HistoryView />
      case 'Profile':
        return <ProfileView user={user} />
      case 'Settings':
        return <SettingsView sessionInfo={{ language: 'en' }} />
      default:
        return <HomeView dashboardData={dashboardData} setActiveTab={setActiveTab} />
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
