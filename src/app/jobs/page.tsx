import { Suspense } from 'react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { SearchX, ShieldCheck } from 'lucide-react'

import { getJobBoard } from '@/lib/data/jobs'
import { JOB_CATEGORIES, jobCategoryMarathi } from '@/lib/jobs/categories'
import { AREA_SUGGESTIONS, WORK_TYPES } from '@/lib/jobs/options'
import JobCard from './JobCard'
import { JOBS_URL } from './jobs-ui'
import { siteConfig } from '@/lib/site'

type Tab = 'hiring' | 'seeking'

interface BoardParams {
  tab?: string
  q?: string
  category?: string
  type?: string
  area?: string
}

export const metadata: Metadata = {
  title: { absolute: `${siteConfig.name} Jobs — Local Jobs in ${siteConfig.town}` },
  description:
    `Local jobs in ${siteConfig.areas} — shops, hotels, farms, clinics and homes hiring. Free to post a job, or to say you are looking for work.`,
  alternates: { canonical: `${JOBS_URL}/` },
}

const labelCls = 'mb-1 block text-[12px] font-bold text-[var(--od-ink-2)]'
const inputCls = 'od-input h-11 w-full px-3.5 text-[15px]'

function tabHref(tab: Tab): string {
  return tab === 'seeking' ? '/jobs?tab=seeking' : '/jobs'
}

function BoardSkeleton() {
  return (
    <div aria-hidden className="mt-5 grid gap-3 md:grid-cols-2">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="od-card h-36 animate-pulse" />
      ))}
    </div>
  )
}

async function BoardResults({
  tab,
  q,
  category,
  type,
  area,
}: {
  tab: Tab
  q: string
  category: string
  type: string
  area: string
}) {
  const posts = await getJobBoard({ kind: tab, q, category: category || null, workType: type || null, area: area || null })
  const filtered = Boolean(q || category || type || area)
  const countLabel =
    tab === 'hiring'
      ? `${posts.length === 1 ? 'job' : 'jobs'}`
      : `${posts.length === 1 ? 'person' : 'people'} looking for work`

  return (
    <div className="mt-5">
      <p className="mb-3 text-[13px] font-semibold text-[var(--od-muted)]" aria-live="polite">
        <span className="tabular-nums">{posts.length}</span> {countLabel}
      </p>

      {posts.length === 0 ? (
        <div className="od-card flex flex-col items-center px-6 py-14 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-[14px] bg-[var(--color-surface-soft)] text-[var(--od-brand)]">
            <SearchX size={26} aria-hidden />
          </span>
          <h2 className="mt-4 font-display text-2xl">{filtered ? 'No matches' : 'Nothing here yet'}</h2>
          <p className="mt-1 max-w-sm text-sm leading-relaxed text-[var(--od-muted)]">
            {filtered
              ? 'Try a different search, or clear the filters.'
              : tab === 'hiring'
                ? `Be the first to post a job in ${siteConfig.town}.`
                : 'Be the first to say you are looking for work.'}
          </p>
          <div className="mt-5 flex gap-2">
            {filtered && (
              <Link href={tabHref(tab)} className="od-button-secondary px-4 py-2 text-sm">
                Clear filters
              </Link>
            )}
            <Link href={`/jobs/post?kind=${tab}`} className="od-button-primary px-4 py-2 text-sm">
              {tab === 'hiring' ? 'Post a job' : 'Post your profile'}
            </Link>
          </div>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {posts.map((post) => (
            <JobCard key={post.id} post={post} />
          ))}
        </div>
      )}
    </div>
  )
}

