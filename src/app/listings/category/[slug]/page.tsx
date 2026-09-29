import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import ListingsDirectoryContent from '../../ListingsDirectoryContent'
import {
  LISTING_CATEGORIES,
  findCategoryBySlug,
  getCategoryPath,
  getCategoryUrl,
  toCategorySlug,
} from '@/lib/listing-category'
import { MIN_CATEGORY_SIZE } from '@/lib/seo-thresholds'
import { getListingCategories, getListingsDirectoryData } from '../../directory-data'
import { siteConfig } from '@/lib/site'

async function resolveCategory(slug: string): Promise<string | null> {
  const { categories } = await getListingCategories()
  return findCategoryBySlug(categories, slug)
}

export async function generateStaticParams() {
  const { categories } = await getListingCategories()
  const source = categories.length > 0 ? categories : LISTING_CATEGORIES
  return source.map((category) => ({
    slug: toCategorySlug(category),
  }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const category = await resolveCategory(slug)

  if (!category) {
    return {
      title: 'Listing Category',
      robots: {
        index: false,
        follow: true,
      },
    }
  }

  const directory = await getListingsDirectoryData(category)
  const listingCount = directory.listings.length

  return {
    title: `${category} in ${siteConfig.town}`,
    description: `Browse ${listingCount} ${category.toLowerCase()} business${listingCount === 1 ? '' : 'es'} in ${siteConfig.town}, Bordi, and Gholvad on ${siteConfig.name}.`,
    keywords: [
      `${category} in ${siteConfig.town}`,
      `${category} near ${siteConfig.town}`,
      `${category} ${siteConfig.name}`,
      `${siteConfig.town} ${category}`,
    ],
    alternates: {
      canonical: getCategoryPath(category),
    },
    openGraph: {
      title: `${category} in ${siteConfig.town}`,
      description: `Browse ${listingCount} ${category.toLowerCase()} business${listingCount === 1 ? '' : 'es'} in ${siteConfig.town}, Bordi, and Gholvad on ${siteConfig.name}.`,
      url: getCategoryPath(category),
      type: 'website',
      images: [{ url: 'https://ourdahanu.in/logo.png' }],
    },
    twitter: {
      card: 'summary_large_image',
      title: `${category} in ${siteConfig.town}`,
      description: `Browse ${listingCount} ${category.toLowerCase()} business${listingCount === 1 ? '' : 'es'} in ${siteConfig.town}, Bordi, and Gholvad on ${siteConfig.name}.`,
      images: ['https://ourdahanu.in/logo.png'],
    },
    ...(listingCount < MIN_CATEGORY_SIZE ? { robots: { index: false, follow: true } } : {}),
  }
}

async function ListingCategoryPageContent({ slug }: { slug: string }) {
  const category = await resolveCategory(slug)

  if (!category) {
    notFound()
  }

  const directory = await getListingsDirectoryData(category)

  if (directory.listings.length === 0) {
    notFound()
  }

  return (
    <ListingsDirectoryContent
      activeCategory={category}
      listings={directory.listings}
      sortedCategories={directory.sortedCategories}
      categoryCounts={directory.categoryCounts}
      currentPrice={directory.currentPrice}
      basePrice={directory.basePrice}
      canonicalUrl={getCategoryUrl(category)}
    />
  )
}

export default async function ListingCategoryPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  return <ListingCategoryPageContent slug={slug} />
}
