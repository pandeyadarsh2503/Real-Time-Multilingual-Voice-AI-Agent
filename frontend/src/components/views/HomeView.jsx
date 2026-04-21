import React from 'react';
import ChatWindow from '../ChatWindow';
import VoiceInterface from '../VoiceInterface';

export default function HomeView({ 
  patientName, 
  messages, 
  status, 
  language, 
  setLanguage, 
  sessionId, 
  handleUserMessage, 
  handleAIResponse, 
  setStatus 
}) {
  const isDisabled = status === 'thinking' || status === 'speaking';

  return (
    <div className="view-container">
      {/* Top Header */}
      <header className="top-header">
        <div className="header-titles">
          <h1>Welcome back, {patientName} 👋</h1>
          <p>Command Center • Next appointment in 22 hours</p>
        </div>
        <div className="header-controls">
          <select className="lang-select" value={language} onChange={e => setLanguage(e.target.value)}>
            <option value="en">🌐 English</option>
            <option value="hi">🌐 Hindi</option>
            <option value="ta">🌐 Tamil</option>
          </select>
          <div className="online-badge">
            <div className="online-dot"></div> Online
          </div>
        </div>
      </header>

      {/* AI Suggestions (Dynamic Chips) */}
      <div className="suggestions-bar" style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
        <button className="chip-btn" onClick={() => handleUserMessage("Book with Dr Iyer", language)}>✨ Book with Dr Iyer again</button>
        <button className="chip-btn" onClick={() => handleUserMessage("Check available slots", language)}>📅 Check available slots</button>
        <button className="chip-btn" onClick={() => handleUserMessage("Cancel last appointment", language)}>❌ Cancel last appointment</button>
      </div>

      <div className="home-grid" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '20px' }}>
        
        {/* Core AI Assistant Column */}
        <div className="assistant-column" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <ChatWindow messages={messages} isThinking={status === 'thinking'} />
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

        {/* Live Activity Column */}
        <div className="home-side-panel" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          <div className="dashboard-card">
            <h3>Live Activity Feed</h3>
            <div style={{marginTop: '15px', display:'flex', flexDirection:'column', gap:'15px'}}>
              {activities && activities.length > 0 ? (
                activities.slice(0, 5).map(act => (
                  <div key={act.id} className="feed-item fade-in" style={{display:'flex', gap:'10px', alignItems:'center'}}>
                    <div style={{background:'#e0e7ff', padding:'8px', borderRadius:'50%', fontSize:'1.2rem', width:'40px', height:'40px', display:'flex', alignItems:'center', justifyContent:'center'}}>
                      {act.icon}
                    </div>
                    <div style={{flex:1, minWidth:0}}>
                      <div style={{fontSize:'0.9rem', fontWeight:500, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>{act.title}</div>
                      <div style={{fontSize:'0.75rem', color:'#64748b', display:'flex', justifyContent:'space-between'}}>
                         <span style={{whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', maxWidth:'100px'}}>{act.desc}</span> 
                         <span>{act.time}</span>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div style={{fontSize:'0.85rem', color:'#64748b', textAlign:'center', marginTop:'10px'}}>No recent activity.</div>
              )}
            </div>
          </div>
          
        </div>
      </div>
    </div>
  );
}