export default async function JobsBoardPage({ searchParams }: { searchParams: Promise<BoardParams> }) {
  const params = await searchParams
  const tab: Tab = params.tab === 'seeking' ? 'seeking' : 'hiring'
  const q = (params.q ?? '').trim()
  const category = JOB_CATEGORIES.find((value) => value === params.category) ?? ''
  const type = WORK_TYPES.find((value) => value === params.type) ?? ''
  const area = (params.area ?? '').trim()
  const filtered = Boolean(q || category || type || area)

  return (
    <div>
      <section className="relative -mx-4 -mt-6 overflow-hidden border-b border-[var(--od-border)] bg-[var(--color-surface-2)] px-4 pb-7 pt-9 sm:pb-9 sm:pt-11">
        <div className="warli-bg absolute inset-0 opacity-60" aria-hidden />
        <div className="relative mx-auto max-w-2xl text-center">
          <p className="od-eyebrow">{siteConfig.town}’s local jobs board</p>
          <h1 className="mt-2 text-balance font-display text-4xl leading-[1.08] sm:text-5xl">
            Local work, <em className="text-[var(--od-brand)]">local people</em>.
          </h1>
          <p className="mx-auto mt-3 max-w-md text-balance text-sm leading-relaxed text-[var(--od-muted)] sm:text-[15px]">
            Shops, farms, clinics and homes hiring across {siteConfig.town} — and neighbours looking for work. Free to post.
          </p>
          <p className="mt-3 flex items-center justify-center gap-1.5 text-xs font-bold text-[var(--od-ink-2)]">
            <ShieldCheck size={13} className="text-[var(--od-success)]" aria-hidden />
            Never pay anyone to get a job
          </p>
        </div>
      </section>

      <nav aria-label="Board" className="mt-5 flex gap-2">
        {(['hiring', 'seeking'] as const).map((value) => (
          <Link
            key={value}
            href={tabHref(value)}
            aria-current={tab === value ? 'page' : undefined}
            className={`rounded-full border px-4 py-2 text-sm font-semibold transition-colors ${
              tab === value
                ? 'border-[var(--od-brand-strong)] bg-[var(--od-brand-strong)] text-[#FFFAF3]'
                : 'border-[var(--od-border)] bg-white/70 text-[var(--od-ink-2)] hover:text-[var(--od-brand-strong)]'
            }`}
          >
            {value === 'hiring' ? 'Hiring' : 'Looking for work'}
          </Link>
        ))}
      </nav>

      <form method="get" action="/jobs" className="od-card mt-4 grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
        {tab === 'seeking' && <input type="hidden" name="tab" value="seeking" />}
        <label className="block">
          <span className={labelCls}>Search</span>
          <input
            name="q"
            defaultValue={q}
            placeholder={tab === 'hiring' ? 'Cook, driver, teacher…' : 'Skill or name…'}
            className={inputCls}
          />
        </label>
        <label className="block">
          <span className={labelCls}>Category</span>
          <select name="category" defaultValue={category} className={inputCls}>
            <option value="">All categories</option>
            {JOB_CATEGORIES.map((value) => (
              <option key={value} value={value}>
                {value} · {jobCategoryMarathi(value)}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className={labelCls}>Work type</span>
          <select name="type" defaultValue={type} className={inputCls}>
            <option value="">Any</option>
            {WORK_TYPES.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className={labelCls}>Area</span>
          <input name="area" defaultValue={area} list="job-areas" placeholder={`${siteConfig.town} Road…`} className={inputCls} />
          <datalist id="job-areas">
            {AREA_SUGGESTIONS.map((value) => (
              <option key={value} value={value} />
            ))}
          </datalist>
        </label>
        <div className="flex gap-2 sm:col-span-2 lg:col-span-4">
          <button className="od-button-primary px-5 py-2 text-sm">Search</button>
          {filtered && (
            <Link href={tabHref(tab)} className="od-button-secondary px-4 py-2 text-sm">
              Clear
            </Link>
          )}
        </div>
      </form>

      <Suspense key={`${tab}|${q}|${category}|${type}|${area}`} fallback={<BoardSkeleton />}>
        <BoardResults tab={tab} q={q} category={category} type={type} area={area} />
      </Suspense>
    </div>
  )
}
