import React from 'react'

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  /** When true, uses the warm coastal shimmer; otherwise a subtle pulse. */
  shimmer?: boolean
}

/**
 * Warm content placeholder. Replaces ad-hoc `bg-gray-100 animate-pulse`
 * blocks so loading states match the coastal palette. Pass width/height/radius
 * via className (e.g. `h-10 w-52 rounded-xl`).
 */
export default function Skeleton({ shimmer = true, className = '', ...props }: SkeletonProps) {
  return (
    <div
      className={`${shimmer ? 'skeleton-shimmer' : 'bg-[var(--od-surface-soft)] animate-pulse'} rounded-xl ${className}`}
      {...props}
    />
  )
}
