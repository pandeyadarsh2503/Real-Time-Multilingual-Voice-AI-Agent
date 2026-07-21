import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { useChat } from '../../context/ChatContext';
import { t } from '../../i18n';
import { doctorsAPI } from '../../services/api';

export default function DoctorsView({ onBook }) {
  const { language } = useChat();
  const [doctors, setDoctors] = useState([]);
  const [search, setSearch] = useState('');

  useEffect(() => {
    const fetchDocs = async () => {
      try {
        const res = await doctorsAPI.list();
        setDoctors(res.data);
      } catch (err) {
        console.error('Failed to load doctors', err);
        toast.error('Could not load the doctor directory.');
      }
    };
    fetchDocs();
  }, []);

  const filtered = doctors.filter((d) =>
    `${d.name} ${d.specialty}`.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="view-container fade-in">
      <header className="top-header" style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: '20px' }}>
        <div className="header-titles">
          <h1>{t(language, 'view.doctors.title')}</h1>
          <p>{t(language, 'view.doctors.sub')}</p>
        </div>
        <div className="search-bar">
          <input
            type="text"
            placeholder="Search by name, specialty..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', width: '300px' }}
          />
        </div>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px', marginTop: '30px' }}>
        {filtered.map((doc) => (
          <div key={doc.name} className="doctor-profile-card dashboard-card" style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ fontSize: '3rem' }}>{doc.icon}</div>
              <span style={{ background: '#eff6ff', color: '#1d4ed8', padding: '4px 8px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 600 }}>
                {doc.experience}
              </span>
            </div>

            <div>
              <h3 style={{ margin: 0 }}>{doc.name}</h3>
              <div style={{ color: '#64748b', fontSize: '0.9rem' }}>{doc.specialty}</div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.85rem', color: '#475569' }}>
              <div>🕒 Consults {doc.availability}</div>
              <div>🗣️ {(doc.languages || []).join(', ')}</div>
            </div>

            <button
              style={{ width: '100%', padding: '10px', borderRadius: '8px', border: 'none', background: '#3b82f6', color: 'white', fontWeight: 600, cursor: 'pointer' }}
              onClick={() => onBook?.(doc.name)}
            >
              Book Appointment
            </button>
          </div>
        ))}
        {filtered.length === 0 && doctors.length > 0 && (
          <div style={{ color: '#64748b', padding: '20px' }}>No doctors match “{search}”.</div>
        )}
      </div>
    </div>
  );
}
