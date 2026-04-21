import { useEffect, useState } from 'react'
import { appointmentsAPI } from '../services/api'

function formatDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function AppointmentCard({ onAction }) {
  const [appointments, setAppointments] = useState([])

  const load = async () => {
    try {
      const res = await appointmentsAPI.upcoming(1) // Just grab the very next one for the hero card
      setAppointments(res.data)
    } catch { /* silently ignore */ }
  }

  useEffect(() => {
    load()
    const id = setInterval(load, 15_000)
    return () => clearInterval(id)
  }, [])

  return (
    <div className="widget-card" style={{ padding: 20 }}>
      <div className="widget-header">
        <span style={{color: 'var(--accent-blue)', fontSize: '18px'}}>📅</span> Upcoming Appointment
      </div>
      
      {appointments.length === 0 ? (
        <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, padding: '20px 0' }}>
          No upcoming appointments
        </div>
      ) : (
        appointments.map((appt) => (
          <div key={appt.id} >
            <div className="upcoming-doc">
              <div>
                <h3>{appt.doctor}</h3>
                <span>General Physician</span>
              </div>
              <span className="badge-confirmed">Confirmed</span>
            </div>
            <div className="upcoming-detail">
              <span>📅</span> {formatDate(appt.date)}
            </div>
            <div className="upcoming-detail">
              <span>⏱️</span> {appt.time}
            </div>
            <div className="upcoming-detail">
              <span>📍</span> CityCare Clinic, Room 2
            </div>
            <button className="upcoming-btn">View Details</button>
          </div>
        ))
      )}
    </div>
  )
}
