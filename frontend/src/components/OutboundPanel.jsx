import { useState } from 'react'
import { outboundAPI } from '../services/api'

export default function OutboundPanel({ appointments = [], onSimulatedReminder }) {
  const [loading, setLoading]         = useState(false)
  const [reminder, setReminder]       = useState(null)
  const [selected, setSelected]       = useState('')
  const [responseMsg, setResponseMsg] = useState('')

  const handleSimulate = async () => {
    if (!selected) return
    setLoading(true)
    setResponseMsg('')
    try {
      const res = await outboundAPI.simulate(selected)
      setReminder(res.data)
      onSimulatedReminder?.(res.data.message)
    } catch (err) {
      setResponseMsg('Failed to simulate. Is the appointment ID correct?')
    } finally {
      setLoading(false)
    }
  }

  const handleReminderAction = (action) => {
    const msgs = {
      confirm:    '✅ Appointment confirmed!',
      reschedule: '🔄 Initiating reschedule flow — please use the chat.',
      cancel:     '✕ Appointment cancelled.',
    }
    setResponseMsg(msgs[action] || '')
    setReminder(null)
  }

  return (
    <div className="glass-card" style={{ padding: 16 }}>
      <div className="section-label">📞 Outbound Reminder</div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
        <input
          style={{
            flex: 1,
            padding: '7px 10px',
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-sm)',
            color: 'var(--text-1)',
            fontSize: 13,
            outline: 'none',
            fontFamily: 'var(--font-sans)',
          }}
          placeholder="Appointment ID…"
          value={selected}
          onChange={(e) => setSelected(e.target.value.toUpperCase())}
        />
        <button
          className="outbound-btn"
          style={{ width: 'auto', padding: '7px 14px', fontSize: 12 }}
          onClick={handleSimulate}
          disabled={!selected || loading}
        >
          {loading ? '⏳' : '📨'} Simulate
        </button>
      </div>

      {reminder && (
        <div className="outbound-reminder">
          <p style={{ marginBottom: 8, fontSize: 12, color: 'var(--text-2)' }}>
            📳 Outbound message:
          </p>
          <p>"{reminder.message}"</p>
          <div className="reminder-actions">
            <button className="reminder-btn confirm"    onClick={() => handleReminderAction('confirm')}>✓ Confirm</button>
            <button className="reminder-btn reschedule" onClick={() => handleReminderAction('reschedule')}>🔄 Reschedule</button>
            <button className="reminder-btn cancel"     onClick={() => handleReminderAction('cancel')}>✕ Cancel</button>
          </div>
        </div>
      )}

      {responseMsg && (
        <p style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 8, textAlign: 'center' }}>
          {responseMsg}
        </p>
      )}

      <p style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 8, textAlign: 'center' }}>
        Live calls via Exotel — configure in backend .env
      </p>
    </div>
  )
}
