import type { Metadata } from 'next'
import { permanentRedirect } from 'next/navigation'

import ListingsDirectoryContent from './ListingsDirectoryContent'
import { getListingsDirectoryData } from './directory-data'
import { getCategoryPath } from '@/lib/listing-category'
import { buildAbsoluteUrl } from '@/lib/site'
import { siteConfig } from '@/lib/site'

export const metadata: Metadata = {
  title: `Business Listings in ${siteConfig.town}`,
  description:
    `Browse trusted businesses, shops, hotels, restaurants, clinics, and local services in ${siteConfig.town}, Bordi, and Gholvad on ${siteConfig.name}.`,
  keywords: [
    `${siteConfig.town} business directory`,
    `${siteConfig.name} listings`,
    `businesses in ${siteConfig.town}`,
    `shops in ${siteConfig.town}`,
    `services in ${siteConfig.town}`,
    `restaurants in ${siteConfig.town}`,
  ],
  alternates: {
    canonical: '/listings',
  },
  openGraph: {
    title: `Business Listings in ${siteConfig.town}`,
    description:
      `Browse trusted businesses, shops, hotels, restaurants, clinics, and local services in ${siteConfig.town}, Bordi, and Gholvad on ${siteConfig.name}.`,
    url: '/listings',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: `Business Listings in ${siteConfig.town}`,
    description:
      `Browse trusted businesses, shops, hotels, restaurants, clinics, and local services in ${siteConfig.town}, Bordi, and Gholvad on ${siteConfig.name}.`,
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
