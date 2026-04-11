import { OurDahanuLoaderCompact } from '@/components/OurDahanuLoader'

export default function PollDetailLoading() {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
      <div className="mb-6">
        <div className="h-8 w-48 rounded skeleton-shimmer mb-3" />
        <div className="h-4 w-72 rounded skeleton-shimmer" />
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg skeleton-shimmer" />
          <div className="h-5 w-64 rounded skeleton-shimmer" />
        </div>
        <div className="space-y-2.5">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="h-12 w-full rounded-xl skeleton-shimmer" />
          ))}
        </div>
        <div className="flex items-center justify-between pt-2">
          <div className="h-3 w-20 rounded skeleton-shimmer" />
          <div className="h-3 w-28 rounded skeleton-shimmer" />
        </div>
      </div>

      <OurDahanuLoaderCompact message="Loading poll..." />
    </div>
  )
}
