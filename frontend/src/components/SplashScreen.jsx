import { useEffect, useRef, useState } from 'react'
import DnaHelix from './ui/DnaHelix'

/**
 * Cinematic splash — the product thesis told in ~5 seconds:
 *
 *   dark → monitor powers on → ECG draws & beats → neural particles
 *   gather → the heartbeat MORPHS into the Voice Orb → brand reveal →
 *   tagline → languages → Get Started.
 *
 * Medicine becomes intelligence, and it speaks. The ECG morphs into
 * the DNA helix — the same living identity the user talks to inside.
 *
 * Returning (signed-in) users auto-continue without the button.
 */
const TIMELINE = [
  ['poweron',   400],
  ['ecg',      1050],
  ['particles', 2450],
  ['morph',    3050],
  ['brand',    3750],
  ['tagline',  4250],
  ['langs',    4550],
  ['cta',      4950],
]
const STAGES = TIMELINE.map(([s]) => s)

const stageAtLeast = (stage, min) => STAGES.indexOf(stage) >= STAGES.indexOf(min)

// deterministic pseudo-random scatter for the neural particles
const PARTICLES = Array.from({ length: 18 }, (_, i) => {
  const angle = (i / 18) * Math.PI * 2 + (i % 3) * 0.4
  const radius = 130 + ((i * 53) % 110)
  return {
    dx: Math.cos(angle) * radius,
    dy: Math.sin(angle) * radius * 0.7,
    delay: (i % 6) * 90,
    size: 3 + (i % 3) * 1.5,
  }
})

