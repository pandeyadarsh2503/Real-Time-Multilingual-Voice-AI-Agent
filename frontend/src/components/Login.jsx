import { useState } from 'react'
import { auth } from '../firebase'
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile
} from 'firebase/auth'

export default function Login() {
  const [isRegister, setIsRegister] = useState(false)
  const [name, setName]             = useState('')
  const [phone, setPhone]           = useState('')
  const [email, setEmail]           = useState('')
  const [password, setPassword]     = useState('')
  const [error, setError]           = useState('')
  const [loading, setLoading]       = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      if (isRegister) {
        if (!name.trim()) throw new Error("Please enter your name.");
        if (!phone.trim()) throw new Error("Phone number is required for outbound call features.");
        if (!email.trim()) throw new Error("Email address is required.");
        if (!password.trim()) throw new Error("Password is required.");
        
        const userCred = await createUserWithEmailAndPassword(auth, email, password)
        await updateProfile(userCred.user, { displayName: name })
        localStorage.setItem(`phone_${userCred.user.uid}`, phone)
      } else {
        if (!email.trim()) throw new Error("Email is required.");
        if (!password.trim()) throw new Error("Password is required.");
        await signInWithEmailAndPassword(auth, email, password)
      }
    } catch (err) {
      setError(err.message || 'Authentication failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-page-container">
      <div className="auth-hero-section">
        <div className="auth-hero-content">
          <div className="auth-logo">🏥 SwasthyaAI</div>
          <h1 className="auth-hero-title">Your AI Healthcare Companion</h1>
          <p className="auth-hero-subtitle">
            Seamlessly manage your appointments, get AI-powered reminders, and take control of your health with intelligent voice assistance.
          </p>
          <div className="auth-features">
            <div className="auth-feature-item">
              <span className="auth-feature-icon">🎙️</span>
              <div>
                <h4>Voice Enabled</h4>
                <p>Interact naturally in multiple languages.</p>
              </div>
            </div>
            <div className="auth-feature-item">
              <span className="auth-feature-icon">📅</span>
              <div>
                <h4>Smart Scheduling</h4>
                <p>Book and manage appointments effortlessly.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <div className="auth-form-section">
        <div className="auth-form-container fade-in">
          <div className="auth-form-header">
            <h2>{isRegister ? 'Create an Account' : 'Welcome Back'}</h2>
            <p>{isRegister ? 'Sign up to get started with SwasthyaAI.' : 'Please enter your details to sign in.'}</p>
          </div>

          {error && (
            <div className="auth-error-message">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
              <span>{error}</span>
            </div>
          )}

          <form className="auth-form" onSubmit={handleSubmit}>
            {isRegister && (
              <div className="auth-input-group-row">
                <div className="auth-input-group">
                  <label>Full Name</label>
                  <input 
                    type="text" 
                    className="auth-input" 
                    required
                    value={name} onChange={e => setName(e.target.value)}
                    placeholder="John Doe"
                  />
                </div>
                <div className="auth-input-group">
                  <label>Phone Number <span>(For Reminders)</span></label>
                  <input 
                    type="tel" 
                    className="auth-input" 
                    required
                    value={phone} onChange={e => setPhone(e.target.value)}
                    placeholder="+91 98765 43210"
                  />
                </div>
              </div>
            )}

            <div className="auth-input-group">
              <label>Email Address</label>
              <input 
                type="email" 
                className="auth-input" 
                required
                value={email} onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
              />
            </div>

            <div className="auth-input-group">
              <label>Password</label>
              <input 
                type="password" 
                className="auth-input" 
                required
                value={password} onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
              />
            </div>

            <button type="submit" className="auth-submit-btn" disabled={loading}>
              {loading ? (
                 <span className="auth-spinner"></span>
              ) : (isRegister ? 'Sign Up' : 'Sign In')}
            </button>
          </form>

          <p className="auth-toggle-text">
            {isRegister ? "Already have an account? " : "Don't have an account? "}
            <button 
              type="button"
              className="auth-toggle-btn"
              onClick={() => { setIsRegister(!isRegister); setError(''); }}
            >
              {isRegister ? "Sign In" : "Create one"}
            </button>
          </p>
        </div>
      </div>
    </div>
  )
}
