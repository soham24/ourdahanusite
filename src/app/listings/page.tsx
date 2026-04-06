import type { Metadata } from 'next'
import { Suspense } from 'react'
import { permanentRedirect } from 'next/navigation'

import ListingsDirectoryContent from './ListingsDirectoryContent'
import { getListingsDirectoryData } from './directory-data'
import { getCategoryPath } from '@/lib/listing-category'
import { buildAbsoluteUrl } from '@/lib/site'

export const metadata: Metadata = {
  title: 'Business Listings in Dahanu',
  description:
    'Browse trusted businesses, shops, hotels, restaurants, clinics, and local services in Dahanu, Bordi, and Gholvad on OurDahanu.',
  keywords: [
    'Dahanu business directory',
    'OurDahanu listings',
    'businesses in Dahanu',
    'shops in Dahanu',
    'services in Dahanu',
    'restaurants in Dahanu',
  ],
  alternates: {
    canonical: '/listings',
  },
  openGraph: {
    title: 'Business Listings in Dahanu',
    description:
      'Browse trusted businesses, shops, hotels, restaurants, clinics, and local services in Dahanu, Bordi, and Gholvad on OurDahanu.',
    url: '/listings',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Business Listings in Dahanu',
    description:
      'Browse trusted businesses, shops, hotels, restaurants, clinics, and local services in Dahanu, Bordi, and Gholvad on OurDahanu.',
  },
}

export const unstable_instant = {
  prefetch: 'runtime',
  samples: [
    { searchParams: { category: null } },
    { searchParams: { category: 'Restaurants' } },
  ],
}

interface ListingsPageProps {
  searchParams: Promise<{ category?: string; q?: string }>
}

function ListingsPageFallback() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="h-10 w-64 rounded-xl bg-gray-100" />
      <div className="mt-3 h-5 w-80 rounded-lg bg-gray-100" />
      <div className="mt-8 h-14 rounded-xl bg-gray-100" />
      <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="h-64 rounded-2xl bg-gray-100" />
        ))}
      </div>
    </div>
  )
}

async function ListingsPageContent({ searchParams }: ListingsPageProps) {
  const { category: rawCategory } = await searchParams

  if (rawCategory && rawCategory !== 'All') {
    permanentRedirect(getCategoryPath(rawCategory))
  }

  const directory = await getListingsDirectoryData(null)

  return (
    <ListingsDirectoryContent
      activeCategory={null}
      listings={directory.listings}
      sortedCategories={directory.sortedCategories}
      categoryCounts={directory.categoryCounts}
      currentPrice={directory.currentPrice}
      basePrice={directory.basePrice}
      canonicalUrl={buildAbsoluteUrl('/listings')}
    />
  )
}

export default function ListingsPage({ searchParams }: ListingsPageProps) {
  return (
    <Suspense fallback={<ListingsPageFallback />}>
      <ListingsPageContent searchParams={searchParams} />
    </Suspense>
  )
}
