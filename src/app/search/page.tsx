import type { Metadata } from 'next'
import Link from 'next/link'
import { Suspense } from 'react'
import { Search, MapPin } from 'lucide-react'
import { getListingHref } from '@/lib/listing-url'
import { createPublicClient } from '@/lib/supabase/public'

export const metadata: Metadata = {
  title: 'Search',
  description: 'Search across OurDahanu.',
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

function SearchBar({ query }: { query: string }) {
  return (
    <form method="get" action="/search" className="relative mb-10">
      <Search size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
      <input
        type="text"
        name="q"
        defaultValue={query}
        placeholder="Search events, businesses in Dahanu..."
        autoFocus
        className="w-full pl-12 pr-4 py-4 border border-gray-200 rounded-2xl focus:outline-none focus:border-brand bg-white text-base shadow-sm"
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

async function SearchPageContent({ searchParams }: SearchPageProps) {
  const { q } = await searchParams
  const query = (q || '').trim()

  let events: Record<string, unknown>[] = []
  let listings: Record<string, unknown>[] = []

  if (query) {
    try {
      const supabase = createPublicClient()
      const pattern = `%${query}%`

      const [eventsRes, listingsRes] = await Promise.all([
        Promise.resolve({ data: [] }), // events coming soon
        supabase
          .from('listings')
          .select('id, name, category, address, rating, subdomain')
          .eq('approved', true)
          .ilike('name', pattern)
          .limit(5),
      ])

      events = eventsRes.data || []
      listings = listingsRes.data || []
    } catch {
      // DB error — show no results
    }
  }

  const totalResults = listings.length

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Search OurDahanu</h1>
        <p className="text-gray-500">Find events and businesses</p>
      </div>

      <SearchBar query={query} />

      {!query && (
        <div className="text-center py-16">
          <div className="text-6xl mb-4">🌴</div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Search Dahanu</h2>
          <p className="text-gray-500">Type something above to search across all sections of OurDahanu</p>
          <div className="flex flex-wrap justify-center gap-2 mt-6">
            {['Chikoo Festival', 'Plumber', 'SSC Results', 'Flat for rent', 'Local Issues'].map(suggestion => (
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

      {query && totalResults === 0 && (
        <div className="text-center py-16">
          <div className="text-6xl mb-4">🔍</div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">No results found</h2>
          <p className="text-gray-500 mb-4">
            Nothing found in Dahanu for <strong>&ldquo;{query}&rdquo;</strong>
          </p>
          <p className="text-sm text-gray-400">Try different keywords or check your spelling</p>
        </div>
      )}

      {query && totalResults > 0 && (
        <div>
          <p className="text-sm text-gray-500 mb-8">
            Found <strong>{totalResults}</strong> result{totalResults !== 1 ? 's' : ''} for <strong>&ldquo;{query}&rdquo;</strong> in Dahanu
          </p>

          <div className="space-y-10">
            {/* Listings */}
            {listings.length > 0 && (
              <section>
                <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2 mb-4">
                  <MapPin size={18} className="text-brand" />
                  Business Listings
                  <span className="text-sm font-normal text-gray-400">({listings.length})</span>
                </h2>
                <div className="space-y-3">
                  {listings.map(listing => (
                    <Link
                      key={listing.id as string}
                      href={getListingHref(
                        listing.id as string,
                        (listing.subdomain as string | null) || null,
                      )}
                      className="flex items-start justify-between gap-4 bg-white border border-gray-100 hover:border-border hover:shadow-sm rounded-2xl px-5 py-4 transition-all group"
                    >
                      <div>
                        <h3 className="font-semibold text-gray-900 group-hover:text-brand transition-colors text-sm">{listing.name as string}</h3>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {listing.category as string}
                          {listing.address ? ` · ${listing.address as string}` : ''}
                        </p>
                      </div>
                      {listing.rating ? (
                        <span className="text-xs font-semibold bg-yellow-100 text-yellow-700 px-2.5 py-0.5 rounded-full flex-shrink-0">
                          ★ {(listing.rating as number).toFixed(1)}
                        </span>
                      ) : null}
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
