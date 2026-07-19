import React from 'react';
import { useChat } from '../../context/ChatContext';
import { useVoiceSession } from '../../hooks/useVoiceSession';
import ChatWindow from '../ChatWindow';
import LanguagePills from '../ui/LanguagePills';
import VoiceInterface from '../VoiceInterface';

function TrustBanner() {
  const items = [
    { icon: '🛡️', bg: '#eff6ff', color: '#3b82f6', title: 'Secure & Private', desc: 'Authenticated & access-controlled' },
    { icon: '🕒', bg: '#ecfdf5', color: '#10b981', title: '24/7 Available', desc: "We're here anytime" },
    { icon: '🌐', bg: '#eff6ff', color: '#3b82f6', title: 'Multilingual', desc: 'English, Hindi & Tamil' },
  ];
  return (
    <div className="trust-banner" style={{ background: 'white', borderRadius: '12px', padding: '16px', display: 'flex', justifyContent: 'space-between', border: '1px solid #e5e7eb', marginTop: '20px' }}>
      {items.map((item) => (
        <div key={item.title} className="trust-item" style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <div style={{ background: item.bg, color: item.color, width: '32px', height: '32px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{item.icon}</div>
          <div>
            <div style={{ fontSize: '0.85rem', fontWeight: '600', color: '#1f2937' }}>{item.title}</div>
            <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>{item.desc}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function HomeView({ dashboardData, setActiveTab }) {
  const { patientName, messages, status, language, setLanguage, sendChatMessage } = useChat();
  const session = useVoiceSession();
  const isDisabled = status === 'thinking' || status === 'speaking';

  return (
    <div className="home-dashboard" style={{ display: 'flex', height: '100%', width: '100%', gap: '32px', padding: '32px 48px', background: '#f9fafb' }}>

      {/* Center Column: Chat & Assistant */}
      <div className="center-column" style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, minHeight: 0 }}>
        <header className="home-header" style={{ display: 'flex', flexDirection: 'column', gap: '5px', marginBottom: '20px', alignItems: 'flex-start', flexShrink: 0 }}>
          <h1 style={{ fontSize: '24px', fontWeight: 'bold', color: '#111827', margin: 0 }}>Hello, {patientName} 👋</h1>
          <p style={{ color: '#4b5563', margin: 0 }}>How can I help you today?</p>
        </header>

        <div className="chat-container-card" style={{ flex: 1, minHeight: 0, background: 'white', borderRadius: '16px', border: '1px solid #e5e7eb', display: 'flex', flexDirection: 'column' }}>
          <ChatWindow messages={messages} isThinking={status === 'thinking'} />

          <div style={{ padding: '0 20px 10px 20px' }}>
            <VoiceInterface session={session} disabled={isDisabled} />
          </div>
        </div>

        <TrustBanner />
      </div>

      {/* Right Column: Widgets */}
      <div className="right-sidebar" style={{ width: '320px', display: 'flex', flexDirection: 'column', gap: '20px', flexShrink: 0, overflow: 'hidden' }}>

        {/* Top Controls */}
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', alignItems: 'center' }}>
          <LanguagePills
            value={language}
            onChange={(code) => { setLanguage(code); localStorage.setItem('preferredLang', code); }}
            className="lang-pills--light"
          />
          <div className="online-badge" style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#ecfdf5', color: '#065f46', padding: '8px 12px', borderRadius: '20px', fontSize: '13px', fontWeight: '500' }}>
            <div style={{ width: '8px', height: '8px', background: '#10b981', borderRadius: '50%' }}></div> Online
          </div>

          <button
            onClick={() => setActiveTab('Profile')}
            title="My Profile"
            style={{
              width: '40px', height: '40px', borderRadius: '50%', background: '#3b82f6',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem',
              color: 'white', cursor: 'pointer', boxShadow: '0 2px 5px rgba(59,130,246,0.3)',
              fontWeight: 'bold', marginLeft: '5px', border: 'none',
            }}
          >
            {(patientName || 'G')[0].toUpperCase()}
          </button>
        </div>

        {/* Upcoming Appointment */}
        {dashboardData?.upcomingAppointment && (
          <div className="widget-card" style={{ background: 'white', borderRadius: '16px', padding: '20px', border: '1px solid #e5e7eb' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '15px', color: '#1f2937', fontWeight: '600', fontSize: '14px' }}>
              <span style={{ color: '#3b82f6' }}>📅</span> Upcoming Appointment
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
              <div style={{ fontWeight: 'bold', color: '#111827', fontSize: '15px' }}>{dashboardData.upcomingAppointment.doctorName}</div>
              <span style={{ background: '#dcfce7', color: '#166534', padding: '4px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: '600' }}>{dashboardData.upcomingAppointment.status}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '13px', color: '#4b5563' }}>
              <div style={{ display: 'flex', gap: '8px' }}><span>🗓️</span> {dashboardData.upcomingAppointment.date}</div>
              <div style={{ display: 'flex', gap: '8px' }}><span>🕒</span> {dashboardData.upcomingAppointment.time}</div>
            </div>
          </div>
        )}

        {/* Quick Actions */}
        {dashboardData?.quickActions && (
          <div className="widget-card" style={{ background: 'white', borderRadius: '16px', padding: '20px', border: '1px solid #e5e7eb' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '15px', color: '#1f2937', fontWeight: '600', fontSize: '14px' }}>
              <span style={{ color: '#1e3a8a' }}>💼</span> Quick Actions
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              {dashboardData.quickActions.map((action) => (
                <button
                  key={action.id}
                  className="action-box-new"
                  onClick={() => sendChatMessage(action.prompt)}
                  style={{ background: action.bgColor, border: 'none', borderRadius: '14px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'flex-start', cursor: 'pointer', textAlign: 'left', minWidth: 0 }}
                >
                  <span style={{ width: '34px', height: '34px', borderRadius: '9px', background: 'rgba(255,255,255,0.75)', display: 'grid', placeItems: 'center', color: action.iconColor, fontSize: '17px' }}>{action.icon}</span>
                  <span style={{ fontSize: '12.5px', fontWeight: '600', color: '#1f2937', lineHeight: 1.3, wordBreak: 'break-word', width: '100%' }}>{action.title}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Explore Doctors */}
        {dashboardData?.recentDoctors?.length > 0 && (
          <div className="widget-card" style={{ background: 'white', borderRadius: '16px', padding: '20px', border: '1px solid #e5e7eb' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '15px' }}>
              <span style={{ color: '#1f2937', fontWeight: '600', fontSize: '14px' }}>Explore Doctors</span>
              <button
                onClick={() => setActiveTab('Doctors')}
                style={{ background: 'none', border: 'none', color: '#3b82f6', fontSize: '13px', fontWeight: '600', cursor: 'pointer', padding: 0 }}
              >
                View all
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              {dashboardData.recentDoctors.slice(0, 3).map((doc, index) => {
                const palette = [['#e7f0ff', '#2563eb'], ['#f1e9ff', '#7c3aed'], ['#fff1e6', '#ea580c'], ['#e7f8ef', '#16a34a']];
                const [bg, fg] = palette[index % palette.length];
                const initials = doc.name.replace(/^Dr\.?\s*/i, '').split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();
                return (
                  <React.Fragment key={doc.id}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }} onClick={() => sendChatMessage(`I want to book an appointment with ${doc.name}`)}>
                      <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                        <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: bg, color: fg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '700', fontSize: '13px' }}>
                          {initials}
                        </div>
                        <div>
                          <div style={{ fontWeight: '600', color: '#111827', fontSize: '14px' }}>{doc.name}</div>
                          <div style={{ color: '#6b7280', fontSize: '12px' }}>{doc.specialty}</div>
                        </div>
                      </div>
                      <span style={{ color: '#94a3b8' }}>›</span>
                    </div>
                    {index < 2 && index < dashboardData.recentDoctors.length - 1 && (
                      <div style={{ height: '1px', background: '#f3f4f6' }}></div>
                    )}
                  </React.Fragment>
                );
              })}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
