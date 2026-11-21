import type { Metadata } from 'next'
import Link from 'next/link'
import { Suspense } from 'react'
import { Search, MapPin, Package, UserRound } from 'lucide-react'
import { formatPaise } from '@/lib/catalog/catalog'
import { getListingHref } from '@/lib/listing-url'
import { createPublicClient } from '@/lib/supabase/public'
import { siteConfig } from '@/lib/site'

export const metadata: Metadata = {
  title: 'Search',
  description: `Search local businesses, products, services and professionals in ${siteConfig.town}.`,
  robots: {
    index: false,
    follow: true,
    googleBot: {
      index: false,
      follow: true,
    },
  },
}

export const unstable_instant = false

interface SearchPageProps {
  searchParams: Promise<{ q?: string }>
}

type Hit = {
  kind: string
  listing_id: string
  listing_name: string
  category: string | null
  address: string | null
  rating: number | null
  subdomain: string | null
  item_id: string | null
  item_name: string | null
  price_paise: number | null
}

/** Rows asked for; split across the three sections below. */
const SEARCH_LIMIT = 60

function SearchBar({ query }: { query: string }) {
  return (
    <form method="get" action="/search" className="relative mb-10">
      <Search size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
      <input
        type="text"
        name="q"
        defaultValue={query}
        aria-label="Search businesses, products, services or professionals"
        placeholder="Cake, plumber, insurance, a shop name…"
        autoFocus
        className="w-full pl-12 pr-28 py-4 border border-gray-200 rounded-2xl focus:outline-none focus:border-brand bg-white text-base shadow-sm"
      />
      <button
        type="submit"
        className="absolute right-3 top-1/2 -translate-y-1/2 bg-brand hover:bg-brand-strong text-bg font-semibold px-5 py-2 rounded-xl transition-colors text-sm"
      >
        Search
      </button>
    </form>
  )
}

function SearchPageFallback() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="h-10 w-56 rounded-xl bg-gray-100" />
      <div className="mt-3 h-5 w-80 rounded-lg bg-gray-100" />
      <div className="mt-8 h-16 rounded-2xl bg-gray-100" />
      <div className="mt-8 space-y-4">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="h-24 rounded-2xl bg-gray-100" />
        ))}
      </div>
    </div>
  )
}

function SectionTitle({ icon, title, count }: { icon: React.ReactNode; title: string; count: number }) {
  return (
    <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2 mb-4">
      {icon}
      {title}
      <span className="text-sm font-normal text-gray-400">({count})</span>
    </h2>
  )
}

const rowClass =
  'flex items-start justify-between gap-4 bg-white border border-gray-100 hover:border-border hover:shadow-sm rounded-2xl px-5 py-4 transition-all group'

