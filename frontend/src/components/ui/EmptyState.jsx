/**
 * EmptyState — no blank pages, ever. Every empty view proposes the
 * next action (talk to the AI, book, browse doctors).
 */
export default function EmptyState({ icon = '🩺', title, description, children }) {
  return (
    <div className="empty-state">
      <div className="empty-state__icon" aria-hidden="true">{icon}</div>
      <div className="empty-state__title">{title}</div>
      {description && <div className="empty-state__desc">{description}</div>}
      {children && <div className="empty-state__actions">{children}</div>}
    </div>
  )
}
