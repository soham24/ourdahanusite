import OurDahanuLoader, { SkeletonRow } from '@/components/OurDahanuLoader'

export default function ForumLoading() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
      <div className="mb-8">
        <div className="h-8 w-40 rounded skeleton-shimmer mb-3" />
        <div className="h-4 w-64 rounded skeleton-shimmer" />
      </div>

      <div className="rounded-xl border border-border/30 bg-white/60 divide-y divide-border/20">
        {Array.from({ length: 6 }).map((_, i) => (
          <SkeletonRow key={i} />
        ))}
      </div>

      <OurDahanuLoader message="Loading discussions\u2026" />
    </div>
  )
}
