import React, { useState, useEffect } from 'react';
import { appointmentsAPI } from '../../services/api';

export default function HistoryView() {
  const [appointments, setAppointments] = useState([]);
  
  useEffect(() => {
    const loadHistory = async () => {
      try {
        const res = await appointmentsAPI.list();
        setAppointments(res.data);
      } catch(err) {
        console.error('Failed to load history', err);
      }
    };
    loadHistory();
  }, []);

  const total = appointments.length;
  const docCounts = {};
  appointments.forEach(a => docCounts[a.doctor] = (docCounts[a.doctor] || 0) + 1);
  let mostVisitedDoc = 'None';
  let mostVisitedCount = 0;
  for (let doc in docCounts) {
    if (docCounts[doc] > mostVisitedCount) {
      mostVisitedCount = docCounts[doc];
      mostVisitedDoc = doc;
    }
  }
  return (
    <div className="view-container fade-in">
      <header className="top-header" style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: '20px' }}>
        <div className="header-titles">
          <h1>Interaction Log & Analytics</h1>
          <p>Past chats, call history, and appointment logs</p>
        </div>
        <div className="search-bar" style={{display:'flex', gap:'10px'}}>
           <input type="date" style={{padding:'8px', borderRadius:'8px', border:'1px solid #cbd5e1'}} />
           <select style={{padding:'8px', borderRadius:'8px', border:'1px solid #cbd5e1'}}>
              <option>All Types</option>
              <option>Chats</option>
              <option>Calls</option>
           </select>
        </div>
      </header>

      <div style={{display:'grid', gridTemplateColumns:'1fr 3fr', gap:'20px', marginTop:'20px'}}>
        
        {/* Left Column: Analytics */}
        <div style={{display:'flex', flexDirection:'column', gap:'20px'}}>
          <div className="dashboard-card" style={{background:'linear-gradient(135deg, #3b82f6, #2563eb)', color:'white'}}>
             <h3 style={{color:'rgba(255,255,255,0.8)'}}>Total Appointments</h3>
             <div style={{fontSize:'2.5rem', fontWeight:'bold', marginTop:'10px'}}>{total}</div>
          </div>
          <div className="dashboard-card" style={{background:'linear-gradient(135deg, #10b981, #059669)', color:'white'}}>
             <h3 style={{color:'rgba(255,255,255,0.8)'}}>Most Visited</h3>
             <div style={{fontSize:'1.5rem', fontWeight:'bold', marginTop:'10px'}}>{mostVisitedDoc}</div>
             <div style={{fontSize:'0.9rem', opacity:0.8}}>{mostVisitedCount} visits</div>
          </div>
          <div className="dashboard-card">
             <h3>Call Outcomes</h3>
             <div style={{display:'flex', justifyContent:'space-between', marginTop:'10px'}}><span>Answered</span> <strong>80%</strong></div>
             <div style={{display:'flex', justifyContent:'space-between', marginTop:'5px'}}><span>Missed</span> <strong>15%</strong></div>
             <div style={{display:'flex', justifyContent:'space-between', marginTop:'5px'}}><span>Rejected</span> <strong>5%</strong></div>
          </div>
        </div>

        {/* Right Column: Deep Interaction Logs */}
        <div className="dashboard-card">
           <h3 style={{marginBottom:'15px'}}>Recent Activity</h3>
           
           <div style={{display:'flex', flexDirection:'column', gap:'10px'}}>
             {appointments.map(appt => (
              <div key={appt.id} style={{border:'1px solid #e2e8f0', borderRadius:'8px', padding:'15px', display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                 <div style={{display:'flex', gap:'15px', alignItems:'center'}}>
                    <div style={{fontSize:'2rem'}}>{appt.status === 'cancelled' ? '❌' : '📅'}</div>
                    <div>
                      <h4 style={{margin:0}}>Appointment {appt.status === 'cancelled' ? 'Cancelled' : 'Booked'}</h4>
                      <div style={{fontSize:'0.85rem', color:'#64748b', marginTop:'5px'}}>{appt.date} • {appt.doctor}</div>
                    </div>
                 </div>
                 <span className={`status-tag ${appt.status === 'cancelled' ? 'cancelled' : 'confirmed'}`}>{appt.status}</span>
              </div>
             ))}
             {appointments.length === 0 && <div style={{textAlign:'center', padding:'20px', color:'#64748b'}}>No activity yet</div>}
           </div>
        </div>

      </div>
    </div>
  );
}
