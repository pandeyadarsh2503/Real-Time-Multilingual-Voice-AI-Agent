import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  updateProfile,
} from 'firebase/auth'
import { useEffect, useState } from 'react'
import { auth } from '../firebase'
import { t } from '../i18n'
import Button from './ui/Button'
import DnaHelix from './ui/DnaHelix'
import LanguagePills from './ui/LanguagePills'

// ── tiny inline icons (stroke follows currentColor) ────────
const I = {
  mail: (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="2.5" y="5" width="19" height="14" rx="2.5"/><path d="m3 7 9 6 9-6"/></svg>
  ),
  lock: (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="4.5" y="10.5" width="15" height="10" rx="2.5"/><path d="M8 10.5V7a4 4 0 0 1 8 0v3.5"/></svg>
  ),
  eye: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3.5-6.5 10-6.5S22 12 22 12s-3.5 6.5-10 6.5S2 12 2 12Z"/><circle cx="12" cy="12" r="2.8"/></svg>
  ),
  eyeOff: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3l18 18"/><path d="M10.7 5.1A10.9 10.9 0 0 1 12 5c6.5 0 10 7 10 7a17.4 17.4 0 0 1-3.2 4M6.6 6.6C3.8 8.4 2 12 2 12s3.5 7 10 7a10.7 10.7 0 0 0 4.4-.9"/><path d="M9.9 9.9a2.8 2.8 0 0 0 4 4"/></svg>
  ),
  google: (
    <svg width="18" height="18" viewBox="0 0 48 48"><path fill="#FFC107" d="M43.6 20.1H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3l5.7-5.7C34.3 6.1 29.4 4 24 4 13 4 4 13 4 24s9 20 20 20 20-9 20-20c0-1.3-.1-2.6-.4-3.9z"/><path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.9 1.2 8 3l5.7-5.7C34.3 6.1 29.4 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.1H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C36.9 39.2 44 34 44 24c0-1.3-.1-2.6-.4-3.9z"/></svg>
  ),
}

// scattered sparkles around the helix scene (deterministic)
const SPARKS = [
  { ch: '+', left: '12%', top: '18%', size: 13, delay: '0s' },
  { ch: '✦', left: '84%', top: '12%', size: 10, delay: '-1.2s' },
  { ch: '·', left: '90%', top: '55%', size: 20, delay: '-2.1s' },
  { ch: '+', left: '78%', top: '78%', size: 11, delay: '-0.6s' },
  { ch: '·', left: '6%',  top: '66%', size: 18, delay: '-1.7s' },
  { ch: '✦', left: '22%', top: '84%', size: 9,  delay: '-2.6s' },
  { ch: '·', left: '48%', top: '6%',  size: 16, delay: '-0.9s' },
]

