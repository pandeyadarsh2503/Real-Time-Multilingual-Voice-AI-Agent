import React, { useState } from 'react';
import { useChat } from '../../context/ChatContext';
import { useVoiceSession } from '../../hooks/useVoiceSession';
import ChatWindow from '../ChatWindow';
import GlassCard from '../ui/GlassCard';
import LanguagePills from '../ui/LanguagePills';
import VoiceInterface from '../VoiceInterface';
import VoiceStage from '../VoiceStage';

/**
 * Home — the conversation. The VoiceStage (living helix + waveform +
 * honest status) crowns a glass conversation column; widgets sit in a
 * quiet right rail. Night Ward theme.
 */
export default function HomeView({ dashboardData, setActiveTab }) {
  const { patientName, messages, status, language, setLanguage, sendChatMessage } = useChat();
  const session = useVoiceSession();
  const isDisabled = status === 'thinking' || status === 'speaking';
  const [showProfileMenu, setShowProfileMenu] = useState(false);

  return (
    <div className="home-night">

      {/* Center column: the conversation */}
      <div className="home-night__center">
        <header className="home-night__header">
          <div>
            <h1>Hello, {patientName} 👋</h1>
            <p>How can I help you today?</p>
          </div>
          <div className="home-night__controls">
            <LanguagePills value={language} onChange={setLanguage} />
            <div className="home-night__avatar-wrap">
              <button
                className="home-night__avatar"
                onClick={() => setShowProfileMenu(!showProfileMenu)}
                aria-haspopup="menu"
                aria-expanded={showProfileMenu}
              >
                {(patientName || 'G')[0].toUpperCase()}
              </button>
              {showProfileMenu && (
                <div className="home-night__menu" role="menu">
                  <button role="menuitem" onClick={() => { setShowProfileMenu(false); setActiveTab('Profile'); }}>👤 My Profile</button>
                  <button role="menuitem" onClick={() => { setShowProfileMenu(false); setActiveTab('Settings'); }}>⚙️ Settings</button>
                </div>
              )}
            </div>
          </div>
        </header>

        <GlassCard className="home-night__chat">
          <VoiceStage
            helixState={session.helixState}
            getLevel={session.getLevel}
            statusLine={session.statusLine}
          />
          <ChatWindow messages={messages} isThinking={status === 'thinking' && !session.live} />
          <VoiceInterface session={session} disabled={isDisabled} />
        </GlassCard>
      </div>

      {/* Right rail: quiet widgets */}
      <div className="home-night__rail">

        {dashboardData?.upcomingAppointment && (
          <GlassCard className="rail-card">
            <div className="rail-card__title">📅 Upcoming Appointment</div>
            <div className="rail-card__row">
              <strong>{dashboardData.upcomingAppointment.doctorName}</strong>
              <span className="rail-badge rail-badge--ok">{dashboardData.upcomingAppointment.status}</span>
            </div>
            <div className="rail-card__meta">🗓️ {dashboardData.upcomingAppointment.date}</div>
            <div className="rail-card__meta">🕒 {dashboardData.upcomingAppointment.time}</div>
          </GlassCard>
        )}

        {dashboardData?.quickActions && (
          <GlassCard className="rail-card">
            <div className="rail-card__title">💼 Quick Actions</div>
            <div className="rail-actions">
              {dashboardData.quickActions.map((action) => (
                <button
                  key={action.id}
                  className="rail-action"
                  onClick={() => sendChatMessage(action.prompt)}
                >
                  <span className="rail-action__icon">{action.icon}</span>
                  <span>{action.title}</span>
                </button>
              ))}
            </div>
          </GlassCard>
        )}

        {dashboardData?.recentDoctors?.length > 0 && (
          <GlassCard className="rail-card">
            <div className="rail-card__title">Explore Doctors</div>
            <div className="rail-doctors">
              {dashboardData.recentDoctors.slice(0, 3).map((doc) => (
                <button
                  key={doc.id}
                  className="rail-doctor"
                  onClick={() => sendChatMessage(`I want to book an appointment with ${doc.name}`)}
                >
                  <img src={doc.imgUrl} alt="" aria-hidden="true" />
                  <span className="rail-doctor__info">
                    <strong>{doc.name}</strong>
                    <small>{doc.specialty}</small>
                  </span>
                  <span aria-hidden="true">›</span>
                </button>
              ))}
              {dashboardData.recentDoctors.length > 3 && (
                <button className="rail-more" onClick={() => setActiveTab('Doctors')}>
                  See all doctors
                </button>
              )}
            </div>
          </GlassCard>
        )}

      </div>
    </div>
  );
}
