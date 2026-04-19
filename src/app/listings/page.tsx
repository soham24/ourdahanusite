import type { Metadata } from 'next'
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

export const unstable_instant = false

interface ListingsPageProps {
  searchParams: Promise<{ category?: string; q?: string }>
}

export default async function ListingsPage({ searchParams }: ListingsPageProps) {
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
