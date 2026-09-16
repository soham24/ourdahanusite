import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import {
  Store,
  Star,
  MessageSquare,
  MessageCircle,
  Eye,
  Plus,
  ArrowUpRight,
  Edit2,
  CheckCircle,
  Clock,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Calendar,
} from 'lucide-react'
import { getListingHref } from '@/lib/listing-url'
import { isBuyable } from '@/lib/catalog/catalog'
import OwnerReplyForm from '@/components/OwnerReplyForm'
import { getMyListingStats } from '@/app/actions/listing-stats'
import { EMPTY_LISTING_STATS } from '@/lib/listing-stats'
import { deriveSellingChecklist } from '@/lib/selling/checklist'
import { loadSuspensionReasons } from '@/lib/selling/suspension-reasons'
import SellOnlineCard, { type SellOnlineRow } from './SellOnlineCard'

function StatusBadge({ status }: { status: string }) {
  if (status === 'approved') {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-green-100 text-green-700">
        <CheckCircle size={11} />
        Live
      </span>
    )
  }
  if (status === 'expiring') {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-orange-100 text-orange-700">
        <Clock size={11} />
        Expiring Soon
      </span>
    )
  }
  if (status === 'expired') {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-red-100 text-red-600">
        <XCircle size={11} />
        Expired
      </span>
    )
  }
  if (status === 'rejected') {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-red-100 text-red-600">
        <XCircle size={11} />
        Rejected
      </span>
    )
  }
  return (
    <span
      title="Your listing is under review. It will appear in the directory once approved (usually within 48 hours)."
      className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-yellow-100 text-yellow-700 cursor-help"
    >
      <Clock size={11} />
      Pending Review
    </span>
  )
}