export default function SplashScreen({ ready, autoDismiss, onDone }) {
  const [stage, setStage] = useState('dark')
  const [leaving, setLeaving] = useState(false)
  const timers = useRef([])

  useEffect(() => {
    // ?slowsplash slows the timeline 5x — for design review only.
    const scale = new URLSearchParams(window.location.search).has('slowsplash') ? 5 : 1
    timers.current = TIMELINE.map(([s, at]) => setTimeout(() => setStage(s), at * scale))
    return () => timers.current.forEach(clearTimeout)
  }, [])

  const leave = () => {
    if (leaving) return
    setLeaving(true)
    setTimeout(onDone, 700)
  }

  const introDone = stage === 'cta'
  useEffect(() => {
    if (autoDismiss && introDone) leave()
  }, [autoDismiss, introDone]) // eslint-disable-line

  const brand = 'SwasthyaAI'
  const showEcg = stageAtLeast(stage, 'ecg') && !stageAtLeast(stage, 'morph')
  const showOrb = stageAtLeast(stage, 'morph')

  return (
    <div className={`cine ${leaving ? 'cine--leaving' : ''}`} data-stage={stage}>
      <style>{`
        .cine {
          position: fixed; inset: 0; z-index: 10000;
          display: flex; flex-direction: column; align-items: center; justify-content: center;
          background: radial-gradient(1100px 700px at 50% 42%, #0a1730 0%, #050b18 60%, #030710 100%);
          overflow: hidden; opacity: 1;
          transition: opacity 0.7s var(--ease-swift);
          font-family: var(--font-body);
        }
        .cine--leaving { opacity: 0; pointer-events: none; }

        /* ── scene stage: fixed-size so nothing shifts between acts ── */
        .cine__scene { position: relative; width: min(560px, 92vw); height: 240px;
          display: grid; place-items: center; }

        /* ── monitor power-on: standby dot → scanline sweep ── */
        .cine__standby {
          position: absolute; width: 6px; height: 6px; border-radius: 50%;
          background: var(--cyan-400); opacity: 0;
          box-shadow: 0 0 12px var(--cyan-glow);
          animation: cineStandby 0.45s ease forwards;
        }
        @keyframes cineStandby { 40% { opacity: 1; } 100% { opacity: 0.9; } }
        .cine[data-stage="poweron"] .cine__standby,
        .cine__scanline {
          position: absolute; height: 2px; width: 100%;
          background: linear-gradient(90deg, transparent, var(--aqua-300), transparent);
          transform: scaleX(0); opacity: 0;
          filter: drop-shadow(0 0 8px var(--cyan-glow));
        }
        .cine[data-stage="poweron"] .cine__scanline {
          animation: cineScan 0.65s var(--ease-swift) forwards;
        }
        @keyframes cineScan {
          0%   { transform: scaleX(0);   opacity: 0; }
          25%  { opacity: 1; }
          80%  { transform: scaleX(1);   opacity: 0.9; }
          100% { transform: scaleX(1);   opacity: 0.25; }
        }

        /* ── ECG: draw + traveling pulse dot ── */
        .cine__ecg { position: absolute; width: 100%; overflow: visible;
          opacity: 1; transition: opacity 0.5s ease, transform 0.6s var(--ease-swift); }
        .cine__ecg path {
          fill: none; stroke: var(--cyan-400); stroke-width: 2.5;
          stroke-linecap: round; stroke-linejoin: round;
          stroke-dasharray: 1400; stroke-dashoffset: 1400;
          filter: drop-shadow(0 0 6px var(--cyan-glow));
        }
        .cine[data-stage="ecg"] .cine__ecg path,
        .cine[data-stage="particles"] .cine__ecg path {
          animation: cineDraw 1.5s cubic-bezier(0.65, 0, 0.35, 1) forwards;
        }
        @keyframes cineDraw { to { stroke-dashoffset: 0; } }
        .cine__beat {
          position: absolute; width: 10px; height: 10px; border-radius: 50%;
          background: #fff; opacity: 0;
          box-shadow: 0 0 16px var(--aqua-300), 0 0 34px var(--cyan-glow);
        }
        .cine[data-stage="ecg"] .cine__beat,
        .cine[data-stage="particles"] .cine__beat {
          animation: cineBeatTravel 1.5s cubic-bezier(0.65, 0, 0.35, 1) forwards;
        }
        @keyframes cineBeatTravel {
          0%   { opacity: 0; transform: translateX(-260px); }
          10%  { opacity: 1; }
          46%  { transform: translateX(-40px) translateY(0); }
          50%  { transform: translateX(-16px) translateY(-34px); }
          54%  { transform: translateX(6px)  translateY(28px); }
          58%  { transform: translateX(20px) translateY(0); }
          92%  { opacity: 1; }
          100% { opacity: 0; transform: translateX(258px); }
        }
        /* morph: the strip collapses into the point the orb grows from */
        .cine[data-stage="morph"] .cine__ecg,
        .cine[data-stage="brand"] .cine__ecg { opacity: 0; transform: scale(0.15); }

        /* ── neural particles: scattered → converge on center ── */
        .cine__particle {
          position: absolute; border-radius: 50%;
          background: var(--aqua-300);
          box-shadow: 0 0 8px var(--cyan-glow);
          opacity: 0;
        }
        .cine[data-stage="particles"] .cine__particle {
          animation: cineGather 1s var(--ease-swift) forwards;
          animation-delay: var(--pd);
        }
        .cine[data-stage="morph"] .cine__particle {
          animation: cineAbsorb 0.55s ease-in forwards;
        }
        @keyframes cineGather {
          0%   { opacity: 0;   transform: translate(var(--px), var(--py)) scale(0.3); }
          40%  { opacity: 0.9; }
          100% { opacity: 0.8; transform: translate(calc(var(--px) * 0.25), calc(var(--py) * 0.25)) scale(1); }
        }
        @keyframes cineAbsorb {
          to { opacity: 0; transform: translate(0, 0) scale(0.2); }
        }

        /* ── orb entrance ── */
        .cine__orb { position: absolute; opacity: 0; transform: scale(0.2); }
        .cine[data-stage="morph"] .cine__orb,
        .cine[data-stage="brand"] .cine__orb,
        .cine[data-stage="tagline"] .cine__orb,
        .cine[data-stage="langs"] .cine__orb,
        .cine[data-stage="cta"] .cine__orb {
          opacity: 1; transform: scale(1);
          transition: opacity 0.55s var(--ease-swift), transform 0.65s var(--ease-spring);
        }

        /* ── brand / tagline / langs / cta ── */
        .cine__title {
          display: flex; margin-top: 26px; min-height: 58px;
          font-family: var(--font-brand);
          font-size: clamp(36px, 7vw, 56px); font-weight: 700;
        }
        .cine__title span {
          display: inline-block; opacity: 0; transform: translateY(24px);
          background: linear-gradient(120deg, #ffffff 30%, var(--aqua-300) 75%, var(--cyan-400) 100%);
          -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent;
        }
        .cine[data-stage="brand"] .cine__title span,
        .cine[data-stage="tagline"] .cine__title span,
        .cine[data-stage="langs"] .cine__title span,
        .cine[data-stage="cta"] .cine__title span {
          animation: cineRise 0.5s var(--ease-swift) forwards;
          animation-delay: var(--ld);
        }
        @keyframes cineRise { to { opacity: 1; transform: translateY(0); } }

        .cine__tagline {
          margin-top: 12px; min-height: 24px; color: var(--text-mid);
          font-size: clamp(14px, 2.3vw, 17px); text-align: center; padding: 0 24px;
          opacity: 0; transition: opacity 0.6s ease;
        }
        .cine__langs {
          margin-top: 10px; min-height: 18px; color: var(--text-low); font-size: 13px;
          letter-spacing: 0.26em; text-transform: uppercase;
          opacity: 0; transition: opacity 0.6s ease;
        }
        .cine[data-stage="tagline"] .cine__tagline,
        .cine[data-stage="langs"] .cine__tagline,
        .cine[data-stage="cta"] .cine__tagline { opacity: 1; }
        .cine[data-stage="langs"] .cine__langs,
        .cine[data-stage="cta"] .cine__langs { opacity: 1; }

        .cine__foot { margin-top: 36px; height: 54px; display: grid; place-items: center; }
        .cine__cta {
          opacity: 0; transform: translateY(14px);
          animation: cineRise 0.55s var(--ease-swift) forwards;
        }
        .cine__wait { display: flex; gap: 8px; }
        .cine__wait span {
          width: 7px; height: 7px; border-radius: 50%; background: var(--cyan-400);
          opacity: 0.4; animation: cineDots 1.2s var(--ease-breathe) infinite;
        }
        .cine__wait span:nth-child(2) { animation-delay: 0.2s; }
        .cine__wait span:nth-child(3) { animation-delay: 0.4s; }
        @keyframes cineDots { 50% { opacity: 1; transform: translateY(-5px); } }
      `}</style>

      <div className="cine__scene">
        {/* Act 1: monitor powers on */}
        {stage === 'dark' && <span className="cine__standby" />}
        <span className="cine__scanline" />

        {/* Act 2: ECG heartbeat */}
        {showEcg && (
          <>
            <svg className="cine__ecg" viewBox="0 0 520 90" aria-hidden="true">
              <path d="M0 45 H150 L170 45 L185 18 L200 72 L212 30 L224 45 H300 L318 45 L330 28 L342 58 L352 45 H520" />
            </svg>
            <span className="cine__beat" />
          </>
        )}

        {/* Act 3: neural particles gather */}
        {(stage === 'particles' || stage === 'morph') && PARTICLES.map((p, i) => (
          <span
            key={i}
            className="cine__particle"
            style={{
              width: p.size, height: p.size,
              '--px': `${p.dx}px`, '--py': `${p.dy}px`, '--pd': `${p.delay}ms`,
            }}
          />
        ))}

        {/* Act 4: the heartbeat becomes the code of life */}
        <div className="cine__orb">
          {showOrb && <DnaHelix state="idle" size={118} label="SwasthyaAI — living intelligence" />}
        </div>
      </div>

      {/* Act 5: brand reveal */}
      <div className="cine__title" aria-label={brand}>
        {brand.split('').map((ch, i) => (
          <span key={i} style={{ '--ld': `${i * 55}ms` }}>{ch}</span>
        ))}
      </div>
      <div className="cine__tagline">Your AI healthcare companion — book, manage &amp; get reminded, by voice.</div>
      <div className="cine__langs">English · हिन्दी · தமிழ்</div>

      <div className="cine__foot">
        {introDone && ready && !autoDismiss ? (
          <button className="btn btn--primary btn--lg cine__cta" onClick={leave}>
            Get Started <span aria-hidden="true">→</span>
          </button>
        ) : introDone ? (
          <div className="cine__wait" aria-label="Loading">
            <span /><span /><span />
          </div>
        ) : null}
      </div>
    </div>
  )
}
