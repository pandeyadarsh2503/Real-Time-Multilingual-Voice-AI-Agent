import { useEffect, useRef, useState } from 'react'

const LANGS = [
  { code: 'en', label: 'EN' },
  { code: 'hi', label: 'हिं' },
  { code: 'ta', label: 'த' },
]

/**
 * LanguagePills — segmented EN / हिं / த selector with a sliding thumb.
 * The thumb position is measured from the active button so it stays
 * correct at any font-size / zoom.
 */
export default function LanguagePills({ value, onChange, className = '' }) {
  const containerRef = useRef(null)
  const [thumb, setThumb] = useState({ left: 3, width: 0 })

  useEffect(() => {
    const el = containerRef.current?.querySelector(`button[data-lang="${value}"]`)
    if (el) setThumb({ left: el.offsetLeft, width: el.offsetWidth })
  }, [value])

  return (
    <div ref={containerRef} className={`lang-pills ${className}`} role="group" aria-label="Language">
      <span className="lang-pills__thumb" style={{ left: thumb.left, width: thumb.width }} aria-hidden="true" />
      {LANGS.map((l) => (
        <button
          key={l.code}
          data-lang={l.code}
          aria-pressed={value === l.code}
          onClick={() => onChange?.(l.code)}
          type="button"
        >
          {l.label}
        </button>
      ))}
    </div>
  )
}
