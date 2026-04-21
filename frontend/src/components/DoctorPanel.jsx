import { useEffect, useState } from 'react'

const DOCTORS = [
  { key: 'sharma', name: 'Dr. Sharma', spec: 'Cardiologist',      icon: '👨‍⚕️' },
  { key: 'iyer',   name: 'Dr. Iyer',   spec: 'General Physician', icon: '👨‍⚕️' },
  { key: 'mehta',  name: 'Dr. Mehta',  spec: 'Dermatologist',     icon: '👩‍⚕️' },
]

export default function DoctorPanel({ onDoctorSelect }) {
  // We no longer necessarily poll for real-time slots inside the thumbnail
  // to match the exact "Recent Doctors" aesthetic in the image.

  return (
    <div className="widget-card" style={{ padding: 20 }}>
      <div className="widget-header">Recent Doctors</div>
      <div className="doc-list">
        {DOCTORS.map((doc) => (
          <div
            key={doc.key}
            className="doc-list-item"
            onClick={() => onDoctorSelect?.(doc.name)}
            title={`Select ${doc.name}`}
          >
            <div style={{
              width: 40, height: 40, borderRadius: '50%', background: '#eff6ff', 
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20
            }}>
              {doc.icon}
            </div>
            <div className="doc-list-info">
              <h4>{doc.name}</h4>
              <p>{doc.spec}</p>
            </div>
            <div className="doc-list-arrow">›</div>
          </div>
        ))}
      </div>
    </div>
  )
}
