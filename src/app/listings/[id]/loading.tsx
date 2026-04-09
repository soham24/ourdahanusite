import { OurDahanuLoaderCompact } from '@/components/OurDahanuLoader'

export default function ListingDetailLoading() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
      {/* Hero image skeleton */}
      <div className="w-full h-56 sm:h-72 lg:h-80 rounded-2xl skeleton-shimmer mb-6" />

      {/* Title + badge row */}
      <div className="flex items-start gap-3 mb-4">
        <div className="h-8 w-64 rounded skeleton-shimmer" />
        <div className="h-6 w-20 rounded-full skeleton-shimmer shrink-0" />
      </div>

      {/* Category + address */}
      <div className="space-y-2 mb-6">
        <div className="h-4 w-36 rounded skeleton-shimmer" />
        <div className="h-4 w-56 rounded skeleton-shimmer" />
      </div>

      {/* Description lines */}
      <div className="space-y-3 mb-8">
        <div className="h-4 w-full rounded skeleton-shimmer" />
        <div className="h-4 w-full rounded skeleton-shimmer" />
        <div className="h-4 w-4/5 rounded skeleton-shimmer" />
        <div className="h-4 w-3/5 rounded skeleton-shimmer" />
      </div>

      {/* Contact buttons skeleton */}
      <div className="flex gap-3 mb-8">
        <div className="h-11 w-32 rounded-lg skeleton-shimmer" />
        <div className="h-11 w-32 rounded-lg skeleton-shimmer" />
        <div className="h-11 w-28 rounded-lg skeleton-shimmer" />
      </div>

      <OurDahanuLoaderCompact message="Loading business details\u2026" />
    </div>
  )
}
