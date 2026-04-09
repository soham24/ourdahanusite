import OurDahanuLoader, { SkeletonCard } from '@/components/OurDahanuLoader'

export default function ShopLoading() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      <div className="mb-8">
        <div className="h-8 w-32 rounded skeleton-shimmer mb-3" />
        <div className="h-4 w-52 rounded skeleton-shimmer" />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>

      <OurDahanuLoader message="Loading shop\u2026" />
    </div>
  )
}
