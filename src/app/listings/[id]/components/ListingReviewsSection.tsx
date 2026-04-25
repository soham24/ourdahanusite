"use client"

import React from 'react'
import Link from 'next/link'
import { MessageSquare, Star, MessageCircle } from 'lucide-react'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import ReviewForm from '../ReviewForm'
import OwnerReplyForm from '@/components/OwnerReplyForm'

interface ListingReviewsSectionProps {
  reviews: any[]
  rating: number
  isOwner: boolean
  listing: any
  currentUser: any
  listingId: string
  currentUserName: string | null
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
  rating,
  isOwner,
  listing,
  currentUser,
  listingId,
  currentUserName,
  platformLoginUrl,
}: ListingReviewsSectionProps) {
  return (
    <div className="space-y-5">
      {/* Reviews List */}
      <Card id="reviews" className="scroll-mt-32">
        <h2 className="text-base font-bold text-ink mb-5 flex items-center gap-2">
          <span className="w-1 h-4 bg-brand rounded-full inline-block" />
          <MessageSquare size={16} className="text-brand" />
          Customer Reviews
          <span className="text-sm font-normal text-ink-2/40">({reviews.length})</span>
        </h2>

        {reviews.length === 0 ? (
          <p className="text-ink-2/40 text-sm text-center py-8">No reviews yet. Be the first!</p>
        ) : (
          <div className="space-y-5">
            {reviews.map(review => {
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
                  {review.comment && (
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

                  {!ownerReply && isOwner && (
                    <div className="ml-10">
                      <OwnerReplyForm reviewId={reviewId} compact />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </Card>

      {/* Review form */}
      <Card className="p-6">
        <h2 className="text-base font-bold text-ink mb-2">Leave a Review</h2>
        <p className="text-sm text-ink-2/50 mb-4">
          Reviews help locals decide which businesses to trust.
        </p>
        {currentUser ? (
          <ReviewForm listingId={listingId} userName={currentUserName} />
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
