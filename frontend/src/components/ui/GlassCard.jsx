/**
 * GlassCard — the base surface of the dark theme.
 * `floaty` adds the hover-lift used on interactive cards; static
 * informational cards should omit it (motion = interactivity).
 */
export default function GlassCard({ floaty = false, className = '', style, children, ...rest }) {
  return (
    <div
      className={`glass-card ${floaty ? 'floaty' : ''} ${className}`}
      style={style}
      {...rest}
    >
      {children}
    </div>
  )
}
