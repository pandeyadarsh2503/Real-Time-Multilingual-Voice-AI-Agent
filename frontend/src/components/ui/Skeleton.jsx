/**
 * Skeleton — shimmer placeholder. Compose several to mirror the real
 * layout so content "develops" in place instead of popping in.
 */
export function Skeleton({ width = '100%', height = 14, radius = 8, style }) {
  return (
    <div
      className="skeleton"
      aria-hidden="true"
      style={{ width, height, borderRadius: radius, ...style }}
    />
  )
}

/** Ready-made card-shaped skeleton (title + 2 lines). */
export function SkeletonCard({ lines = 2 }) {
  return (
    <div className="glass-card" style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 10 }} aria-hidden="true">
      <Skeleton width="45%" height={16} />
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} width={`${88 - i * 14}%`} height={12} />
      ))}
    </div>
  )
}
