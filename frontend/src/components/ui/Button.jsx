/**
 * Button — the only button in the app.
 * variants: primary (AI-cyan, one per view max) | glass | ghost | danger
 * sizes: sm | md | lg.  `loading` swaps content for a spinner but keeps
 * width stable so layouts never jump.
 */
export default function Button({
  variant = 'glass',
  size = 'md',
  loading = false,
  disabled = false,
  children,
  className = '',
  ...rest
}) {
  return (
    <button
      className={`btn btn--${variant} btn--${size} ${className}`}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading && <span className="btn__spinner" aria-hidden="true" />}
      <span style={loading ? { opacity: 0.75 } : undefined}>{children}</span>
    </button>
  )
}
