'use client'

import Link from 'next/link'
import { useDeferredValue, useState } from 'react'
import { Plus, Search } from 'lucide-react'

import CategoryFilter from './CategoryFilter'
import ListingCard from './ListingCard'
import type { DirectoryListing } from './directory-data'
import Input from '@/components/ui/Input'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'

type SortKey = 'recommended' | 'top-rated' | 'most-reviewed' | 'newest' | 'a-z'

const SORT_OPTIONS: Array<{ value: SortKey; label: string }> = [
  { value: 'recommended', label: 'Recommended' },
  { value: 'top-rated', label: 'Top rated' },
  { value: 'most-reviewed', label: 'Most reviewed' },
  { value: 'newest', label: 'Newest' },
  { value: 'a-z', label: 'A to Z' },
]

interface Props {
  activeCategory: string | null
  listings: DirectoryListing[]
  sortedCategories: string[]
  categoryCounts: Record<string, number>
}

function sortListings(listings: DirectoryListing[], sortKey: SortKey): DirectoryListing[] {
  const copy = [...listings]

  switch (sortKey) {
    case 'top-rated':
      return copy.sort((a, b) => {
        const scoreA = (a.rating || 0) * 100 + (a.review_count || 0)
        const scoreB = (b.rating || 0) * 100 + (b.review_count || 0)
        return scoreB - scoreA
      })
    case 'most-reviewed':
      return copy.sort((a, b) => (b.review_count || 0) - (a.review_count || 0))
    case 'newest':
      return copy.sort((a, b) => {
        const aTime = a.created_at ? Date.parse(a.created_at) : a.updated_at ? Date.parse(a.updated_at) : 0
        const bTime = b.created_at ? Date.parse(b.created_at) : b.updated_at ? Date.parse(b.updated_at) : 0
        return bTime - aTime
      })
    case 'a-z':
      return copy.sort((a, b) => a.name.localeCompare(b.name))
    default:
      return copy
  }
}

export default function ListingsDirectoryResults({
  activeCategory,
  listings,
  sortedCategories,
  categoryCounts,
}: Props) {
  const [searchQuery, setSearchQuery] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('recommended')
  const deferredQuery = useDeferredValue(searchQuery.trim().toLowerCase())

  const matchingListings = listings.filter((listing) => {
    if (!deferredQuery) return true

    const haystack = [
      listing.name,
      listing.category,
      listing.tagline,
      listing.description,
      listing.address,
      listing.phone,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()

    return haystack.includes(deferredQuery)
  })

  const sortedListings = sortListings(matchingListings, sortKey)
  const countLabel = activeCategory
    ? `${sortedListings.length} ${activeCategory.toLowerCase()} result${sortedListings.length === 1 ? '' : 's'}`
    : `${sortedListings.length} business result${sortedListings.length === 1 ? '' : 's'}`

  return (
    <>
      <Card padding="sm" className="mb-6 flex items-center gap-2">
        <div className="flex-1 min-w-0">
          <Input
            type="text"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search by business, category, service, or area..."
            icon={<Search size={18} />}
            className="w-full h-11"
          />
        </div>

        <select
          value={sortKey}
          onChange={(event) => setSortKey(event.target.value as SortKey)}
          className="h-11 flex-shrink-0 rounded-xl border border-[var(--od-border)] bg-white px-2 sm:px-3 py-2 text-sm text-[var(--od-ink)] outline-none transition-all focus:border-[var(--od-brand)] focus:ring-4 focus:ring-[rgba(192,88,46,0.11)]"
        >
          {SORT_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>

        <Link
          href="/listings/submit"
          className="sm:hidden flex-shrink-0 inline-flex items-center justify-center h-11 w-11 bg-brand rounded-xl text-bg"
          aria-label="Add Business"
        >
          <Plus size={16} />
        </Link>
        {/* Wrapper controls responsive visibility — `hidden` on <Button> itself
            is overridden by the component's base `inline-flex` in the cascade. */}
        <div className="hidden sm:block flex-shrink-0">
          <Button
            href="/listings/submit"
            variant="primary"
            size="md"
            icon={<Plus size={16} />}
          >
            Add Business
          </Button>
        </div>
      </Card>

      <CategoryFilter
        sortedCategories={sortedCategories}
        activeCategory={activeCategory || 'All'}
        categoryCounts={categoryCounts}
      />

      <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-[var(--od-muted)]">
          <span className="font-bold text-[var(--od-ink)]">{countLabel}</span>
          {deferredQuery ? <> for &quot;{searchQuery.trim()}&quot;</> : null}
        </p>
        {deferredQuery ? (
          <button
            type="button"
            onClick={() => setSearchQuery('')}
            className="text-sm font-semibold text-[var(--od-brand)] transition-colors hover:text-[var(--od-brand-strong)]"
          >
            Clear search
          </button>
        ) : null}
      </div>

      {sortedListings.length > 0 ? (
        <div className="mb-16 grid grid-cols-1 gap-5 md:grid-cols-2">
          {sortedListings.map((listing) => (
            <ListingCard key={listing.id} listing={listing} />
          ))}
        </div>
      ) : (
        <Card padding="lg" className="mb-16 text-center">
          <div className="text-5xl mb-4">🏪</div>
          <h2 className="text-xl font-bold text-[var(--od-ink)] mb-2">
            No matching listings found
          </h2>
          <p className="text-sm text-[var(--od-muted)] max-w-md mx-auto">
            Try a different business name, category, or area. You can also add the first listing for this search.
          </p>
          <Button
            href="/listings/submit"
            variant="primary"
            size="md"
            icon={<Plus size={15} />}
            className="mt-6"
          >
            Add Your Business
          </Button>
        </Card>
      )}
    </>
  )
}
