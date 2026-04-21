import React, { useState } from 'react';

export default function SettingsView() {
  const [debugLog] = useState([
    { ts: '10:45:01.212', event: 'AudioStreamStart', details: 'WebM format, Int8 computed' },
    { ts: '10:45:03.450', event: 'Speech-to-Text', details: '"I want to book an appointment with Dr Iyer"' },
    { ts: '10:45:03.820', event: 'LLM Intent Extractor', details: 'Intent: BOOK_APPOINTMENT | Entities: {Doctor: "Dr Iyer"}' },
    { ts: '10:45:04.100', event: 'Tool Called', details: 'query_availability(doctor="Dr Iyer")' },
    { ts: '10:45:04.425', event: 'Text-to-Speech', details: 'Generated Azure Neural Voice buffer (450ms latency)' },
  ]);

  return (
    <div className="view-container fade-in">
      <header className="top-header" style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: '20px' }}>
        <div className="header-titles">
          <h1>System Configuration</h1>
          <p>Global settings and debug monitoring</p>
        </div>
      </header>

      <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'20px', marginTop:'20px'}}>
        
        <div style={{display:'flex', flexDirection:'column', gap:'20px'}}>
          <div className="dashboard-card">
             <h3>Voice AI Settings</h3>
             <div style={{display:'flex', flexDirection:'column', gap:'15px', marginTop:'20px'}}>
                <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                   <div>
                      <div style={{fontWeight:600}}>Enable Voice Input</div>
                      <div style={{fontSize:'0.85rem', color:'#64748b'}}>Allow microphone access for chat</div>
                   </div>
                   <input type="checkbox" defaultChecked style={{width:'20px', height:'20px'}} />
                </div>
                <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                   <div>
                      <div style={{fontWeight:600}}>Auto-detect Language</div>
                      <div style={{fontSize:'0.85rem', color:'#64748b'}}>Switch model based on user speech</div>
                   </div>
                   <input type="checkbox" defaultChecked style={{width:'20px', height:'20px'}} />
                </div>
                <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                   <div>
                      <div style={{fontWeight:600}}>Response Style</div>
                      <div style={{fontSize:'0.85rem', color:'#64748b'}}>Assistant verbosity</div>
                   </div>
                   <select style={{padding:'5px', borderRadius:'4px'}}>
                      <option>Concise & Fast</option>
                      <option>Detailed & Empathetic</option>
                   </select>
                </div>
             </div>
          </div>

          <div className="dashboard-card">
             <h3>Notification Config</h3>
             <div style={{display:'flex', flexDirection:'column', gap:'15px', marginTop:'20px'}}>
                <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                   <div style={{fontWeight:600}}>Automated Call Reminders</div>
                   <input type="checkbox" defaultChecked style={{width:'20px', height:'20px'}} />
                </div>
                <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                   <div style={{fontWeight:600}}>Reminder Timing</div>
                   <select style={{padding:'5px', borderRadius:'4px'}}>
                      <option>1 Day before</option>
                      <option>2 Hours before</option>
                   </select>
                </div>
             </div>
          </div>
        </div>

        {/* System Debug Panel (High Impact) */}
        <div className="dashboard-card" style={{background:'#0f172a', color:'#38bdf8', fontFamily:'monospace', overflow:'hidden', display:'flex', flexDirection:'column'}}>
           <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', borderBottom:'1px solid #334155', paddingBottom:'10px', marginBottom:'15px'}}>
               <h3 style={{color:'white', margin:0}}>🧪 System Debug Panel</h3>
               <span style={{background:'#22c55e', color:'white', padding:'2px 8px', borderRadius:'4px', fontSize:'0.75rem'}}>LIVE</span>
           </div>
           
           <div style={{flex:1, overflowY:'auto', fontSize:'0.85rem'}}>
              <div style={{color:'#94a3b8', marginBottom:'10px'}}>// Real-time inference trace</div>
              {debugLog.map((log, i) => (
                <div key={i} style={{marginBottom:'10px', wordBreak:'break-word'}}>
                   <span style={{color:'#64748b'}}>[{log.ts}]</span> 
                   <span style={{color:'#fbbf24', marginLeft:'10px'}}>{log.event}:</span> 
                   <span style={{color:'#e2e8f0', marginLeft:'5px'}}>{log.details}</span>
                </div>
              ))}
              <div style={{color:'#22c55e', marginTop:'20px', animation:'pulse 2s infinite'}}>Waiting for next event... █</div>
           </div>
        </div>

      </div>
    </div>
  );
}
