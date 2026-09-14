import Link from 'next/link'
import { BriefcaseBusiness, MapPin, Users } from 'lucide-react'

import { formatPay } from '@/lib/jobs/pay'
import type { PublicJobPost } from '@/lib/jobs/types'
import { BusinessBadge, CategoryPill, CollectedLabel, shortDate } from './jobs-ui'

export default function JobCard({ post }: { post: PublicJobPost }) {
  const subtitle = post.kind === 'hiring' ? post.employer_name : post.display_name

  return (
    <article className="od-card od-card-hover relative flex flex-col p-4 sm:p-5">
      <Link
        href={`/jobs/j/${post.id}`}
        className="absolute inset-0 z-0 rounded-[inherit]"
        aria-label={`View ${post.title}${subtitle ? ` — ${subtitle}` : ''}`}
      />

      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="truncate text-[1.05rem] font-bold tracking-[-0.01em]">{post.title}</h2>
          {subtitle && <p className="mt-0.5 truncate text-sm text-[var(--od-ink-2)]">{subtitle}</p>}
        </div>
        <span className="shrink-0 text-[11px] text-[var(--od-muted)]">{shortDate(post.published_at)}</span>
      </div>

      <div className="mt-2 flex flex-wrap gap-1">
        <CategoryPill category={post.category} />
        {post.business && <BusinessBadge business={post.business} />}
        {post.collected_source && <CollectedLabel source={post.collected_source} />}
      </div>

      <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--od-muted)]">
        <span className="flex items-center gap-1">
          <MapPin size={12} aria-hidden /> {post.area}
        </span>
        <span>{post.work_types.join(' · ')}</span>
        {post.kind === 'hiring' && <span className="font-semibold text-[var(--od-ink-2)]">{formatPay(post)}</span>}
        {post.kind === 'hiring' && post.openings !== null && post.openings > 1 && (
          <span className="flex items-center gap-1">
            <Users size={12} aria-hidden /> {post.openings} openings
          </span>
        )}
        {post.kind === 'seeking' && post.experience_years !== null && (
          <span className="flex items-center gap-1">
            <BriefcaseBusiness size={12} aria-hidden /> {post.experience_years} {post.experience_years === 1 ? 'year' : 'years'} experience
          </span>
        )}
      </p>

      {post.description && (
        <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-[var(--od-ink-2)]">{post.description}</p>
      )}
    </article>
  )
}
