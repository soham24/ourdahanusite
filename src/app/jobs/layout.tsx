import Link from 'next/link'
import type { Metadata } from 'next'
import { Plus } from 'lucide-react'
import { siteConfig } from '@/lib/site'

export const metadata: Metadata = {
  title: { absolute: `${siteConfig.name} Jobs — Local Jobs in ${siteConfig.town}` },
  description:
    `Local jobs in ${siteConfig.areas} — shops, hotels, farms, clinics and homes hiring. Free to post a job, or to say you are looking for work.`,
}

export default function JobsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="od-page flex min-h-dvh flex-col text-[var(--od-ink)]">
      <a
        href="#jobs-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-white focus:px-3 focus:py-2 focus:text-sm focus:font-semibold"
      >
        Skip to content
      </a>

      <div className="w-full bg-[var(--od-ink)] px-4 py-2 text-center text-xs font-semibold text-[var(--od-bg)]">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-center gap-x-2 gap-y-0.5">
          <span aria-hidden>🛡️</span>
          <span>Never pay anyone to get a job. Report posts that ask for money.</span>
        </div>
      </div>

      <header className="sticky top-0 z-40 border-b border-[var(--od-border)] bg-[rgba(250,250,247,0.88)] backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-3 px-4">
          <Link href="/jobs" className="flex items-baseline">
            <span className="font-display text-[1.4rem] leading-none">Jobs</span>
            <span className="font-display text-[1.4rem] italic leading-none text-[var(--od-brand)]">{siteConfig.town}</span>
          </Link>
          <nav aria-label="Jobs" className="flex items-center gap-3">
            <Link
              href="/jobs/my-posts"
              className="text-sm font-semibold text-[var(--od-ink-2)] transition-colors hover:text-[var(--od-brand-strong)]"
            >
              My posts
            </Link>
            <Link href="/jobs/post" className="od-button-primary px-3.5 py-2 text-sm active:scale-[0.98]">
              <Plus size={15} aria-hidden />
              Post
            </Link>
          </nav>
        </div>
      </header>

      <main id="jobs-content" className="mx-auto w-full max-w-5xl flex-1 scroll-mt-14 px-4 pb-16 pt-6">
        {children}
      </main>

      <footer className="border-t border-[var(--od-border)] bg-[var(--color-surface-2)]">
        <div className="warli-divider opacity-70" aria-hidden />
        <div className="mx-auto flex max-w-5xl flex-col items-center gap-1.5 px-4 py-6 text-center">
          <p className="font-display text-lg">
            Jobs<span className="italic text-[var(--od-brand)]">{siteConfig.town}</span>
          </p>
          <p className="text-xs text-[var(--od-muted)]">
            Free to post. Posts from individuals are checked by a moderator before they appear.
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
