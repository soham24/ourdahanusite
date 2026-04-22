import type { Metadata } from 'next'
import Image from 'next/image'
import { Suspense } from 'react'
import {
  ArrowRight,
  Briefcase,
  Check,
  CheckCircle2,
  Clock,
  MapPin,
  Plus,
  Search,
  Star,
  Store,
} from 'lucide-react'

import OurDahanuLoader from '@/components/OurDahanuLoader'
import { getHomePageData, type FeaturedListing } from '@/lib/data/home'
import HomepagePollCard, { HomepagePollCardFallback } from '@/components/HomepagePollCard'
import SafeAppLink from '@/components/SafeAppLink'
import { summarizeAddress } from '@/lib/listing-content'
import { getCategoryPath, LISTING_CATEGORY_EMOJIS } from '@/lib/listing-category'
import { getListingHref } from '@/lib/listing-url'

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

function formatStat(value: number, fallback: string): string {
  if (!value) return fallback
  if (value >= 1000) return `${Math.round(value / 100) / 10}k+`
  return `${value}+`
}

// ────────────────────────────────────────────────────────────────────
// Featured spotlight — restyled per revamp spec
// ────────────────────────────────────────────────────────────────────
function FeaturedSpotlight({ listing }: { listing: FeaturedListing }) {
  const href = getListingHref(listing.id, listing.subdomain)
  const address = summarizeAddress(listing.address, 2)
  const categoryEmoji = LISTING_CATEGORY_EMOJIS[listing.category] ?? '🏪'

  return (
    <section className="py-12">
      <div className="max-w-[1160px] mx-auto px-6">
        <div className="mb-5">
          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#C0582E]">
            ⭐ Featured Spotlight
          </p>
        </div>

        <SafeAppLink
          href={href}
          className="group block bg-white border border-[#E8DDD2] rounded-[32px] overflow-hidden grid md:grid-cols-[380px_1fr] transition-shadow duration-200 hover:shadow-card-hover"
        >
          {/* Image side */}
          <div
            className="relative min-h-[280px] md:min-h-[320px] flex items-center justify-center overflow-hidden"
            style={{ background: 'linear-gradient(135deg, #E8C49A, #D4926A)' }}
          >
            {listing.image_url ? (
              <Image
                src={listing.image_url}
                alt={listing.name}
                fill
                sizes="(min-width: 768px) 380px, 100vw"
                className="object-cover transition-transform duration-500 group-hover:scale-[1.04]"
                priority
              />
            ) : (
              <span className="text-[80px] text-white/30" aria-hidden>
                🏪
              </span>
            )}
            <span className="absolute top-4 left-4 inline-flex items-center gap-1 bg-[#C8881E] text-[#2E1205] text-[11px] font-bold px-3 py-[5px] rounded-full">
              ⭐ Featured
            </span>
          </div>

          {/* Content side */}
          <div className="p-8 md:p-10 flex flex-col justify-center">
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#C0582E] bg-[rgba(192,88,46,0.08)] border border-[rgba(192,88,46,0.15)] rounded-full px-[10px] py-1 w-fit mb-3.5">
              {categoryEmoji} {listing.category}
            </span>

            <h2 className="font-display text-[28px] md:text-[32px] leading-[1.15] text-[#2E1205] mb-2.5">
              {listing.name}
            </h2>

            {listing.tagline && (
              <p className="text-sm text-[#9A7A60] leading-[1.6] mb-5 max-w-[360px]">
                {listing.tagline}
              </p>
            )}

            <div className="flex items-center gap-4 flex-wrap mb-7">
              {listing.rating && listing.rating > 0 ? (
                <div className="flex items-center gap-1.5 text-[13px] text-[#9A7A60]">
                  <Star size={14} className="fill-amber-400 text-amber-400" />
                  <span className="font-bold text-[#2E1205]">{listing.rating.toFixed(1)}</span>
                  <span>({listing.review_count ?? 0} reviews)</span>
                </div>
              ) : (
                <span className="text-[11px] bg-[#F4EDE3] text-[#C0582E] font-semibold px-2.5 py-1 rounded-full">
                  New on OurDahanu
                </span>
              )}
              {listing.verified && (
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-700 bg-blue-50 border border-blue-200 px-2.5 py-[3px] rounded-full">
                  <CheckCircle2 size={11} /> Verified
                </span>
              )}
              {address && (
                <span className="flex items-center gap-1 text-[13px] text-[#9A7A60]">
                  <MapPin size={11} />
                  {address}
                </span>
              )}
            </div>

            <div className="flex items-center gap-3 flex-wrap">
              <span className="inline-flex items-center gap-2 bg-[#C0582E] group-hover:bg-[#8A3618] text-white font-semibold text-sm px-6 py-3 rounded-[10px] transition-all group-hover:-translate-y-[1px]">
                Visit Page
                <ArrowRight size={14} />
              </span>
              {listing.subdomain && (
                <span className="text-xs text-[#9A7A60] font-mono">
                  {listing.subdomain}.ourdahanu.in
                </span>
              )}
            </div>
          </div>
        </SafeAppLink>
      </div>
    </section>
  )
}

