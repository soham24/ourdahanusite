import type { Metadata } from 'next'
import { Suspense } from 'react'

import OurDahanuLoader from '@/components/OurDahanuLoader'
import { getHomePageData } from '@/lib/data/home'
import HeroSection from './page-components/HeroSection'
import QuickCategories from './page-components/QuickCategories'
import StatsBar from './page-components/StatsBar'
import FeaturedSpotlight from './page-components/FeaturedSpotlight'
import CategoryGrid from './page-components/CategoryGrid'
import NewListingsSection from './page-components/NewListingsSection'
import PopularBusinesses from './page-components/PopularBusinesses'
import BusinessOwnerCTA from './page-components/BusinessOwnerCTA'
import JobsSection from './page-components/JobsSection'
import CommunityPollSection from './page-components/CommunityPollSection'
import HeritageSection from './page-components/HeritageSection'
import AboutDahanu from './page-components/AboutDahanu'
import BottomCTABanner from './page-components/BottomCTABanner'

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

export const unstable_instant = false

export default function HomePage() {
  return (
    <Suspense fallback={<OurDahanuLoader />}>
      <HomePageContent />
    </Suspense>
  )
}

async function HomePageContent() {
  const {
    listings,
    newListings,
    recentJobs,
    topCategoryLabels,
    categoryCounts,
    totalListings,
    totalJobs,
    pricing,
    featuredListing,
    activePoll,
  } = await getHomePageData()

  return (
    <>
      <HeroSection />
      
      <QuickCategories />

      <StatsBar 
        totalListings={totalListings} 
        topCategoryLabelsLength={topCategoryLabels.length} 
      />

      {featuredListing && <FeaturedSpotlight listing={featuredListing} />}

      <CategoryGrid 
        topCategoryLabels={topCategoryLabels} 
        categoryCounts={categoryCounts} 
      />

      {newListings.length > 0 && <NewListingsSection newListings={newListings} />}

      {listings.length > 0 && <PopularBusinesses listings={listings} />}

      <BusinessOwnerCTA 
        currentPrice={pricing.current_price} 
        basePrice={pricing.base_price} 
      />

      <JobsSection 
        recentJobs={recentJobs} 
        totalJobs={totalJobs} 
        jobCurrentPrice={pricing.job_current_price} 
        jobBasePrice={pricing.job_base_price} 
      />

      {activePoll && <CommunityPollSection activePoll={activePoll} />}

      <HeritageSection />

      <AboutDahanu />

      <BottomCTABanner />
    </>
  )
}
