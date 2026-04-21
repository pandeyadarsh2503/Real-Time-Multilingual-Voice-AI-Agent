const STATUS_CONFIG = {
  ready:     { dot: 'ready',     label: 'Ready',      icon: '✦' },
  listening: { dot: 'listening', label: 'Listening…', icon: '🎤' },
  thinking:  { dot: 'thinking',  label: 'Thinking…',  icon: '🧠' },
  speaking:  { dot: 'speaking',  label: 'Speaking…',  icon: '🔊' },
}

export default function StatusBar({ status, language }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.ready

  const langLabels = { en: '🇬🇧 English', hi: '🇮🇳 Hindi', ta: '🇮🇳 Tamil' }

  return (
    <div className="status-bar">
      <div className={`status-dot ${cfg.dot}`} />
      <span style={{ fontSize: 14 }}>{cfg.icon}</span>
      <span>{cfg.label}</span>
      <span style={{ marginLeft: 'auto', opacity: 0.6, fontSize: 11 }}>
        {langLabels[language] || langLabels.en}
      </span>
    </div>
  )
}
