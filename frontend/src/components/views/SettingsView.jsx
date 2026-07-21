import React, { useEffect, useState } from 'react';
import { useChat } from '../../context/ChatContext';
import { t } from '../../i18n';
import api from '../../services/api';

/**
 * Real system status — replaces the old mock panel that displayed
 * hardcoded "live" debug logs and settings toggles wired to nothing.
 */
export default function SettingsView() {
  const { sessionId, language } = useChat();
  const [health, setHealth] = useState(null);
  const [ready, setReady] = useState(null);
  const [checkedAt, setCheckedAt] = useState(null);

  const runChecks = async () => {
    try {
      const h = await fetch('/health');
      setHealth(h.ok);
    } catch { setHealth(false); }
    try {
      const r = await fetch('/health/ready');
      setReady(r.ok ? (await r.json()) : { status: 'not_ready' });
    } catch { setReady({ status: 'unreachable' }); }
    setCheckedAt(new Date().toLocaleTimeString());
  };

  useEffect(() => { runChecks(); }, []);

  const [doctorsCount, setDoctorsCount] = useState(null);
  useEffect(() => {
    api.get('/doctors').then((r) => setDoctorsCount(r.data.length)).catch(() => setDoctorsCount(null));
  }, []);

  const Badge = ({ ok, labels = ['OK', 'DOWN'] }) => (
    <span style={{
      background: ok ? '#dcfce7' : '#fee2e2', color: ok ? '#166534' : '#991b1b',
      padding: '4px 10px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 700,
    }}>
      {ok ? labels[0] : labels[1]}
    </span>
  );

  return (
    <div className="view-container fade-in">
      <header className="top-header" style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: '20px' }}>
        <div className="header-titles">
          <h1>{t(language, 'view.settings.title')}</h1>
          <p>{t(language, 'view.settings.sub')}</p>
        </div>
        <button
          onClick={runChecks}
          style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid #cbd5e1', background: 'white', cursor: 'pointer', fontWeight: 600 }}
        >
          ↻ Re-check
        </button>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginTop: '20px' }}>

        <div className="dashboard-card">
          <h3>Backend Health</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginTop: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 600 }}>API server (liveness)</div>
                <div style={{ fontSize: '0.85rem', color: '#64748b' }}>GET /health</div>
              </div>
              {health !== null && <Badge ok={health} />}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 600 }}>Readiness</div>
                <div style={{ fontSize: '0.85rem', color: '#64748b' }}>GET /health/ready</div>
              </div>
              {ready && <Badge ok={ready.status === 'ready'} labels={['READY', ready.status?.toUpperCase() || 'DOWN']} />}
            </div>
            {ready?.checks && Object.entries(ready.checks).map(([name, state]) => (
              <div key={name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingLeft: '15px' }}>
                <div style={{ fontSize: '0.9rem', color: '#475569' }}>↳ {name}</div>
                <Badge ok={state === 'ok'} />
              </div>
            ))}
            {checkedAt && <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Last checked {checkedAt}</div>}
          </div>
        </div>

        <div className="dashboard-card">
          <h3>Session</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '20px', fontSize: '0.9rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#64748b' }}>Chat session ID</span>
              <code style={{ background: '#f1f5f9', padding: '2px 8px', borderRadius: '4px', fontSize: '0.8rem' }}>{sessionId.slice(0, 13)}…</code>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#64748b' }}>Active language</span>
              <strong>{{ en: 'English', hi: 'Hindi', ta: 'Tamil' }[language] || language}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#64748b' }}>Doctors available</span>
              <strong>{doctorsCount ?? '—'}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#64748b' }}>Voice modes</span>
              <strong>Live (WebRTC) · Push-to-talk</strong>
            </div>
          </div>

          <div style={{ marginTop: '20px', padding: '12px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '0.8rem', color: '#64748b', lineHeight: 1.5 }}>
            Conversations expire automatically after 30 minutes of inactivity.
            Transcripts are retained for 30 days, then deleted.
          </div>
        </div>

      </div>
    </div>
  );
}
