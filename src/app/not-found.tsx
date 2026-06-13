import Link from 'next/link'
import { Home, Search, MapPin } from 'lucide-react'

export default function NotFound() {
  return (
    <div className="min-h-[70vh] flex items-center justify-center px-5 py-16">
      <div className="w-full max-w-md text-center">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--od-surface-soft)]">
          <MapPin size={30} className="text-[var(--od-brand)]" />
        </div>

        <p className="font-display text-6xl text-[var(--od-brand)]">404</p>
        <h1 className="mt-2 text-2xl font-bold text-[var(--od-ink)]">
          Page not found
        </h1>
        <p className="mt-2 text-[var(--od-muted)]">
          The page you&apos;re looking for doesn&apos;t exist or may have moved.
        </p>

        <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 bg-[var(--od-brand)] hover:bg-[var(--od-brand-strong)] text-white font-semibold px-6 py-3 rounded-xl transition-colors"
          >
            <Home size={17} />
            Go home
          </Link>
          <Link
            href="/listings"
            className="inline-flex items-center justify-center gap-2 bg-white border border-[var(--od-border)] hover:border-[var(--od-brand)] text-[var(--od-ink-2)] hover:text-[var(--od-brand)] font-semibold px-6 py-3 rounded-xl transition-colors"
          >
            <Search size={17} />
            Browse listings
          </Link>
        </div>
      </div>
    </div>
  )
}
