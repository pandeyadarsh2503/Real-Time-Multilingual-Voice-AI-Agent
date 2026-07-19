import { useEffect, useRef } from 'react'
import Waveform from './Waveform'

/**
 * DnaHelix — the visual identity of SwasthyaAI.
 *
 * A holographic double helix: glowing nodes on two strands, thin rung
 * connections, slow 3D rotation with real depth (far side recedes and
 * dims), particles travelling the strands, floating on a soft glow.
 *
 * States
 *   idle      slow rotation, nodes breathe, particles drift
 *   listening rotation eases, brightness up, pulse climbs the helix,
 *             particles gather to the middle, sonar rings, faint ECG
 *   thinking  neural sweep — nodes & rungs light sequentially, faster
 *             rotation, three orbiting motes: intelligence, not loading
 *   speaking  rhythmic energy synced to the voice level, particles
 *             stream downward, waves radiate
 *   success   cyan → soft green, a pulse runs bottom→top, gentle
 *             particle burst, then settles back
 *   error     rotation pauses, glow fades, one soft amber pulse
 *   muted/off dim, near-still
 *
 * Engine: single rAF writing SVG attributes via refs — zero React
 * re-renders per frame; all layer motion (float/parallax/rings) is
 * composited CSS. prefers-reduced-motion → static pose, glow only.
 *
 * Drop-in replacement for the old VoiceOrb (state, size, getLevel, label).
 */

const N = 9            // rungs
const TWIST = 0.62     // radians of twist per rung
const SPACING = 26     // px between rungs (viewBox units)
const RADIUS = 50
const CX = 100
const Y0 = 44
const VIEW_W = 200
const VIEW_H = 300

const SPEED = { idle: 0.4, listening: 0.24, thinking: 0.95, speaking: 0.55, success: 0.4, error: 0, muted: 0.05, off: 0 }

const CYAN = [34, 211, 238]
const AQUA = [103, 232, 249]
const WHITE = [255, 255, 255]
const GREEN = [52, 211, 153]
const GREY = [120, 138, 165]
const AMBER = [251, 191, 36]

const mix = (a, b, t) => [
  Math.round(a[0] + (b[0] - a[0]) * t),
  Math.round(a[1] + (b[1] - a[1]) * t),
  Math.round(a[2] + (b[2] - a[2]) * t),
]
const rgba = (c, a) => `rgba(${c[0]},${c[1]},${c[2]},${a})`

// particle field: 12 strand-travellers (+ their strand & speed factor)
const TRAVELLERS = Array.from({ length: 12 }, (_, i) => ({
  strand: i % 2, u: (i * 0.137) % 1, rate: 0.6 + (i % 4) * 0.2,
}))

// light signals: bright pulses racing the strands with fading tails —
// the energy running through the engine
const SIGNALS = [
  { strand: 0, u: 0.0,  speed: 0.15 },
  { strand: 0, u: 0.55, speed: 0.12 },
  { strand: 1, u: 0.3,  speed: 0.17 },
  { strand: 1, u: 0.8,  speed: 0.13 },
]
const TRAIL = [0, -0.045, -0.09]

