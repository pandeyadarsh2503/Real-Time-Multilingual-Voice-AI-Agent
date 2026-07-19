import GlassCard from './GlassCard'
import { Skeleton } from './Skeleton'

/**
 * MetricCard — one number that matters, with context.
 * `value === undefined` renders the skeleton state so dashboards
 * shimmer instead of flashing zeros.
 */
export default function MetricCard({ label, value, hint, accent, loading = false }) {
  return (
    <GlassCard className="metric-card">
      <span className="metric-card__label">{label}</span>
      {loading || value === undefined ? (
        <Skeleton width="60%" height={30} />
      ) : (
        <span className="metric-card__value" style={accent ? { color: accent } : undefined}>{value}</span>
      )}
      {hint && <span className="metric-card__hint">{hint}</span>}
    </GlassCard>
  )
}
