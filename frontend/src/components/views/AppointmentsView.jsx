import React, { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { appointmentsAPI, doctorsAPI, outboundAPI } from '../../services/api';

export default function AppointmentsView({ patientName, onNewBooking, onReschedule, userPhone }) {
  const [selectedAppt, setSelectedAppt] = useState(null);
  const [appointments, setAppointments] = useState([]);
  const [reminders, setReminders] = useState([]);
  const [doctorsList, setDoctorsList] = useState([]);
  const [cancelling, setCancelling] = useState(false);

  const [reminderDoctor, setReminderDoctor] = useState('');
  const [reminderDate, setReminderDate] = useState('');
  const [reminderHour, setReminderHour] = useState('10');
  const [reminderMinute, setReminderMinute] = useState('00');
  const [reminderPeriod, setReminderPeriod] = useState('AM');
  const [reminderDelay, setReminderDelay] = useState('1');
  const [reminderLoading, setReminderLoading] = useState(false);
  const [phoneOverride, setPhoneOverride] = useState('');
  const [showDocDropdown, setShowDocDropdown] = useState(false);
  const [docSearch, setDocSearch] = useState('');

  const loadData = useCallback(async () => {
    try {
      const res = await appointmentsAPI.list();
      setAppointments(res.data);
      const remRes = await outboundAPI.upcomingReminders();
      setReminders(remRes.data);
      const docsRes = await doctorsAPI.list();
      setDoctorsList(docsRes.data);
    } catch (err) {
      console.error('Failed to load appointments/reminders', err);
      toast.error('Could not load your appointments.');
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleCancel = async (appt) => {
    setCancelling(true);
    try {
      await appointmentsAPI.cancel(appt.id);
      toast.success(`Appointment with ${appt.doctor} cancelled.`);
      setSelectedAppt(null);
      await loadData();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Could not cancel the appointment.');
    } finally {
      setCancelling(false);
    }
  };

  const handleSetReminder = async () => {
    const combinedTime = `${reminderHour}:${reminderMinute} ${reminderPeriod}`;
    if (!reminderDoctor || !reminderDate) return;
    const phone = userPhone || phoneOverride;
    if (!phone) {
      toast.error('Please enter your phone number to receive the call.');
      return;
    }
    setReminderLoading(true);
    try {
      const res = await outboundAPI.triggerDemo({
        phone,
        patient_name: patientName,
        doctor: reminderDoctor,
        date: reminderDate,
        time: combinedTime,
        delay_minutes: parseInt(reminderDelay) || 1,
        language: 'English',
      });
      toast.success(res.data.message || `Call scheduled in ${reminderDelay} min!`);
      setReminderDoctor(''); setDocSearch(''); setReminderDate('');
      setReminderHour('10'); setReminderMinute('00'); setReminderPeriod('AM');
      setReminderDelay('1'); setPhoneOverride('');
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Failed to schedule call.');
    } finally {
      setReminderLoading(false);
    }
  };

  // Calendar
  const today = new Date();
  const currentMonth = today.getMonth();
  const currentYear = today.getFullYear();
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const firstDayOfMonth = new Date(currentYear, currentMonth, 1).getDay();
  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!event.target.closest('.searchable-doc-container')) setShowDocDropdown(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const activeAppointments = appointments.filter((a) => a.status === 'scheduled' || a.status === 'confirmed');

  return (
    <div className="view-container fade-in">
      <header className="top-header" style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: '20px' }}>
        <div className="header-titles">
          <h1>Calendar & Reminders</h1>
          <p>Manage your schedule and automated voice reminders</p>
        </div>
        <div className="header-actions" style={{ display: 'flex', gap: '10px' }}>
          <button className="primary-btn" onClick={onNewBooking} style={{ background: '#3b82f6', color: 'white', padding: '8px 16px', borderRadius: '8px', border: 'none', cursor: 'pointer' }}>+ New Booking</button>
        </div>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '20px', marginTop: '20px' }}>

        {/* Calendar */}
        <div className="dashboard-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h3>{monthNames[currentMonth]} {currentYear}</h3>
          </div>

          <div className="calendar-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '5px' }}>
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => <div key={day} style={{ textAlign: 'center', fontWeight: 600, color: '#64748b', padding: '5px' }}>{day}</div>)}

            {Array.from({ length: firstDayOfMonth }).map((_, i) => (
              <div key={`empty-${i}`} style={{ background: 'transparent' }}></div>
            ))}

            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
              const dayAppts = activeAppointments.filter(a => a.date === dateStr);
              const isToday = day === today.getDate();

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
                  <span style={{ fontSize: '0.8rem', color: isToday ? '#3b82f6' : '#94a3b8', fontWeight: isToday ? 'bold' : 'normal' }}>{day}</span>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginTop: '2px', height: '50px', overflowY: 'auto' }}>
                    {dayAppts.map(appt => (
                      <div key={appt.id} className="appt-dot" style={{
                        background: '#10b981', color: 'white', fontSize: '0.65rem',
                        padding: '2px 4px', borderRadius: '4px', textAlign: 'left',
                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
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

        {/* Right column */}
        <div className="appt-list" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

          {/* Reminder Widget */}
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
                      .filter(doc => (doc.name + doc.specialty).toLowerCase().includes(docSearch.toLowerCase()))
                      .map(doc => (
                        <div
                          key={doc.name}
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
                <div style={{ display: 'flex', gap: '4px' }}>
                  <select value={reminderHour} onChange={e => setReminderHour(e.target.value)} style={{ flex: 1, padding: '10px 4px', borderRadius: '8px', border: '1px solid #e2e8f0', background: '#f8fafc', fontSize: '12px', color: '#1e293b', outline: 'none', cursor: 'pointer' }}>
                    {Array.from({ length: 12 }).map((_, i) => (
                      <option key={i + 1} value={String(i + 1).padStart(2, '0')}>{i + 1}</option>
                    ))}
                  </select>
                  <select value={reminderMinute} onChange={e => setReminderMinute(e.target.value)} style={{ flex: 1, padding: '10px 4px', borderRadius: '8px', border: '1px solid #e2e8f0', background: '#f8fafc', fontSize: '12px', color: '#1e293b', outline: 'none', cursor: 'pointer' }}>
                    {['00', '15', '30', '45'].map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                  <select value={reminderPeriod} onChange={e => setReminderPeriod(e.target.value)} style={{ flex: 1, padding: '10px 4px', borderRadius: '8px', border: '1px solid #e2e8f0', background: '#f8fafc', fontSize: '12px', color: '#1e293b', outline: 'none', cursor: 'pointer' }}>
                    <option value="AM">AM</option>
                    <option value="PM">PM</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Delay Row */}
            <div style={{ marginBottom: '15px' }}>
              <label style={{ fontSize: '11px', fontWeight: '600', color: '#64748b', marginBottom: '6px', display: 'block', textTransform: 'uppercase' }}>Call me in</label>
              <select value={reminderDelay} onChange={e => setReminderDelay(e.target.value)} style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #e2e8f0', background: '#f8fafc', fontSize: '13px', color: '#1e293b', outline: 'none', cursor: 'pointer' }}>
                <option value="1">1 minute</option>
                <option value="5">5 minutes</option>
                <option value="15">15 minutes</option>
                <option value="30">30 minutes</option>
                <option value="60">1 hour</option>
              </select>
            </div>

            {/* Phone number */}
            {!userPhone && (
              <div style={{ marginBottom: '12px' }}>
                <label style={{ fontSize: '11px', fontWeight: '600', color: '#64748b', marginBottom: '6px', display: 'block', textTransform: 'uppercase' }}>Your Phone Number</label>
                <input
                  type="tel"
                  placeholder="+91XXXXXXXXXX"
                  value={phoneOverride}
                  onChange={e => setPhoneOverride(e.target.value)}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #e2e8f0', background: '#f8fafc', fontSize: '13px', color: '#1e293b', outline: 'none' }}
                />
              </div>
            )}
            {userPhone && (
              <div style={{ marginBottom: '12px', padding: '8px 12px', background: '#f0fdf4', borderRadius: '8px', border: '1px solid #bbf7d0', fontSize: '12px', color: '#166534' }}>
                📞 Call will go to: <strong>{userPhone}</strong>
              </div>
            )}

            <button
              onClick={handleSetReminder}
              disabled={reminderLoading || !reminderDoctor || !reminderDate}
              style={{
                width: '100%', padding: '12px', borderRadius: '8px', border: 'none',
                background: (reminderLoading || !reminderDoctor || !reminderDate) ? '#e2e8f0' : '#3b82f6',
                color: (reminderLoading || !reminderDoctor || !reminderDate) ? '#94a3b8' : 'white',
                fontSize: '13px', fontWeight: '600',
                cursor: (reminderLoading || !reminderDoctor || !reminderDate) ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s'
              }}
            >
              {reminderLoading ? '⏳ Scheduling Call...' : '📞 Set Reminder & Call Me'}
            </button>
          </div>

          <h3 style={{ marginTop: '10px' }}>Upcoming</h3>
          {activeAppointments.map(appt => (
            <div
              key={appt.id}
              className="dashboard-card"
              style={{ cursor: 'pointer', border: selectedAppt?.id === appt.id ? '2px solid #3b82f6' : '1px solid transparent' }}
              onClick={() => setSelectedAppt(selectedAppt?.id === appt.id ? null : appt)}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <h4 style={{ margin: 0 }}>{appt.doctor}</h4>
                <span className={`status-tag ${appt.status}`}>{appt.status}</span>
              </div>
              <div style={{ fontSize: '0.85rem', color: '#64748b', marginTop: '5px' }}>{appt.date} • {appt.time}</div>
            </div>
          ))}
          {activeAppointments.length === 0 && (
            <div style={{ color: '#64748b', fontSize: '0.9rem', padding: '10px' }}>No upcoming appointments.</div>
          )}

          {/* Detail Drawer — real actions */}
          {selectedAppt && (
            <div className="detail-drawer" style={{ background: '#f8fafc', padding: '15px', borderRadius: '12px', marginTop: '10px', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.05)' }}>
              <h4 style={{ margin: '0 0 10px 0' }}>Appointment Details</h4>
              <div style={{ fontSize: '0.85rem', color: '#475569', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div><strong>Doctor:</strong> {selectedAppt.doctor}</div>
                <div><strong>Date:</strong> {selectedAppt.date} at {selectedAppt.time}</div>
                <div><strong>Booking ID:</strong> <code>{selectedAppt.id}</code></div>
                <div style={{ marginTop: '10px', display: 'flex', gap: '10px' }}>
                  <button
                    onClick={() => handleCancel(selectedAppt)}
                    disabled={cancelling}
                    style={{ padding: '6px 12px', background: 'white', border: '1px solid #ef4444', color: '#ef4444', borderRadius: '6px', cursor: 'pointer' }}
                  >
                    {cancelling ? 'Cancelling…' : 'Cancel'}
                  </button>
                  <button
                    onClick={() => onReschedule?.(selectedAppt)}
                    style={{ padding: '6px 12px', background: 'white', border: '1px solid #3b82f6', color: '#3b82f6', borderRadius: '6px', cursor: 'pointer' }}
                  >
                    Reschedule via chat
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div style={{ marginTop: '30px' }}>
        <div className="dashboard-card">
          <h3>Tomorrow's Reminder Candidates</h3>
          <p style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '15px' }}>Appointments scheduled for tomorrow — use the widget above to schedule a reminder call.</p>
          <table style={{ width: '100%', marginTop: '15px', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
            <thead>
              <tr style={{ textAlign: 'left', borderBottom: '2px solid #f1f5f9' }}>
                <th style={{ padding: '10px' }}>Patient</th>
                <th style={{ padding: '10px' }}>Doctor</th>
                <th style={{ padding: '10px' }}>Date</th>
                <th style={{ padding: '10px' }}>Time</th>
              </tr>
            </thead>
            <tbody>
              {reminders.map(r => (
                <tr key={r.appointment_id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '10px', fontWeight: 500, color: '#1e293b' }}>{r.patient_name}</td>
                  <td style={{ padding: '10px', color: '#64748b' }}>{r.doctor}</td>
                  <td style={{ padding: '10px', color: '#64748b' }}>{r.date}</td>
                  <td style={{ padding: '10px', color: '#64748b' }}>{r.time}</td>
                </tr>
              ))}
              {reminders.length === 0 && (
                <tr>
                  <td colSpan="4" style={{ padding: '20px', textAlign: 'center', color: '#64748b' }}>No appointments tomorrow</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