export default function DnaHelix({
  state = 'idle',
  size = 200,
  getLevel,
  label,
  withWaveform = false,
  onActivate,
  /** false: never intercepts the pointer (hero/backdrop placements);
      parallax then follows the cursor across the whole window. */
  interactive = true,
}) {
  const wrapRef = useRef(null)
  const tiltRef = useRef(null)
  const nodesA = useRef([])
  const nodesB = useRef([])
  const rungs = useRef([])
  const strandA = useRef(null)
  const strandB = useRef(null)
  const strandAGhost = useRef(null)
  const strandBGhost = useRef(null)
  const signalRefs = useRef([])
  const travellers = useRef([])
  const orbiters = useRef([])
  const burst = useRef([])
  const stateRef = useRef(state)
  const successT0 = useRef(-1)
  const errorT0 = useRef(-1)

  useEffect(() => {
    const prev = stateRef.current
    stateRef.current = state
    if (state === 'success' && prev !== 'success') successT0.current = performance.now()
    if (state === 'error' && prev !== 'error') errorT0.current = performance.now()
  }, [state])

  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let raf
    let phase = 0.6
    let level = 0
    let sweep = 0            // thinking neural sweep position
    let pulseU = 1           // listening pulse (1=bottom → 0=top)
    let mouse = { x: 0, y: 0 }
    let tilt = { x: 0, y: 0 }
    let last = performance.now()
    const travel = TRAVELLERS.map((t) => ({ ...t }))

    const nodePos = (strand, f, ph) => {
      // f: fractional rung index 0..N-1
      const a = ph + f * TWIST + (strand ? Math.PI : 0)
      return {
        x: CX + Math.sin(a) * RADIUS,
        y: Y0 + f * SPACING,
        z: Math.cos(a), // -1 (far) .. 1 (near)
      }
    }

    const onMove = (e) => {
      if (interactive) {
        const r = wrapRef.current?.getBoundingClientRect()
        if (!r) return
        mouse.x = ((e.clientX - r.left) / r.width - 0.5) * 2
        mouse.y = ((e.clientY - r.top) / r.height - 0.5) * 2
      } else {
        mouse.x = (e.clientX / window.innerWidth - 0.5) * 2
        mouse.y = (e.clientY / window.innerHeight - 0.5) * 2
      }
    }
    const onLeave = () => { mouse.x = 0; mouse.y = 0 }
    const el = wrapRef.current
    const pointerSource = interactive ? el : window
    if (!reduced && pointerSource) {
      pointerSource.addEventListener('mousemove', onMove)
      pointerSource.addEventListener('mouseleave', onLeave)
    }
    const signals = SIGNALS.map((s) => ({ ...s }))

    const frame = (now) => {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      const st = stateRef.current
      const t = now / 1000

      // ── success / error timelines ──
      const sT = successT0.current > 0 ? (now - successT0.current) / 1000 : -1
      const inSuccess = sT >= 0 && sT < 1.7
      const eT = errorT0.current > 0 ? (now - errorT0.current) / 1000 : -1

      // ── audio level (attack fast, release slow) ──
      const target = Math.max(0, Math.min(1, getLevel?.() || 0))
      level += (target - level) * (target > level ? 0.4 : 0.07)

      // ── rotation ──
      let speed = SPEED[st] ?? SPEED.idle
      if (st === 'listening') speed *= 1 + level * 0.8   // voice nudges it alive
      phase += speed * dt * (reduced ? 0 : 1)

      // ── state color & glow ──
      let base = CYAN
      let glow = 0.55
      if (st === 'listening') { base = mix(CYAN, WHITE, 0.12 + level * 0.2); glow = 0.8 + level * 0.2 }
      if (st === 'thinking') glow = 0.75
      if (st === 'speaking') { base = mix(CYAN, WHITE, level * 0.25); glow = 0.7 + level * 0.3 }
      if (st === 'muted' || st === 'off') { base = GREY; glow = 0.18 }
      if (st === 'error') {
        const amber = eT >= 0 ? Math.max(0, Math.sin(Math.min(eT, 1.2) * Math.PI)) * 0.5 : 0
        base = mix(mix(CYAN, GREY, 0.75), AMBER, amber)
        glow = 0.25 + amber * 0.25
      }
      if (inSuccess) {
        const k = sT < 0.45 ? sT / 0.45 : sT > 1.25 ? Math.max(0, 1 - (sT - 1.25) / 0.45) : 1
        base = mix(base, GREEN, k)
        glow = 0.6 + k * 0.35
      }

      // ── pulses & sweeps ──
      if (st === 'listening') { pulseU -= dt * 0.55; if (pulseU < -0.25) pulseU = 1.15 }
      if (st === 'thinking') sweep = (sweep + dt * 6.5) % (N * 2)
      const successPulseU = inSuccess ? Math.min(1.1, sT / 0.9) : -1 // bottom→top

      // ── nodes, strands, rungs ──
      const ptsA = []
      const ptsB = []
      for (let i = 0; i < N; i++) {
        const pa = nodePos(0, i, phase)
        const pb = nodePos(1, i, phase)
        ptsA.push(pa); ptsB.push(pb)

        for (const [p, ref, strandIdx] of [[pa, nodesA.current[i], 0], [pb, nodesB.current[i], 1]]) {
          if (!ref) continue
          const depth = (p.z + 1) / 2                       // 0 far → 1 near
          const breathe = reduced ? 1 : 1 + 0.07 * Math.sin(t * 1.5 + i * 0.9 + strandIdx * 2)
          let boost = 0
          if (st === 'thinking') {
            const d = Math.abs(((strandIdx * N + i) - sweep + N * 2) % (N * 2))
            boost = Math.max(0, 1 - Math.min(d, N * 2 - d) / 2.2)
          }
          if (st === 'listening' && pulseU >= -0.2) {
            boost = Math.max(boost, Math.max(0, 1 - Math.abs(i / (N - 1) - pulseU) * 3.2))
          }
          if (successPulseU >= 0) {
            boost = Math.max(boost, Math.max(0, 1 - Math.abs((1 - i / (N - 1)) - successPulseU) * 3))
          }
          if (st === 'speaking') boost = Math.max(boost, (0.35 + level) * Math.max(0, Math.sin(t * 9 + i * 1.1)))

          const color = mix(base, WHITE, Math.min(1, boost * 0.85 + depth * 0.12))
          ref.setAttribute('cx', p.x.toFixed(2))
          ref.setAttribute('cy', p.y.toFixed(2))
          ref.setAttribute('r', (4.4 * (0.5 + depth * 0.55) * breathe * (1 + boost * 0.35)).toFixed(2))
          ref.setAttribute('fill', rgba(color, 0.35 + depth * 0.62 * glow + boost * 0.25))
        }

        const rung = rungs.current[i]
        if (rung) {
          const depth = ((pa.z + pb.z) / 2 + 1) / 2
          let lit = 0
          if (st === 'thinking') {
            const d = Math.abs((i - (sweep % N) + N) % N)
            lit = Math.max(0, 1 - Math.min(d, N - d) / 1.6)
          }
          rung.setAttribute('x1', pa.x.toFixed(2)); rung.setAttribute('y1', pa.y.toFixed(2))
          rung.setAttribute('x2', pb.x.toFixed(2)); rung.setAttribute('y2', pb.y.toFixed(2))
          rung.setAttribute('stroke', rgba(mix(base, WHITE, lit * 0.7), (0.1 + depth * 0.3 + lit * 0.45) * glow))
        }
      }
      const d = (pts) => pts.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ')
      const dA = d(ptsA)
      const dB = d(ptsB)
      strandA.current?.setAttribute('d', dA)
      strandA.current?.setAttribute('stroke', rgba(base, 0.35 * glow + 0.1))
      strandB.current?.setAttribute('d', dB)
      strandB.current?.setAttribute('stroke', rgba(mix(base, AQUA, 0.5), 0.3 * glow + 0.08))
      // ghost underlay: wider, dimmer copies read as out-of-focus depth
      strandAGhost.current?.setAttribute('d', dA)
      strandAGhost.current?.setAttribute('stroke', rgba(base, 0.09 * glow + 0.03))
      strandBGhost.current?.setAttribute('d', dB)
      strandBGhost.current?.setAttribute('stroke', rgba(mix(base, AQUA, 0.5), 0.08 * glow + 0.03))

      // ── strand travellers ──
      travel.forEach((tr, i) => {
        const ref = travellers.current[i]
        if (!ref) return
        if (!reduced) {
          if (st === 'listening') {
            tr.u += (0.5 - tr.u) * dt * (1.2 + level * 3)   // gather to middle, faster on voice
          } else {
            const dir = st === 'speaking' ? 1 : -1           // speaking: downward
            tr.u = (tr.u + dir * dt * tr.rate * (st === 'thinking' ? 2.2 : 0.22 + level) + 1) % 1
          }
        }
        const p = nodePos(tr.strand, tr.u * (N - 1), phase)
        const depth = (p.z + 1) / 2
        ref.setAttribute('cx', p.x.toFixed(2))
        ref.setAttribute('cy', p.y.toFixed(2))
        ref.setAttribute('fill', rgba(mix(base, WHITE, 0.55), (0.25 + depth * 0.55) * glow))
      })

      // ── light signals racing the strands ──
      signals.forEach((sig, i) => {
        if (!reduced) {
          const boost = st === 'thinking' ? 2.4 : st === 'speaking' ? 2.0 : st === 'listening' ? 1.4 : 1
          sig.u = (sig.u + dt * sig.speed * boost) % 1
        }
        TRAIL.forEach((off, k) => {
          const ref = signalRefs.current[i * TRAIL.length + k]
          if (!ref) return
          const u = ((sig.u + off) % 1 + 1) % 1
          const p = nodePos(sig.strand, u * (N - 1), phase)
          const depth = (p.z + 1) / 2
          ref.setAttribute('cx', p.x.toFixed(2))
          ref.setAttribute('cy', p.y.toFixed(2))
          ref.setAttribute('r', (2.5 - k * 0.7).toFixed(2))
          ref.setAttribute('fill', rgba(mix(base, WHITE, 0.85), (0.85 - k * 0.3) * (0.3 + depth * 0.7) * glow))
        })
      })

      // ── thinking orbiters ──
      orbiters.current.forEach((ref, i) => {
        if (!ref) return
        const vis = st === 'thinking' ? 1 : 0
        const a = t * (1.1 + i * 0.25) + i * 2.1
        ref.setAttribute('cx', (CX + Math.cos(a) * (RADIUS + 22)).toFixed(2))
        ref.setAttribute('cy', (VIEW_H / 2 + Math.sin(a) * (RADIUS + 34) * 0.9).toFixed(2))
        ref.setAttribute('opacity', (vis * (0.35 + 0.25 * Math.sin(t * 3 + i))).toFixed(2))
      })

      // ── success burst ──
      burst.current.forEach((ref, i) => {
        if (!ref) return
        if (inSuccess && sT > 0.45) {
          const bt = Math.min(1, (sT - 0.45) / 0.9)
          const a = (i / burst.current.length) * Math.PI * 2
          const r = 26 + bt * 62
          ref.setAttribute('cx', (CX + Math.cos(a) * r).toFixed(2))
          ref.setAttribute('cy', (VIEW_H / 2 + Math.sin(a) * r).toFixed(2))
          ref.setAttribute('opacity', (Math.max(0, 1 - bt) * 0.8).toFixed(2))
        } else {
          ref.setAttribute('opacity', '0')
        }
      })

      // ── perspective: gentle autonomous sway + cursor parallax ──
      if (tiltRef.current && !reduced) {
        tilt.x += (mouse.x - tilt.x) * 0.06
        tilt.y += (mouse.y - tilt.y) * 0.06
        const swayY = Math.sin(t * 0.26) * 4.5
        const swayX = Math.cos(t * 0.21) * 2.5
        tiltRef.current.style.transform =
          `perspective(700px) rotateY(${(tilt.x * 7 + swayY).toFixed(2)}deg) rotateX(${(-tilt.y * 6 + swayX).toFixed(2)}deg)`
      }

      if (!reduced) raf = requestAnimationFrame(frame)
    }

    raf = requestAnimationFrame(frame)
    // reduced motion: render a handful of static frames (state changes still restyle)
    let staticIv
    if (reduced) staticIv = setInterval(() => frame(performance.now()), 600)

    return () => {
      cancelAnimationFrame(raf)
      if (staticIv) clearInterval(staticIv)
      if (pointerSource) {
        pointerSource.removeEventListener('mousemove', onMove)
        pointerSource.removeEventListener('mouseleave', onLeave)
      }
    }
  }, [getLevel, interactive])

  const height = size * (VIEW_H / VIEW_W)

  return (
    <div
      ref={wrapRef}
      className="dna"
      data-state={state}
      style={{ width: size, pointerEvents: interactive ? undefined : 'none' }}
      role="img"
      aria-label={label || `Assistant is ${state}`}
      onClick={() => {
        wrapRef.current?.classList.remove('dna--tapped')
        void wrapRef.current?.offsetWidth   // retrigger pulse
        wrapRef.current?.classList.add('dna--tapped')
        onActivate?.()
      }}
    >
      <div className="dna__floater">
        <div ref={tiltRef} className="dna__tilt">
          <span className="dna__coreGlow" aria-hidden="true" />
          {/* sonar rings — CSS-driven by data-state */}
          <span className="dna__ring" />
          <span className="dna__ring" />
          <span className="dna__ring" />

          <svg viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} width={size} height={height} className="dna__svg">
            {/* ambient neural field */}
            <g className="dna__field" aria-hidden="true">
              <line x1="18" y1="70" x2="52" y2="104" />
              <line x1="176" y1="196" x2="148" y2="236" />
              <line x1="30" y1="230" x2="60" y2="212" />
              <circle cx="18" cy="70" r="1.6" />
              <circle cx="52" cy="104" r="1.2" />
              <circle cx="176" cy="196" r="1.5" />
              <circle cx="148" cy="236" r="1.1" />
              <circle cx="30" cy="230" r="1.3" />
              <circle cx="185" cy="60" r="1.4" />
            </g>

            {/* faint ECG — visible while listening / on success */}
            <path
              className="dna__ecg"
              d="M0 150 H60 L72 150 L80 132 L88 168 L95 141 L102 150 H140 L200 150"
              aria-hidden="true"
            />

            {/* strands (ghost underlay first = depth blur) */}
            <path ref={strandAGhost} className="dna__strand dna__strand--ghost" />
            <path ref={strandBGhost} className="dna__strand dna__strand--ghost" />
            <path ref={strandA} className="dna__strand" />
            <path ref={strandB} className="dna__strand" />

            {/* rungs */}
            {Array.from({ length: N }).map((_, i) => (
              <line key={`r${i}`} ref={(e) => (rungs.current[i] = e)} strokeWidth="1.1" />
            ))}

            {/* nodes */}
            {Array.from({ length: N }).map((_, i) => (
              <circle key={`a${i}`} ref={(e) => (nodesA.current[i] = e)} className="dna__node" />
            ))}
            {Array.from({ length: N }).map((_, i) => (
              <circle key={`b${i}`} ref={(e) => (nodesB.current[i] = e)} className="dna__node" />
            ))}

            {/* strand travellers */}
            {TRAVELLERS.map((_, i) => (
              <circle key={`t${i}`} ref={(e) => (travellers.current[i] = e)} r="1.7" />
            ))}

            {/* light signals with fading tails */}
            {SIGNALS.flatMap((_, i) => TRAIL.map((_2, k) => (
              <circle key={"sig" + i + "-" + k} ref={(e) => (signalRefs.current[i * TRAIL.length + k] = e)} />
            )))}

            {/* thinking orbiters */}
            {Array.from({ length: 3 }).map((_, i) => (
              <circle key={`o${i}`} ref={(e) => (orbiters.current[i] = e)} r="2" fill="#67e8f9" opacity="0" />
            ))}

            {/* success burst */}
            {Array.from({ length: 12 }).map((_, i) => (
              <circle key={`s${i}`} ref={(e) => (burst.current[i] = e)} r="1.8" fill="#6ee7b7" opacity="0" />
            ))}
          </svg>
        </div>
      </div>

      {withWaveform && (
        <div className="dna__wave" aria-hidden="true">
          <Waveform getLevel={getLevel} height={44} />
        </div>
      )}
    </div>
  )
}