async function SearchPageContent({ searchParams }: SearchPageProps) {
  const { q } = await searchParams
  const query = (q || '').trim().slice(0, 100)

  let hits: Hit[] = []
  let searchFailed = false

  if (query) {
    try {
      // One typo-tolerant search over businesses, their items and Find's
      // professionals (supabase/migrations/*_search_directory.sql). The query
      // is a bound parameter, so it needs no escaping here.
      const supabase = createPublicClient()
      const { data, error } = await supabase.rpc('search_directory', { p_query: query, p_limit: SEARCH_LIMIT })
      if (error) throw error
      hits = (data ?? []) as Hit[]
    } catch {
      searchFailed = true
    }
  }

  const listings = hits.filter((hit) => hit.kind === 'listing')
  const items = hits.filter((hit) => hit.kind === 'item')
  const professionals = hits.filter((hit) => hit.kind === 'professional')
  const totalResults = hits.length

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Search {siteConfig.town}</h1>
        <p className="text-gray-500">Businesses, what they sell, and local professionals. Spelling mistakes are fine.</p>
      </div>

      <SearchBar query={query} />
      <p className="mb-6 text-sm text-brand"><Link href={`/listings?q=${encodeURIComponent(query)}`}>Browse businesses by service or area</Link></p>

      {!query && (
        <div className="text-center py-16">
          <div className="text-6xl mb-4">🌴</div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Search {siteConfig.town}</h2>
          <p className="text-gray-500">Type what you need, a business name, or a kind of work.</p>
          <div className="flex flex-wrap justify-center gap-2 mt-6">
            {['Cake', 'Plumber', 'Tailor', 'Insurance', 'Photographer'].map(suggestion => (
              <Link
                key={suggestion}
                href={`/search?q=${encodeURIComponent(suggestion)}`}
                className="px-4 py-2 bg-gray-100 hover:bg-surface-soft hover:text-brand text-gray-600 rounded-full text-sm transition-colors"
              >
                {suggestion}
              </Link>
            ))}
          </div>
        </div>
      )}

      {searchFailed && <p role="alert" className="rounded-xl bg-amber-50 p-4 text-amber-900">Search is temporarily unavailable. Please try again shortly.</p>}

      {query && !searchFailed && totalResults === 0 && (
        <div className="text-center py-16">
          <div className="text-6xl mb-4">🔍</div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">No results found</h2>
          <p className="text-gray-500 mb-4">
            Nothing found in {siteConfig.town} for <strong>&ldquo;{query}&rdquo;</strong>
          </p>
          <p className="text-sm text-gray-400">Try a shorter word, like &ldquo;cake&rdquo; instead of &ldquo;birthday cake shop&rdquo;.</p>
        </div>
      )}

      {query && totalResults > 0 && (
        <div>
          <p className="text-sm text-gray-500 mb-8">
            <strong>{totalResults}</strong> result{totalResults !== 1 ? 's' : ''} for <strong>&ldquo;{query}&rdquo;</strong> in {siteConfig.town}
          </p>

          <div className="space-y-10">
            {listings.length > 0 && (
              <section>
                <SectionTitle icon={<MapPin size={18} className="text-brand" />} title="Businesses" count={listings.length} />
                <div className="space-y-3">
                  {listings.map(listing => (
                    <Link key={listing.listing_id} href={getListingHref(listing.listing_id, listing.subdomain)} className={rowClass}>
                      <div>
                        <h3 className="font-semibold text-gray-900 group-hover:text-brand transition-colors text-sm">{listing.listing_name}</h3>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {listing.category}
                          {listing.address ? ` · ${listing.address}` : ''}
                        </p>
                      </div>
                      {listing.rating ? (
                        <span className="text-xs font-semibold bg-yellow-100 text-yellow-700 px-2.5 py-0.5 rounded-full flex-shrink-0">
                          ★ {Number(listing.rating).toFixed(1)}
                        </span>
                      ) : null}
                    </Link>
                  ))}
                </div>
              </section>
            )}

            {items.length > 0 && (
              <section>
                <SectionTitle icon={<Package size={18} className="text-brand" />} title="Products & services" count={items.length} />
                <div className="space-y-3">
                  {items.map(item => (
                    <Link key={item.item_id} href={`/p/${item.item_id}`} className={rowClass}>
                      <div>
                        <h3 className="font-semibold text-gray-900 group-hover:text-brand transition-colors text-sm">{item.item_name}</h3>
                        <p className="text-xs text-gray-400 mt-0.5">from {item.listing_name}</p>
                      </div>
                      <span className="text-sm font-bold text-gray-900 flex-shrink-0">
                        {item.price_paise != null ? formatPaise(item.price_paise) : 'Ask for price'}
                      </span>
                    </Link>
                  ))}
                </div>
              </section>
            )}

            {professionals.length > 0 && (
              <section>
                <SectionTitle icon={<UserRound size={18} className="text-brand" />} title="Professionals" count={professionals.length} />
                <div className="space-y-3">
                  {professionals.map(pro => (
                    <Link key={pro.listing_id} href={`/find/p/${pro.listing_id}`} className={rowClass}>
                      <div>
                        <h3 className="font-semibold text-gray-900 group-hover:text-brand transition-colors text-sm">{pro.listing_name}</h3>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {pro.category}
                          {pro.address ? ` · ${pro.address}` : ''}
                        </p>
                      </div>
                    </Link>
                  ))}
                </div>
              </section>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default function SearchPage(props: SearchPageProps) {
  return (
    <Suspense fallback={<SearchPageFallback />}>
      <SearchPageContent {...props} />
    </Suspense>
  )
}
