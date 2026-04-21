import React, { useState, useEffect } from 'react';
import { appointmentsAPI } from '../../services/api';

export default function AppointmentsView() {
  const [selectedAppt, setSelectedAppt] = useState(null);
  const [appointments, setAppointments] = useState([]);

  useEffect(() => {
    const fetchAppointments = async () => {
      try {
        const res = await appointmentsAPI.list();
        setAppointments(res.data.map(a => ({
          id: a.id,
          doctor: a.doctor,
          time: a.time,
          date: a.date,
          status: a.status === 'scheduled' ? 'Confirmed' : (a.status || 'Pending'),
          room: 'Consultation Room',
          notes: 'Standard visit'
        })));
      } catch (err) {
        console.error('Failed to load appointments', err);
      }
    };
    fetchAppointments();
  }, []);

  return (
    <div className="view-container fade-in">
      <header className="top-header" style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: '20px' }}>
        <div className="header-titles">
          <h1>Calendar & Appointments</h1>
          <p>Manage your schedules, conflicts and history</p>
        </div>
        <div className="header-actions" style={{display:'flex', gap:'10px'}}>
          <button className="primary-btn" style={{background:'#3b82f6', color:'white', padding:'8px 16px', borderRadius:'8px', border:'none'}}>+ New Booking</button>
          <button className="secondary-btn" style={{background:'#f1f5f9', padding:'8px 16px', borderRadius:'8px', border:'1px solid #cbd5e1'}}>Bulk Cancel</button>
        </div>
      </header>

      <div style={{display:'grid', gridTemplateColumns:'2fr 1fr', gap:'20px', marginTop:'20px'}}>
        
        {/* Calendar View Mockup */}
        <div className="dashboard-card">
          <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'20px'}}>
             <h3>October 2026</h3>
             <div style={{display:'flex', gap:'5px'}}>
               <button style={{padding:'5px 10px', borderRadius:'4px', border:'1px solid #ddd'}}>Week</button>
               <button style={{padding:'5px 10px', borderRadius:'4px', border:'1px solid #ddd', background:'#e2e8f0'}}>Month</button>
             </div>
          </div>
          
          <div className="calendar-grid" style={{display:'grid', gridTemplateColumns:'repeat(7, 1fr)', gap:'5px'}}>
             {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(day => <div key={day} style={{textAlign:'center', fontWeight:600, color:'#64748b', padding:'5px'}}>{day}</div>)}
             {/* Mock 31 days */}
             {Array.from({length: 31}).map((_, i) => (
                <div key={i} style={{
                  height: '80px', 
                  border: '1px solid #f1f5f9', 
                  borderRadius: '8px', 
                  padding: '5px',
                  background: i===24 ? '#eff6ff' : 'white',
                  borderTop: i===24 ? '3px solid #3b82f6' : '1px solid #f1f5f9',
                  position: 'relative'
                }}>
                  <span style={{fontSize:'0.8rem', color:'#94a3b8'}}>{i+1}</span>
                  {i===24 && <div className="appt-dot" style={{background:'#10b981', color:'white', fontSize:'0.7rem', padding:'2px', borderRadius:'4px', marginTop:'15px', textAlign:'center'}}>10:00 Dr Iyer</div>}
                  {i===27 && <div className="appt-dot" style={{background:'#f59e0b', color:'white', fontSize:'0.7rem', padding:'2px', borderRadius:'4px', marginTop:'15px', textAlign:'center'}}>Pending</div>}
                </div>
             ))}
          </div>
          <div style={{marginTop:'15px', fontSize:'0.85rem', color:'#ef4444'}}>
             ⚠ Overlapping appointment detected on Oct 28
          </div>
        </div>

        {/* Appointment Drawer/List */}
        <div className="appt-list" style={{display:'flex', flexDirection:'column', gap:'15px'}}>
            <h3>Upcoming list</h3>
            {appointments.map(appt => (
              <div 
                key={appt.id} 
                className="dashboard-card" 
                style={{cursor:'pointer', border: selectedAppt?.id === appt.id ? '2px solid #3b82f6' : '1px solid transparent'}}
                onClick={() => setSelectedAppt(appt)}
              >
                <div style={{display:'flex', justifyContent:'space-between'}}>
                  <h4 style={{margin:0}}>{appt.doctor}</h4>
                  <span className={`status-tag ${appt.status.toLowerCase()}`}>{appt.status}</span>
                </div>
                <div style={{fontSize:'0.85rem', color:'#64748b', marginTop:'5px'}}>{appt.date} • {appt.time}</div>
              </div>
            ))}

            {/* Detail Drawer */}
            {selectedAppt && (
              <div className="detail-drawer" style={{background:'#f8fafc', padding:'15px', borderRadius:'12px', marginTop:'10px', boxShadow:'inset 0 2px 4px rgba(0,0,0,0.05)'}}>
                <h4 style={{margin:'0 0 10px 0'}}>Appointment Details</h4>
                <div style={{fontSize:'0.85rem', color:'#475569', display:'flex', flexDirection:'column', gap:'8px'}}>
                  <div><strong>Doctor:</strong> {selectedAppt.doctor}</div>
                  <div><strong>Room:</strong> {selectedAppt.room}</div>
                  <div><strong>Notes:</strong> {selectedAppt.notes}</div>
                  <div style={{marginTop:'10px', display:'flex', gap:'10px'}}>
                     <button style={{padding:'6px 12px', background:'white', border:'1px solid #ef4444', color:'#ef4444', borderRadius:'6px'}}>Cancel</button>
                     <button style={{padding:'6px 12px', background:'white', border:'1px solid #3b82f6', color:'#3b82f6', borderRadius:'6px'}}>Reschedule</button>
                  </div>
                </div>
              </div>
            )}
        </div>
      </div>
    </div>
  );
}
