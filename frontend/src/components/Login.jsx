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
        // Store phone number locally for demo simulation (or push to backend DB)
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
    <div style={{
      width: '100%', height: '100vh',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--bg-body)'
    }}>
      <form className="widget-card" style={{ width: '400px', display: 'flex', flexDirection: 'column', gap: '16px' }} onSubmit={handleSubmit}>
        <div style={{ textAlign: 'center', marginBottom: '8px' }}>
          <div style={{ fontSize: '32px', marginBottom: '8px' }}>🏥</div>
          <h2 style={{ fontSize: '24px', fontWeight: '700' }}>SwasthyaAI</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Your AI Healthcare Companion</p>
        </div>

        {error && (
          <div style={{ background: '#fef2f2', color: '#b91c1c', padding: '12px', borderRadius: '8px', fontSize: '13px' }}>
            {error}
          </div>
        )}

        {isRegister && (
          <>
            <div>
              <label style={{ display: 'block', marginBottom: '4px', fontSize: '13px', fontWeight: '600' }}>Full Name *</label>
              <input 
                type="text" 
                className="input-field" 
                required
                style={{ width: '100%', border: '1px solid var(--border)', borderRadius: '8px', padding: '10px 14px' }}
                value={name} onChange={e => setName(e.target.value)}
                placeholder="John Doe"
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '4px', fontSize: '13px', fontWeight: '600' }}>Phone Number * <span style={{color:'#6b7280', fontWeight: 'normal'}}>(Required for Reminders)</span></label>
              <input 
                type="tel" 
                className="input-field" 
                required
                style={{ width: '100%', border: '1px solid var(--border)', borderRadius: '8px', padding: '10px 14px' }}
                value={phone} onChange={e => setPhone(e.target.value)}
                placeholder="+91 98765 43210"
              />
            </div>
          </>
        )}

        <div>
          <label style={{ display: 'block', marginBottom: '4px', fontSize: '13px', fontWeight: '600' }}>Email Address *</label>
          <input 
            type="email" 
            className="input-field" 
            required
            style={{ width: '100%', border: '1px solid var(--border)', borderRadius: '8px', padding: '10px 14px' }}
            value={email} onChange={e => setEmail(e.target.value)}
            placeholder="you@example.com"
          />
        </div>

        <div>
          <label style={{ display: 'block', marginBottom: '4px', fontSize: '13px', fontWeight: '600' }}>Password *</label>
          <input 
            type="password" 
            className="input-field" 
            required
            style={{ width: '100%', border: '1px solid var(--border)', borderRadius: '8px', padding: '10px 14px' }}
            value={password} onChange={e => setPassword(e.target.value)}
            placeholder="••••••••"
          />
        </div>

        <button type="submit" className="upcoming-btn" disabled={loading} style={{ marginTop: '8px' }}>
          {loading ? 'Please wait...' : (isRegister ? 'Sign Up' : 'Sign In')}
        </button>

        <p style={{ textAlign: 'center', fontSize: '13px', color: 'var(--text-muted)', marginTop: '8px' }}>
          {isRegister ? "Already have an account? " : "Don't have an account? "}
          <span 
            style={{ color: 'var(--accent-blue)', cursor: 'pointer', fontWeight: '600' }}
            onClick={() => { setIsRegister(!isRegister); setError(''); }}
          >
            {isRegister ? "Sign In" : "Sign Up"}
          </span>
        </p>
      </form>
    </div>
  )
}
