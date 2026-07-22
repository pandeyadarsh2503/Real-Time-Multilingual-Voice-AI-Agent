import { onAuthStateChanged, signOut } from 'firebase/auth'
import { Suspense, lazy, useCallback, useEffect, useState } from 'react'
import toast, { Toaster } from 'react-hot-toast'
import { auth } from './firebase'
import { t } from './i18n'
import { appointmentsAPI, doctorsAPI } from './services/api'

import { ChatProvider, useChat } from './context/ChatContext'

import ErrorBoundary from './components/ErrorBoundary'
import LeftSidebar from './components/LeftSidebar'
import Login from './components/Login'
import SplashScreen from './components/SplashScreen'
import HomeView from './components/views/HomeView'

// Secondary views are code-split so the initial bundle is just the splash,
// login, and Home — the rest load on demand when their tab is opened.
const AppointmentsView = lazy(() => import('./components/views/AppointmentsView'))
const DoctorsView = lazy(() => import('./components/views/DoctorsView'))
const HealthSummaryView = lazy(() => import('./components/views/HealthSummaryView'))
const HistoryView = lazy(() => import('./components/views/HistoryView'))
const ProfileView = lazy(() => import('./components/views/ProfileView'))
const SettingsView = lazy(() => import('./components/views/SettingsView'))

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
    return <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center' }}>{t(langNow(), 'app.loading')}</div>
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

const langNow = () => localStorage.getItem('preferredLang') || 'en'

function AuthedApp({ user, userPhone }) {
  const { sendChatMessage, patientName, language } = useChat()
  const [activeTab, setActiveTab] = useState('Home')
  const [dashboardData, setDashboardData] = useState({
    upcomingAppointment: null,
    recentDoctors: [],
    quickActions: [
      { id: 'book', icon: '📅', titleKey: 'qa.book', bgColor: '#f0f9ff', iconColor: '#3b82f6', promptKey: 'qa.book.prompt' },
      { id: 'check', icon: '🗓️', titleKey: 'qa.check', bgColor: '#f0fdf4', iconColor: '#10b981', promptKey: 'qa.check.prompt' },
      { id: 'reschedule', icon: '🔄', titleKey: 'qa.reschedule', bgColor: '#fff7ed', iconColor: '#f59e0b', promptKey: 'qa.reschedule.prompt' },
      { id: 'cancel', icon: '❌', titleKey: 'qa.cancel', bgColor: '#fef2f2', iconColor: '#ef4444', promptKey: 'qa.cancel.prompt' },
    ],
  })

  // The doctor directory is immutable config — fetch it once, not on a timer.
  useEffect(() => {
    let cancelled = false
    doctorsAPI.list()
      .then((res) => {
        if (cancelled) return
        const docs = res.data.map((d) => ({
          id: d.name, name: d.name, specialty: d.specialty, icon: d.icon,
        }))
        setDashboardData((prev) => ({ ...prev, recentDoctors: docs }))
      })
      .catch((err) => console.error('Failed to load doctors:', err))
    return () => { cancelled = true }
  }, [])

  // Upcoming appointment changes rarely — poll it, but far less aggressively
  // than before (was every 15s, hammering an authenticated endpoint).
  useEffect(() => {
    let failedOnce = false
    const fetchUpcoming = async () => {
      try {
        const upcomingRes = await appointmentsAPI.upcoming(1)
        const apt = upcomingRes.data?.[0]
        const upcomingAppointment = apt ? {
          id: apt.id,
          doctorName: apt.doctor,
          status: apt.status,   // localized in the view via status.* keys
          date: apt.date,
          time: apt.time,
        } : null
        setDashboardData((prev) => ({ ...prev, upcomingAppointment }))
        failedOnce = false
      } catch (err) {
        console.error('Failed to load upcoming appointment:', err)
        if (!failedOnce) {
          failedOnce = true
          toast.error(t(langNow(), 'toast.serverUnreachable'))
        }
      }
    }
    fetchUpcoming()
    const intervalId = setInterval(fetchUpcoming, 60000)
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
            onNewBooking={() => chatHandoff(t(language, 'prompt.newBooking'))}
            onReschedule={(appt) => chatHandoff(t(language, 'prompt.reschedule', { id: appt.id, doctor: appt.doctor, date: appt.date }))}
          />
        )
      case 'Doctors':
        return <DoctorsView onBook={(docName) => chatHandoff(t(language, 'prompt.bookWith', { doctor: docName }))} />
      case 'History':
        return <HistoryView />
      case 'Health':
        return <HealthSummaryView onTalk={() => setActiveTab('Home')} />
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
        {/* A broken view degrades to a panel, not a white screen; key resets
            the boundary when the user switches tabs. */}
        <ErrorBoundary compact key={activeTab}>
          <Suspense fallback={<div style={{ padding: 32, color: '#64748b' }}>{t(language, 'app.loading')}</div>}>
            {renderActiveView()}
          </Suspense>
        </ErrorBoundary>
      </main>
    </div>
  )
}