// ────────────────────────────────────────────────────────────────────
// Section header — shared across content sections
// ────────────────────────────────────────────────────────────────────
function SectionHeader({
  label,
  title,
  sub,
  viewAllHref,
}: {
  label: string
  title: string
  sub?: string
  viewAllHref?: string
}) {
  return (
    <div className="flex items-end justify-between gap-4 mb-8 flex-wrap">
      <div>
        <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#C0582E] mb-1.5">
          {label}
        </p>
        <h2 className="font-display text-[30px] md:text-[34px] leading-[1.15] text-[#2E1205] tracking-[-0.01em]">
          {title}
        </h2>
        {sub && <p className="text-sm text-[#9A7A60] mt-1">{sub}</p>}
      </div>
      {viewAllHref && (
        <SafeAppLink
          href={viewAllHref}
          className="inline-flex items-center gap-1 text-[13px] font-semibold text-[#C0582E] border border-[#E8DDD2] hover:border-[#E8C49A] hover:bg-[#F4EDE3] px-[14px] py-1.5 rounded-lg transition-all"
        >
          View all
          <ArrowRight size={13} />
        </SafeAppLink>
      )}
    </div>
  )
}

export default function HomePage() {
  // Render the loader inline (non-fullscreen) as the Suspense fallback so
  // that when the homepage data is still resolving, the user sees a
  // branded loader *inside* the page layout (under the navbar, above the
  // footer) instead of a separate fullscreen page that hangs around for
  // the full window.load cycle. Fast cache hits skip the fallback
  // entirely; only cold paths see it.
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

  const topCategories = topCategoryLabels
    .filter((label) => label !== 'Other')
    .slice(0, 6)
    .map((label) => ({
      label,
      emoji: LISTING_CATEGORY_EMOJIS[label] || '🏪',
      count: categoryCounts[label] || 0,
    }))

  const currentPrice = pricing.current_price
  const basePrice = pricing.base_price
  const jobCurrentPrice = pricing.job_current_price
  const jobBasePrice = pricing.job_base_price

  return (
    <>
      {/* ─────────────────────────────────────────────────────────────
          1. HERO — deep bark bg, editorial serif headline
      ───────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-[#2E1205] pt-16 pb-[72px] sm:pt-20">
        {/* Warli pattern overlay */}
        <div className="absolute inset-0 warli-pattern opacity-[0.04] pointer-events-none" />

        {/* Warm glow orbs */}
        <div
          className="absolute w-[600px] h-[600px] rounded-full pointer-events-none"
          style={{
            top: '-120px',
            left: '-80px',
            background: 'radial-gradient(circle, rgba(192,88,46,0.22) 0%, transparent 65%)',
          }}
        />
        <div
          className="absolute w-[400px] h-[400px] rounded-full pointer-events-none"
          style={{
            bottom: '-60px',
            right: '-40px',
            background: 'radial-gradient(circle, rgba(200,136,30,0.14) 0%, transparent 65%)',
          }}
        />

        <div className="relative max-w-[760px] mx-auto px-6 text-center">
          {/* Live badge */}
          <div
            className="inline-flex items-center gap-2 border border-white/[0.12] bg-white/[0.07] backdrop-blur-sm rounded-full pl-2.5 pr-3.5 py-1.5 text-xs font-semibold tracking-[0.02em] mb-7"
            style={{ color: 'rgba(251,240,220,0.7)' }}
          >
            <span className="relative flex h-[7px] w-[7px]">
              <span className="absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-40 animate-pulse-green" />
              <span className="relative inline-flex h-[7px] w-[7px] rounded-full bg-green-400" />
            </span>
            <MapPin size={11} className="opacity-70" />
            Dahanu · Bordi · Gholvad · Palghar
          </div>

          {/* H1 */}
          <h1
            className="font-display text-[#FBF0DC] mb-[18px]"
            style={{
              fontSize: 'clamp(44px, 7vw, 74px)',
              lineHeight: 1.05,
              letterSpacing: '-0.02em',
            }}
          >
            Everything Dahanu.
            <br />
            <em className="italic text-[#F0C87A]">One Place.</em>
          </h1>

          <p
            className="text-base max-w-[420px] mx-auto leading-[1.65] mb-9"
            style={{ color: 'rgba(232,196,154,0.65)' }}
          >
            Businesses, jobs, food, services — your whole local community, right here.
          </p>

          {/* Search bar */}
          <form action="/search" method="get" className="mb-5">
            <div className="flex items-center bg-white rounded-[14px] overflow-hidden shadow-search">
              <span className="pl-[14px] pr-2 text-[#AAA] flex items-center flex-shrink-0">
                <Search size={18} />
              </span>
              <input
                type="text"
                name="q"
                placeholder="Search businesses, services, jobs in Dahanu…"
                className="flex-1 border-none outline-none text-[15px] text-[#1C0D05] placeholder-[#BAA590] py-4 pr-3 bg-transparent"
              />
              <button
                type="submit"
                className="m-[7px] px-[22px] py-2.5 bg-[#C0582E] hover:bg-[#8A3618] text-white font-semibold text-sm rounded-[9px] transition-all flex-shrink-0"
              >
                Search
              </button>
            </div>
          </form>

          {/* Hero tags */}
          <div className="flex flex-wrap justify-center gap-2">
            {[
              { label: 'Homemade Food', href: getCategoryPath('Homemade Food') },
              { label: 'Repair Services', href: getCategoryPath('Repair Services') },
              { label: 'Healthcare', href: getCategoryPath('Healthcare & Clinics') },
              { label: 'Photography', href: getCategoryPath('Photography') },
              { label: 'Salons & Beauty', href: getCategoryPath('Salons & Beauty') },
            ].map(({ label, href }) => (
              <SafeAppLink
                key={label}
                href={href}
                prefetch={false}
                className="text-xs font-medium border border-white/10 bg-white/[0.07] rounded-full px-3 py-[5px] transition-all hover:bg-white/[0.13]"
                style={{ color: 'rgba(232,196,154,0.55)' }}
              >
                {label}
              </SafeAppLink>
            ))}
          </div>

          {/* CTA buttons */}
          <div className="flex flex-wrap justify-center gap-3 mt-8">
            <SafeAppLink
              href="/listings"
              className="inline-flex items-center gap-2 px-[26px] py-[13px] bg-[#C8881E] hover:bg-[#D49A28] text-[#2E1205] font-bold text-sm rounded-[10px] transition-all hover:-translate-y-[1px]"
            >
              <Store size={15} />
              Explore Businesses
            </SafeAppLink>
            <SafeAppLink
              href="/listings/submit"
              className="inline-flex items-center gap-2 px-[26px] py-[13px] bg-white/[0.09] hover:bg-white/[0.15] border border-white/20 text-[#FBF0DC] font-semibold text-sm rounded-[10px] transition-all"
            >
              <Plus size={15} />
              List Your Business
            </SafeAppLink>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          2. QUICK NAV STRIP — sticky under navbar
      ───────────────────────────────────────────────────────────── */}
      <section className="sticky top-[60px] z-40 bg-white border-b border-[#E8DDD2]">
        <div className="max-w-[1160px] mx-auto">
          <div className="flex gap-1 overflow-x-auto scrollbar-hide px-6 py-2.5">
            {[
              { icon: '🏪', label: 'Businesses', href: '/listings', bg: '#FEF3E8' },
              { icon: '💼', label: 'Jobs', href: '/jobs', bg: '#F0FDF4' },
              { icon: '🍱', label: 'Food', href: getCategoryPath('Homemade Food'), bg: '#FFF7ED' },
              { icon: '🔧', label: 'Services', href: getCategoryPath('Repair Services'), bg: '#EFF6FF' },
              { icon: '🏥', label: 'Healthcare', href: getCategoryPath('Healthcare & Clinics'), bg: '#FDF2F8' },
              { icon: '📚', label: 'Education', href: getCategoryPath('Education & Coaching'), bg: '#F5F3FF' },
              { icon: '💇', label: 'Salons', href: getCategoryPath('Salons & Beauty'), bg: '#FFF0F0' },
              { icon: '📸', label: 'Photography', href: getCategoryPath('Photography'), bg: '#F0F9FF' },
              { icon: '🎉', label: 'Events', href: '/listings', bg: '#FEFCE8' },
              { icon: '🆘', label: 'Emergency', href: '/emergency', bg: '#FEF2F2' },
            ].map((item) => (
              <SafeAppLink
                key={item.label}
                href={item.href}
                prefetch={false}
                className="flex flex-col items-center gap-1 px-4 py-2 rounded-[10px] min-w-[70px] flex-shrink-0 hover:bg-[#F4EDE3] transition-colors"
              >
                <span
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-base"
                  style={{ background: item.bg }}
                  aria-hidden
                >
                  {item.icon}
                </span>
                <span className="text-[11px] font-semibold text-[#7A4520] whitespace-nowrap">
                  {item.label}
                </span>
              </SafeAppLink>
            ))}
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          3. STATS BAR
      ───────────────────────────────────────────────────────────── */}
      <section className="bg-[#F4EDE3] border-b border-[#E8DDD2]">
        <div className="max-w-[1160px] mx-auto px-6 py-4 flex items-center justify-center gap-10 flex-wrap">
          {[
            { val: formatStat(totalListings, '30+'), label: 'Local Businesses' },
            { val: `${topCategoryLabels.length || 8}+`, label: 'Categories' },
            { val: '1,000+', label: 'Dahanukars' },
            { val: 'Free', label: 'to browse' },
          ].map((s, i) => (
            <div key={s.label} className="flex items-center gap-6">
              {i > 0 && <div className="hidden sm:block w-px h-8 bg-[#E8DDD2]" aria-hidden />}
              <div className="flex items-center gap-2.5">
                <span className="font-display text-[26px] text-[#C0582E] leading-none">{s.val}</span>
                <span className="text-xs text-[#9A7A60] font-medium max-w-[80px] leading-[1.3]">
                  {s.label}
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          4. FEATURED SPOTLIGHT
      ───────────────────────────────────────────────────────────── */}
      {featuredListing && <FeaturedSpotlight listing={featuredListing} />}

      {/* ─────────────────────────────────────────────────────────────
          5. CATEGORY GRID — white cards on muted bg
      ───────────────────────────────────────────────────────────── */}
      {topCategories.length > 0 && (
        <section className="bg-[#F4EDE3] py-14">
          <div className="max-w-[1160px] mx-auto px-6">
            <SectionHeader
              label="Browse"
              title="Popular Categories"
              sub="The most searched services in Dahanu"
              viewAllHref="/listings"
            />
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {topCategories.map((cat) => (
                <SafeAppLink
                  key={cat.label}
                  href={getCategoryPath(cat.label)}
                  className="bg-white border border-[#E8DDD2] rounded-2xl px-4 py-5 text-center transition-all duration-200 hover:border-[#E8C49A] hover:-translate-y-[3px] hover:shadow-card-hover"
                >
                  <div className="text-[26px] mb-2.5" aria-hidden>
                    {cat.emoji}
                  </div>
                  <div className="text-xs font-semibold text-[#2E1205] leading-[1.3]">
                    {cat.label}
                  </div>
                  <div className="text-[11px] text-[#9A7A60] mt-0.5">
                    {cat.count} {cat.count === 1 ? 'business' : 'businesses'}
                  </div>
                </SafeAppLink>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ─────────────────────────────────────────────────────────────
          6. NEW BUSINESSES — just-added additions, white bg
      ───────────────────────────────────────────────────────────── */}
      {newListings.length > 0 && (
        <section className="py-16">
          <div className="max-w-[1160px] mx-auto px-6">
            <SectionHeader
              label="Just added"
              title="New on OurDahanu"
              sub="Fresh additions — be the first to check them out"
              viewAllHref="/listings"
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-[18px]">
              {newListings.map((listing) => {
                const href = getListingHref(listing.id, listing.subdomain)
                const address = summarizeAddress(listing.address, 2)
                return (
                  <SafeAppLink
                    key={listing.id}
                    href={href}
                    className="group bg-white border border-[#E8DDD2] rounded-3xl overflow-hidden transition-all duration-200 hover:border-[#E8C49A] hover:-translate-y-1 hover:shadow-card-hover"
                  >
                    <div
                      className="relative h-[180px] overflow-hidden"
                      style={{ background: 'linear-gradient(135deg, #F4EDE3, #E8C49A)' }}
                    >
                      {listing.image_url ? (
                        <Image
                          src={listing.image_url}
                          alt={listing.name}
                          fill
                          sizes="(min-width: 1024px) 360px, (min-width: 640px) 50vw, 100vw"
                          className="object-cover transition-transform duration-500 group-hover:scale-[1.06]"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center text-[52px] text-[#C0582E]/20">
                          🏪
                        </div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/25 via-transparent to-transparent" />
                      <span className="absolute top-3 left-3 bg-[#C8881E] text-[#2E1205] text-[10px] font-bold px-2.5 py-[3px] rounded-full uppercase tracking-wide">
                        New
                      </span>
                      <span className="absolute bottom-3 left-3 bg-black/55 backdrop-blur-sm text-white text-[11px] font-semibold px-2.5 py-1 rounded-full">
                        {listing.category}
                      </span>
                      {listing.verified && (
                        <span className="absolute top-3 right-3 bg-blue-700 text-white text-[10px] font-bold px-2.5 py-[3px] rounded-full flex items-center gap-1">
                          <CheckCircle2 size={9} />
                          Verified
                        </span>
                      )}
                    </div>
                    <div className="p-[18px]">
                      <h3 className="font-bold text-[16px] text-[#2E1205] leading-[1.25] mb-1 group-hover:text-[#C0582E] transition-colors">
                        {listing.name}
                      </h3>
                      {listing.tagline && (
                        <p className="text-xs text-[#9A7A60] truncate mb-3">{listing.tagline}</p>
                      )}
                      <div className="flex items-center justify-between text-xs">
                        {listing.rating && listing.rating > 0 ? (
                          <div className="flex items-center gap-1">
                            <Star size={12} className="fill-amber-400 text-amber-400" />
                            <span className="font-bold text-[13px] text-[#2E1205]">
                              {listing.rating.toFixed(1)}
                            </span>
                            <span className="text-[#9A7A60]">({listing.review_count ?? 0})</span>
                          </div>
                        ) : (
                          <span className="text-[11px] text-[#9A7A60] bg-[#F4EDE3] px-2 py-0.5 rounded-full">
                            Be the first to review
                          </span>
                        )}
                        {address && (
                          <span className="flex items-center gap-1 text-[#9A7A60]">
                            <MapPin size={10} />
                            <span className="truncate max-w-[110px]">{address}</span>
                          </span>
                        )}
                      </div>
                    </div>
                  </SafeAppLink>
                )
              })}
            </div>
          </div>
        </section>
      )}

      {/* ─────────────────────────────────────────────────────────────
          6b. POPULAR BUSINESSES — warm-cream bg
      ───────────────────────────────────────────────────────────── */}
      {listings.length > 0 && (
        <section className="bg-[#FBF0DC]/40 py-16 border-y border-[#E8DDD2]">
          <div className="max-w-[1160px] mx-auto px-6">
            <SectionHeader
              label="Popular"
              title="Around Dahanu"
              sub="Trusted and highly-reviewed local businesses"
              viewAllHref="/listings"
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-[18px]">
              {listings.map((listing) => {
                const href = getListingHref(listing.id, listing.subdomain)
                const address = summarizeAddress(listing.address, 2)
                return (
                  <SafeAppLink
                    key={listing.id}
                    href={href}
                    className="group bg-white border border-[#E8DDD2] rounded-3xl overflow-hidden transition-all duration-200 hover:border-[#E8C49A] hover:-translate-y-1 hover:shadow-card-hover"
                  >
                    <div
                      className="relative h-[180px] overflow-hidden"
                      style={{ background: 'linear-gradient(135deg, #F4EDE3, #E8C49A)' }}
                    >
                      {listing.image_url ? (
                        <Image
                          src={listing.image_url}
                          alt={listing.name}
                          fill
                          sizes="(min-width: 1024px) 360px, (min-width: 640px) 50vw, 100vw"
                          className="object-cover transition-transform duration-500 group-hover:scale-[1.06]"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center text-[52px] text-[#C0582E]/20">
                          🏪
                        </div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/25 via-transparent to-transparent" />
                      <span className="absolute bottom-3 left-3 bg-black/55 backdrop-blur-sm text-white text-[11px] font-semibold px-2.5 py-1 rounded-full">
                        {listing.category}
                      </span>
                      {listing.verified && (
                        <span className="absolute top-3 right-3 bg-blue-700 text-white text-[10px] font-bold px-2.5 py-[3px] rounded-full flex items-center gap-1">
                          <CheckCircle2 size={9} />
                          Verified
                        </span>
                      )}
                    </div>
                    <div className="p-[18px]">
                      <h3 className="font-bold text-[16px] text-[#2E1205] leading-[1.25] mb-1 group-hover:text-[#C0582E] transition-colors">
                        {listing.name}
                      </h3>
                      {listing.tagline && (
                        <p className="text-xs text-[#9A7A60] truncate mb-3">{listing.tagline}</p>
                      )}
                      <div className="flex items-center justify-between text-xs">
                        {listing.rating && listing.rating > 0 ? (
                          <div className="flex items-center gap-1">
                            <Star size={12} className="fill-amber-400 text-amber-400" />
                            <span className="font-bold text-[13px] text-[#2E1205]">
                              {listing.rating.toFixed(1)}
                            </span>
                            <span className="text-[#9A7A60]">({listing.review_count ?? 0})</span>
                          </div>
                        ) : (
                          <span className="text-[11px] text-[#9A7A60] bg-[#F4EDE3] px-2 py-0.5 rounded-full">
                            New
                          </span>
                        )}
                        {address && (
                          <span className="flex items-center gap-1 text-[#9A7A60]">
                            <MapPin size={10} />
                            <span className="truncate max-w-[110px]">{address}</span>
                          </span>
                        )}
                      </div>
                    </div>
                  </SafeAppLink>
                )
              })}
            </div>
          </div>
        </section>
      )}

      {/* ─────────────────────────────────────────────────────────────
          7. BUSINESS OWNER CTA — dark with mock card
      ───────────────────────────────────────────────────────────── */}
      <section className="py-12">
        <div className="max-w-[1160px] mx-auto px-6">
          <div className="relative bg-[#2E1205] rounded-[32px] overflow-hidden">
            <div className="absolute inset-0 warli-pattern opacity-[0.04] pointer-events-none" />

            <div className="relative grid grid-cols-1 md:grid-cols-[1fr_320px] gap-12 p-10 md:p-14 items-center">
              {/* Left copy */}
              <div>
                <p
                  className="text-[11px] font-bold uppercase tracking-[0.12em] mb-4"
                  style={{ color: 'rgba(240,200,122,0.7)' }}
                >
                  For Business Owners
                </p>
                <h2
                  className="font-display text-[#FBF0DC] mb-[18px]"
                  style={{
                    fontSize: 'clamp(32px, 4.5vw, 40px)',
                    lineHeight: 1.1,
                    letterSpacing: '-0.02em',
                  }}
                >
                  Get found by
                  <br />
                  <em className="italic text-[#F0C87A]">30,000 locals.</em>
                </h2>

                <p
                  className="text-sm leading-[1.7] mb-6 max-w-[380px]"
                  style={{ color: 'rgba(232,196,154,0.6)' }}
                >
                  Your own page at{' '}
                  <code className="font-mono text-xs bg-white/10 px-1.5 py-0.5 rounded">
                    yourname.ourdahanu.in
                  </code>{' '}
                  — searchable on Google, with WhatsApp, photos, and reviews.
                </p>

                <ul className="flex flex-col gap-2.5 mb-8">
                  {[
                    'Appear in Google searches instantly',
                    'One-tap WhatsApp from your page',
                    'Customer reviews build trust fast',
                  ].map((f) => (
                    <li
                      key={f}
                      className="flex items-center gap-2.5 text-[13px]"
                      style={{ color: 'rgba(251,240,220,0.7)' }}
                    >
                      <span
                        className="w-[18px] h-[18px] rounded-full flex items-center justify-center flex-shrink-0"
                        style={{
                          background: 'rgba(200,136,30,0.25)',
                          border: '1px solid rgba(200,136,30,0.4)',
                        }}
                      >
                        <Check size={10} className="text-[#F0C87A]" strokeWidth={2.5} />
                      </span>
                      {f}
                    </li>
                  ))}
                </ul>

                <div className="flex items-baseline gap-2.5 mb-5">
                  <span className="font-display text-[42px] text-[#F0C87A] leading-none">
                    ₹{currentPrice}
                  </span>
                  <span className="text-[13px]" style={{ color: 'rgba(232,196,154,0.5)' }}>
                    / year
                  </span>
                  {basePrice > currentPrice && (
                    <span
                      className="text-base line-through"
                      style={{ color: 'rgba(232,196,154,0.35)' }}
                    >
                      ₹{basePrice}
                    </span>
                  )}
                </div>

                <SafeAppLink
                  href="/listings/submit"
                  className="inline-flex items-center gap-2 px-[26px] py-[13px] bg-[#C8881E] hover:bg-[#D49A28] text-[#2E1205] font-bold text-sm rounded-[10px] transition-all hover:-translate-y-[1px]"
                >
                  <Plus size={15} />
                  Claim Your Profile
                </SafeAppLink>
              </div>

              {/* Right mock card */}
              <div className="hidden md:block bg-white rounded-3xl overflow-hidden shadow-cta">
                <div
                  className="h-[100px] flex items-center justify-center text-4xl"
                  style={{ background: 'linear-gradient(135deg, #C0582E, #2E1205)' }}
                  aria-hidden
                >
                  🏪
                </div>
                <div className="p-4">
                  <div className="font-bold text-sm text-[#2E1205]">Your Business Name</div>
                  <div className="font-mono text-[11px] text-[#C0582E] mt-0.5">
                    yourname.ourdahanu.in
                  </div>
                  <div className="flex items-center gap-0.5 mt-2">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} size={11} className="fill-amber-400 text-amber-400" />
                    ))}
                    <span className="text-[11px] text-[#9A7A60] ml-1">5.0 (12)</span>
                  </div>
                  <div className="flex gap-2 mt-3">
                    <div className="flex-1 text-center py-2 rounded-lg text-[11px] font-bold text-white bg-[#25D366]">
                      💬 WhatsApp
                    </div>
                    <div className="flex-1 text-center py-2 rounded-lg text-[11px] font-bold text-white bg-[#C0582E]">
                      📞 Call
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          8. JOBS SECTION — muted bg with sidebar CTA
      ───────────────────────────────────────────────────────────── */}
      <section className="bg-[#F4EDE3] py-16">
        <div className="max-w-[1160px] mx-auto px-6">
          <SectionHeader
            label="Opportunities"
            title="Jobs in Dahanu"
            sub={
              totalJobs > 0
                ? `${totalJobs} open ${totalJobs === 1 ? 'role' : 'roles'} for local people`
                : 'Local opportunities for local people'
            }
            viewAllHref="/jobs"
          />

          <div className="grid gap-6 lg:grid-cols-[1fr_260px] items-start">
            <div className="flex flex-col gap-2.5">
              {recentJobs.length > 0 ? (
                recentJobs.map((job) => (
                  <SafeAppLink
                    key={job.id}
                    href={`/jobs/${job.id}`}
                    className="group bg-white border border-[#E8DDD2] rounded-2xl p-5 flex gap-4 items-start transition-all hover:border-[#E8C49A] hover:shadow-[0_4px_16px_rgba(192,88,46,0.07)]"
                  >
                    <div className="w-11 h-11 rounded-xl bg-[#F4EDE3] flex items-center justify-center flex-shrink-0">
                      <Briefcase size={20} className="text-[#C0582E]" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="text-[11px] font-semibold text-[#C0582E] bg-[rgba(192,88,46,0.07)] rounded-full px-2 py-0.5">
                          {job.category}
                        </span>
                        <span className="text-[11px] text-[#9A7A60]">{job.type}</span>
                      </div>
                      <h3 className="font-bold text-[15px] text-[#2E1205] group-hover:text-[#C0582E] transition-colors">
                        {job.title}
                      </h3>
                      <p className="text-xs text-[#9A7A60] mt-0.5">{job.company}</p>
                      <div className="flex items-center gap-3 flex-wrap mt-2 text-xs text-[#9A7A60]">
                        {job.location && (
                          <span className="flex items-center gap-1">
                            <MapPin size={10} />
                            {job.location}
                          </span>
                        )}
                        {job.salary && (
                          <span className="font-semibold text-[#C0582E]">₹ {job.salary}</span>
                        )}
                        <span className="flex items-center gap-1">
                          <Clock size={10} />
                          {job.type}
                        </span>
                      </div>
                    </div>
                  </SafeAppLink>
                ))
              ) : (
                <div className="rounded-2xl border border-[#E8DDD2] bg-white p-10 text-center">
                  <p className="text-sm text-[#9A7A60]">
                    No open jobs yet. Employers can post the first one today.
                  </p>
                </div>
              )}
            </div>

            {/* Post a job sidebar */}
            <div className="bg-[#2E1205] rounded-3xl p-7 sticky top-[120px] text-[#FBF0DC]">
              <p
                className="text-[11px] font-bold uppercase tracking-[0.1em] mb-2.5"
                style={{ color: 'rgba(232,196,154,0.5)' }}
              >
                Hiring locally?
              </p>
              <h3 className="font-display text-[22px] text-[#FBF0DC] leading-[1.2] mb-2.5">
                Post a job in minutes
              </h3>
              <p
                className="text-[13px] leading-[1.6] mb-5"
                style={{ color: 'rgba(232,196,154,0.5)' }}
              >
                Reach job seekers around Dahanu without needing your own hiring page.
              </p>
              {jobBasePrice > jobCurrentPrice && (
                <div
                  className="text-xs line-through mb-1"
                  style={{ color: 'rgba(232,196,154,0.4)' }}
                >
                  ₹{jobBasePrice} / posting
                </div>
              )}
              <div className="font-display text-[32px] text-[#F0C87A] leading-none mb-4">
                ₹{jobCurrentPrice}
              </div>
              <SafeAppLink
                href="/jobs/submit"
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#C8881E] hover:bg-[#D49A28] text-[#2E1205] font-bold text-[13px] rounded-[10px] transition-all hover:-translate-y-[1px]"
              >
                <Plus size={13} />
                Post a Job
              </SafeAppLink>
            </div>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          8.5 COMMUNITY POLL
      ───────────────────────────────────────────────────────────── */}
      {activePoll && (
        <section className="py-16">
          <div className="max-w-[1160px] mx-auto px-6">
            <SectionHeader
              label="Community"
              title="Community Poll"
              sub="Have your say — vote and see what Dahanu thinks"
              viewAllHref="/polls"
            />
            <div className="max-w-xl">
              <Suspense fallback={<HomepagePollCardFallback />}>
                <HomepagePollCard poll={activePoll} />
              </Suspense>
            </div>
          </div>
        </section>
      )}

      {/* ─────────────────────────────────────────────────────────────
          9. ABOUT DAHANU
      ───────────────────────────────────────────────────────────── */}
      <section className="py-16">
        <div className="max-w-[1160px] mx-auto px-6">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#C0582E] mb-1.5">
              Our Town
            </p>
            <h2 className="font-display text-[30px] md:text-[34px] leading-[1.15] text-[#2E1205] tracking-[-0.01em]">
              A coastal town with strong local identity
            </h2>
            <p className="text-sm text-[#9A7A60] mt-2 max-w-[600px] leading-[1.7]">
              Dahanu is known for its chikoo orchards, beaches, Warli art, and a deep sense of
              community. OurDahanu is built to help that community discover, support, and recommend
              local businesses.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8">
            {[
              {
                title: '🌳 Chikoo Capital',
                desc: "Dahanu's sapodilla orchards are part of everyday life and the local economy — celebrated nationally for their quality.",
              },
              {
                title: '🎨 Warli Heritage',
                desc: "The region's tribal visual culture — geometric Warli art — gives our platform a distinctive and authentic local character.",
              },
              {
                title: '🤝 Built for Locals',
                desc: 'Designed to help residents find trusted services and support their neighbours. Community first, always.',
              },
            ].map((c) => (
              <div
                key={c.title}
                className="bg-white border border-[#E8DDD2] rounded-2xl p-6"
              >
                <div className="font-bold text-[#2E1205] flex items-center gap-2 mb-2">
                  {c.title}
                </div>
                <p className="text-[13px] text-[#9A7A60] leading-[1.65]">{c.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          10. BOTTOM CTA BANNER
      ───────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-[#2E1205] py-20 text-center">
        <div className="absolute inset-0 warli-pattern opacity-[0.04] pointer-events-none" />
        <div className="relative max-w-[600px] mx-auto px-6">
          <h2
            className="font-display text-[#FBF0DC] mb-4"
            style={{
              fontSize: 'clamp(32px, 5vw, 50px)',
              lineHeight: 1.1,
              letterSpacing: '-0.02em',
            }}
          >
            Dahanu is yours.
            <br />
            <em className="italic text-[#F0C87A]">Make it yours online too.</em>
          </h2>
          <p
            className="text-[15px] mb-9"
            style={{ color: 'rgba(232,196,154,0.5)' }}
          >
            Join hundreds of local businesses and residents already on OurDahanu.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <SafeAppLink
              href="/listings/submit"
              className="inline-flex items-center gap-2 px-[26px] py-[13px] bg-[#C8881E] hover:bg-[#D49A28] text-[#2E1205] font-bold text-sm rounded-[10px] transition-all hover:-translate-y-[1px]"
            >
              <Store size={15} />
              List Your Business
            </SafeAppLink>
            <SafeAppLink
              href="/listings"
              className="inline-flex items-center gap-2 px-[26px] py-[13px] bg-white/[0.09] hover:bg-white/[0.15] border border-white/20 text-[#FBF0DC] font-semibold text-sm rounded-[10px] transition-all"
            >
              <Search size={15} />
              Explore Dahanu
            </SafeAppLink>
          </div>
        </div>
      </section>
    </>
  )
}
