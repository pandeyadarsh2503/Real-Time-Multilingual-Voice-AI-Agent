import { useEffect, useState } from 'react'

/**
 * Animated splash shown while the site opens.
 *
 * Sequence: ECG heartbeat draws in → logo pulses → brand name letters
 * cascade up → tagline → "Get Started". Doubles as the auth-loading
 * screen; already-signed-in users are auto-dismissed into the app,
 * everyone else clicks Get Started to reach the login page.
 */
export default function SplashScreen({ ready, autoDismiss, onDone }) {
  const [leaving, setLeaving] = useState(false)
  const [introDone, setIntroDone] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setIntroDone(true), 2100)
    return () => clearTimeout(t)
  }, [])

  const leave = () => {
    if (leaving) return
    setLeaving(true)
    setTimeout(onDone, 700) // matches the fade-out duration below
  }

  useEffect(() => {
    if (autoDismiss && introDone) leave()
  }, [autoDismiss, introDone]) // eslint-disable-line

  const brand = 'SwasthyaAI'

  return (
    <div className={`splash-root ${leaving ? 'splash-leaving' : ''}`}>
      <style>{`
        .splash-root {
          position: fixed; inset: 0; z-index: 10000;
          display: flex; flex-direction: column; align-items: center; justify-content: center;
          background: radial-gradient(1200px 700px at 20% 10%, #16295c 0%, transparent 55%),
                      radial-gradient(900px 600px at 85% 90%, #0e3a3a 0%, transparent 50%),
                      linear-gradient(150deg, #060d1f 0%, #0b1730 55%, #0a1128 100%);
          overflow: hidden;
          opacity: 1; transition: opacity 0.7s ease;
        }
        .splash-leaving { opacity: 0; pointer-events: none; }

        /* floating soft glow orbs */
        .splash-orb {
          position: absolute; border-radius: 50%; filter: blur(70px); opacity: 0.35;
          animation: splash-drift 9s ease-in-out infinite alternate;
        }
        @keyframes splash-drift {
          from { transform: translate(0, 0) scale(1); }
          to   { transform: translate(40px, -30px) scale(1.15); }
        }

        /* ECG line */
        .splash-ecg { width: min(520px, 80vw); margin-bottom: 8px; overflow: visible; }
        .splash-ecg path {
          fill: none; stroke: #14b8a6; stroke-width: 3; stroke-linecap: round; stroke-linejoin: round;
          stroke-dasharray: 1400; stroke-dashoffset: 1400;
          filter: drop-shadow(0 0 6px rgba(20, 184, 166, 0.8));
          animation: splash-draw 1.6s cubic-bezier(0.65, 0, 0.35, 1) 0.15s forwards;
        }
        @keyframes splash-draw { to { stroke-dashoffset: 0; } }

        .splash-logo {
          font-size: 64px; line-height: 1;
          opacity: 0; transform: scale(0.4);
          animation: splash-pop 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) 1.2s forwards,
                     splash-beat 1.6s ease-in-out 2.2s infinite;
        }
        @keyframes splash-pop  { to { opacity: 1; transform: scale(1); } }
        @keyframes splash-beat {
          0%, 100% { transform: scale(1); }
          12%      { transform: scale(1.12); }
          24%      { transform: scale(1); }
          36%      { transform: scale(1.08); }
          48%      { transform: scale(1); }
        }

        .splash-title {
          display: flex; margin-top: 18px;
          font-family: 'Space Grotesk', 'Inter', sans-serif;
          font-size: clamp(40px, 8vw, 64px); font-weight: 700; letter-spacing: 0.01em;
        }
        .splash-title span {
          display: inline-block; opacity: 0; transform: translateY(26px);
          background: linear-gradient(120deg, #ffffff 30%, #7dd3fc 70%, #14b8a6 100%);
          -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent;
          animation: splash-rise 0.55s cubic-bezier(0.22, 1, 0.36, 1) forwards;
        }
        @keyframes splash-rise { to { opacity: 1; transform: translateY(0); } }

        .splash-tagline {
          margin-top: 14px; color: #94a3b8; font-size: clamp(14px, 2.4vw, 18px);
          letter-spacing: 0.02em; text-align: center; padding: 0 24px;
          opacity: 0; animation: splash-fade 0.8s ease 1.9s forwards;
        }
        .splash-langs {
          margin-top: 10px; color: #64748b; font-size: 13px; letter-spacing: 0.28em;
          text-transform: uppercase;
          opacity: 0; animation: splash-fade 0.8s ease 2.1s forwards;
        }
        @keyframes splash-fade { to { opacity: 1; } }

        .splash-cta {
          margin-top: 44px; padding: 15px 46px; border: none; border-radius: 999px;
          font-size: 17px; font-weight: 600; font-family: 'Inter', sans-serif;
          color: white; cursor: pointer;
          background: linear-gradient(120deg, #0ea5e9, #14b8a6);
          box-shadow: 0 8px 30px rgba(20, 184, 166, 0.35);
          opacity: 0; transform: translateY(16px);
          animation: splash-rise 0.6s cubic-bezier(0.22, 1, 0.36, 1) forwards;
          transition: transform 0.2s ease, box-shadow 0.2s ease;
        }
        .splash-cta:hover { transform: translateY(-2px) scale(1.03); box-shadow: 0 12px 40px rgba(20, 184, 166, 0.5); }
        .splash-cta:active { transform: translateY(0) scale(0.98); }
        .splash-cta .arrow { display: inline-block; margin-left: 10px; transition: transform 0.2s ease; }
        .splash-cta:hover .arrow { transform: translateX(5px); }

        .splash-wait {
          margin-top: 44px; height: 51px; display: flex; align-items: center; gap: 8px;
        }
        .splash-wait span {
          width: 8px; height: 8px; border-radius: 50%; background: #14b8a6; opacity: 0.5;
          animation: splash-dots 1.2s ease-in-out infinite;
        }
        .splash-wait span:nth-child(2) { animation-delay: 0.2s; }
        .splash-wait span:nth-child(3) { animation-delay: 0.4s; }
        @keyframes splash-dots { 50% { opacity: 1; transform: translateY(-6px); } }
      `}</style>

      <div className="splash-orb" style={{ width: 340, height: 340, top: '8%', left: '10%', background: '#1d4ed8' }} />
      <div className="splash-orb" style={{ width: 280, height: 280, bottom: '10%', right: '12%', background: '#0d9488', animationDelay: '-4s' }} />

      {/* ECG heartbeat */}
      <svg className="splash-ecg" viewBox="0 0 520 90" aria-hidden="true">
        <path d="M0 45 H150 L170 45 L185 18 L200 72 L212 30 L224 45 H300 L318 45 L330 28 L342 58 L352 45 H520" />
      </svg>

      <div className="splash-logo">🫀</div>

      <div className="splash-title" aria-label={brand}>
        {brand.split('').map((ch, i) => (
          <span key={i} style={{ animationDelay: `${1.05 + i * 0.06}s` }}>{ch}</span>
        ))}
      </div>

      <div className="splash-tagline">Your AI Healthcare Companion — book, manage &amp; get reminded, by voice.</div>
      <div className="splash-langs">English · हिन्दी · தமிழ்</div>

      {introDone && ready && !autoDismiss ? (
        <button className="splash-cta" onClick={leave}>
          Get Started <span className="arrow">→</span>
        </button>
      ) : (
        <div className="splash-wait" aria-hidden="true">
          {introDone && <><span /><span /><span /></>}
        </div>
      )}
    </div>
  )
}
