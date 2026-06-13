'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { RotateCw, Home, AlertTriangle } from 'lucide-react'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Surface to server/observability so we can see production failures.
    console.error('[app/error]', error.message, error.digest)
  }, [error])

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-5 py-16">
      <div className="w-full max-w-md text-center">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-red-50">
          <AlertTriangle size={30} className="text-[var(--od-danger)]" />
        </div>

        <h1 className="text-2xl font-bold text-[var(--od-ink)]">
          Something went wrong
        </h1>
        <p className="mt-2 text-[var(--od-muted)]">
          An unexpected error occurred. You can try again, or head back home.
        </p>
        {error.digest && (
          <p className="mt-3 text-xs text-[var(--od-muted)]/70">
            Reference: {error.digest}
          </p>
        )}

        <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={reset}
            className="inline-flex items-center justify-center gap-2 bg-[var(--od-brand)] hover:bg-[var(--od-brand-strong)] text-white font-semibold px-6 py-3 rounded-xl transition-colors"
          >
            <RotateCw size={17} />
            Try again
          </button>
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 bg-white border border-[var(--od-border)] hover:border-[var(--od-brand)] text-[var(--od-ink-2)] hover:text-[var(--od-brand)] font-semibold px-6 py-3 rounded-xl transition-colors"
          >
            <Home size={17} />
            Go home
          </Link>
        </div>
      </div>
    </div>
  )
}
