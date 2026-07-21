import React from 'react';
import { useChat } from '../context/ChatContext';
import { t } from '../i18n';

// line icons, stroke = currentColor
const Ic = {
  home: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="m3 10.5 9-7.5 9 7.5"/><path d="M5 9.5V20a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V9.5"/></svg>,
  calendar: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><rect x="3.5" y="5" width="17" height="16" rx="2.5"/><path d="M8 3v4M16 3v4M3.5 10.5h17"/></svg>,
  users: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="8" r="3.2"/><path d="M2.8 20c.6-3.3 3.1-5 6.2-5s5.6 1.7 6.2 5"/><path d="M15.5 5.4a3.2 3.2 0 0 1 0 5.9M18.1 15.5c1.7.7 2.8 2 3.1 4.5"/></svg>,
  doc: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M6 2.8h8l4 4V21a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V3.8a1 1 0 0 1 1-1Z"/><path d="M9 12h6M9 16h4"/></svg>,
  trend: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="m3 16 5.5-5.5 4 4L21 6"/><path d="M15.5 6H21v5.5"/></svg>,
  gear: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3.2"/><path d="M19.3 14.9a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.2a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.2a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3h.1a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.2a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9v.1a1.7 1.7 0 0 0 1.5 1h.2a2 2 0 1 1 0 4h-.2a1.7 1.7 0 0 0-1.5 1Z"/></svg>,
  user: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="3.6"/><path d="M4.5 20.5c.8-3.8 3.9-5.7 7.5-5.7s6.7 1.9 7.5 5.7"/></svg>,
  logout: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h8"/><path d="m17 8 4 4-4 4M21 12H9"/></svg>,
};

const MAIN_NAV = [
  { id: 'Home', labelKey: 'nav.home', icon: Ic.home },
  { id: 'Appointments', labelKey: 'nav.appointments', icon: Ic.calendar },
  { id: 'Doctors', labelKey: 'nav.doctors', icon: Ic.users },
  { id: 'History', labelKey: 'nav.history', icon: Ic.doc },
];

const SECONDARY_NAV = [
  { id: 'Health', labelKey: 'nav.health', icon: Ic.trend, tile: 'sb-tile--green' },
  { id: 'Settings', labelKey: 'nav.settings', icon: Ic.gear, tile: '' },
  { id: 'Profile', labelKey: 'nav.profile', icon: Ic.user, tile: '' },
];

export default function LeftSidebar({ activeTab, setActiveTab, onLogout }) {
  const { language } = useChat();
  return (
    <aside className="left-sidebar">
      <div className="sb-logo">
        <span className="sb-logo__icon" aria-hidden="true">🫀</span>
        <div>
          <div className="sb-logo__title">SwasthyaAI</div>
          <div className="sb-logo__sub">{t(language, 'brand.sub')}</div>
        </div>
      </div>

      <div className="sb-divider" />

      <nav className="sb-nav" aria-label="Main">
        {MAIN_NAV.map((item) => (
          <button
            key={item.id}
            className={`sb-item ${activeTab === item.id ? 'active' : ''}`}
            onClick={() => setActiveTab(item.id)}
            aria-current={activeTab === item.id ? 'page' : undefined}
          >
            {item.icon}
            <span>{t(language, item.labelKey)}</span>
          </button>
        ))}
      </nav>

      <div className="sb-divider" />

      <nav className="sb-nav" aria-label="Account">
        {SECONDARY_NAV.map((item) => (
          <button
            key={item.id}
            className={`sb-item sb-item--tiled ${activeTab === item.id ? 'active' : ''}`}
            onClick={() => setActiveTab(item.id)}
            aria-current={activeTab === item.id ? 'page' : undefined}
          >
            <span className={`sb-tile ${item.tile}`}>{item.icon}</span>
            <span>{t(language, item.labelKey)}</span>
          </button>
        ))}
      </nav>

      <div style={{ flex: 1 }} />

      <div className="sb-divider" />

      <button className="sb-item sb-item--tiled sb-logout" onClick={onLogout}>
        <span className="sb-tile sb-tile--red">{Ic.logout}</span>
        <span>{t(language, 'nav.logout')}</span>
      </button>
    </aside>
  );
}
