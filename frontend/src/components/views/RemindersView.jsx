import React from 'react';

export default function RemindersView() {
  return (
    <div className="view-container fade-in">
      <header className="top-header" style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: '20px' }}>
        <div className="header-titles">
          <h1>Outbound Reminders</h1>
          <p>Campaign management and automated voice calls</p>
        </div>
      </header>

      <div style={{display:'grid', gridTemplateColumns:'2fr 1fr', gap:'20px', marginTop:'20px'}}>
        
        {/* Campaign View */}
        <div className="dashboard-card">
          <h3>Campaign View: Tomorrow's Appointments</h3>
          <table style={{width:'100%', marginTop:'15px', borderCollapse:'collapse', fontSize:'0.9rem'}}>
            <thead>
              <tr style={{textAlign:'left', borderBottom:'2px solid #f1f5f9'}}>
                <th style={{padding:'10px'}}>Patient</th>
                <th style={{padding:'10px'}}>Doctor</th>
                <th style={{padding:'10px'}}>Time</th>
                <th style={{padding:'10px'}}>Status</th>
                <th style={{padding:'10px'}}>Action</th>
              </tr>
            </thead>
            <tbody>
              <tr style={{borderBottom:'1px solid #f1f5f9'}}>
                <td style={{padding:'10px', fontWeight:500}}>Adarsh Pandey</td>
                <td style={{padding:'10px', color:'#64748b'}}>Dr Iyer</td>
                <td style={{padding:'10px', color:'#64748b'}}>10:00 AM</td>
                <td style={{padding:'10px'}}><span className="status-tag confirmed">Confirmed</span></td>
                <td style={{padding:'10px'}}><button className="retry-btn" disabled>Called</button></td>
              </tr>
              <tr style={{borderBottom:'1px solid #f1f5f9'}}>
                <td style={{padding:'10px', fontWeight:500}}>Rahul Singh</td>
                <td style={{padding:'10px', color:'#64748b'}}>Dr Sharma</td>
                <td style={{padding:'10px', color:'#64748b'}}>02:30 PM</td>
                <td style={{padding:'10px'}}><span className="status-tag pending">Calling...</span></td>
                <td style={{padding:'10px'}}><button className="retry-btn">Cancel</button></td>
              </tr>
              <tr style={{borderBottom:'1px solid #f1f5f9'}}>
                <td style={{padding:'10px', fontWeight:500}}>Anita Rao</td>
                <td style={{padding:'10px', color:'#64748b'}}>Dr Mehta</td>
                <td style={{padding:'10px', color:'#64748b'}}>04:00 PM</td>
                <td style={{padding:'10px'}}><span className="status-tag cancelled">No Response</span></td>
                <td style={{padding:'10px'}}><button className="retry-btn" style={{background:'#3b82f6', color:'white', border:'none'}}>Retry Call</button></td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Timeline & Controls */}
        <div style={{display:'flex', flexDirection:'column', gap:'20px'}}>
           
           <div className="dashboard-card">
              <h3>Reminder Timeline</h3>
              <div className="timeline" style={{marginTop:'20px', marginLeft:'10px', borderLeft:'2px solid #e2e8f0', paddingLeft:'20px', display:'flex', flexDirection:'column', gap:'20px'}}>
                 <div style={{position:'relative'}}>
                   <div style={{position:'absolute', width:'12px', height:'12px', background:'#3b82f6', borderRadius:'50%', left:'-27px', top:'2px'}}></div>
                   <div style={{fontSize:'0.9rem', fontWeight:600}}>Scheduled</div>
                   <div style={{fontSize:'0.75rem', color:'#64748b'}}>24 hrs before appointment</div>
                 </div>
                 <div style={{position:'relative'}}>
                   <div style={{position:'absolute', width:'12px', height:'12px', background:'#f59e0b', borderRadius:'50%', left:'-27px', top:'2px'}}></div>
                   <div style={{fontSize:'0.9rem', fontWeight:600}}>AI Outbound Call Initiated</div>
                   <div style={{fontSize:'0.75rem', color:'#64748b'}}>Calling via Exotel...</div>
                 </div>
                 <div style={{position:'relative'}}>
                   <div style={{position:'absolute', width:'12px', height:'12px', background:'#e2e8f0', borderRadius:'50%', left:'-27px', top:'2px'}}></div>
                   <div style={{fontSize:'0.9rem', fontWeight:600, color:'#94a3b8'}}>User Response</div>
                   <div style={{fontSize:'0.75rem', color:'#64748b'}}>Pending</div>
                 </div>
              </div>
           </div>

           <div className="dashboard-card" style={{background:'#f8fafc', border:'1px dashed #cbd5e1'}}>
             <h3>Manual Trigger</h3>
             <p style={{fontSize:'0.85rem', color:'#64748b', marginBottom:'15px'}}>For demonstration purposes, you can force a call right now.</p>
             <button style={{width:'100%', padding:'12px', background:'#10b981', color:'white', border:'none', borderRadius:'8px', fontWeight:600, cursor:'pointer'}}>
               📞 Send Reminder Now
             </button>
           </div>
        </div>

      </div>
    </div>
  );
}
