import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { useChat } from '../../context/ChatContext';
import { t } from '../../i18n';
import { appointmentsAPI } from '../../services/api';

/**
 * Health Summary — a real snapshot computed from the user's own
 * appointment history. No invented vitals, no fake analytics.
 */
export default function HealthSummaryView({ onTalk }) {
  const { language } = useChat();
  const [appointments, setAppointments] = useState(null);
  const [upcoming, setUpcoming] = useState([]);

  useEffect(() => {
    const load = async () => {
      try {
        const [allRes, upRes] = await Promise.all([
          appointmentsAPI.list(),
          appointmentsAPI.upcoming(10),
        ]);
        setAppointments(allRes.data);
        setUpcoming(upRes.data);
      } catch (err) {
        console.error('Failed to load health summary', err);
        toast.error('Could not load your health summary.');
        setAppointments([]);
      }
    };
    load();
  }, []);

  const all = appointments || [];
  const cancelled = all.filter((a) => a.status === 'cancelled').length;
  const completedOrActive = all.length - cancelled;
  const counts = {};
  all.forEach((a) => { counts[a.doctor] = (counts[a.doctor] || 0) + 1; });
  const favourite = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  const next = upcoming[0];

  const stat = (label, value, color, bg) => (
    <div className="dashboard-card" style={{ textAlign: 'center', background: bg || 'white' }}>
      <div style={{ fontSize: '2rem', fontWeight: 'bold', color }}>{value}</div>
      <div style={{ fontSize: '0.85rem', color: '#64748b', marginTop: '6px' }}>{label}</div>
    </div>
  );

  return (
    <div className="view-container fade-in">
      <header className="top-header" style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: '20px' }}>
        <div className="header-titles">
          <h1>{t(language, 'view.health.title')}</h1>
          <p>{t(language, 'view.health.sub')}</p>
        </div>
      </header>

      {appointments === null ? (
        <div style={{ color: '#64748b', padding: '30px 10px' }}>Loading your summary…</div>
      ) : all.length === 0 ? (
        <div className="dashboard-card" style={{ marginTop: '20px', textAlign: 'center', padding: '48px 24px' }}>
          <div style={{ fontSize: '44px' }}>🩺</div>
          <h3 style={{ margin: '12px 0 6px' }}>No health activity yet</h3>
          <p style={{ color: '#64748b', fontSize: '0.9rem', marginBottom: '18px' }}>
            Book your first appointment and your summary will build itself.
          </p>
          <button
            onClick={onTalk}
            style={{ padding: '10px 22px', borderRadius: '8px', border: 'none', background: '#3b82f6', color: 'white', fontWeight: 600, cursor: 'pointer' }}
          >
            🎧 Talk to the Assistant
          </button>
        </div>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', marginTop: '20px' }}>
            {stat('Total appointments', all.length, '#2563eb')}
            {stat('Upcoming', upcoming.length, '#16a34a')}
            {stat('Attended / active', completedOrActive, '#0891b2')}
            {stat('Cancelled', cancelled, '#ef4444')}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginTop: '16px' }}>
            <div className="dashboard-card">
              <h3 style={{ marginBottom: '12px' }}>Next appointment</h3>
              {next ? (
                <div style={{ fontSize: '0.95rem', color: '#334155', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div><strong>{next.doctor}</strong></div>
                  <div>🗓️ {next.date} at {next.time}</div>
                  <span className={`status-tag ${next.status}`} style={{ alignSelf: 'flex-start' }}>{next.status}</span>
                </div>
              ) : (
                <p style={{ color: '#64748b', fontSize: '0.9rem' }}>Nothing scheduled — ask the assistant to book one.</p>
              )}
            </div>

            <div className="dashboard-card">
              <h3 style={{ marginBottom: '12px' }}>Your regular doctor</h3>
              {favourite ? (
                <div style={{ fontSize: '0.95rem', color: '#334155' }}>
                  <strong>{favourite[0]}</strong>
                  <div style={{ color: '#64748b', marginTop: '6px' }}>{favourite[1]} visit{favourite[1] > 1 ? 's' : ''} so far</div>
                </div>
              ) : (
                <p style={{ color: '#64748b', fontSize: '0.9rem' }}>No visits recorded yet.</p>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
