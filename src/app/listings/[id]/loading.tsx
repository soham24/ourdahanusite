import { OurDahanuLoaderCompact } from '@/components/OurDahanuLoader'

export default function ListingDetailLoading() {
  return (
    <div className="min-h-screen bg-gray-50 animate-warli-fade-in">
      {/* Hero skeleton */}
      <div className="relative w-full h-48 md:h-64 bg-gradient-to-br from-warli-terra/30 to-chikoo-bark/20 overflow-hidden">
        <div className="absolute inset-0 skeleton-shimmer opacity-40" />
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Profile card skeleton */}
        <div className="relative -mt-12 mb-6">
          <div className="bg-white rounded-2xl border border-warli-sand/30 shadow-warm p-6">
            <div className="flex items-start gap-5">
              <div className="w-20 h-20 rounded-2xl skeleton-shimmer shrink-0" />
              <div className="flex-1 space-y-3">
                <div className="h-7 w-56 rounded-lg skeleton-shimmer" />
                <div className="h-4 w-40 rounded skeleton-shimmer" />
                <div className="flex gap-3">
                  <div className="h-6 w-28 rounded-full skeleton-shimmer" />
                  <div className="h-6 w-24 rounded-full skeleton-shimmer" />
                </div>
              </div>
            </div>
          </div>
        </div>

        <OurDahanuLoaderCompact message="Loading business details&hellip;" />
      </div>
    </div>
  )
}
