import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { useChat } from '../../context/ChatContext';
import { t } from '../../i18n';
import { appointmentsAPI } from '../../services/api';

export default function HistoryView() {
  const { language } = useChat();
  const [appointments, setAppointments] = useState([]);

  useEffect(() => {
    const loadHistory = async () => {
      try {
        const res = await appointmentsAPI.list();
        setAppointments(res.data);
      } catch (err) {
        console.error('Failed to load history', err);
        toast.error(t(language, 'toast.loadHistory'));
      }
    };
    loadHistory();
  }, []);

  const total = appointments.length;
  const cancelled = appointments.filter((a) => a.status === 'cancelled').length;
  const docCounts = {};
  appointments.forEach((a) => { docCounts[a.doctor] = (docCounts[a.doctor] || 0) + 1; });
  const [mostVisitedDoc, mostVisitedCount] = Object.entries(docCounts)
    .sort((a, b) => b[1] - a[1])[0] || ['None', 0];

  return (
    <div className="view-container fade-in">
      <header className="top-header" style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: '20px' }}>
        <div className="header-titles">
          <h1>{t(language, 'view.history.title')}</h1>
          <p>{t(language, 'view.history.sub')}</p>
        </div>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 3fr', gap: '20px', marginTop: '20px' }}>

        {/* Left Column: real stats */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div className="dashboard-card" style={{ background: 'linear-gradient(135deg, #3b82f6, #2563eb)', color: 'white' }}>
            <h3 style={{ color: 'rgba(255,255,255,0.8)' }}>{t(language, 'hist.total')}</h3>
            <div style={{ fontSize: '2.5rem', fontWeight: 'bold', marginTop: '10px' }}>{total}</div>
          </div>
          <div className="dashboard-card" style={{ background: 'linear-gradient(135deg, #10b981, #059669)', color: 'white' }}>
            <h3 style={{ color: 'rgba(255,255,255,0.8)' }}>{t(language, 'hist.mostVisited')}</h3>
            <div style={{ fontSize: '1.5rem', fontWeight: 'bold', marginTop: '10px' }}>{mostVisitedDoc}</div>
            <div style={{ fontSize: '0.9rem', opacity: 0.8 }}>{t(language, 'hist.visits', { n: mostVisitedCount })}</div>
          </div>
          <div className="dashboard-card">
            <h3>{t(language, 'hist.cancellations')}</h3>
            <div style={{ fontSize: '2rem', fontWeight: 'bold', marginTop: '10px', color: '#ef4444' }}>{cancelled}</div>
            <div style={{ fontSize: '0.85rem', color: '#64748b' }}>{t(language, 'hist.ofTotal', { n: total })}</div>
          </div>
        </div>

        {/* Right Column: activity list */}
        <div className="dashboard-card">
          <h3 style={{ marginBottom: '15px' }}>{t(language, 'hist.recent')}</h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {appointments.map((appt) => (
              <div key={appt.id} style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '15px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
                  <div style={{ fontSize: '2rem' }}>{appt.status === 'cancelled' ? '❌' : '📅'}</div>
                  <div>
                    <h4 style={{ margin: 0 }}>{appt.status === 'cancelled' ? t(language, 'hist.cancelledItem') : t(language, 'hist.booked')}</h4>
                    <div style={{ fontSize: '0.85rem', color: '#64748b', marginTop: '5px' }}>{appt.date} • {appt.time} • {appt.doctor}</div>
                  </div>
                </div>
                <span className={`status-tag ${appt.status === 'cancelled' ? 'cancelled' : 'confirmed'}`}>{appt.status}</span>
              </div>
            ))}
            {appointments.length === 0 && <div style={{ textAlign: 'center', padding: '20px', color: '#64748b' }}>{t(language, 'hist.none')}</div>}
          </div>
        </div>

      </div>
    </div>
  );
}
