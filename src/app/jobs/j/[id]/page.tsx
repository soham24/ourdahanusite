import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, Clock, MapPin, Share2, ShieldAlert, Users } from 'lucide-react'

import StructuredData from '@/components/StructuredData'
import { getLiveJobPostById } from '@/lib/data/jobs'
import { jobCategorySlug } from '@/lib/jobs/categories'
import { buildJobPostingLd } from '@/lib/jobs/job-posting-ld'
import { formatPay } from '@/lib/jobs/pay'
import { truncateAtWord } from '@/lib/text'
import { BusinessBadge, CategoryPill, CollectedLabel, JOBS_URL, kindLabel, shortDate } from '../../jobs-ui'
import ReportPostButton from './ReportPostButton'
import ShowContactButton from './ShowContactButton'
import { siteConfig } from '@/lib/site'

const dtCls = 'text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--od-muted)]'
const pillLinkCls =
  'inline-flex items-center gap-1.5 rounded-full border border-[var(--od-border)] bg-white/70 px-3 py-1.5 text-[13px] font-semibold text-[var(--od-ink-2)] transition-colors hover:border-[rgba(192,88,46,0.4)] hover:text-[var(--od-brand-strong)]'

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params
  const post = await getLiveJobPostById(id)
  if (!post) return {}

  const url = `${JOBS_URL}/j/${post.id}`
  const title =
    post.kind === 'hiring'
      ? `${post.title} job at ${post.employer_name} in ${post.area}`
      : `${post.display_name} — ${post.title}, looking for work in ${post.area}`
  const description = truncateAtWord(
    [post.kind === 'hiring' ? formatPay(post) : null, post.work_types.join(', '), post.description]
      .filter(Boolean)
      .join(' · '),
    159,
  )

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { title, description, url, type: 'website', siteName: `${siteConfig.name} Jobs` },
    twitter: { card: 'summary_large_image', title, description },
    // A person's "looking for work" page should not linger in search results
    // after they find work. Only hiring posts are indexed.
    ...(post.kind === 'seeking' ? { robots: { index: false, follow: true } } : {}),
  }
}

export default async function JobPostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const post = await getLiveJobPostById(id)
  if (!post) notFound()

  const url = `${JOBS_URL}/j/${post.id}`
  const shareText = `${post.title}${post.kind === 'hiring' && post.employer_name ? ` — ${post.employer_name}` : ''}, ${post.area}\n${url}`

  return (
    <div className="mx-auto max-w-2xl">
      {post.kind === 'hiring' && post.employer_name && (
        <StructuredData data={buildJobPostingLd({ ...post, employer_name: post.employer_name }, url)} />
      )}

      <nav aria-label="Breadcrumb" className="mb-4 flex items-center gap-1.5">
        <Link href={post.kind === 'hiring' ? '/jobs' : '/jobs?tab=seeking'} className={pillLinkCls}>
          <ArrowLeft size={13} aria-hidden /> {post.kind === 'hiring' ? 'All jobs' : 'Looking for work'}
        </Link>
        {post.kind === 'hiring' && post.category !== 'Other' && (
          <>
            <span className="text-[var(--od-muted)]" aria-hidden>/</span>
            <Link href={`/jobs/c/${jobCategorySlug(post.category)}`} className={pillLinkCls}>
              {post.category}
            </Link>
          </>
        )}
      </nav>

      <article className="od-card relative p-5 sm:p-6">
        <a
          href={`https://wa.me/?text=${encodeURIComponent(shareText)}`}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Share this post on WhatsApp"
          title="Share on WhatsApp"
          className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full border border-[var(--od-border)] bg-white/70 text-[var(--od-muted)] transition-colors hover:border-[rgba(192,88,46,0.4)] hover:text-[var(--od-brand-strong)]"
        >
          <Share2 size={15} aria-hidden />
        </a>

        <p className="od-eyebrow pr-10">{kindLabel(post.kind)}</p>
        <h1 className="mt-1 pr-10 text-balance font-display text-3xl leading-tight sm:text-4xl">{post.title}</h1>
        <p className="mt-1 text-[15px] font-semibold text-[var(--od-ink-2)]">
          {post.kind === 'hiring'
            ? post.employer_name
            : `${post.display_name}${
                post.experience_years !== null
                  ? ` · ${post.experience_years} ${post.experience_years === 1 ? 'year' : 'years'} experience`
                  : ''
              }`}
        </p>

        <div className="mt-3 flex flex-wrap gap-1">
          <CategoryPill category={post.category} />
          {post.business && <BusinessBadge business={post.business} />}
          {post.collected_source && <CollectedLabel source={post.collected_source} />}
        </div>

        <dl className="mt-4 grid gap-x-4 gap-y-2.5 rounded-[14px] bg-[var(--color-surface-soft)] px-4 py-3 text-sm sm:grid-cols-2">
          <div>
            <dt className={dtCls}>Area</dt>
            <dd className="flex items-center gap-1">
              <MapPin size={13} aria-hidden /> {post.area}
            </dd>
          </div>
          <div>
            <dt className={dtCls}>Work type</dt>
            <dd>{post.work_types.join(' · ')}</dd>
          </div>
          {post.kind === 'hiring' && (
            <div>
              <dt className={dtCls}>Pay</dt>
              <dd>{formatPay(post)}</dd>
            </div>
          )}
          {post.kind === 'hiring' && post.openings !== null && (
            <div>
              <dt className={dtCls}>Openings</dt>
              <dd className="flex items-center gap-1">
                <Users size={13} aria-hidden /> {post.openings}
              </dd>
            </div>
          )}
          {post.kind === 'hiring' && post.timings && (
            <div>
              <dt className={dtCls}>Timings</dt>
              <dd className="flex items-center gap-1">
                <Clock size={13} aria-hidden /> {post.timings}
              </dd>
            </div>
          )}
          <div>
            <dt className={dtCls}>Posted</dt>
            <dd>
              {shortDate(post.published_at)} · open until {shortDate(post.expires_at)}
            </dd>
          </div>
        </dl>

        {post.description && (
          <p className="mt-4 whitespace-pre-line text-[15px] leading-relaxed text-[var(--od-ink-2)]">{post.description}</p>
        )}

        <div className="mt-5 border-t border-[var(--od-border)] pt-4">
          <ShowContactButton postId={post.id} />
        </div>

        <p className="mt-4 flex items-start gap-2 rounded-[12px] border border-[rgba(180,35,24,0.2)] bg-[rgba(180,35,24,0.04)] px-3 py-2.5 text-[13px] text-[var(--od-ink-2)]">
          <ShieldAlert size={15} className="mt-0.5 shrink-0 text-[var(--od-danger)]" aria-hidden />
          <span>Never pay anyone to get a job. Report posts that ask for money.</span>
        </p>
      </article>

      <div className="mt-4 flex justify-end">
        <ReportPostButton postId={post.id} />
      </div>
    </div>
  )
}
