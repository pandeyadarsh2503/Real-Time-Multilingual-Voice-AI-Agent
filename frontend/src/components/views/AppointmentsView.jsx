import React, { useState, useEffect } from 'react';
import { appointmentsAPI } from '../../services/api';

export default function AppointmentsView({ patientName }) {
  const [selectedAppt, setSelectedAppt] = useState(null);
  const [appointments, setAppointments] = useState([]);

  // Calendar logic
  const today = new Date();
  const currentMonth = today.getMonth();
  const currentYear = today.getFullYear();
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const firstDayOfMonth = new Date(currentYear, currentMonth, 1).getDay();
  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

  useEffect(() => {
    const fetchAppointments = async () => {
      try {
        const res = await appointmentsAPI.list({ patient_name: patientName });
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
    if (patientName) fetchAppointments();
  }, [patientName]);

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
             <h3>{monthNames[currentMonth]} {currentYear}</h3>
             <div style={{display:'flex', gap:'5px'}}>
               <button style={{padding:'5px 10px', borderRadius:'4px', border:'1px solid #ddd'}}>Week</button>
               <button style={{padding:'5px 10px', borderRadius:'4px', border:'1px solid #ddd', background:'#e2e8f0'}}>Month</button>
             </div>
          </div>
          
          <div className="calendar-grid" style={{display:'grid', gridTemplateColumns:'repeat(7, 1fr)', gap:'5px'}}>
             {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(day => <div key={day} style={{textAlign:'center', fontWeight:600, color:'#64748b', padding:'5px'}}>{day}</div>)}
             
             {/* Empty slots for days before the 1st of the month */}
             {Array.from({ length: firstDayOfMonth }).map((_, i) => (
                <div key={`empty-${i}`} style={{ background: 'transparent' }}></div>
             ))}

             {/* Days of the month */}
             {Array.from({length: daysInMonth}).map((_, i) => {
                const day = i + 1;
                const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                const dayAppts = appointments.filter(a => a.date === dateStr);
                const isToday = day === today.getDate() && currentMonth === today.getMonth() && currentYear === today.getFullYear();

                return (
                  <div key={day} style={{
                    height: '80px', 
                    border: isToday ? '2px solid #3b82f6' : '1px solid #f1f5f9', 
                    borderRadius: '8px', 
                    padding: '5px',
                    background: dayAppts.length > 0 ? '#eff6ff' : 'white',
                    position: 'relative',
                    overflow: 'hidden'
                  }}>
                    <span style={{fontSize:'0.8rem', color: isToday ? '#3b82f6' : '#94a3b8', fontWeight: isToday ? 'bold' : 'normal'}}>{day}</span>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginTop: '2px', height: '50px', overflowY: 'auto' }}>
                      {dayAppts.map(appt => (
                        <div key={appt.id} className="appt-dot" style={{
                          background: appt.status === 'Confirmed' || appt.status === 'scheduled' ? '#10b981' : '#f59e0b', 
                          color: 'white', 
                          fontSize: '0.65rem', 
                          padding: '2px 4px', 
                          borderRadius: '4px', 
                          textAlign: 'left',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis'
                        }}>
                          {appt.time} {appt.doctor.replace('Dr ', '')}
                        </div>
                      ))}
                    </div>
                  </div>
                )
             })}
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
