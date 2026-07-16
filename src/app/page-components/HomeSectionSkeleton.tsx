/**
 * Lightweight placeholders shown while a homepage section's data loads.
 * Each variant matches the rough height/shape of the real section so the
 * page doesn't jump as content streams in.
 */

interface HomeSectionSkeletonProps {
  variant: 'bar' | 'row' | 'cta' | 'card'
  label?: string
}

export default function HomeSectionSkeleton({ variant, label }: HomeSectionSkeletonProps) {
  if (variant === 'bar') {
    return (
      <>
        <section className="border-y border-[var(--color-border)] bg-[#FBF5EC]">
          <div className="mx-auto flex max-w-[1160px] items-center justify-around gap-4 px-6 py-6">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full skeleton-shimmer" />
                <div className="flex flex-col gap-1.5">
                  <div className="h-6 w-16 rounded skeleton-shimmer" />
                  <div className="h-2 w-20 rounded skeleton-shimmer" />
                </div>
              </div>
            ))}
          </div>
        </section>
        <section className="py-16 bg-[#FAFAF7]">
          <div className="mx-auto max-w-[1160px] px-6">
            <div className="mb-8">
              <div className="h-3 w-16 rounded skeleton-shimmer mb-2" />
              <div className="h-8 w-72 rounded skeleton-shimmer" />
            </div>
            <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-3 lg:grid-cols-6">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="rounded-2xl border border-[var(--color-border)] bg-white p-5 text-center">
                  <div className="mx-auto mb-3 h-14 w-14 rounded-2xl skeleton-shimmer" />
                  <div className="mx-auto h-3 w-20 rounded skeleton-shimmer" />
                  <div className="mx-auto mt-2 h-2 w-14 rounded skeleton-shimmer" />
                </div>
              ))}
            </div>
          </div>
        </section>
      </>
    )
  }

  if (variant === 'row') {
    return (
      <section className="py-12 md:py-16">
        <div className="mx-auto max-w-[1160px] px-6">
          <div className="mb-6">
            <div className="h-3 w-20 rounded skeleton-shimmer mb-2" />
            <div className="h-8 w-56 rounded skeleton-shimmer" aria-label={label} />
          </div>
          <div className="flex gap-4 overflow-hidden">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="min-w-[280px] sm:min-w-[300px] flex-shrink-0 rounded-2xl border border-[var(--color-border)] bg-white"
              >
                <div className="h-[170px] rounded-t-2xl skeleton-shimmer" />
                <div className="p-4">
                  <div className="h-4 w-3/4 rounded skeleton-shimmer mb-2" />
                  <div className="h-3 w-1/2 rounded skeleton-shimmer" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    )
  }

  if (variant === 'cta') {
    return (
      <section className="py-12">
        <div className="mx-auto max-w-[1160px] px-6">
          <div className="rounded-3xl bg-white border border-[var(--color-border)] p-10 text-center">
            <div className="mx-auto h-3 w-24 rounded skeleton-shimmer mb-3" />
            <div className="mx-auto h-8 w-72 rounded skeleton-shimmer mb-3" />
            <div className="mx-auto h-3 w-96 rounded skeleton-shimmer mb-6" />
            <div className="mx-auto h-11 w-40 rounded-xl skeleton-shimmer" />
          </div>
        </div>
      </section>
    )
  }

  // 'card' — generic single card placeholder
  return (
    <section className="py-12 md:py-16">
      <div className="mx-auto max-w-[1160px] px-6">
        <div className="mb-6">
          <div className="h-3 w-20 rounded skeleton-shimmer mb-2" />
          <div className="h-8 w-56 rounded skeleton-shimmer" aria-label={label} />
        </div>
        <div className="rounded-3xl border border-[var(--color-border)] bg-white p-8 h-[260px]">
          <div className="h-4 w-3/4 rounded skeleton-shimmer mb-3" />
          <div className="h-3 w-full rounded skeleton-shimmer mb-2" />
          <div className="h-3 w-5/6 rounded skeleton-shimmer mb-6" />
          <div className="grid grid-cols-2 gap-3">
            <div className="h-12 rounded-xl skeleton-shimmer" />
            <div className="h-12 rounded-xl skeleton-shimmer" />
          </div>
        </div>
      </div>
    </section>
  )
}
