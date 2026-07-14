import type { Metadata } from 'next'
import { Suspense } from 'react'

import {
  getHomeNewListings,
  getHomePopularListings,
  getHomeRecentJobs,
  getHomeRecentReviews,
  getHomeStats,
} from '@/lib/data/home'
import { getCachedPricingConfig } from '@/lib/data/pricing'
import { getProfessionCounts } from '@/lib/data/find'
import { PROFESSIONS } from '@/lib/find/professions'

import HeroSection from './page-components/HeroSection'
import StatsBar from './page-components/StatsBar'
import FeaturedSpotlight from './page-components/FeaturedSpotlight'
import CategoryGrid from './page-components/CategoryGrid'
import NewListingsSection from './page-components/NewListingsSection'
import PopularBusinesses from './page-components/PopularBusinesses'
import FindDahanuSection from './page-components/FindDahanuSection'
import BusinessOwnerCTA from './page-components/BusinessOwnerCTA'
import JobsSection from './page-components/JobsSection'
import RecentReviewsSection from './page-components/RecentReviewsSection'
import HeritageSection from './page-components/HeritageSection'
import AboutDahanu from './page-components/AboutDahanu'
import BottomCTABanner from './page-components/BottomCTABanner'
import HomeSectionSkeleton from './page-components/HomeSectionSkeleton'

export const metadata: Metadata = {
  title: 'Dahanu Business Directory, Local Jobs & Community',
  description:
    'Discover Dahanu businesses, restaurants, hotels, services, local jobs, and community updates on OurDahanu.',
  alternates: {
    canonical: 'https://ourdahanu.in/',
  },
  openGraph: {
    title: 'Dahanu Business Directory, Local Jobs & Community',
    description:
      'Discover Dahanu businesses, restaurants, hotels, services, local jobs, and community updates on OurDahanu.',
    url: 'https://ourdahanu.in/',
    type: 'website',
    images: [{ url: 'https://ourdahanu.in/logo.png' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Dahanu Business Directory, Local Jobs & Community',
    description:
      'Discover Dahanu businesses, restaurants, hotels, services, local jobs, and community updates on OurDahanu.',
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

      <Suspense fallback={<HomeSectionSkeleton variant="bar" />}>
        <StatsAndCategoriesAsync />
      </Suspense>

      <Suspense fallback={<HomeSectionSkeleton variant="row" label="Newest businesses" />}>
        <NewListingsAsync />
      </Suspense>

      <Suspense fallback={<HomeSectionSkeleton variant="card" label="Find trusted people" />}>
        <FindDahanuAsync />
      </Suspense>

      <Suspense fallback={<HomeSectionSkeleton variant="row" label="Popular in Dahanu" />}>
        <PopularBusinessesAsync />
      </Suspense>

      <Suspense fallback={<HomeSectionSkeleton variant="cta" />}>
        <BusinessOwnerCTAAsync />
      </Suspense>

      <Suspense fallback={<HomeSectionSkeleton variant="jobs" />}>
        <JobsSectionAsync />
      </Suspense>

      <Suspense fallback={<HomeSectionSkeleton variant="row" label="What people are saying" />}>
        <RecentReviewsAsync />
      </Suspense>

      <HeritageSection />
      <AboutDahanu />
      <BottomCTABanner />
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
      {stats.featuredListing && <FeaturedSpotlight listing={stats.featuredListing} />}
      <CategoryGrid
        topCategoryLabels={stats.topCategoryLabels}
        categoryCounts={stats.categoryCounts}
      />
    </>
  )
}

async function NewListingsAsync() {
  const newListings = await getHomeNewListings()
  if (newListings.length === 0) return null
  return <NewListingsSection newListings={newListings} />
}

async function FindDahanuAsync() {
  const { counts, total } = await getProfessionCounts()
  if (total === 0) return null
  const categories = PROFESSIONS
    .filter((p) => (counts.get(p) ?? 0) > 0)
    .sort((a, b) => (counts.get(b) ?? 0) - (counts.get(a) ?? 0))
    .slice(0, 8)
    .map((p) => ({ label: p, count: counts.get(p) ?? 0 }))
  return <FindDahanuSection categories={categories} total={total} />
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

async function JobsSectionAsync() {
  // Three independent cached fetches; with `'use cache'` Next dedupes any
  // overlap and runs them in parallel. JobsSection needs totalJobs from
  // the stats RPC plus the recent-jobs query plus pricing.
  const [recentJobs, stats, pricing] = await Promise.all([
    getHomeRecentJobs(),
    getHomeStats(),
    getCachedPricingConfig(),
  ])
  return (
    <JobsSection
      recentJobs={recentJobs}
      totalJobs={stats.totalJobs}
      jobCurrentPrice={pricing.job_current_price}
      jobBasePrice={pricing.job_base_price}
    />
  )
}

async function RecentReviewsAsync() {
  const reviews = await getHomeRecentReviews()
  if (reviews.length === 0) return null
  return <RecentReviewsSection reviews={reviews} />
}
