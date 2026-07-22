import { Component } from 'react'
import { t } from '../i18n'

/**
 * Catches render-phase exceptions so a single component bug degrades to a
 * recoverable panel instead of a blank white screen for the whole SPA.
 * Class component because only class components can be error boundaries.
 */
export default class ErrorBoundary extends Component {
  state = { hasError: false }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error, info) {
    console.error('ErrorBoundary caught:', error, info)
  }

  render() {
    if (!this.state.hasError) return this.props.children

    const lang = localStorage.getItem('preferredLang') || 'en'
    if (this.props.compact) {
      return (
        <div style={{ padding: '32px', textAlign: 'center', color: '#64748b' }}>
          <p style={{ marginBottom: 12 }}>{t(lang, 'err.body')}</p>
          <button onClick={() => this.setState({ hasError: false })}
                  style={_btn}>{t(lang, 'state.retry')}</button>
        </div>
      )
    }
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column',
                    alignItems: 'center', justifyContent: 'center', gap: 14, padding: 24,
                    textAlign: 'center', color: '#1e293b' }}>
        <div style={{ fontSize: 40 }}>⚠️</div>
        <h1 style={{ fontSize: 20, margin: 0 }}>{t(lang, 'err.title')}</h1>
        <p style={{ color: '#64748b', maxWidth: 420, margin: 0 }}>{t(lang, 'err.body')}</p>
        <button onClick={() => window.location.reload()} style={_btn}>{t(lang, 'err.reload')}</button>
      </div>
    )
  }
}

const _btn = {
  background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8,
  padding: '10px 20px', fontSize: 14, fontWeight: 600, cursor: 'pointer',
}
