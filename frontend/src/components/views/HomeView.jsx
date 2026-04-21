import React from 'react';
import ChatWindow from '../ChatWindow';
import VoiceInterface from '../VoiceInterface';

function TrustBanner() {
  return (
    <div className="trust-banner" style={{ background: 'white', borderRadius: '12px', padding: '16px', display: 'flex', justifyContent: 'space-between', border: '1px solid #e5e7eb', marginTop: '20px' }}>
      <div className="trust-item" style={{display:'flex', gap:'10px', alignItems:'center'}}>
        <div style={{background:'#eff6ff', color:'#3b82f6', width:'32px', height:'32px', borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center'}}>🛡️</div>
        <div>
          <div style={{fontSize:'0.85rem', fontWeight:'600', color:'#1f2937'}}>Secure & Private</div>
          <div style={{fontSize:'0.75rem', color:'#6b7280'}}>Your data is safe with us</div>
        </div>
      </div>
      <div className="trust-item" style={{display:'flex', gap:'10px', alignItems:'center'}}>
        <div style={{background:'#ecfdf5', color:'#10b981', width:'32px', height:'32px', borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center'}}>🕒</div>
        <div>
          <div style={{fontSize:'0.85rem', fontWeight:'600', color:'#1f2937'}}>24/7 Available</div>
          <div style={{fontSize:'0.75rem', color:'#6b7280'}}>We're here anytime</div>
        </div>
      </div>
      <div className="trust-item" style={{display:'flex', gap:'10px', alignItems:'center'}}>
        <div style={{background:'#eff6ff', color:'#3b82f6', width:'32px', height:'32px', borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center'}}>👥</div>
        <div>
          <div style={{fontSize:'0.85rem', fontWeight:'600', color:'#1f2937'}}>Trusted by Thousands</div>
          <div style={{fontSize:'0.75rem', color:'#6b7280'}}>For better healthcare</div>
        </div>
      </div>
    </div>
  )
}

export default function HomeView({ 
  patientName, 
  messages, 
  status, 
  language, 
  setLanguage, 
  sessionId, 
  handleUserMessage, 
  handleAIResponse, 
  setStatus,
  activities,
  dashboardData
}) {
  const isDisabled = status === 'thinking' || status === 'speaking';

  return (
    <div className="home-dashboard" style={{ display: 'flex', height: '100%', width: '100%', gap: '20px', padding: '20px', background: '#f9fafb' }}>
      
      {/* Center Column: Chat & Assistant */}
      <div className="center-column" style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <header className="home-header" style={{ display: 'flex', flexDirection: 'column', gap: '5px', marginBottom: '20px', alignItems: 'flex-start' }}>
          <h1 style={{ fontSize: '24px', fontWeight: 'bold', color: '#111827', margin: 0 }}>Hello, {patientName} 👋</h1>
          <p style={{ color: '#4b5563', margin: 0 }}>How can I help you today?</p>
        </header>

        <div className="chat-container-card" style={{ flex: 1, background: 'white', borderRadius: '16px', border: '1px solid #e5e7eb', display: 'flex', flexDirection: 'column' }}>
          <ChatWindow messages={messages} isThinking={status === 'thinking'} />
          
          <div style={{ padding: '0 20px 20px 20px' }}>
            <VoiceInterface
              sessionId={sessionId}
              patientName={patientName}
              language={language}
              setLanguage={setLanguage}
              onMessage={handleUserMessage}
              onResponse={handleAIResponse}
              onStatusChange={setStatus}
              disabled={isDisabled}
              status={status}
            />
          </div>
        </div>

        <TrustBanner />
      </div>

      {/* Right Column: Widgets */}
      <div className="right-sidebar" style={{ width: '320px', display: 'flex', flexDirection: 'column', gap: '20px', flexShrink: 0 }}>
        
        {/* Top Controls */}
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', alignItems: 'center' }}>
          <select className="lang-select" value={language} onChange={e => setLanguage(e.target.value)} style={{ padding: '8px 12px', borderRadius: '20px', border: '1px solid #e5e7eb', background: 'white', fontSize: '13px', cursor: 'pointer', outline: 'none' }}>
            <option value="en">🌐 English</option>
            <option value="hi">🌐 Hindi</option>
            <option value="ta">🌐 Tamil</option>
          </select>
          <div className="online-badge" style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#ecfdf5', color: '#065f46', padding: '8px 12px', borderRadius: '20px', fontSize: '13px', fontWeight: '500' }}>
            <div style={{ width: '8px', height: '8px', background: '#10b981', borderRadius: '50%' }}></div> Online
          </div>
        </div>

        {/* Upcoming Appointment */}
        {dashboardData?.upcomingAppointment && (
          <div className="widget-card" style={{ background: 'white', borderRadius: '16px', padding: '20px', border: '1px solid #e5e7eb' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '15px', color: '#1f2937', fontWeight: '600', fontSize: '14px' }}>
              <span style={{ color: '#3b82f6' }}>📅</span> Upcoming Appointment
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
              <div>
                <div style={{ fontWeight: 'bold', color: '#111827', fontSize: '15px' }}>{dashboardData.upcomingAppointment.doctorName}</div>
                <div style={{ color: '#6b7280', fontSize: '12px' }}>{dashboardData.upcomingAppointment.specialty}</div>
              </div>
              <span style={{ background: '#dcfce7', color: '#166534', padding: '4px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: '600' }}>{dashboardData.upcomingAppointment.status}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '13px', color: '#4b5563', marginBottom: '15px' }}>
               <div style={{ display: 'flex', gap: '8px' }}><span>🗓️</span> {dashboardData.upcomingAppointment.date}</div>
               <div style={{ display: 'flex', gap: '8px' }}><span>🕒</span> {dashboardData.upcomingAppointment.time}</div>
               <div style={{ display: 'flex', gap: '8px' }}><span>📍</span> {dashboardData.upcomingAppointment.location}</div>
            </div>
            <button style={{ width: '100%', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '8px', padding: '10px', fontSize: '13px', fontWeight: '500', cursor: 'pointer' }}>View Details</button>
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
                  onClick={() => handleUserMessage(action.prompt, language)} 
                  style={{ background: action.bgColor, border: 'none', borderRadius: '12px', padding: '10px', display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'flex-start', cursor: 'pointer', textAlign: 'left', minWidth: 0 }}
                >
                  <span style={{ color: action.iconColor, fontSize: '20px' }}>{action.icon}</span>
                  <span style={{ fontSize: '11px', fontWeight: '600', color: '#0f172a', lineHeight: 1.2, wordBreak: 'break-word', width: '100%' }}>{action.title}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Recent Doctors */}
        {dashboardData?.recentDoctors && (
          <div className="widget-card" style={{ background: 'white', borderRadius: '16px', padding: '20px', border: '1px solid #e5e7eb' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '15px', color: '#1f2937', fontWeight: '600', fontSize: '14px' }}>
              Recent Doctors
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              {dashboardData.recentDoctors.map((doc, index) => (
                <React.Fragment key={doc.id}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }} onClick={() => handleUserMessage(`I want to see ${doc.name}`, language)}>
                     <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                       <img src={doc.imgUrl} style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover', background: '#e2e8f0' }} alt={doc.name} />
                       <div>
                         <div style={{ fontWeight: '600', color: '#111827', fontSize: '14px' }}>{doc.name}</div>
                         <div style={{ color: '#6b7280', fontSize: '12px' }}>{doc.specialty}</div>
                       </div>
                     </div>
                     <span style={{ color: '#1e3a8a' }}>›</span>
                  </div>
                  {index < dashboardData.recentDoctors.length - 1 && (
                    <div style={{ height: '1px', background: '#f3f4f6' }}></div>
                  )}
                </React.Fragment>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
