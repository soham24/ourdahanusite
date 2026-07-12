// Shown instantly on navigation to a professional page while the dynamic
// server component (DB lookups + auth check) streams in — so a card tap gives
// immediate feedback instead of a silent pause.
export default function Loading() {
  const bar = 'rounded bg-[var(--color-gray-100)]'
  return (
    <div className="mx-auto max-w-2xl animate-pulse" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading profile…</span>

      {/* Back pill */}
      <div className={`mb-4 h-7 w-36 rounded-full bg-[var(--color-gray-100)]`} />

      {/* Header card */}
      <div className="od-card p-5 sm:p-6">
        <div className="flex items-start gap-4">
          <div className="h-16 w-16 rounded-[20px] bg-[var(--color-gray-100)]" />
          <div className="min-w-0 flex-1 space-y-2 pt-1">
            <div className={`h-8 w-3/5 ${bar}`} />
            <div className="flex gap-1.5">
              <div className="h-5 w-20 rounded-full bg-[var(--color-gray-100)]" />
              <div className="h-5 w-24 rounded-full bg-[var(--color-gray-100)]" />
            </div>
          </div>
        </div>

        {/* Rating box */}
        <div className="mt-4 h-16 rounded-[14px] bg-[var(--color-surface-soft)]" />

        {/* Action buttons */}
        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <div className="h-11 flex-1 rounded-xl bg-[var(--color-gray-100)]" />
          <div className="h-11 flex-1 rounded-xl bg-[var(--color-gray-100)]" />
        </div>

        <div className="mt-4 space-y-2 border-t border-[var(--od-border)] pt-4">
          <div className={`h-4 w-1/3 ${bar}`} />
          <div className={`h-4 w-4/5 ${bar}`} />
        </div>
      </div>

      {/* Ratings section */}
      <div className="mt-8">
        <div className={`mb-3 h-7 w-28 ${bar}`} />
        <div className="space-y-3">
          {Array.from({ length: 2 }).map((_, i) => (
            <div
              key={i}
              className="rounded-[var(--od-radius)] border border-[var(--od-border)] bg-[var(--color-surface-2)] p-4"
            >
              <div className={`h-3.5 w-24 ${bar}`} />
              <div className={`mt-2 h-4 w-11/12 ${bar}`} />
              <div className={`mt-1.5 h-4 w-2/3 ${bar}`} />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
