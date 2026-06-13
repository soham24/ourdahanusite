import React from 'react'

interface EmptyStateProps {
  /** Lucide icon element or emoji string. */
  icon?: React.ReactNode
  title: string
  description?: string
  action?: React.ReactNode
  className?: string
}

/**
 * Consistent empty / no-results state. Replaces the scattered
 * "emoji + heading + paragraph" blocks so they share spacing and warm tone.
 */
export default function EmptyState({ icon, title, description, action, className = '' }: EmptyStateProps) {
  return (
    <div className={`flex flex-col items-center text-center px-6 py-14 ${className}`}>
      {icon && (
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--od-surface-soft)] text-2xl text-[var(--od-brand)]">
          {icon}
        </div>
      )}
      <h2 className="text-lg font-bold text-[var(--od-ink)]">{title}</h2>
      {description && (
        <p className="mt-1.5 max-w-md text-sm leading-relaxed text-[var(--od-muted)]">{description}</p>
      )}
      {action && <div className="mt-6">{action}</div>}
    </div>
  )
}
