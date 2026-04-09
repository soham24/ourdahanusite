import OurDahanuLoader, { SkeletonCard } from '@/components/OurDahanuLoader'

export default function ClassifiedsLoading() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      <div className="mb-8">
        <div className="h-8 w-44 rounded skeleton-shimmer mb-3" />
        <div className="h-4 w-60 rounded skeleton-shimmer" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {Array.from({ length: 6 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>

      <OurDahanuLoader message="Loading classifieds\u2026" />
    </div>
  )
}
