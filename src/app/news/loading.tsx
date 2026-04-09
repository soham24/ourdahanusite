import OurDahanuLoader, { SkeletonCard } from '@/components/OurDahanuLoader'

export default function NewsLoading() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      <div className="mb-8">
        <div className="h-8 w-36 rounded skeleton-shimmer mb-3" />
        <div className="h-4 w-56 rounded skeleton-shimmer" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {Array.from({ length: 6 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>

      <OurDahanuLoader message="Loading news\u2026" />
    </div>
  )
}