function PlanBadge({ plan }: { plan: string }) {
  const map: Record<string, string> = {
    featured: 'bg-yellow-100 text-yellow-700',
    premium:  'bg-purple-100 text-purple-700',
    basic:    'bg-gray-100 text-gray-600',
  }
  const cls = map[plan?.toLowerCase()] || 'bg-gray-100 text-gray-600'
  return (
    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full capitalize ${cls}`}>
      {plan || 'Basic'}
    </span>
  )
}

type Listing = {
  id:           string
  name:         string
  category:     string
  subdomain:    string | null
  plan:         string
  approved:     boolean | null
  rating:       number | null
  review_count: number | null
  views:        number | null
  expires_at:   string | null
  payments_enabled:          boolean | null
  payments_suspended_at:     string | null
}

function getListingStatus(listing: Listing): string {
  const now = new Date()

  if (listing.expires_at) {
    const expiryDate = new Date(listing.expires_at)

    // Expired — either cron already set approved=false, or it just passed
    if (expiryDate < now) return 'expired'

    // Expiring within 30 days — only show warning when listing is live
    if (listing.approved === true) {
      const daysLeft = Math.ceil(
        (expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      )
      if (daysLeft <= 30) return 'expiring'
    }
  }

  if (listing.approved === true)  return 'approved'
  if (listing.approved === false) return 'pending'
  return 'pending'
}

function daysUntilExpiry(expiresAt: string): number {
  return Math.ceil(
    (new Date(expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  )
}

function formatExpiry(expiresAt: string): string {
  return new Date(expiresAt).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
  })
}

export default async function MyBusinessPage({
  searchParams,
}: {
  searchParams: Promise<{ renewed?: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { renewed } = await searchParams

  type Review = {
    id:                string
    listing_id:        string
    user_id:           string
    rating:            number
    comment:           string | null
    created_at:        string
    owner_reply:       string | null
    owner_replied_at:  string | null
    reviewer_name?:    string | null
    listings?:         { name: string } | null
  }

  let listings: Listing[] = []
  let reviews:  Review[]  = []
  let totalReviews = 0
  let avgRating    = 0
  let totalViews   = 0
  let listingStats: Record<string, import('@/lib/listing-stats').ListingStats> | null = {}

  try {
    const { data: listingsData } = await supabase
      .from('listings')
      .select('id, name, category, subdomain, plan, approved, rating, review_count, views, expires_at, payments_enabled, payments_suspended_at')
      .eq('owner_id', user.id)
      .order('created_at', { ascending: false })

    if (listingsData) listings = listingsData as Listing[]

    // Aggregate stats
    totalReviews = listings.reduce((sum, l) => sum + (l.review_count || 0), 0)
    totalViews   = listings.reduce((sum, l) => sum + (l.views        || 0), 0)
    const ratedListings = listings.filter(l => l.rating && l.rating > 0)
    avgRating = ratedListings.length
      ? ratedListings.reduce((sum, l) => sum + (l.rating || 0), 0) / ratedListings.length
      : 0

    listingStats = listings.length > 0
      ? await getMyListingStats(listings.map((l) => l.id))
      : {}

    if (listings.length > 0) {
      const ids = listings.map(l => l.id)
      const { data: reviewsData } = await supabase
        .from('reviews')
        .select('id, listing_id, user_id, rating, comment, created_at, owner_reply, owner_replied_at, listings(name)')
        .in('listing_id', ids)
        .order('created_at', { ascending: false })
        .limit(10)

      if (reviewsData) {
        const rawReviews = reviewsData as unknown as Review[]
        const userIds = [...new Set(rawReviews.map(r => r.user_id))]
        const { data: profileData } = await supabase
          .from('profiles')
          .select('id, full_name')
          .in('id', userIds)
        const profileMap: Record<string, string> = {}
        for (const p of profileData || []) {
          if (p.full_name) profileMap[p.id] = p.full_name
        }
        reviews = rawReviews.map(r => ({
          ...r,
          reviewer_name: profileMap[r.user_id] || null,
        }))
      }
    }
  } catch {
    // table may not exist yet
  }

  // One batched set of reads for the "Sell online" card. Owners can read
  // their own configs, products and orders through RLS.
  let sellRows: SellOnlineRow[] = []
  if (listings.length > 0) {
    const ids = listings.map((l) => l.id)
    const [{ data: configData }, { data: productData }, { data: orderData }, reasons] = await Promise.all([
      supabase
        .from('listing_payment_configs')
        .select('listing_id, razorpay_key_id, verified_at')
        .in('listing_id', ids),
      supabase
        .from('listing_products')
        .select('listing_id, price_paise, options:listing_product_options(id)')
        .eq('is_active', true)
        .in('listing_id', ids),
      supabase
        .from('orders')
        .select('listing_id, is_test, status')
        .in('listing_id', ids),
      loadSuspensionReasons(listings.filter((l) => l.payments_suspended_at).map((l) => l.id)),
    ])

    const configs = new Map(
      ((configData ?? []) as { listing_id: string; razorpay_key_id: string; verified_at: string | null }[])
        .map((config) => [config.listing_id, config]),
    )
    const activeItems = new Map<string, number>()
    const visibleItems = new Map<string, number>()
    type ItemRow = { listing_id: string; price_paise: number | null; options: { id: string }[] | null }
    for (const row of (productData ?? []) as unknown as ItemRow[]) {
      visibleItems.set(row.listing_id, (visibleItems.get(row.listing_id) ?? 0) + 1)
      // Copied items without a price are enquiries, not something to sell online yet.
      if (!isBuyable({ price_paise: row.price_paise, options: row.options ?? [] })) continue
      activeItems.set(row.listing_id, (activeItems.get(row.listing_id) ?? 0) + 1)
    }
    const orderRows = (orderData ?? []) as { listing_id: string | null; is_test: boolean; status: string }[]

    sellRows = listings.map((listing) => {
      const config = configs.get(listing.id) ?? null
      const listingOrders = orderRows.filter((order) => order.listing_id === listing.id)
      return {
        listingId: listing.id,
        listingName: listing.name,
        shopHref: getListingHref(listing.id, listing.subdomain),
        suspendedReason: reasons.get(listing.id) ?? null,
        newOrderCount: listingOrders.filter((order) => !order.is_test && order.status === 'confirmed').length,
        itemCount: visibleItems.get(listing.id) ?? 0,
        checklist: deriveSellingChecklist({
          approved: listing.approved === true,
          paymentsEnabled: listing.payments_enabled === true,
          suspendedAt: listing.payments_suspended_at,
          hasConfig: config !== null,
          verifiedAt: config?.verified_at ?? null,
          keyId: config?.razorpay_key_id ?? null,
          activeItemCount: activeItems.get(listing.id) ?? 0,
          orderCount: listingOrders.length,
          testOrderCount: listingOrders.filter((order) => order.is_test).length,
        }),
      }
    })
  }

  const hasExpiring = listings.some(l => {
    const s = getListingStatus(l)
    return s === 'expiring' || s === 'expired'
  })

  return (
    <div className="od-page min-h-screen py-8 md:py-10">
      <div className="od-shell max-w-6xl">

      {/* Renewal success banner */}
      {renewed === '1' && (
        <div className="mb-6 bg-green-50 border border-green-200 rounded-2xl px-5 py-4 flex items-start gap-3">
          <CheckCircle size={20} className="text-green-600 mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-bold text-green-800">Listing renewed successfully! 🎉</p>
            <p className="text-green-700 text-sm mt-0.5">
              Your listing is now active and will appear in the directory for another year.
            </p>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="od-eyebrow mb-2">Owner dashboard</p>
          <h1 className="od-section-title flex items-center gap-2 text-3xl md:text-5xl">
            <Store size={30} className="text-[var(--od-brand)]" />
            My Business
          </h1>
          <p className="od-muted mt-2 text-sm">Manage listings, products, orders, appointments, and customer trust from one place.</p>
        </div>
        <Link
          href="/listings/submit"
          className="od-button-primary px-5 py-2.5 text-sm"
        >
          <Plus size={16} />
          Add New Listing
        </Link>
      </div>

      {/* Quick Stats */}
      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="od-card p-5 text-center">
          <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center mx-auto mb-2">
            <Eye size={18} className="text-blue-600" />
          </div>
          <div className="text-2xl font-bold text-gray-900">{totalViews}</div>
          <div className="text-xs text-gray-500 mt-0.5">Profile Views</div>
        </div>
        <div className="od-card p-5 text-center">
          <div className="w-10 h-10 bg-green-50 rounded-xl flex items-center justify-center mx-auto mb-2">
            <MessageSquare size={18} className="text-brand" />
          </div>
          <div className="text-2xl font-bold text-gray-900">{totalReviews}</div>
          <div className="text-xs text-gray-500 mt-0.5">Total Reviews</div>
        </div>
        <div className="od-card p-5 text-center">
          <div className="w-10 h-10 bg-yellow-50 rounded-xl flex items-center justify-center mx-auto mb-2">
            <Star size={18} className="text-yellow-500" />
          </div>
          <div className="text-2xl font-bold text-gray-900">
            {avgRating > 0 ? avgRating.toFixed(1) : '—'}
          </div>
          <div className="text-xs text-gray-500 mt-0.5">Avg Rating</div>
        </div>
      </div>

      {/* Listings */}
      <div className="od-card mb-6 p-6">
        <h2 className="text-lg font-bold text-gray-900 mb-5 flex items-center gap-2">
          <Store size={18} className="text-brand" />
          Your Listings
        </h2>

        {/* Pending review notice */}
        {listings.some(l => !l.approved && getListingStatus(l) === 'pending') && (
          <div className="mb-4 bg-yellow-50 border border-yellow-200 rounded-xl px-4 py-3 text-sm text-yellow-800 flex items-start gap-2">
            <Clock size={15} className="mt-0.5 flex-shrink-0 text-yellow-600" />
            <span>
              Some listings are <strong>pending review</strong>. They won&apos;t appear in the
              public directory until approved — usually within 48 hours of submission.
            </span>
          </div>
        )}

        {/* Expiry warning */}
        {hasExpiring && (
          <div className="mb-4 bg-orange-50 border border-orange-200 rounded-xl px-4 py-3 text-sm text-orange-800 flex items-start gap-2">
            <AlertTriangle size={15} className="mt-0.5 flex-shrink-0 text-orange-600" />
            <span>
              One or more listings are <strong>expiring soon or have expired</strong>.
              Renew now to stay visible to customers.
            </span>
          </div>
        )}

        {listings.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-green-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Store size={28} className="text-brand" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No listings yet</h3>
            <p className="text-gray-500 text-sm mb-6 max-w-xs mx-auto">
              List your business to reach 30,000+ potential customers in Dahanu.
            </p>
            <Link
              href="/listings/submit"
              className="inline-flex items-center gap-2 bg-brand hover:bg-brand-strong text-bg font-semibold px-6 py-3 rounded-xl transition-colors"
            >
              <Plus size={16} />
              Add Your Business
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {listings.map((listing) => {
              const status   = getListingStatus(listing)
              const isExpiredStatus  = status === 'expired'
              const isExpiringStatus = status === 'expiring'
              const showRenew        = isExpiredStatus || isExpiringStatus

              return (
                <div
                  key={listing.id}
                  className={`flex flex-col gap-3 p-4 border rounded-2xl transition-all ${
                    isExpiredStatus
                      ? 'border-red-200 bg-red-50/40'
                      : isExpiringStatus
                      ? 'border-orange-200 bg-orange-50/30'
                    : 'border-[var(--od-border)] bg-white/70 hover:border-[rgba(192,88,46,0.35)] hover:shadow-sm'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <h3 className="font-bold text-gray-900">{listing.name}</h3>
                        <PlanBadge plan={listing.plan} />
                        <StatusBadge status={status} />
                      </div>
                      <p className="text-sm text-gray-500">{listing.category}</p>
                      <div className="flex flex-wrap items-center gap-3 mt-1.5 text-xs text-gray-400">
                        <span className="flex items-center gap-1">
                          <Star size={11} className="text-yellow-400 fill-yellow-400" />
                          {listing.rating?.toFixed(1) || '—'}
                        </span>
                        <span className="flex items-center gap-1">
                          <MessageSquare size={11} />
                          {listing.review_count || 0} reviews
                        </span>
                        {listing.expires_at && (
                          <span className={`flex items-center gap-1 ${
                            isExpiredStatus  ? 'text-red-500 font-medium' :
                            isExpiringStatus ? 'text-orange-500 font-medium' :
                            'text-gray-400'
                          }`}>
                            <Calendar size={11} />
                            {isExpiredStatus
                              ? `Expired ${formatExpiry(listing.expires_at)}`
                              : isExpiringStatus
                              ? `Expires in ${daysUntilExpiry(listing.expires_at)} days (${formatExpiry(listing.expires_at)})`
                              : `Active until ${formatExpiry(listing.expires_at)}`}
                          </span>
                        )}
                      </div>
                      {(() => {
                        // null means the stats query itself failed — render no
                        // line at all rather than a false "No views yet this
                        // month" that a paying owner would take as fact.
                        if (listingStats === null) return null
                        const stats = listingStats[listing.id] ?? EMPTY_LISTING_STATS
                        // Every segment is gated, views included. Views can be
                        // zero while a tap is not — a visitor who opens the
                        // listing before midnight and taps after it lands the
                        // view in one month and the tap in the next. Printing
                        // views unconditionally would show "0 views this month
                        // · 3 calls", which is the row-of-zeroes look this line
                        // exists to avoid.
                        const parts: React.ReactNode[] = []
                        if (stats.views > 0) {
                          parts.push(<><span className="font-semibold text-gray-900">{stats.views}</span> views this month</>)
                        }
                        if (stats.whatsapp > 0) {
                          parts.push(<><span className="font-semibold text-gray-900">{stats.whatsapp}</span> WhatsApp</>)
                        }
                        if (stats.phone > 0) {
                          parts.push(<><span className="font-semibold text-gray-900">{stats.phone}</span> calls</>)
                        }
                        if (parts.length === 0) {
                          return (
                            <p className="mt-1.5 text-xs text-gray-400">
                              No views yet this month
                              {stats.previousViews > 0 && (
                                <span> · last month: {stats.previousViews} views</span>
                              )}
                            </p>
                          )
                        }
                        return (
                          <p className="mt-1.5 text-xs text-gray-600">
                            {parts.map((part, i) => (
                              <span key={i}>{i > 0 && ' · '}{part}</span>
                            ))}
                            {stats.previousViews > 0 && (
                              <span className="text-gray-400"> · last month: {stats.previousViews} views</span>
                            )}
                          </p>
                        )
                      })()}
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
                      <Link
                        href={getListingHref(listing.id, listing.subdomain)}
                        className="od-button-secondary px-3 py-2 text-sm"
                      >
                        <ArrowUpRight size={14} />
                        View
                      </Link>
                      <Link
                        href={`/my-business/edit/${listing.id}`}
                        className="od-button-primary px-3 py-2 text-sm"
                      >
                        <Edit2 size={14} />
                        Edit
                      </Link>
                      {showRenew && (
                        <Link
                          href={`/my-business/renew/${listing.id}`}
                          className={`inline-flex items-center gap-1.5 text-sm font-semibold px-3 py-2 rounded-xl transition-colors ${
                            isExpiredStatus
                              ? 'bg-red-600 hover:bg-red-700 text-white'
                              : 'bg-orange-500 hover:bg-orange-600 text-white'
                          }`}
                        >
                          <RefreshCw size={14} />
                          {isExpiredStatus ? 'Renew Now' : 'Renew'}
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <SellOnlineCard rows={sellRows} />

      <div className="od-card mb-4 flex items-center justify-between gap-4 p-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-surface-soft rounded-xl flex items-center justify-center">
            <Calendar size={18} className="text-brand" />
          </div>
          <div>
            <p className="font-semibold text-gray-900 text-sm">Appointments</p>
            <p className="text-xs text-gray-400">View and manage bookings across your listings</p>
          </div>
        </div>
        <Link
          href="/my-business/appointments"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand hover:text-brand-strong border border-border hover:border-brand px-3 py-2 rounded-xl transition-colors"
        >
          <ArrowUpRight size={14} />
          View Appointments
        </Link>
      </div>

      {/* Recent Reviews */}
      <div className="od-card mb-6 p-6">
        <h2 className="text-lg font-bold text-gray-900 mb-5 flex items-center gap-2">
          <MessageSquare size={18} className="text-brand" />
          Recent Reviews
        </h2>

        {reviews.length === 0 ? (
          <p className="text-gray-400 text-sm text-center py-6">
            No reviews yet. Reviews will appear here once customers rate your business.
          </p>
        ) : (
          <div className="space-y-4">
            {reviews.map((review) => (
              <div key={review.id} className="border-b border-gray-50 last:border-0 pb-4 last:pb-0">
                <div className="flex items-start justify-between gap-2 mb-1">
                  <div>
                    <span className="font-medium text-gray-900 text-sm">
                      {review.reviewer_name || 'Anonymous'}
                    </span>
                    {review.listings?.name && (
                      <span className="text-xs text-gray-400 ml-2">on {review.listings.name}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-0.5 flex-shrink-0">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star
                        key={i}
                        size={12}
                        className={
                          i < review.rating
                            ? 'text-yellow-400 fill-yellow-400'
                            : 'text-gray-200 fill-gray-200'
                        }
                      />
                    ))}
                  </div>
                </div>
                {review.comment && (
                  <p className="text-sm text-gray-600 mt-1">{review.comment}</p>
                )}
                <p className="text-xs text-gray-400 mt-1">
                  {new Date(review.created_at).toLocaleDateString('en-IN', {
                    year: 'numeric', month: 'short', day: 'numeric',
                  })}
                </p>

                {review.owner_reply ? (
                  <div className="mt-3 rounded-xl border-l-4 border-brand bg-surface-soft/30 px-3 py-2.5">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-brand flex items-center gap-1">
                        <MessageCircle size={12} />
                        Your reply
                      </p>
                      {review.owner_replied_at && (
                        <span className="text-[11px] text-gray-400">
                          {new Date(review.owner_replied_at).toLocaleDateString('en-IN', {
                            year: 'numeric', month: 'short', day: 'numeric',
                          })}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-700 whitespace-pre-wrap break-words">
                      {review.owner_reply}
                    </p>
                  </div>
                ) : (
                  <OwnerReplyForm reviewId={review.id} compact />
                )}
              </div>
            ))}
          </div>
        )}
      </div>
      </div>
    </div>
  )
}
