import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile,
} from 'firebase/auth'
import { useState } from 'react'
import { auth } from '../firebase'
import Button from './ui/Button'
import DnaHelix from './ui/DnaHelix'
import LanguagePills from './ui/LanguagePills'

// deterministic particle field behind the hero orb
const PARTICLES = Array.from({ length: 10 }, (_, i) => ({
  left: `${8 + ((i * 83) % 84)}%`,
  top: `${10 + ((i * 47) % 78)}%`,
  size: 3 + (i % 3) * 2,
  delay: `${-(i * 1.3)}s`,
}))

export default function Login() {
  const [isRegister, setIsRegister] = useState(false)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [errorKey, setErrorKey] = useState(0)   // re-triggers the shake
  const [loading, setLoading] = useState(false)
  const [lang, setLang] = useState(() => localStorage.getItem('preferredLang') || 'en')

  const chooseLang = (code) => {
    setLang(code)
    localStorage.setItem('preferredLang', code)
  }

  const fail = (msg) => {
    setError(msg)
    setErrorKey((k) => k + 1)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      if (isRegister) {
        if (!name.trim()) throw new Error('Please enter your name.')
        if (!phone.trim()) throw new Error('Phone number is required for reminder calls.')
        if (!email.trim()) throw new Error('Email address is required.')
        if (!password.trim()) throw new Error('Password is required.')

        const userCred = await createUserWithEmailAndPassword(auth, email, password)
        await updateProfile(userCred.user, { displayName: name })
        localStorage.setItem(`phone_${userCred.user.uid}`, phone)
      } else {
        if (!email.trim()) throw new Error('Email is required.')
        if (!password.trim()) throw new Error('Password is required.')
        await signInWithEmailAndPassword(auth, email, password)
      }
    } catch (err) {
      fail(err.message || 'Authentication failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-page-container">
      {/* ── Hero: the assistant is already awake ── */}
      <div className="auth-hero-section">
        {PARTICLES.map((p, i) => (
          <span
            key={i}
            className="auth-particle"
            style={{ left: p.left, top: p.top, width: p.size, height: p.size, animationDelay: p.delay }}
            aria-hidden="true"
          />
        ))}
        <div className="auth-hero-content">
          <div className="auth-logo">🫀 SwasthyaAI</div>

          <div className="auth-hero-orb">
            <DnaHelix state="idle" size={150} label="SwasthyaAI assistant, ready" />
          </div>

          <h1 className="auth-hero-title">Talk to your healthcare&nbsp;companion</h1>
          <p className="auth-hero-subtitle">
            Book appointments, check availability and get voice reminders —
            in English, Hindi or Tamil. Just speak.
          </p>
          <div className="auth-features">
            <div className="auth-feature-item">
              <span className="auth-feature-icon">🎧</span>
              <div>
                <h4>Live voice conversations</h4>
                <p>Real-time speech with interruptions, like talking to a person.</p>
              </div>
            </div>
            <div className="auth-feature-item">
              <span className="auth-feature-icon">📅</span>
              <div>
                <h4>Smart scheduling</h4>
                <p>Conflict-free bookings within each doctor's real hours.</p>
              </div>
            </div>
            <div className="auth-feature-item">
              <span className="auth-feature-icon">🔔</span>
              <div>
                <h4>Reminder calls</h4>
                <p>The assistant phones you before your appointment.</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Form: glass card ── */}
      <div className="auth-form-section">
        <div className="auth-form-container fade-in">
          <div className="auth-lang-row">
            <LanguagePills value={lang} onChange={chooseLang} />
          </div>

          <div className="auth-form-header">
            <h2>{isRegister ? 'Create an account' : 'Welcome back'}</h2>
            <p>{isRegister ? 'Sign up to meet your assistant.' : 'Sign in to continue the conversation.'}</p>
          </div>

          {error && (
            <div key={errorKey} className="auth-error-message" role="alert">
              <span aria-hidden="true">⚠️</span>
              <span>{error}</span>
            </div>
          )}

          <form className="auth-form" onSubmit={handleSubmit}>
            {isRegister && (
              <div className="auth-input-group-row">
                <div className="auth-input-group">
                  <label htmlFor="auth-name">Full Name</label>
                  <input
                    id="auth-name"
                    type="text"
                    className="auth-input"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="John Doe"
                    disabled={loading}
                  />
                </div>
                <div className="auth-input-group">
                  <label htmlFor="auth-phone">Phone <span>(for reminders)</span></label>
                  <input
                    id="auth-phone"
                    type="tel"
                    className="auth-input"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+91 98765 43210"
                    disabled={loading}
                  />
                </div>
              </div>
            )}

            <div className="auth-input-group">
              <label htmlFor="auth-email">Email Address</label>
              <input
                id="auth-email"
                type="email"
                className="auth-input"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                disabled={loading}
              />
            </div>

            <div className="auth-input-group">
              <label htmlFor="auth-password">Password</label>
              <input
                id="auth-password"
                type="password"
                className="auth-input"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                disabled={loading}
              />
            </div>

            <Button type="submit" variant="primary" size="lg" loading={loading} style={{ width: '100%', marginTop: 8 }}>
              {isRegister ? 'Sign Up' : 'Sign In'}
            </Button>
          </form>

          <p className="auth-toggle-text">
            {isRegister ? 'Already have an account? ' : "Don't have an account? "}
            <button
              type="button"
              className="auth-toggle-btn"
              onClick={() => { setIsRegister(!isRegister); setError('') }}
            >
              {isRegister ? 'Sign In' : 'Create one'}
            </button>
          </p>
        </div>
      </div>
    </div>
  )
}
