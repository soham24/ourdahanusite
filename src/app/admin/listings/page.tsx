import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin-client'
import Link from 'next/link'
import Image from 'next/image'
import { MapPin, CheckCircle, XCircle, Pencil, Calendar, Plus } from 'lucide-react'
import { approveContent, unpublishContent } from '@/app/actions/admin'
import DeleteListingButton from './DeleteListingButton'
import ExtendListingButton from './ExtendListingButton'

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
  })
}

function expiryBadge(expiresAt: string | null): React.ReactNode {
  if (!expiresAt) return null
  const now   = new Date()
  const expiry = new Date(expiresAt)
  const days  = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))

  if (expiry < now) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-red-100 text-red-700">
        <Calendar size={10} /> Expired {formatDate(expiresAt)}
      </span>
    )
  }
  if (days <= 30) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-orange-100 text-orange-700">
        <Calendar size={10} /> Expires in {days}d
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
      <Calendar size={10} /> {formatDate(expiresAt)}
    </span>
  )
}

const PLAN_COLORS: Record<string, string> = {
  premium:  'bg-yellow-100 text-yellow-700',
  featured: 'bg-green-100 text-green-700',
  basic:    'bg-gray-100 text-gray-600',
}

export default async function AdminListingsPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>
}) {
  const { filter = 'all' } = await searchParams

  let listings: any[]    = []
  let totalCount         = 0
  let pendingCount       = 0
  let liveCount          = 0
  let expiringCount      = 0
  let expiredCount       = 0

  const now               = new Date()
  const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString()
  const nowIso            = now.toISOString()

  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    const adminClient = createAdminClient()
    if (!adminClient) throw new Error('Admin client unavailable')

    // Tab counts
    const [allRes, pendingRes, liveRes, expiringRes, expiredRes] = await Promise.all([
      adminClient.from('listings').select('*', { count: 'exact', head: true }),
      adminClient.from('listings').select('*', { count: 'exact', head: true }).eq('approved', false),
      adminClient.from('listings').select('*', { count: 'exact', head: true }).eq('approved', true),
      // Expiring: approved, expires_at set, within 30 days
      adminClient.from('listings').select('*', { count: 'exact', head: true })
        .eq('approved', true)
        .not('expires_at', 'is', null)
        .gt('expires_at', nowIso)
        .lte('expires_at', thirtyDaysFromNow),
      // Expired: expires_at in the past
      adminClient.from('listings').select('*', { count: 'exact', head: true })
        .not('expires_at', 'is', null)
        .lt('expires_at', nowIso),
    ])

    totalCount    = allRes.count    ?? 0
    pendingCount  = pendingRes.count ?? 0
    liveCount     = liveRes.count    ?? 0
    expiringCount = expiringRes.count ?? 0
    expiredCount  = expiredRes.count  ?? 0

    // Filtered list
    let query = adminClient.from('listings').select('*').order('created_at', { ascending: false })

    if (filter === 'pending')  query = query.eq('approved', false)
    if (filter === 'live')     query = query.eq('approved', true)
    if (filter === 'expiring') {
      query = query
        .eq('approved', true)
        .not('expires_at', 'is', null)
        .gt('expires_at', nowIso)
        .lte('expires_at', thirtyDaysFromNow)
    }
    if (filter === 'expired') {
      query = query
        .not('expires_at', 'is', null)
        .lt('expires_at', nowIso)
    }

    const { data } = await query
    listings = data || []
  } catch {
    // DB error
  }

  const tabs = [
    { key: 'all',      label: 'All',           count: totalCount    },
    { key: 'pending',  label: 'Pending',        count: pendingCount  },
    { key: 'live',     label: 'Live',           count: liveCount     },
    { key: 'expiring', label: 'Expiring Soon',  count: expiringCount },
    { key: 'expired',  label: 'Expired',        count: expiredCount  },
  ]

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <MapPin size={22} className="text-blue-500" />
            Manage Listings
          </h1>
          <p className="text-gray-500 text-sm mt-0.5">{totalCount} total listings</p>
        </div>
        <Link
          href="/admin/listings/new"
          className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold px-4 py-2.5 rounded-xl text-sm transition-colors"
        >
          <Plus size={16} /> New Listing
        </Link>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 border-b border-gray-200 mb-6 overflow-x-auto">
        {tabs.map(tab => (
          <Link
            key={tab.key}
            href={`/admin/listings?filter=${tab.key}`}
            className={`px-4 py-2.5 text-sm font-medium rounded-t-lg border-b-2 transition-colors whitespace-nowrap ${
              filter === tab.key
                ? tab.key === 'expired'  ? 'border-red-500 text-red-700 bg-red-50'
                : tab.key === 'expiring' ? 'border-orange-500 text-orange-700 bg-orange-50'
                : 'border-blue-500 text-blue-700 bg-blue-50'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
            }`}
          >
            {tab.label}
            <span className={`ml-1.5 text-xs px-1.5 py-0.5 rounded-full ${
              filter === tab.key
                ? tab.key === 'expired'  ? 'bg-red-100 text-red-700'
                : tab.key === 'expiring' ? 'bg-orange-100 text-orange-700'
                : 'bg-blue-100 text-blue-700'
                : 'bg-gray-100 text-gray-500'
            }`}>
              {tab.count}
            </span>
          </Link>
        ))}
      </div>

      {/* Listings */}
      {listings.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
          <div className="text-5xl mb-3">✅</div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Nothing here</h2>
          <p className="text-gray-500 text-sm">No listings match this filter.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {listings.map(listing => {
            const isExpired  = listing.expires_at && new Date(listing.expires_at as string) < now
            return (
              <div
                key={listing.id as string}
                className={`rounded-2xl border p-5 transition-colors ${
                  isExpired ? 'bg-red-50/40 border-red-200' : 'bg-white border-gray-100 hover:border-gray-200'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">

                  {/* Info */}
                  <div className="flex gap-4 flex-1 min-w-0">
                    {/* Thumbnail */}
                    <div className="relative w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center flex-shrink-0 overflow-hidden">
                      {listing.image_url ? (
                        <Image
                          src={listing.image_url as string}
                          alt=""
                          fill
                          className="object-cover"
                          sizes="48px"
                        />
                      ) : (
                        <MapPin size={20} className="text-gray-400" />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5 mb-1">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                          listing.approved ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                        }`}>
                          {listing.approved ? '✓ Live' : '⏳ Pending'}
                        </span>
                        {listing.plan && (
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full capitalize ${
                            PLAN_COLORS[listing.plan as string] || 'bg-gray-100 text-gray-600'
                          }`}>
                            {String(listing.plan)}
                          </span>
                        )}
                        {listing.category && (
                          <span className="text-xs text-gray-500">{String(listing.category)}</span>
                        )}
                        {/* Expiry badge */}
                        {expiryBadge(listing.expires_at as string | null)}
                      </div>

                      <h3 className="font-bold text-gray-900 truncate">{String(listing.name)}</h3>

                      <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-gray-400 mt-1">
                        {listing.phone    && <span>📞 {String(listing.phone)}</span>}
                        {listing.address  && <span>📍 {String(listing.address)}</span>}
                        {listing.created_at && <span>Added {formatDate(String(listing.created_at))}</span>}
                      </div>

                      {listing.description && (
                        <p className="text-xs text-gray-400 mt-1.5 line-clamp-1">
                          {String(listing.description)}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 flex-shrink-0 flex-wrap justify-end">
                    {/* Approve / Unpublish */}
                    {!listing.approved ? (
                      <form action={approveContent}>
                        <input type="hidden" name="table" value="listings" />
                        <input type="hidden" name="id"    value={listing.id as string} />
                        <button
                          type="submit"
                          className="inline-flex items-center gap-1 bg-brand hover:bg-brand-strong text-bg text-xs font-semibold px-3 py-2 rounded-lg transition-colors"
                        >
                          <CheckCircle size={13} /> Approve
                        </button>
                      </form>
                    ) : (
                      <form action={unpublishContent}>
                        <input type="hidden" name="table" value="listings" />
                        <input type="hidden" name="id"    value={listing.id as string} />
                        <button
                          type="submit"
                          className="inline-flex items-center gap-1 bg-gray-100 hover:bg-gray-200 text-gray-600 text-xs font-semibold px-3 py-2 rounded-lg transition-colors"
                        >
                          <XCircle size={13} /> Unpublish
                        </button>
                      </form>
                    )}

                    {/* Extend 1 year */}
                    <ExtendListingButton
                      id={listing.id as string}
                      name={String(listing.name)}
                    />

                    {/* Edit */}
                    <Link
                      href={`/admin/listings/${listing.id as string}/edit`}
                      className="inline-flex items-center gap-1 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-semibold px-3 py-2 rounded-lg transition-colors border border-blue-100"
                    >
                      <Pencil size={13} /> Edit
                    </Link>

                    {/* Delete */}
                    <DeleteListingButton
                      id={listing.id as string}
                      name={String(listing.name)}
                    />
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
