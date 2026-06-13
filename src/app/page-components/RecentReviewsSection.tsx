import { Star, Quote } from 'lucide-react'
import Link from 'next/link'

import SectionHeader from '@/components/ui/SectionHeader'
import type { HomeReview } from '@/lib/data/home'
import { getListingHref } from '@/lib/listing-url'

interface RecentReviewsSectionProps {
  reviews: HomeReview[]
}

function StarRow({ rating }: { rating: number }) {
  return (
    <span className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          size={13}
          className={n <= rating ? 'fill-amber-400 text-amber-400' : 'fill-gray-200 text-gray-200'}
        />
      ))}
    </span>
  )
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function RecentReviewsSection({ reviews }: RecentReviewsSectionProps) {
  if (reviews.length === 0) return null

  return (
    <section className="bg-[#fffdf9] py-12 md:py-16">
      <div className="mx-auto max-w-[1160px] px-5 md:px-6">
        <SectionHeader
          label="Community voices"
          title="What People Are Saying"
          sub="Recent reviews from across Dahanu businesses"
          viewAllHref="/listings"
        />

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {reviews.map((review) => {
            const href = getListingHref(review.listing_id, review.listing_subdomain)
            return (
              <Link
                key={review.id}
                href={href}
                className="group flex flex-col rounded-2xl border border-[var(--od-border)] bg-white p-5 shadow-[0_6px_20px_rgba(46,18,5,0.05)] transition-all duration-300 hover:-translate-y-0.5 hover:border-[rgba(192,88,46,0.30)] hover:shadow-[0_12px_32px_rgba(46,18,5,0.10)]"
              >
                {/* Quote icon */}
                <Quote size={18} className="mb-3 text-[var(--od-brand)]/30" />

                {/* Stars */}
                <StarRow rating={review.rating} />

                {/* Comment */}
                <p className="mt-3 flex-1 line-clamp-4 text-sm leading-relaxed text-[var(--od-muted)]">
                  {review.comment}
                </p>

                {/* Divider */}
                <div className="my-4 border-t border-[var(--od-border)]" />

                {/* Listing name */}
                <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-[var(--od-brand)] transition-colors group-hover:text-[var(--od-brand-strong)] line-clamp-1">
                  {review.listing_name}
                </p>

                {/* Reviewer + date */}
                <div className="mt-1 flex items-center justify-between gap-2">
                  <p className="text-xs text-[var(--od-ink)] font-medium truncate">
                    {review.reviewer_name ?? 'Community member'}
                  </p>
                  <p className="text-[11px] text-[var(--od-muted)] whitespace-nowrap">
                    {formatDate(review.created_at)}
                  </p>
                </div>
              </Link>
            )
          })}
        </div>
      </div>
    </section>
  )
}