export default function Login() {
  const [isRegister, setIsRegister] = useState(false)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [errorKey, setErrorKey] = useState(0)   // re-triggers the shake
  const [loading, setLoading] = useState(false)
  const [lang, setLang] = useState(() => localStorage.getItem('preferredLang') || 'en')

  // Helix scales with viewport height so the scene never overflows 768.
  const sceneSize = () => Math.min(230, Math.round((window.innerHeight * 0.3) / 1.5))
  const [dnaSize, setDnaSize] = useState(sceneSize)
  useEffect(() => {
    const onResize = () => setDnaSize(sceneSize())
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

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

  const handleGoogle = async () => {
    setError('')
    setLoading(true)
    try {
      await signInWithPopup(auth, new GoogleAuthProvider())
    } catch (err) {
      if (err.code === 'auth/operation-not-allowed') {
        fail('Google sign-in is not enabled yet — enable the Google provider in the Firebase console (Authentication → Sign-in method).')
      } else if (err.code !== 'auth/popup-closed-by-user' && err.code !== 'auth/cancelled-popup-request') {
        fail(err.message || 'Google sign-in failed.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-page-container">
      {/* ── Hero ── */}
      <div className="auth-hero-section">
        <div className="auth-hero-content">
          <div className="auth-logo">🫀 SwasthyaAI</div>

          {/* animated helix over a travelling ECG */}
          <div className="auth-scene">
            <svg className="auth-scene-ecg" viewBox="0 0 600 80" preserveAspectRatio="none" aria-hidden="true">
              <path className="auth-scene-ecg__base" d="M0 40 H105 l12 0 l9 -20 l10 38 l9 -26 l6 8 H460 l12 0 l9 -20 l10 38 l9 -26 l6 8 H600" />
              <path className="auth-scene-ecg__pulse" d="M0 40 H105 l12 0 l9 -20 l10 38 l9 -26 l6 8 H460 l12 0 l9 -20 l10 38 l9 -26 l6 8 H600" />
            </svg>
            {SPARKS.map((s, i) => (
              <span key={i} className="auth-spark" style={{ left: s.left, top: s.top, fontSize: s.size, animationDelay: s.delay }} aria-hidden="true">{s.ch}</span>
            ))}
            <DnaHelix state="idle" size={dnaSize} label="SwasthyaAI assistant, ready" />
          </div>

          <div className="auth-badge">
            <span className="hl">{t(lang, 'login.badge.hl')}</span>{t(lang, 'login.badge.rest')}
          </div>

          <h1 className="auth-hero-title">{t(lang, 'login.title.pre')}<span className="hl">{t(lang, 'login.title.accent')}</span>{t(lang, 'login.title.post')}</h1>
          <p className="auth-hero-subtitle">{t(lang, 'login.subtitle')}</p>

          <div className="auth-features">
            <div className="auth-feature-item">
              <span className="auth-feature-icon">🎤</span>
              <div>
                <h4>{t(lang, 'login.f1.title')}</h4>
                <p>{t(lang, 'login.f1.desc')}</p>
              </div>
            </div>
            <div className="auth-feature-item">
              <span className="auth-feature-icon">📅</span>
              <div>
                <h4>{t(lang, 'login.f2.title')}</h4>
                <p>{t(lang, 'login.f2.desc')}</p>
              </div>
            </div>
            <div className="auth-feature-item">
              <span className="auth-feature-icon">🔔</span>
              <div>
                <h4>{t(lang, 'login.f3.title')}</h4>
                <p>{t(lang, 'login.f3.desc')}</p>
              </div>
            </div>
            <div className="auth-feature-item">
              <span className="auth-feature-icon">🌐</span>
              <div>
                <h4>{t(lang, 'login.f4.title')}</h4>
                <p>{t(lang, 'login.f4.desc')}</p>
              </div>
            </div>
          </div>

          <div className="auth-trust">
            <span>{t(lang, 'login.trust1')}</span>
            <span>{t(lang, 'login.trust2')}</span>
            <span>{t(lang, 'login.trust3')}</span>
          </div>
        </div>
      </div>

      {/* ── Form ── */}
      <div className="auth-form-section">
        <div className="auth-form-container fade-in">
          <div className="auth-lang-row">
            <LanguagePills value={lang} onChange={chooseLang} />
          </div>

          <div className="auth-form-header">
            <h2>{isRegister ? t(lang, 'login.create') : t(lang, 'login.welcome')}</h2>
            <p>{isRegister ? t(lang, 'login.createSub') : t(lang, 'login.welcomeSub')}</p>
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
                  <label htmlFor="auth-name">{t(lang, 'login.fullName')}</label>
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
                  <label htmlFor="auth-phone">{t(lang, 'login.phone')} <span>{t(lang, 'login.phoneNote')}</span></label>
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
              <label htmlFor="auth-email">{t(lang, 'login.email')}</label>
              <div className="auth-input-wrap">
                <span className="auth-input-icon">{I.mail}</span>
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
            </div>

            <div className="auth-input-group">
              <label htmlFor="auth-password">{t(lang, 'login.password')}</label>
              <div className="auth-input-wrap">
                <span className="auth-input-icon">{I.lock}</span>
                <input
                  id="auth-password"
                  type={showPassword ? 'text' : 'password'}
                  className="auth-input"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  disabled={loading}
                />
                <button
                  type="button"
                  className="auth-eye"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? I.eyeOff : I.eye}
                </button>
              </div>
            </div>

            <Button type="submit" variant="primary" size="lg" loading={loading} style={{ width: '100%', marginTop: 4 }}>
              {isRegister ? t(lang, 'login.signUp') : t(lang, 'login.signIn')} <span className="btn-arrow" aria-hidden="true">→</span>
            </Button>
          </form>

          <div className="auth-divider">{t(lang, 'login.orContinue')}</div>

          <Button variant="glass" size="md" onClick={handleGoogle} disabled={loading} style={{ width: '100%' }}>
            {I.google}&nbsp; {t(lang, 'login.google')}
          </Button>

          <p className="auth-toggle-text">
            {isRegister ? t(lang, 'login.haveAccount') : t(lang, 'login.noAccount')}
            <button
              type="button"
              className="auth-toggle-btn"
              onClick={() => { setIsRegister(!isRegister); setError('') }}
            >
              {isRegister ? t(lang, 'login.signIn') : t(lang, 'login.createOne')}
            </button>
          </p>
        </div>
      </div>
    </div>
  )
}
