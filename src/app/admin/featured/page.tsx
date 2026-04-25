import { createPublicClient } from '@/lib/supabase/public'
import { setFeaturedListing } from '@/app/actions/settings'
import { Star, MapPin, CheckCircle, Search, Sparkles } from 'lucide-react'
import Image from 'next/image'

interface ListingRow {
  id: string
  name: string
  category: string
  image_url: string | null
  tagline: string | null
  subdomain: string | null
  verified: boolean | null
  rating: number | null
  review_count: number | null
  address: string | null
  approved?: boolean
}

interface SettingRow {
  value: string
  updated_at: string
}

export default async function AdminFeaturedPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>
}) {
  const { q } = await searchParams
  const supabase = createPublicClient()

  // Current featured subdomain
  const { data: settingRow } = await supabase
    .from('site_settings')
    .select('value, updated_at')
    .eq('key', 'featured_listing_subdomain')
    .maybeSingle()

  const setting = settingRow as SettingRow | null
  const currentSubdomain = setting?.value ?? null
  const updatedAt = setting?.updated_at ?? null

  // Current featured listing details
  let currentListing: ListingRow | null = null
  if (currentSubdomain) {
    const { data } = await supabase
      .from('listings')
      .select('id, name, category, image_url, tagline, subdomain, verified, rating, review_count, address, approved')
      .eq('subdomain', currentSubdomain)
      .maybeSingle()
    currentListing = data as ListingRow | null
  }

  // Search results
  let searchResults: ListingRow[] = []
  if (q && q.trim()) {
    const { data } = await supabase
      .from('listings')
      .select('id, name, category, image_url, tagline, subdomain, verified, rating, review_count, address, approved')
      .ilike('name', `%${q.trim()}%`)
      .order('verified', { ascending: false })
      .order('review_count', { ascending: false })
      .limit(12)
    searchResults = (data ?? []) as ListingRow[]
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Sparkles size={22} className="text-gold" />
          Featured Spotlight
        </h1>
        <p className="text-gray-500 text-sm mt-1">
          The featured listing appears prominently on the homepage above the category grid.
        </p>
      </div>

      {/* Current featured */}
      <div className="bg-white rounded-2xl border border-gray-100 p-6 mb-8">
        <h2 className="text-base font-bold text-gray-800 mb-4 flex items-center gap-2">
          <span className="text-lg">⭐</span> Currently Featured
        </h2>

        {currentListing ? (
          <div className="flex items-start gap-4">
            {/* Thumbnail */}
            <div className="relative w-20 h-20 rounded-xl overflow-hidden flex-shrink-0 bg-surface-soft">
              {currentListing.image_url ? (
                <Image
                  src={currentListing.image_url}
                  alt={currentListing.name}
                  fill
                  className="object-cover"
                />
              ) : (
                <div className="h-full flex items-center justify-center text-2xl opacity-30">🏪</div>
              )}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-bold text-gray-900">{currentListing.name}</h3>
                {currentListing.verified && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-blue-700 bg-blue-50 border border-blue-100 px-2 py-0.5 rounded-full">
                    <CheckCircle size={9} /> Verified
                  </span>
                )}
                {currentListing.approved === false && (
                  <span className="text-[10px] font-bold text-red-600 bg-red-50 border border-red-100 px-2 py-0.5 rounded-full">
                    Not approved
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-500 mt-0.5">{currentListing.category}</p>
              <p className="text-xs font-mono text-brand mt-1">{currentSubdomain}.ourdahanu.in</p>
              {currentListing.address && (
                <p className="text-xs text-gray-400 flex items-center gap-1 mt-1">
                  <MapPin size={10} className="text-brand" />
                  {currentListing.address}
                </p>
              )}
              {updatedAt && (
                <p className="text-[10px] text-gray-300 mt-2">
                  Set on {new Date(updatedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                </p>
              )}
            </div>

            {/* Preview link */}
            <a
              href={`https://${currentSubdomain}.ourdahanu.in`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-shrink-0 text-xs font-semibold text-brand hover:text-brand-strong border border-brand/30 rounded-xl px-3 py-2 hover:bg-surface-soft transition-colors"
            >
              View →
            </a>
          </div>
        ) : (
          <div className="text-sm text-gray-400 bg-gray-50 rounded-xl p-6 text-center">
            No listing is currently featured.{' '}
            {currentSubdomain && (
              <span>Subdomain <span className="font-mono text-brand">{currentSubdomain}</span> not found or not approved.</span>
            )}
          </div>
        )}
      </div>

      {/* Set by subdomain directly */}
      <div className="bg-white rounded-2xl border border-gray-100 p-6 mb-8">
        <h2 className="text-base font-bold text-gray-800 mb-4">Set by Subdomain</h2>
        <form action={async (fd: FormData) => {
          'use server'
          const sub = fd.get('subdomain') as string
          await setFeaturedListing(sub)
        }} className="flex gap-3">
          <div className="flex-1 flex items-center border border-gray-200 rounded-xl overflow-hidden focus-within:border-brand transition-colors">
            <span className="px-3 text-xs text-gray-400 font-mono whitespace-nowrap bg-gray-50 border-r border-gray-200 py-3">subdomain</span>
            <input
              type="text"
              name="subdomain"
              placeholder="nisargfarm"
              defaultValue={currentSubdomain ?? ''}
              className="flex-1 px-3 py-3 text-sm focus:outline-none"
              required
            />
            <span className="px-3 text-xs text-gray-400 font-mono whitespace-nowrap bg-gray-50 border-l border-gray-200 py-3">.ourdahanu.in</span>
          </div>
          <button
            type="submit"
            className="px-5 py-3 rounded-xl text-sm font-bold text-white bg-brand hover:bg-brand-strong transition-colors whitespace-nowrap"
          >
            Set as Featured
          </button>
        </form>
      </div>

      {/* Search listings */}
      <div className="bg-white rounded-2xl border border-gray-100 p-6">
        <h2 className="text-base font-bold text-gray-800 mb-4 flex items-center gap-2">
          <Search size={16} className="text-gray-400" /> Search &amp; Pick a Listing
        </h2>

        <form method="GET" className="flex gap-3 mb-6">
          <input
            type="text"
            name="q"
            defaultValue={q ?? ''}
            placeholder="Search by business name…"
            className="flex-1 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-brand transition-colors"
          />
          <button
            type="submit"
            className="px-5 py-2.5 rounded-xl text-sm font-semibold bg-gray-100 hover:bg-gray-200 transition-colors text-gray-700"
          >
            Search
          </button>
        </form>

        {q && searchResults.length === 0 && (
          <p className="text-sm text-gray-400 text-center py-8">No listings found for &quot;{q}&quot;.</p>
        )}

        {searchResults.length > 0 && (
          <div className="space-y-3">
            {searchResults.map((listing) => (
              <div key={listing.id}
                className={`flex items-center gap-4 p-4 rounded-2xl border transition-colors ${
                  listing.subdomain === currentSubdomain
                    ? 'border-gold bg-amber-50'
                    : 'border-gray-100 hover:border-gray-200 hover:bg-gray-50'
                }`}>
                {/* Thumbnail */}
                <div className="relative w-14 h-14 rounded-xl overflow-hidden flex-shrink-0 bg-surface-soft">
                  {listing.image_url ? (
                    <Image
                      src={listing.image_url}
                      alt={listing.name}
                      fill
                      className="object-cover"
                    />
                  ) : (
                    <div className="h-full flex items-center justify-center text-xl opacity-30">🏪</div>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-semibold text-sm text-gray-900 truncate">{listing.name}</span>
                    {listing.verified && (
                      <CheckCircle size={12} className="text-blue-500 flex-shrink-0" />
                    )}
                    {listing.approved === false && (
                      <span className="text-[10px] text-red-500 bg-red-50 px-1.5 py-0.5 rounded-full font-medium">Not approved</span>
                    )}
                    {listing.subdomain === currentSubdomain && (
                      <span className="text-[10px] font-bold text-gold bg-amber-100 px-2 py-0.5 rounded-full">⭐ Current</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-400">
                    <span>{listing.category}</span>
                    {listing.subdomain && (
                      <span className="font-mono text-brand/70">{listing.subdomain}.ourdahanu.in</span>
                    )}
                    {(listing.rating ?? 0) > 0 && (
                      <span className="flex items-center gap-0.5">
                        <Star size={10} className="fill-yellow-400 text-yellow-400" />
                        {listing.rating!.toFixed(1)}
                      </span>
                    )}
                  </div>
                </div>

                {/* Set button */}
                {listing.subdomain !== currentSubdomain ? (
                  <form action={async () => {
                    'use server'
                    await setFeaturedListing(listing.subdomain!)
                  }}>
                    <button
                      type="submit"
                      className="flex-shrink-0 px-4 py-2 rounded-xl text-xs font-bold bg-gold hover:bg-gold-light transition-colors"
                      style={{ color: '#3D1A08' }}
                    >
                      ⭐ Feature
                    </button>
                  </form>
                ) : (
                  <span className="flex-shrink-0 px-4 py-2 rounded-xl text-xs font-bold text-gold border border-gold/40 bg-amber-50">
                    Featured
                  </span>
                )}
              </div>
            ))}
          </div>
        )}

        {!q && searchResults.length === 0 && (
          <p className="text-sm text-gray-400 text-center py-8">
            Search for a listing above to set it as featured.
          </p>
        )}
      </div>
    </div>
  )
}
