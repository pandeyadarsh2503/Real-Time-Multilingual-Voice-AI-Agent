import { useEffect, useRef } from 'react'

/**
 * Waveform — flowing bezier ribbon, not an equalizer.
 * Three phase-shifted sine ribbons whose amplitude follows the live
 * audio level (Siri / ChatGPT-Voice lineage). Canvas + rAF, DPR-aware,
 * ~0 React re-renders. Flat-lines gracefully when idle.
 *
 * props: getLevel () => 0..1, color, height
 */
export default function Waveform({ getLevel, color = '#22d3ee', height = 56 }) {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const dpr = window.devicePixelRatio || 1
    let raf
    let t = 0
    let level = 0

    const resize = () => {
      const { clientWidth, clientHeight } = canvas
      canvas.width = clientWidth * dpr
      canvas.height = clientHeight * dpr
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(canvas)

    const ribbon = (amp, speed, phase, alpha, thickness) => {
      const w = canvas.width
      const h = canvas.height
      const mid = h / 2
      ctx.beginPath()
      const STEPS = 48
      for (let i = 0; i <= STEPS; i++) {
        const x = (i / STEPS) * w
        // window the amplitude so the ribbon pinches at the edges
        const window_ = Math.sin((i / STEPS) * Math.PI)
        const y = mid +
          Math.sin(i * 0.35 + t * speed + phase) *
          amp * window_ * mid * 0.85
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
      }
      ctx.strokeStyle = color
      ctx.globalAlpha = alpha
      ctx.lineWidth = thickness * dpr
      ctx.lineCap = 'round'
      ctx.stroke()
      ctx.globalAlpha = 1
    }

    const tick = () => {
      const target = Math.max(0, Math.min(1, getLevel?.() || 0))
      level += (target - level) * (target > level ? 0.35 : 0.06)
      const amp = 0.08 + level * 0.92          // never fully flat — alive
      t += 0.09 + level * 0.12                 // sound speeds the flow

      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ribbon(amp, 1.0, 0, 0.9, 2.2)
      ribbon(amp * 0.65, 1.35, 1.7, 0.45, 1.6)
      ribbon(amp * 0.4, 0.8, 3.4, 0.25, 1.2)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)

    return () => { cancelAnimationFrame(raf); ro.disconnect() }
  }, [getLevel, color])

  return (
    <canvas
      ref={canvasRef}
      className="waveform-canvas"
      style={{ height }}
      aria-hidden="true"
    />
  )
}
