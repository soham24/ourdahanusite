import type { Metadata } from 'next'
import { Suspense } from 'react'
import TelegramNotificationPrompt from '@/components/TelegramNotificationPrompt'

import {
  getHomeNewListings,
  getHomePopularListings,
  getHomeRecentReviews,
  getHomeStats,
} from '@/lib/data/home'
import { getCachedPricingConfig } from '@/lib/data/pricing'

import HeroSection from './page-components/HeroSection'
import StatsBar from './page-components/StatsBar'
import FeaturedSpotlight from './page-components/FeaturedSpotlight'
import CategoryGrid from './page-components/CategoryGrid'
import FindProfessionalsSection from './page-components/FindProfessionalsSection'
import NewListingsSection from './page-components/NewListingsSection'
import PopularBusinesses from './page-components/PopularBusinesses'
import BusinessOwnerCTA from './page-components/BusinessOwnerCTA'
import RecentReviewsSection from './page-components/RecentReviewsSection'
import HeritageSection from './page-components/HeritageSection'
import HomeSectionSkeleton from './page-components/HomeSectionSkeleton'
import { siteConfig } from '@/lib/site'

export const metadata: Metadata = {
  title: `${siteConfig.town} Business Directory & Community`,
  description:
    `Discover ${siteConfig.town} businesses, restaurants, hotels, services, and community updates on ${siteConfig.name}.`,
  alternates: {
    canonical: 'https://ourdahanu.in/',
  },
  openGraph: {
    title: `${siteConfig.town} Business Directory & Community`,
    description:
      `Discover ${siteConfig.town} businesses, restaurants, hotels, services, and community updates on ${siteConfig.name}.`,
    url: 'https://ourdahanu.in/',
    type: 'website',
    images: [{ url: 'https://ourdahanu.in/logo.png' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: `${siteConfig.town} Business Directory & Community`,
    description:
      `Discover ${siteConfig.town} businesses, restaurants, hotels, services, and community updates on ${siteConfig.name}.`,
    images: ['https://ourdahanu.in/logo.png'],
  },
}

// The Hero forms a static shell so this route can prefetch
// instantly on client navigation; data-driven sections sit behind their
// own Suspense boundaries below. Validation is disabled because the root
// layout's auth-aware Navbar/EmergencyRibbon trip the static-shell check
// even though they're properly wrapped in Suspense.
export const unstable_instant = {
  prefetch: 'static',
  unstable_disableValidation: true,
}

// Hero renders synchronously so the search bar appears instantly.
// Each below-fold section has its own Suspense boundary fed by
// a focused cached fetcher in lib/data/home.ts, so the page streams in
// section-by-section as data lands instead of blocking the whole tree
// behind one big fetch.
export default function HomePage() {
  return (
    <>
      <HeroSection />
      <TelegramNotificationPrompt />

      <Suspense fallback={<HomeSectionSkeleton variant="bar" />}>
        <StatsAndCategoriesAsync />
      </Suspense>

      <Suspense fallback={<HomeSectionSkeleton variant="row" label={`Popular in ${siteConfig.town}`} />}>
        <PopularBusinessesAsync />
      </Suspense>

      <Suspense fallback={<HomeSectionSkeleton variant="row" label="Newest businesses" />}>
        <NewListingsAsync />
      </Suspense>

      <Suspense fallback={<HomeSectionSkeleton variant="row" label="What people are saying" />}>
        <RecentReviewsAsync />
      </Suspense>

      <Suspense fallback={<HomeSectionSkeleton variant="cta" />}>
        <BusinessOwnerCTAAsync />
      </Suspense>

      <HeritageSection />
    </>
  )
}

async function StatsAndCategoriesAsync() {
  const stats = await getHomeStats()
  return (
    <>
      <StatsBar
        totalListings={stats.totalListings}
        topCategoryLabelsLength={stats.topCategoryLabels.length}
      />
      <CategoryGrid groups={stats.categoryGroups} />
      <FindProfessionalsSection />
      {stats.featuredListing && <FeaturedSpotlight listing={stats.featuredListing} />}
    </>
  )
}

async function NewListingsAsync() {
  const newListings = await getHomeNewListings()
  if (newListings.length === 0) return null
  return <NewListingsSection newListings={newListings} />
}

async function PopularBusinessesAsync() {
  const listings = await getHomePopularListings()
  if (listings.length === 0) return null
  return <PopularBusinesses listings={listings} />
}

async function BusinessOwnerCTAAsync() {
  const pricing = await getCachedPricingConfig()
  return (
    <BusinessOwnerCTA
      currentPrice={pricing.current_price}
      basePrice={pricing.base_price}
    />
  )
}

async function RecentReviewsAsync() {
  const reviews = await getHomeRecentReviews()
  if (reviews.length === 0) return null
  return <RecentReviewsSection reviews={reviews} />
}
