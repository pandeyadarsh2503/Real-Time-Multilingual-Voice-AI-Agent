import React from 'react';

export default function LeftSidebar({ activeTab, setActiveTab, onLogout }) {
  const tabs = [
    { id: 'Home', icon: '🏠', label: 'Home' },
    { id: 'Appointments', icon: '📅', label: 'Appointments' },
    { id: 'Doctors', icon: '👨‍⚕️', label: 'Doctors' },
    { id: 'Reminders', icon: '🔔', label: 'Reminders' },
    { id: 'History', icon: '🕒', label: 'History' },
    { id: 'Profile', icon: '👤', label: 'Profile' },
    { id: 'Settings', icon: '⚙️', label: 'Settings' },
  ];

  return (
    <aside className="left-sidebar">
      <div className="brand-logo" style={{ marginBottom: '40px', display: 'flex', alignItems: 'center', gap: '12px', padding: '0 8px' }}>
        <div style={{color:'#14b8a6', fontSize: '32px', fontWeight: 'bold'}}>🫀</div>
        <div>
          <div className="brand-title" style={{color: 'white', fontSize: '20px', fontWeight: '700'}}>SwasthyaAI</div>
          <div className="brand-subtitle" style={{color: '#9ca3af', fontSize: '10px', textTransform:'uppercase', letterSpacing:'1px', marginTop:'4px'}}>Healthcare Companion</div>
        </div>
      </div>

      <nav className="nav-links">
        {tabs.map((tab) => (
          <a
            key={tab.id}
            className={`nav-item ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.icon} {tab.label}
          </a>
        ))}
        {/* Logout Button */}
        <a className="nav-item" onClick={onLogout} style={{ color: '#ef4444', marginTop: '16px' }}>
          🚪 Logout
        </a>
      </nav>

      <div className="help-widget" style={{background: 'linear-gradient(135deg, #0f766e, #115e59)', borderRadius: '16px', padding: '20px', color: 'white', marginTop: 'auto', border: '1px solid #14b8a6', boxShadow: '0 4px 6px rgba(0,0,0,0.1)'}}>
        <div className="help-title" style={{display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 'bold', fontSize: '15px', marginBottom: '8px'}}>
          <span style={{color: 'white', fontSize: '18px'}}>📞</span> Need Help?
        </div>
        <div className="help-desc" style={{fontSize: '12px', opacity: 0.9, marginBottom: '20px', lineHeight: 1.5}}>Talk to our assistant now or call us.</div>
        <button className="help-btn" onClick={() => alert("Initiating Exotel call or browser-based voice simulation...")} style={{background: 'rgba(20, 184, 166, 0.2)', border: '1px solid #14b8a6', borderRadius: '8px', padding: '10px 12px', width: '100%', color: 'white', fontSize: '13px', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'}}>
          📞 Call Assistant
        </button>
      </div>
    </aside>
  );
}
