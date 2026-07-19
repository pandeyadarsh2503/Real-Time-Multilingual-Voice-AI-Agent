import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'

/**
 * Dialog — scale-in modal on a blurred backdrop.
 * Esc and backdrop-click close it; focus moves into the panel on open
 * and is restored on close. Content is scrollable past 88vh.
 */
export default function Dialog({ open, onClose, labelledBy, children, maxWidth = 480 }) {
  const panelRef = useRef(null)
  const lastFocused = useRef(null)

  useEffect(() => {
    if (!open) return
    lastFocused.current = document.activeElement
    panelRef.current?.focus()
    const onKey = (e) => { if (e.key === 'Escape') onClose?.() }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      lastFocused.current?.focus?.()
    }
  }, [open, onClose])

  if (!open) return null

  return createPortal(
    <div
      className="dialog-backdrop"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose?.() }}
    >
      <div
        ref={panelRef}
        className="dialog-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        tabIndex={-1}
        style={{ maxWidth }}
      >
        {children}
      </div>
    </div>,
    document.body
  )
}
