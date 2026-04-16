import type { Metadata } from 'next'
import { Suspense } from 'react'
import { notFound } from 'next/navigation'

import ListingsDirectoryContent from '../../ListingsDirectoryContent'
import {
  findCategoryBySlug,
  getCategoryPath,
  getCategoryUrl,
  toCategorySlug,
} from '@/lib/listing-category'
import { getListingCategories, getListingsDirectoryData } from '../../directory-data'

async function resolveCategory(slug: string): Promise<string | null> {
  const { categories } = await getListingCategories()
  return findCategoryBySlug(categories, slug)
}

export const unstable_instant = {
  prefetch: 'runtime',
  samples: [
    { params: { slug: 'restaurants' } },
  ],
}

export async function generateStaticParams() {
  const { categories } = await getListingCategories()
  return categories.map((category) => ({
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
    title: `${category} in Dahanu`,
    description: `Browse ${listingCount} ${category.toLowerCase()} business${listingCount === 1 ? '' : 'es'} in Dahanu, Bordi, and Gholvad on OurDahanu.`,
    keywords: [
      `${category} in Dahanu`,
      `${category} near Dahanu`,
      `${category} OurDahanu`,
      `Dahanu ${category}`,
    ],
    alternates: {
      canonical: getCategoryPath(category),
    },
    openGraph: {
      title: `${category} in Dahanu`,
      description: `Browse ${listingCount} ${category.toLowerCase()} business${listingCount === 1 ? '' : 'es'} in Dahanu, Bordi, and Gholvad on OurDahanu.`,
      url: getCategoryPath(category),
      type: 'website',
      images: [{ url: 'https://ourdahanu.in/logo.png' }],
    },
    twitter: {
      card: 'summary_large_image',
      title: `${category} in Dahanu`,
      description: `Browse ${listingCount} ${category.toLowerCase()} business${listingCount === 1 ? '' : 'es'} in Dahanu, Bordi, and Gholvad on OurDahanu.`,
      images: ['https://ourdahanu.in/logo.png'],
    },
  }
}

function ListingCategoryFallback() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="h-10 w-72 rounded-xl bg-gray-100" />
      <div className="mt-3 h-5 w-96 rounded-lg bg-gray-100" />
      <div className="mt-8 h-14 rounded-xl bg-gray-100" />
      <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="h-64 rounded-2xl bg-gray-100" />
        ))}
      </div>
    </div>
  )
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

export default function ListingCategoryPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  return (
    <Suspense fallback={<ListingCategoryFallback />}>
      {params.then(({ slug }) => <ListingCategoryPageContent slug={slug} />)}
    </Suspense>
  )
}
