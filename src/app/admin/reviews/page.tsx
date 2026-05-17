import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin-client'
import Link from 'next/link'
import { Star, Trash2, ArrowLeft, MessageSquare } from 'lucide-react'
import { deleteReview } from '@/app/actions/admin'

function StarRating({ rating }: { rating: number }) {
  return (
    <span className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          size={12}
          className={n <= rating ? 'text-amber-400 fill-amber-400' : 'text-gray-200 fill-gray-200'}
        />
      ))}
    </span>
  )
}

function timeAgo(dateStr: string) {
  const date = new Date(dateStr)
  const now = new Date()
  const hours = Math.floor((now.getTime() - date.getTime()) / 3600000)
  if (hours < 1) return 'just now'
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

type Review = {
  id: string
  listing_id: string
  user_id: string
  rating: number
  comment: string | null
  created_at: string
  owner_reply: string | null
  reviewer_name: string | null
  listing_name: string | null
}

type Listing = {
  id: string
  name: string
}

export default async function AdminReviewsPage({
  searchParams,
}: {
  searchParams: Promise<{ listing_id?: string }>
}) {
  const { listing_id } = await searchParams

  const supabase = await createClient()
  const adminClient = createAdminClient()
  const db = adminClient ?? supabase

  let listings: Listing[] = []
  let reviews: Review[] = []
  let selectedListing: Listing | null = null

  try {
    // Fetch all approved listings for the dropdown
    const { data: listingsData } = await db
      .from('listings')
      .select('id, name')
      .eq('approved', true)
      .order('name', { ascending: true })
    listings = (listingsData ?? []) as Listing[]

    if (listing_id) {
      selectedListing = listings.find((l) => l.id === listing_id) ?? null

      // Fetch reviews for the selected listing, joined with reviewer name
      const { data: reviewsData } = await db
        .from('reviews')
        .select(`
          id, listing_id, user_id, rating, comment, created_at, owner_reply,
          profiles!reviews_user_id_fkey(full_name)
        `)
        .eq('listing_id', listing_id)
        .order('created_at', { ascending: false })

      reviews = (reviewsData ?? []).map((r: Record<string, unknown>) => ({
        id: r.id as string,
        listing_id: r.listing_id as string,
        user_id: r.user_id as string,
        rating: r.rating as number,
        comment: r.comment as string | null,
        created_at: r.created_at as string,
        owner_reply: r.owner_reply as string | null,
        reviewer_name: (r.profiles as { full_name?: string } | null)?.full_name ?? null,
        listing_name: selectedListing?.name ?? null,
      }))
    } else {
      // No listing selected — show last 50 reviews across all listings
      const { data: reviewsData } = await db
        .from('reviews')
        .select(`
          id, listing_id, user_id, rating, comment, created_at, owner_reply,
          profiles!reviews_user_id_fkey(full_name),
          listings!reviews_listing_id_fkey(name)
        `)
        .order('created_at', { ascending: false })
        .limit(50)

      reviews = (reviewsData ?? []).map((r: Record<string, unknown>) => ({
        id: r.id as string,
        listing_id: r.listing_id as string,
        user_id: r.user_id as string,
        rating: r.rating as number,
        comment: r.comment as string | null,
        created_at: r.created_at as string,
        owner_reply: r.owner_reply as string | null,
        reviewer_name: (r.profiles as { full_name?: string } | null)?.full_name ?? null,
        listing_name: (r.listings as { name?: string } | null)?.name ?? null,
      }))
    }
  } catch {
    // DB error — show empty state
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link href="/admin" className="text-sm text-gray-500 hover:text-brand transition-colors">
          <ArrowLeft size={15} />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Star size={22} className="text-amber-500" />
            Reviews Moderation
          </h1>
          <p className="text-gray-500 text-sm mt-0.5">
            Filter by listing to review and delete inappropriate or spam reviews
          </p>
        </div>
      </div>

      {/* Listing filter */}
      <form method="GET" className="mb-6">
        <div className="flex items-center gap-3">
          <label htmlFor="listing_id" className="text-sm font-medium text-gray-700 whitespace-nowrap">
            Filter by listing:
          </label>
          <select
            id="listing_id"
            name="listing_id"
            defaultValue={listing_id ?? ''}
            onChange={undefined}
            className="flex-1 max-w-sm rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 shadow-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
          >
            <option value="">All listings (latest 50 reviews)</option>
            {listings.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="inline-flex items-center gap-1.5 rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand/90 transition-colors"
          >
            View
          </button>
          {listing_id && (
            <Link
              href="/admin/reviews"
              className="text-sm text-gray-500 hover:text-gray-700 underline underline-offset-2"
            >
              Clear
            </Link>
          )}
        </div>
      </form>

      {/* Summary bar */}
      <div className="mb-4 flex items-center gap-2">
        <span className="text-sm text-gray-500">
          {listing_id && selectedListing
            ? <>Showing <strong>{reviews.length}</strong> review{reviews.length !== 1 ? 's' : ''} for <strong>{selectedListing.name}</strong></>
            : <>Showing latest <strong>{reviews.length}</strong> reviews across all listings</>
          }
        </span>
      </div>

      {/* Reviews list */}
      {reviews.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
          <div className="text-5xl mb-3">⭐</div>
          <p className="text-gray-500 text-sm">
            {listing_id ? 'No reviews found for this listing.' : 'No reviews found.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {reviews.map((review) => (
            <div
              key={review.id}
              className="bg-white rounded-2xl border border-gray-100 p-4 flex items-start justify-between gap-4"
            >
              <div className="flex-1 min-w-0">
                {/* Meta row */}
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <StarRating rating={review.rating} />
                  <span className="text-xs text-gray-400">{timeAgo(review.created_at)}</span>
                  {!listing_id && review.listing_name && (
                    <span className="text-xs font-semibold bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full">
                      {review.listing_name}
                    </span>
                  )}
                </div>

                {/* Reviewer */}
                <p className="text-xs text-gray-400 mb-1.5">
                  by {review.reviewer_name ?? 'Unknown user'}
                </p>

                {/* Comment */}
                {review.comment ? (
                  <p className="text-sm text-gray-700 leading-relaxed">{review.comment}</p>
                ) : (
                  <p className="text-sm text-gray-400 italic">No comment</p>
                )}

                {/* Owner reply */}
                {review.owner_reply && (
                  <div className="mt-2 pl-3 border-l-2 border-amber-200">
                    <p className="text-xs text-gray-500 flex items-center gap-1 mb-0.5">
                      <MessageSquare size={11} /> Owner reply
                    </p>
                    <p className="text-xs text-gray-600 italic">{review.owner_reply}</p>
                  </div>
                )}
              </div>

              {/* Delete action */}
              <form action={deleteReview}>
                <input type="hidden" name="id" value={review.id} />
                <input type="hidden" name="listing_id" value={review.listing_id} />
                <button
                  type="submit"
                  className="inline-flex items-center gap-1 text-red-600 hover:text-red-700 text-xs font-medium px-3 py-2 rounded-xl hover:bg-red-50 transition-colors border border-red-100 whitespace-nowrap"
                >
                  <Trash2 size={13} /> Delete
                </button>
              </form>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
