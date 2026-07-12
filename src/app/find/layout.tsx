import Link from 'next/link'
import { Plus } from 'lucide-react'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Find — Trusted Local Professionals in Dahanu',
  description:
    'Find rated local professionals in Dahanu — electricians, plumbers, doctors, tutors and more. Real ratings from real customers.',
}

export default function FindLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="od-page flex min-h-dvh flex-col text-[var(--od-ink)]">
      <a
        href="#find-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-white focus:px-3 focus:py-2 focus:text-sm focus:font-semibold"
      >
        Skip to content
      </a>

      <header className="sticky top-0 z-40 border-b border-[var(--od-border)] bg-[rgba(250,250,247,0.88)] backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
          <Link href="/find" className="flex items-baseline">
            <span className="font-display text-[1.4rem] leading-none">Find</span>
            <span className="font-display text-[1.4rem] italic leading-none text-[var(--od-brand)]">
              Dahanu
            </span>
          </Link>
          <Link
            href="/find/submit"
            className="od-button-primary px-3.5 py-2 text-sm active:scale-[0.98]"
          >
            <Plus size={15} aria-hidden />
            Add a professional
          </Link>
        </div>
      </header>

      <main id="find-content" className="mx-auto w-full max-w-5xl flex-1 px-4 pb-16 pt-6">
        {children}
      </main>

      <footer className="border-t border-[var(--od-border)] bg-[var(--color-surface-2)]">
        <div className="warli-divider opacity-70" aria-hidden />
        <div className="mx-auto flex max-w-5xl flex-col items-center gap-1.5 px-4 py-6 text-center">
          <p className="font-display text-lg">
            Find<span className="italic text-[var(--od-brand)]">Dahanu</span>
          </p>
          <p className="text-xs text-[var(--od-muted)]">
            Every listing and rating is checked by a moderator before it appears.
          </p>
          <a
            href="https://ourdahanu.in"
            className="text-xs font-bold text-[var(--od-brand)] transition-colors hover:text-[var(--od-brand-strong)]"
          >
            Part of OurDahanu →
          </a>
        </div>
      </footer>
    </div>
  )
}
