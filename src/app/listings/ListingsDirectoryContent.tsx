import Link from 'next/link'
import { CheckCircle } from 'lucide-react'

import StructuredData from '@/components/StructuredData'
import ListingsDirectoryResults from './ListingsDirectoryResults'
import type { DirectoryListing } from './directory-data'
import { PLAN_FEATURES } from './directory-data'
import { getCanonicalListingUrl } from '@/lib/listing-url'
import { SITE_URL } from '@/lib/site'

interface Props {
  activeCategory: string | null
  listings: DirectoryListing[]
  sortedCategories: string[]
  categoryCounts: Record<string, number>
  currentPrice: number
  basePrice: number
  canonicalUrl: string
}

export default function ListingsDirectoryContent({
  activeCategory,
  listings,
  sortedCategories,
  categoryCounts,
  currentPrice,
  basePrice,
  canonicalUrl,
}: Props) {
  const collectionName = activeCategory
    ? `${activeCategory} in Dahanu`
    : 'Business Listings in Dahanu'
  const collectionDescription = activeCategory
    ? `Browse ${listings.length} ${activeCategory.toLowerCase()} business${listings.length === 1 ? '' : 'es'} in Dahanu, Bordi, Gholvad, and nearby areas on OurDahanu.`
    : 'Browse verified businesses, services, shops, restaurants, hotels, and local professionals in Dahanu on OurDahanu.'

  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: 'Home',
        item: SITE_URL,
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: 'Business Listings',
        item: `${SITE_URL}/listings`,
      },
      ...(activeCategory
        ? [
            {
              '@type': 'ListItem',
              position: 3,
              name: activeCategory,
              item: canonicalUrl,
            },
          ]
        : []),
    ],
  }

  const itemListSchema = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: collectionName,
    description: collectionDescription,
    url: canonicalUrl,
    isPartOf: {
      '@type': 'WebSite',
      name: 'OurDahanu',
      url: SITE_URL,
    },
    mainEntity: {
      '@type': 'ItemList',
      numberOfItems: listings.length,
      itemListElement: listings.map((listing, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        name: listing.name,
        url: getCanonicalListingUrl(listing.id, listing.subdomain),
      })),
    },
  }

  return (
    <div className="od-page py-8 md:py-10">
      <div className="od-shell">
      <StructuredData data={[breadcrumbSchema, itemListSchema]} />

      <div className="mb-8 grid gap-5 md:grid-cols-[1fr_auto] md:items-end">
        <div>
          <p className="od-eyebrow mb-2">Local directory</p>
          <h1 className="od-section-title text-3xl md:text-5xl">
            {activeCategory ? `${activeCategory} in Dahanu` : 'Business Listings in Dahanu'}
          </h1>
          <p className="od-muted mt-3 max-w-2xl text-base leading-7">
            {activeCategory
              ? `${listings.length} business${listings.length !== 1 ? 'es' : ''} currently visible in ${activeCategory}. Search, sort, and compare before you contact them.`
              : 'Search, sort, and compare trusted businesses and services across Dahanu, Bordi, Gholvad, and nearby areas.'}
          </p>
        </div>

        <div className="od-card px-4 py-3 text-sm text-[var(--od-ink-2)]">
          <span className="font-bold text-[var(--od-ink)]">{Object.keys(categoryCounts).length || sortedCategories.length - 1}</span>{' '}
          categories live
        </div>
      </div>

      <ListingsDirectoryResults
        activeCategory={activeCategory}
        listings={listings}
        sortedCategories={sortedCategories}
        categoryCounts={categoryCounts}
      />

      <div id="add" className="border-t border-[var(--od-border)] py-12">
        <div className="text-center mb-8">
          <h2 className="od-section-title text-2xl md:text-3xl">Get Your Profile on OurDahanu</h2>
          <p className="od-muted mt-2">Whether you sell, serve, or create, you belong here.</p>
        </div>

        <div className="od-card mx-auto max-w-md p-8 text-center">
          <div className="mb-4 inline-flex items-center gap-1.5 rounded-full bg-[rgba(192,88,46,0.1)] px-3 py-1 text-xs font-bold text-[var(--od-brand)]">
            Launch Offer
          </div>
          <div className="flex items-baseline justify-center gap-2 mb-1">
            <span className="text-5xl font-bold text-gray-900">₹{currentPrice}</span>
            <span className="text-gray-400">/ year</span>
          </div>
          <div className="text-sm text-gray-400 line-through mb-5">₹{basePrice} / year</div>
          <ul className="space-y-2.5 mb-7 text-left">
            {PLAN_FEATURES.map((feature) => (
              <li key={feature} className="flex items-center gap-2 text-sm text-gray-700">
                <CheckCircle size={14} className="text-green-500 flex-shrink-0" />
                {feature}
              </li>
            ))}
          </ul>
          <Link
            href="/listings/submit"
            className="od-button-primary flex px-6 py-3.5 text-base"
          >
            Claim Your Profile
          </Link>
          {activeCategory ? (
            <p className="od-muted mt-3 text-xs">
              Want to rank for {activeCategory.toLowerCase()} in Dahanu? Claim this page with your business listing.
            </p>
          ) : null}
        </div>
      </div>
      </div>
    </div>
  )
}
