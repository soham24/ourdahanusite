import type { Metadata } from 'next'
import Link from 'next/link'
import { Suspense } from 'react'
import { Search, MapPin } from 'lucide-react'
import { getListingHref } from '@/lib/listing-url'
import { createPublicClient } from '@/lib/supabase/public'

export const metadata: Metadata = {
  title: 'Search',
  description: 'Search local businesses, services, categories, and areas in Dahanu.',
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
        aria-label="Search businesses, services, or areas"
        placeholder="Business, service, or area..."
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

async function SearchPageContent({ searchParams }: SearchPageProps) {
  const { q } = await searchParams
  const query = (q || '').trim()

  let listings: Record<string, unknown>[] = []
  let searchFailed = false

  if (query) {
    try {
      const supabase = createPublicClient()
      // PostgREST's `.or()` accepts a filter expression, so restrict the
      // value to ordinary search characters before composing it.
      const safeQuery = query.slice(0, 100).replace(/[^a-zA-Z0-9\s&-]/g, ' ').trim()
      const pattern = `%${safeQuery.replace(/[\\%_]/g, '\\$&')}%`

      if (safeQuery) {
        const { data, error } = await supabase
          .from('listings')
          .select('id, name, category, address, rating, subdomain')
          .eq('approved', true)
          .or(`name.ilike.${pattern},category.ilike.${pattern},address.ilike.${pattern}`)
          .order('name')
          .limit(20)
        if (error) throw error
        listings = data || []
      }
    } catch {
      searchFailed = true
    }
  }

  const totalResults = listings.length

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Search local businesses</h1>
        <p className="text-gray-500">Find a business by name, service, category, or area.</p>
      </div>

      <SearchBar query={query} />
      <p className="mb-6 text-sm text-brand"><Link href={`/listings?q=${encodeURIComponent(query)}`}>Browse businesses by service or area</Link></p>

      {!query && (
        <div className="text-center py-16">
          <div className="text-6xl mb-4">🌴</div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Search Dahanu</h2>
          <p className="text-gray-500">Enter a business name, or browse the directory by category and area.</p>
          <div className="flex flex-wrap justify-center gap-2 mt-6">
            {['Cafe', 'Hotel', 'Clinic', 'School'].map(suggestion => (
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
            Nothing found in Dahanu for <strong>&ldquo;{query}&rdquo;</strong>
          </p>
          <p className="text-sm text-gray-400">Try different keywords or check your spelling</p>
        </div>
      )}

      {query && totalResults > 0 && (
        <div>
          <p className="text-sm text-gray-500 mb-8">
            Showing <strong>{totalResults}</strong> result{totalResults !== 1 ? 's' : ''} for <strong>&ldquo;{query}&rdquo;</strong> in Dahanu
          </p>

          {totalResults === 20 && <p className="mb-4 text-sm text-gray-500">Showing the first 20 matches. Refine your search or browse the directory.</p>}
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
