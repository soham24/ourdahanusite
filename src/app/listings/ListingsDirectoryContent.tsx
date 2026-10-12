import { CheckCircle } from 'lucide-react'
import { Suspense } from 'react'

import StructuredData from '@/components/StructuredData'
import ListingsDirectoryResults from './ListingsDirectoryResults'
import type { DirectoryListing } from './directory-data'
import { PLAN_FEATURES } from './directory-data'
import { getCanonicalListingUrl } from '@/lib/listing-url'
import { SITE_URL } from '@/lib/site'
import SectionHeader from '@/components/ui/SectionHeader'
import Card from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import { siteConfig } from '@/lib/site'

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
    ? `${activeCategory} in ${siteConfig.town}`
    : `Business Listings in ${siteConfig.town}`
  const collectionDescription = activeCategory
    ? `Browse ${listings.length} ${activeCategory.toLowerCase()} business${listings.length === 1 ? '' : 'es'} in ${siteConfig.areas} on ${siteConfig.name}.`
    : `Browse verified businesses, services, shops, restaurants, hotels, and local professionals in ${siteConfig.town} on ${siteConfig.name}.`

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
      name: `${siteConfig.name}`,
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

      <div className="mb-5 flex flex-col md:flex-row md:items-end justify-between gap-3">
        <SectionHeader
          as="h1"
          className="mb-0"
          label="Local directory"
          title={activeCategory ? `${activeCategory} in ${siteConfig.town}` : `Business Listings in ${siteConfig.town}`}
          sub={activeCategory
            ? `${listings.length} business${listings.length !== 1 ? 'es' : ''} currently visible in ${activeCategory}. Search, sort, and compare before you contact them.`
            : `Search, sort, and compare trusted businesses and services across ${siteConfig.areas}.`}
        />

        <Card padding="sm" className="hidden md:inline-flex self-start md:self-auto text-sm text-[var(--od-ink-2)]">
          <span className="font-bold text-[var(--od-ink)] mr-1.5">{Object.keys(categoryCounts).length || sortedCategories.length - 1}</span>{' '}
          categories live
        </Card>
      </div>

      <Suspense fallback={<p role="status" className="py-8">Loading businesses…</p>}>
      <ListingsDirectoryResults
        activeCategory={activeCategory}
        listings={listings}
        sortedCategories={sortedCategories}
        categoryCounts={categoryCounts}
      />
      </Suspense>

      <div id="add" className="border-t border-[var(--od-border)] py-12">
        <div className="text-center mb-10">
          <h2 className="font-display text-[28px] md:text-[36px] text-[var(--od-ink)] leading-tight">Get Your Profile on {siteConfig.name}</h2>
          <p className="text-[var(--od-muted)] mt-2">Whether you sell, serve, or create, you belong here.</p>
        </div>

        <Card className="mx-auto max-w-md text-center" padding="lg">
          <Badge variant="brand" className="mb-4">
            Launch Offer
          </Badge>
          <div className="flex items-baseline justify-center gap-2 mb-1">
            <span className="text-5xl font-bold text-[var(--od-ink)]">₹{currentPrice}</span>
            <span className="text-[var(--od-muted)]">/ year</span>
          </div>
          <div className="text-sm text-[var(--od-muted)] line-through mb-5">₹{basePrice} / year</div>
          <ul className="space-y-3 mb-8 text-left">
            {PLAN_FEATURES.map((feature) => (
              <li key={feature} className="flex items-center gap-2.5 text-sm text-[var(--od-ink-2)]">
                <CheckCircle size={15} className="text-green-500 flex-shrink-0" />
                {feature}
              </li>
            ))}
          </ul>
          <Button
            href="/listings/submit"
            variant="primary"
            size="lg"
            className="w-full"
          >
            Claim Your Profile
          </Button>
          {activeCategory ? (
            <p className="text-[var(--od-muted)] mt-4 text-xs">
              Want to rank for {activeCategory.toLowerCase()} in Dahanu? Claim this page with your business listing.
            </p>
          ) : null}
        </Card>
      </div>
      </div>
    </div>
  )
}
