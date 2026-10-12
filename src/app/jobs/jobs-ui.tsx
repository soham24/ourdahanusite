import { BadgeCheck, Newspaper } from 'lucide-react'

import { Mr } from '@/app/find/find-ui'
import { jobCategoryMarathi } from '@/lib/jobs/categories'
import type { JobBusiness } from '@/lib/jobs/types'
import { getCanonicalListingUrl } from '@/lib/listing-url'
import { siteConfig } from '@/lib/site'

// Generic pieces shared with Find, re-exported so jobs code has one import path.
export { Mr, chipBase, chipOff, chipOn } from '@/app/find/find-ui'

// Production on purpose: these are canonical and share URLs, which must keep
// working after a preview deployment is gone.
export const JOBS_URL = `https://jobs.${siteConfig.domain}`

export function kindLabel(kind: 'hiring' | 'seeking'): string {
  return kind === 'hiring' ? 'Hiring' : 'Looking for work'
}

/** "14 Sep" in IST. An absolute date, so cached pages never go stale mid-sentence. */
export function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' })
}

export function CategoryPill({ category }: { category: string }) {
  return (
    <span className="rounded-full bg-[rgba(192,88,46,0.09)] px-2 py-0.5 text-[11px] font-bold text-[var(--od-brand-strong)]">
      {category} <Mr text={jobCategoryMarathi(category)} />
    </span>
  )
}

export function BusinessBadge({ business }: { business: JobBusiness }) {
  return (
    <a
      href={getCanonicalListingUrl(business.id, business.subdomain)}
      target="_blank"
      rel="noopener noreferrer"
      className="relative z-10 inline-flex items-center gap-1 rounded-full bg-[var(--od-gold)]/15 px-2 py-0.5 text-[11px] font-bold text-[var(--od-brand-strong)] transition-colors hover:bg-[var(--od-gold)]/25"
    >
      <BadgeCheck size={12} className="text-[var(--od-gold)]" aria-hidden />
      {siteConfig.name} business · {business.name}
    </a>
  )
}

export function CollectedLabel({ source }: { source: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-[var(--color-surface-soft)] px-2 py-0.5 text-[11px] font-semibold text-[var(--od-muted)]">
      <Newspaper size={12} aria-hidden />
      Collected by {siteConfig.name} · {source}
    </span>
  )
}
