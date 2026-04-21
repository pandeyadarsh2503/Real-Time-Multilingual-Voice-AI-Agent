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
      <div className="brand-logo">
        <div className="brand-icon" style={{background: 'linear-gradient(135deg, #10b981, #059669)'}}>S</div>
        <div>
          <div className="brand-title">SwasthyaAI</div>
          <div className="brand-subtitle">Command Center</div>
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

      {/* Call Assistant Panel Upgraded */}
      <div className="help-widget">
        <div className="help-title">📞 Call Assistant</div>
        <div className="help-desc">Need immediate help? Start a live outbound call simulation.</div>
        <button className="help-btn" onClick={() => alert("Initiating Exotel call or browser-based voice simulation...")}>
          🟢 Start Live Call
        </button>
        <div className="help-links" style={{marginTop: '10px', fontSize: '0.8rem', opacity: 0.8, display: 'flex', justifyContent: 'space-between'}}>
            <span style={{cursor:'pointer'}}>Call logs</span>
            <span style={{cursor:'pointer'}}>Last interaction</span>
        </div>
      </div>
    </aside>
  );
}
