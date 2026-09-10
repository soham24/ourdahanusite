"use client"

import React, { useState, useTransition } from 'react'
import { MessageSquare, Star, MessageCircle, Loader2 } from 'lucide-react'
import { loadMoreReviews } from '@/app/actions/reviews'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import ReviewForm from '../ReviewForm'
import OwnerReplyForm from '@/components/OwnerReplyForm'
import { useListingViewer } from '../ListingViewerContext'
import type { ListingRecord, ReviewRecord } from '@/lib/data/listing-detail'

interface ListingReviewsSectionProps {
  reviews: ReviewRecord[]
  /** Exact total across all pages, so the heading does not shrink to a page size. */
  reviewCount: number
  hasMoreReviews: boolean
  rating: number
  listing: ListingRecord
  listingId: string
  platformLoginUrl: string
}

function StarDisplay({ rating, size = 14 }: { rating: number; size?: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map(s => (
        <Star
          key={s}
          size={size}
          className={s <= Math.round(rating) ? 'text-yellow-400 fill-yellow-400' : 'text-gray-200 fill-gray-200'}
        />
      ))}
    </div>
  )
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function ListingReviewsSection({
  reviews,
  reviewCount,
  hasMoreReviews,
  rating,
  listing,
  listingId,
  platformLoginUrl,
}: ListingReviewsSectionProps) {
  const viewer = useListingViewer()

  // `reviews` is the first server-rendered page; later pages are appended here.
  const [loadedReviews, setLoadedReviews] = useState<ListingReviewsSectionProps['reviews']>(reviews)
  const [hasMore, setHasMore] = useState(hasMoreReviews)
  const [loadError, setLoadError] = useState('')
  const [isLoadingMore, startLoadMore] = useTransition()

  function handleLoadMore() {
    setLoadError('')
    startLoadMore(async () => {
      const res = await loadMoreReviews(listingId, loadedReviews.length)
      if (res.error) {
        setLoadError(res.error)
        return
      }
      // Guard against a review added between page loads shifting the offset
      // and re-serving a row we already show.
      setLoadedReviews(prev => {
        const seen = new Set(prev.map(r => r.id as string))
        return [...prev, ...res.reviews.filter(r => !seen.has(r.id as string))]
      })
      setHasMore(res.hasMore)
    })
  }

  return (
    <div className="space-y-5">
      {/* Reviews List */}
      <Card id="reviews" className="scroll-mt-32">
        <h2 className="text-base font-bold text-ink mb-5 flex items-center gap-2">
          <span className="w-1 h-4 bg-brand rounded-full inline-block" />
          <MessageSquare size={16} className="text-brand" />
          Customer Reviews
          <span className="text-sm font-normal text-ink-2/40">({reviewCount})</span>
        </h2>

        {loadedReviews.length === 0 ? (
          <p className="text-ink-2/40 text-sm text-center py-8">No reviews yet. Be the first!</p>
        ) : (
          <div className="space-y-5">
            {loadedReviews.map(review => {
              const reviewerName: string = (review.reviewer_name as string) || 'Anonymous'
              const initial = reviewerName.slice(0, 1).toUpperCase()
              const reviewId = review.id as string
              const ownerReply = (review.owner_reply as string | null) || null
              const ownerRepliedAt = (review.owner_replied_at as string | null) || null
              const ownerDisplayName = (listing.name as string | undefined) || 'Owner'
              
              return (
                <div
                  key={reviewId}
                  id={`review-${reviewId}`}
                  className="border-b border-gray-50 pb-5 last:border-0 last:pb-0 scroll-mt-24"
                >
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 bg-surface-soft text-brand rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">
                        {initial}
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-ink">{reviewerName}</p>
                        <StarDisplay rating={review.rating as number} size={12} />
                      </div>
                    </div>
                    <span className="text-xs text-ink-2/40">{formatDate(review.created_at as string)}</span>
                  </div>
                  {Boolean(review.comment) && (
                    <p className="text-sm text-ink-2/70 mt-2 ml-10">{String(review.comment)}</p>
                  )}

                  {ownerReply && (
                    <div className="mt-3 ml-10 rounded-xl border-l-4 border-brand bg-surface-soft/30 px-3 py-2.5">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-brand flex items-center gap-1">
                          <MessageCircle size={12} />
                          Reply from {ownerDisplayName}
                        </p>
                        {ownerRepliedAt && (
                          <span className="text-[11px] text-ink-2/40">
                            {formatDate(ownerRepliedAt)}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-ink-2 whitespace-pre-wrap break-words">
                        {ownerReply}
                      </p>
                    </div>
                  )}

                  {!ownerReply && viewer.isOwner && (
                    <div className="ml-10">
                      <OwnerReplyForm reviewId={reviewId} compact />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {loadError && (
          <p className="mt-4 text-center text-sm text-red-600">{loadError}</p>
        )}

        {hasMore && (
          <div className="mt-5 flex justify-center">
            <Button
              variant="secondary"
              size="md"
              onClick={handleLoadMore}
              disabled={isLoadingMore}
            >
              {isLoadingMore ? (
                <span className="flex items-center gap-2">
                  <Loader2 size={14} className="animate-spin" />
                  Loading…
                </span>
              ) : (
                `Load more reviews (${Math.max(reviewCount - loadedReviews.length, 0)} left)`
              )}
            </Button>
          </div>
        )}

        {!hasMore && loadedReviews.length > 0 && reviewCount > loadedReviews.length && (
          <p className="mt-4 text-center text-xs text-ink-2/40">
            Showing all available reviews.
          </p>
        )}
      </Card>

      {/* Review form */}
      <Card className="p-6">
        <h2 className="text-base font-bold text-ink mb-2">Leave a Review</h2>
        <p className="text-sm text-ink-2/50 mb-4">
          Reviews help locals decide which businesses to trust.
        </p>
        {viewer.isLoggedIn ? (
          <ReviewForm listingId={listingId} userName={viewer.name} />
        ) : (
          <div className="rounded-2xl border border-border/60 bg-surface-soft/60 px-4 py-5 text-center text-ink-2/60">
            <p className="mb-3 text-sm">Sign in to leave a review and help other Dahanu locals.</p>
            <Button variant="primary" size="md" href={platformLoginUrl}>
              Sign In to Review
            </Button>
          </div>
        )}
      </Card>
    </div>
  )
}
