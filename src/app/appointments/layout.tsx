import Link from 'next/link'
import type { Metadata } from 'next'
import { siteConfig } from '@/lib/site'

export const metadata: Metadata = {
  title: `Book an Appointment in ${siteConfig.town}`,
  description:
    `Book appointments with clinics, dentists, salons and tutors in ${siteConfig.town}. See the next free slot and book online.`,
}

export default function AppointmentsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="od-page flex min-h-dvh flex-col text-[var(--od-ink)]">
      <a
        href="#appointments-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-white focus:px-3 focus:py-2 focus:text-sm focus:font-semibold"
      >
        Skip to content
      </a>

      <header className="sticky top-0 z-40 border-b border-[var(--od-border)] bg-[rgba(250,250,247,0.88)] backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
          <Link href="/appointments" className="flex items-baseline">
            <span className="font-display text-[1.4rem] leading-none">Book</span>
            <span className="font-display text-[1.4rem] italic leading-none text-[var(--od-brand)]">
              {siteConfig.town}
            </span>
          </Link>
          <a
            href="https://ourdahanu.in/listings"
            className="text-xs font-bold text-[var(--od-brand)] transition-colors hover:text-[var(--od-brand-strong)]"
          >
            All businesses →
          </a>
        </div>
      </header>

      <main
        id="appointments-content"
        className="mx-auto w-full max-w-5xl flex-1 scroll-mt-14 px-4 pb-16 pt-6"
      >
        {children}
      </main>

      <footer className="border-t border-[var(--od-border)] bg-[var(--color-surface-2)]">
        <div className="warli-divider opacity-70" aria-hidden />
        <div className="mx-auto flex max-w-5xl flex-col items-center gap-1.5 px-4 py-6 text-center">
          <p className="text-xs text-[var(--od-muted)]">
            Cancellations are handled by the business.
          </p>
          <a
            href={`https://${siteConfig.domain}`}
            className="text-xs font-bold text-[var(--od-brand)] transition-colors hover:text-[var(--od-brand-strong)]"
          >
            Part of {siteConfig.name} →
          </a>
        </div>
      </footer>
    </div>
  )
}
