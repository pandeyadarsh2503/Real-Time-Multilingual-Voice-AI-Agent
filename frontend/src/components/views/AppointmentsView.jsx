import React, { useState, useEffect } from 'react';
import { appointmentsAPI, outboundAPI, doctorsAPI } from '../../services/api';

function ReminderToast({ visible }) {
  if (!visible) return null;
  return (
    <div style={{
      position: 'fixed',
      top: '24px',
      right: '24px',
      zIndex: 9999,
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
      background: 'linear-gradient(135deg, #10b981, #059669)',
      color: 'white',
      padding: '14px 20px',
      borderRadius: '12px',
      boxShadow: '0 8px 24px rgba(16,185,129,0.35)',
      fontSize: '14px',
      fontWeight: '600',
      animation: 'slideInRight 0.4s ease',
    }}>
      <div style={{ fontSize: '20px' }}>✅</div>
      <div>
        <div style={{ fontWeight: '700', fontSize: '15px' }}>Reminder Set!</div>
        <div style={{ opacity: 0.9, fontSize: '13px', fontWeight: '400' }}>AI will remind you</div>
      </div>
    </div>
  );
}

export default function AppointmentsView({ patientName }) {
  const [selectedAppt, setSelectedAppt] = useState(null);
  const [appointments, setAppointments] = useState([]);
  const [reminders, setReminders] = useState([]);
  const [doctorsList, setDoctorsList] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');

  const [reminderDoctor, setReminderDoctor] = useState('');
  const [reminderDate, setReminderDate] = useState('');
  const [reminderTime, setReminderTime] = useState('');
  const [showToast, setShowToast] = useState(false);
  const [showDocDropdown, setShowDocDropdown] = useState(false);
  const [docSearch, setDocSearch] = useState('');

  const handleSetReminder = () => {
    if (!reminderDoctor || !reminderDate || !reminderTime) return;
    setShowToast(true);
    setTimeout(() => setShowToast(false), 4000);
    setReminderDoctor('');
    setDocSearch('');
    setReminderDate('');
    setReminderTime('');
  };

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
        
        const remRes = await outboundAPI.upcomingReminders();
        setReminders(remRes.data.filter(r => r.patient_name === patientName));
        
        const docsRes = await doctorsAPI.list();
        setDoctorsList(docsRes.data);
      } catch (err) {
        console.error('Failed to load appointments/reminders', err);
      }
    };
    if (patientName) fetchAppointments();
  }, [patientName]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!event.target.closest('.searchable-doc-container')) {
        setShowDocDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="view-container fade-in">
      <ReminderToast visible={showToast} />
      <header className="top-header" style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: '20px' }}>
        <div className="header-titles">
          <h1>Calendar & Reminders</h1>
          <p>Manage your schedules, conflicts and automated voice calls</p>
        </div>
        <div className="header-actions" style={{display:'flex', gap:'10px'}}>
          <button className="primary-btn" style={{background:'#3b82f6', color:'white', padding:'8px 16px', borderRadius:'8px', border:'none'}}>+ New Booking</button>
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
        <div className="appt-list" style={{display:'flex', flexDirection:'column', gap:'20px'}}>
            
            {/* Appointment Reminder Widget */}
            <div className="dashboard-card" style={{ padding: '20px', border: '1px solid #e5e7eb', overflow: 'visible' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                <span style={{ fontWeight: '700', fontSize: '15px', color: '#111827' }}>Set Appointment Reminder</span>
              </div>

              {/* Searchable Doctor Dropdown */}
              <div className="searchable-doc-container" style={{ marginBottom: '12px', position: 'relative' }}>
                <label style={{ fontSize: '11px', fontWeight: '600', color: '#64748b', marginBottom: '6px', display: 'block', textTransform: 'uppercase' }}>Doctor</label>
                <div style={{ position: 'relative' }}>
                  <input
                    type="text"
                    placeholder="Search & select doctor..."
                    value={docSearch || (reminderDoctor ? reminderDoctor : '')}
                    onFocus={() => setShowDocDropdown(true)}
                    onChange={(e) => {
                      setDocSearch(e.target.value);
                      setShowDocDropdown(true);
                      if (reminderDoctor) setReminderDoctor('');
                    }}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #e2e8f0', background: '#f8fafc', fontSize: '13px', color: '#1e293b', outline: 'none' }}
                  />
                  {showDocDropdown && (
                    <div style={{ 
                      position: 'absolute', top: '100%', left: 0, right: 0, 
                      background: 'white', border: '1px solid #e2e8f0', borderRadius: '8px', 
                      boxShadow: '0 4px 12px rgba(0,0,0,0.1)', zIndex: 100, 
                      maxHeight: '200px', overflowY: 'auto', marginTop: '4px' 
                    }}>
                      {doctorsList
                        .filter(doc => 
                          (doc.name + doc.specialty).toLowerCase().includes(docSearch.toLowerCase())
                        )
                        .map(doc => (
                          <div 
                            key={doc.id || doc.name}
                            onClick={() => {
                              setReminderDoctor(doc.name);
                              setDocSearch(`${doc.name} (${doc.specialty})`);
                              setShowDocDropdown(false);
                            }}
                            style={{ padding: '10px 12px', fontSize: '13px', cursor: 'pointer', borderBottom: '1px solid #f1f5f9' }}
                            onMouseEnter={(e) => e.target.style.background = '#f8fafc'}
                            onMouseLeave={(e) => e.target.style.background = 'none'}
                          >
                            <strong>{doc.name}</strong> <span style={{ color: '#64748b', fontSize: '11px' }}>({doc.specialty})</span>
                          </div>
                        ))}
                      {doctorsList.length === 0 && (
                        <div style={{ padding: '10px 12px', fontSize: '13px', color: '#94a3b8' }}>Loading doctors...</div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Date & Time Row */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '15px' }}>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: '600', color: '#64748b', marginBottom: '6px', display: 'block', textTransform: 'uppercase' }}>Date</label>
                  <input
                    type="date"
                    value={reminderDate}
                    min={new Date().toISOString().split('T')[0]}
                    onChange={e => setReminderDate(e.target.value)}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #e2e8f0', background: '#f8fafc', fontSize: '13px', color: '#1e293b', outline: 'none' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: '600', color: '#64748b', marginBottom: '6px', display: 'block', textTransform: 'uppercase' }}>Time</label>
                  <input
                    type="time"
                    value={reminderTime}
                    onChange={e => setReminderTime(e.target.value)}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #e2e8f0', background: '#f8fafc', fontSize: '13px', color: '#1e293b', outline: 'none' }}
                  />
                </div>
              </div>

              {/* Set Reminder Button */}
              <button
                onClick={handleSetReminder}
                disabled={!reminderDoctor || !reminderDate || !reminderTime}
                style={{
                  width: '100%',
                  padding: '12px',
                  borderRadius: '8px',
                  border: 'none',
                  background: (!reminderDoctor || !reminderDate || !reminderTime) ? '#e2e8f0' : '#3b82f6',
                  color: 'white',
                  fontSize: '13px',
                  fontWeight: '600',
                  cursor: (!reminderDoctor || !reminderDate || !reminderTime) ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                Set Reminder
              </button>
            </div>

            <h3 style={{marginTop: '10px'}}>Upcoming list</h3>
            {appointments
              .filter(appt => 
                appt.doctor.toLowerCase().includes(searchTerm.toLowerCase()) ||
                (appt.patient_name && appt.patient_name.toLowerCase().includes(searchTerm.toLowerCase()))
              )
              .map(appt => (
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

      <div style={{marginTop: '30px'}}>
        <div className="dashboard-card">
          <h3>Automated Voice Reminders</h3>
          <p style={{fontSize:'0.85rem', color:'#64748b', marginBottom:'15px'}}>AI will automatically call you to confirm these appointments.</p>
          <table style={{width:'100%', marginTop:'15px', borderCollapse:'collapse', fontSize:'0.9rem'}}>
            <thead>
              <tr style={{textAlign:'left', borderBottom:'2px solid #f1f5f9'}}>
                <th style={{padding:'10px'}}>Doctor</th>
                <th style={{padding:'10px'}}>Date</th>
                <th style={{padding:'10px'}}>Time</th>
                <th style={{padding:'10px'}}>Status</th>
                <th style={{padding:'10px'}}>Action</th>
              </tr>
            </thead>
            <tbody>
              {reminders
                .filter(r => 
                  r.doctor.toLowerCase().includes(searchTerm.toLowerCase()) ||
                  (r.patient_name && r.patient_name.toLowerCase().includes(searchTerm.toLowerCase()))
                )
                .map(r => (
                <tr key={r.id} style={{borderBottom:'1px solid #f1f5f9'}}>
                  <td style={{padding:'10px', fontWeight:500, color:'#1e293b'}}>{r.doctor}</td>
                  <td style={{padding:'10px', color:'#64748b'}}>{r.date}</td>
                  <td style={{padding:'10px', color:'#64748b'}}>{r.time}</td>
                  <td style={{padding:'10px'}}><span className={`status-tag ${r.status || 'pending'}`}>{r.status || 'Pending'}</span></td>
                  <td style={{padding:'10px'}}>
                    <button style={{padding:'6px 12px', background:'#10b981', color:'white', border:'none', borderRadius:'6px', fontWeight:600, cursor:'pointer', fontSize: '0.8rem'}}>
                      📞 Trigger Demo Call
                    </button>
                  </td>
                </tr>
              ))}
              {reminders.length === 0 && (
                <tr>
                  <td colSpan="5" style={{padding:'20px', textAlign:'center', color:'#64748b'}}>No upcoming AI reminders</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
