import { useEffect, useRef } from 'react'

/**
 * VoiceOrb — the AI's physical presence. Replaces "chatbot" with
 * "something alive is listening".
 *
 * states: idle (slow breathing) | listening (pulse + sonar ripples)
 *         thinking (rotating rings) | speaking (expanding sound waves)
 *         muted (grey + slash) | off (dim)
 *
 * `getLevel` (optional): () => 0..1 microphone/output energy. Sampled
 * on rAF and applied as a transform on the core so the orb physically
 * reacts to sound — smoothed, GPU-only, no re-renders.
 */
export default function VoiceOrb({ state = 'idle', size = 180, getLevel, label }) {
  const coreRef = useRef(null)
  const smoothed = useRef(0)

  useEffect(() => {
    if (!getLevel) return
    let raf
    const tick = () => {
      const target = Math.max(0, Math.min(1, getLevel() || 0))
      // attack fast, release slow — feels like it hears you
      smoothed.current += (target - smoothed.current) * (target > smoothed.current ? 0.4 : 0.08)
      if (coreRef.current) {
        const s = 1 + smoothed.current * 0.18
        coreRef.current.style.transform = `scale(${s})`
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(raf)
      if (coreRef.current) coreRef.current.style.transform = ''
    }
  }, [getLevel, state])

  return (
    <div
      className="orb"
      data-state={state}
      style={{ width: size, height: size }}
      role="img"
      aria-label={label || `Assistant is ${state}`}
    >
      <span className="orb__ripple" />
      <span className="orb__ripple" />
      <span className="orb__ripple" />
      <span className="orb__aura" />
      <span className="orb__ring orb__ring--a" />
      <span className="orb__ring orb__ring--b" />
      <span ref={coreRef} className="orb__core" />
      <span className="orb__slash" />
    </div>
  )
}
