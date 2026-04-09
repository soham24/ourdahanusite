import OurDahanuLoader, { SkeletonCard } from '@/components/OurDahanuLoader'

export default function ListingsLoading() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      {/* Header skeleton */}
      <div className="mb-8">
        <div className="h-8 w-48 rounded skeleton-shimmer mb-3" />
        <div className="h-4 w-72 rounded skeleton-shimmer" />
      </div>

      {/* Category filter skeleton */}
      <div className="flex gap-2 mb-8 overflow-hidden">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-9 w-24 rounded-full skeleton-shimmer shrink-0" />
        ))}
      </div>

      {/* Card grid skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {Array.from({ length: 6 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>

      {/* Centered brand loader below the grid */}
      <OurDahanuLoader message="Loading listings\u2026" />
    </div>
  )
}
