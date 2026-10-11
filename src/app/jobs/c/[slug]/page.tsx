import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, SearchX } from 'lucide-react'

import { getJobBoard } from '@/lib/data/jobs'
import { JOB_CATEGORIES, jobCategoryFromSlug, jobCategoryMarathi, jobCategorySlug } from '@/lib/jobs/categories'
import { MIN_CATEGORY_SIZE } from '@/lib/seo-thresholds'
import JobCard from '../../JobCard'
import { JOBS_URL, Mr } from '../../jobs-ui'
import { siteConfig } from '@/lib/site'

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const category = jobCategoryFromSlug(slug)
  if (!category || category === 'Other') return {}

  const posts = await getJobBoard({ kind: 'hiring', category })
  const canonical = `${JOBS_URL}/c/${slug}`
  const title = `${category} jobs in ${siteConfig.town}`
  const description = `${posts.length > 0 ? `${posts.length} ` : ''}${category.toLowerCase()} jobs open now in ${siteConfig.areas}. Free to use — reach the employer directly.`.slice(0, 160)

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: { title, description, url: canonical, type: 'website', siteName: `${siteConfig.name} Jobs` },
    // A category with only a post or two reads as thin content; don't index it yet.
    ...(posts.length < MIN_CATEGORY_SIZE ? { robots: { index: false, follow: true } } : {}),
  }
}

export default async function JobCategoryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const category = jobCategoryFromSlug(slug)
  if (!category || category === 'Other') notFound()

  const hiring = await getJobBoard({ kind: 'hiring' })
  const posts = hiring.filter((post) => post.category === category)
  const counts = new Map<string, number>()
  for (const post of hiring) counts.set(post.category, (counts.get(post.category) ?? 0) + 1)
  const others = JOB_CATEGORIES.filter((value) => value !== category && value !== 'Other' && (counts.get(value) ?? 0) > 0)

  return (
    <div>
      <Link
        href="/jobs"
        className="mb-4 inline-flex items-center gap-1.5 rounded-full border border-[var(--od-border)] bg-white/70 px-3 py-1.5 text-[13px] font-semibold text-[var(--od-ink-2)] transition-colors hover:border-[rgba(192,88,46,0.4)] hover:text-[var(--od-brand-strong)]"
      >
        <ArrowLeft size={13} aria-hidden /> All jobs
      </Link>

      <header className="mb-6">
        <h1 className="text-balance font-display text-3xl leading-tight sm:text-4xl">
          {category} <span className="text-[var(--od-brand)]">jobs in {siteConfig.town}</span>
        </h1>
        <p className="mt-1 text-[15px] font-semibold text-[var(--od-muted)]">
          <Mr text={jobCategoryMarathi(category)} />
        </p>
        <p className="mt-3 text-xs font-bold text-[var(--od-ink-2)]">
          {posts.length} open {posts.length === 1 ? 'job' : 'jobs'}
        </p>
      </header>

      {posts.length > 0 ? (
        <div className="grid gap-3 md:grid-cols-2">
          {posts.map((post) => (
            <JobCard key={post.id} post={post} />
          ))}
        </div>
      ) : (
        <div className="od-card flex flex-col items-center px-6 py-14 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-[14px] bg-[var(--color-surface-soft)] text-[var(--od-brand)]">
            <SearchX size={26} aria-hidden />
          </span>
          <h2 className="mt-4 font-display text-2xl">No {category.toLowerCase()} jobs yet</h2>
          <p className="mt-1 max-w-sm text-sm leading-relaxed text-[var(--od-muted)]">
            Hiring in this line of work? Posting is free.
          </p>
          <Link href="/jobs/post?kind=hiring" className="od-button-primary mt-5 px-4 py-2 text-sm">
            Post a job
          </Link>
        </div>
      )}

      {others.length > 0 && (
        <nav aria-label="Other categories" className="mt-10 border-t border-[var(--od-border)] pt-6">
          <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.1em] text-[var(--od-muted)]">
            Other jobs in {siteConfig.town}
          </p>
          <div className="flex flex-wrap gap-2">
            {others.map((value) => (
              <Link
                key={value}
                href={`/jobs/c/${jobCategorySlug(value)}`}
                className="inline-flex items-center gap-1.5 rounded-full border border-[var(--od-border)] bg-white/70 px-3.5 py-2 text-[13px] font-semibold text-[var(--od-ink-2)] transition-colors hover:border-[var(--od-gold)] hover:bg-white"
              >
                {value}
                <span className="rounded-full bg-[var(--od-surface-soft)] px-1.5 py-0.5 text-[11px] font-bold tabular-nums text-[var(--od-brand-strong)]">
                  {counts.get(value) ?? 0}
                </span>
              </Link>
            ))}
          </div>
        </nav>
      )}
    </div>
  )
}
