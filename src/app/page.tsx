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
// Featured spotlight — image-on-top card style (coastal revamp)
// ────────────────────────────────────────────────────────────────────
function FeaturedSpotlight({ listing }: { listing: FeaturedListing }) {
  const href = getListingHref(listing.id, listing.subdomain)
  const address = summarizeAddress(listing.address, 2)
  const categoryEmoji = LISTING_CATEGORY_EMOJIS[listing.category] ?? '🏪'

  return (
    <section className="py-10 md:py-14">
      <div className="max-w-[1160px] mx-auto px-5 md:px-6">
        <div className="mb-5 flex items-end justify-between gap-4 flex-wrap">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#C0582E]">
              Editor's Choice
            </p>
            <h2 className="font-display text-[26px] md:text-[30px] leading-[1.15] text-[#2E1205] mt-1">
              Featured Spotlight
            </h2>
          </div>
          <SafeAppLink
            href="/listings"
            className="inline-flex items-center gap-1 text-[13px] font-semibold text-[#C0582E] hover:text-[#8A3618] transition-colors"
          >
            View All <ArrowRight size={13} />
          </SafeAppLink>
        </div>

        <SafeAppLink
          href={href}
          className="group block bg-white border border-[#E8DDD2] rounded-3xl overflow-hidden transition-all duration-200 hover:border-[#E8C49A] hover:shadow-card-hover hover:-translate-y-[2px]"
        >
          {/* Image on top — 16:10 aspect ratio */}
          <div
            className="relative aspect-[16/10] overflow-hidden"
            style={{ background: 'linear-gradient(135deg, #E8C49A, #C0582E)' }}
          >
            {listing.image_url ? (
              <Image
                src={listing.image_url}
                alt={listing.name}
                fill
                sizes="(min-width: 1160px) 1112px, 100vw"
                className="object-cover transition-transform duration-700 group-hover:scale-[1.04]"
                priority
              />
            ) : (
              <div className="flex h-full items-center justify-center text-[80px] text-white/30" aria-hidden>
                🏪
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent" />
            <span className="absolute top-4 left-4 inline-flex items-center gap-1 bg-[#C8881E] text-[#2E1205] text-[11px] font-bold px-3 py-[5px] rounded-full uppercase tracking-wide">
              ⭐ Featured
            </span>
          </div>

          {/* Content below */}
          <div className="p-6 md:p-8">
            <div className="flex items-start justify-between gap-4 mb-3">
              <div className="min-w-0">
                <h3 className="font-display text-[24px] md:text-[28px] leading-[1.2] text-[#2E1205] mb-1.5">
                  {listing.name}
                </h3>
                {address && (
                  <div className="flex items-center gap-1 text-[#9A7A60] text-[13px]">
                    <MapPin size={13} />
                    <span>{address}</span>
                  </div>
                )}
              </div>
              {listing.rating && listing.rating > 0 ? (
                <div className="flex items-center gap-1 bg-[#F4EDE3] border border-[#E8C49A] text-[#2E1205] px-2.5 py-1 rounded-lg flex-shrink-0">
                  <Star size={12} className="fill-amber-400 text-amber-400" />
                  <span className="font-bold text-xs">{listing.rating.toFixed(1)}</span>
                </div>
              ) : (
                <span className="text-[11px] bg-[#F4EDE3] text-[#C0582E] font-semibold px-2.5 py-1 rounded-full flex-shrink-0">
                  New
                </span>
              )}
            </div>

            {listing.tagline && (
              <p className="text-sm text-[#9A7A60] leading-[1.6] line-clamp-2 mb-4">
                {listing.tagline}
              </p>
            )}

            <div className="flex items-center gap-3 flex-wrap">
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#C0582E] bg-[rgba(192,88,46,0.08)] border border-[rgba(192,88,46,0.15)] rounded-full px-2.5 py-1">
                {categoryEmoji} {listing.category}
              </span>
              {listing.verified && (
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-700 bg-blue-50 border border-blue-200 px-2.5 py-[3px] rounded-full">
                  <CheckCircle2 size={11} /> Verified
                </span>
              )}
              <span className="ml-auto inline-flex items-center gap-1.5 text-[13px] font-semibold text-[#C0582E] group-hover:text-[#8A3618] group-hover:gap-2.5 transition-all">
                Visit Page
                <ArrowRight size={13} />
              </span>
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
          1. HERO — full-bleed coastal scene, bottom-aligned content
      ───────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden min-h-[640px] md:min-h-[680px] flex flex-col justify-end">
        {/* Layered coastal backdrop — sunset gradient + scene */}
        <div className="absolute inset-0 z-0">
          {/* Base sunset gradient — sky to sea to bark */}
          <div
            className="absolute inset-0"
            style={{
              background:
                'linear-gradient(180deg, #1A0A03 0%, #2E1205 28%, #6E2D11 52%, #C0582E 72%, #E8A855 86%, #F0C87A 100%)',
            }}
          />

          {/* Setting sun glow */}
          <div
            className="absolute w-[520px] h-[520px] rounded-full pointer-events-none"
            style={{
              top: '8%',
              right: '-120px',
              background:
                'radial-gradient(circle, rgba(240,200,122,0.55) 0%, rgba(232,168,85,0.25) 35%, transparent 70%)',
            }}
          />

          {/* Warli pattern overlay (light) */}
          <div className="absolute inset-0 warli-pattern opacity-[0.05] pointer-events-none" />

          {/* Coastal scene SVG — waves + palms anchored to bottom */}
          <svg
            className="absolute bottom-0 left-0 w-full pointer-events-none"
            viewBox="0 0 1440 360"
            preserveAspectRatio="none"
            aria-hidden
            style={{ height: '52%' }}
          >
            {/* Distant wave (back) */}
            <path
              d="M0,200 Q360,170 720,195 T1440,200 L1440,360 L0,360 Z"
              fill="rgba(20, 60, 80, 0.35)"
            />
            {/* Mid wave */}
            <path
              d="M0,240 Q300,210 600,235 T1200,240 T1440,235 L1440,360 L0,360 Z"
              fill="rgba(14, 48, 64, 0.55)"
            />
            {/* Front wave with shimmer line */}
            <path
              d="M0,278 Q240,250 480,275 T960,278 T1440,275 L1440,360 L0,360 Z"
              fill="rgba(8, 32, 48, 0.75)"
            />
            <path
              d="M0,278 Q240,250 480,275 T960,278 T1440,275"
              stroke="rgba(240,200,122,0.4)"
              strokeWidth="1.5"
              fill="none"
            />
            {/* Sand strip */}
            <path d="M0,340 L1440,340 L1440,360 L0,360 Z" fill="rgba(46, 18, 5, 0.95)" />
          </svg>

          {/* Palm silhouette — left */}
          <svg
            className="absolute pointer-events-none hidden sm:block"
            style={{ bottom: '14%', left: '4%', width: 110, height: 180 }}
            viewBox="0 0 110 180"
            aria-hidden
          >
            <path
              d="M55,180 Q53,120 50,80 Q48,55 52,30"
              stroke="rgba(20, 8, 0, 0.85)"
              strokeWidth="3"
              strokeLinecap="round"
              fill="none"
            />
            {/* Palm fronds */}
            <g fill="rgba(20, 8, 0, 0.8)">
              <path d="M52,30 Q30,18 8,22 Q26,30 52,38 Z" />
              <path d="M52,30 Q70,12 95,18 Q78,30 52,38 Z" />
              <path d="M52,30 Q24,40 4,60 Q30,46 54,42 Z" />
              <path d="M52,30 Q82,42 102,58 Q78,46 54,42 Z" />
              <path d="M52,30 Q44,4 38,-2 Q50,18 54,32 Z" />
            </g>
          </svg>

          {/* Palm silhouette — right (smaller) */}
          <svg
            className="absolute pointer-events-none"
            style={{ bottom: '15%', right: '6%', width: 80, height: 140 }}
            viewBox="0 0 80 140"
            aria-hidden
          >
            <path
              d="M40,140 Q39,90 36,60 Q35,40 38,20"
              stroke="rgba(20, 8, 0, 0.8)"
              strokeWidth="2.5"
              strokeLinecap="round"
              fill="none"
            />
            <g fill="rgba(20, 8, 0, 0.75)">
              <path d="M38,20 Q22,10 6,14 Q22,20 40,26 Z" />
              <path d="M38,20 Q54,6 72,12 Q56,20 40,26 Z" />
              <path d="M38,20 Q18,28 2,46 Q22,32 40,28 Z" />
              <path d="M38,20 Q60,30 76,44 Q58,32 40,28 Z" />
            </g>
          </svg>

          {/* Bottom dark overlay for text contrast */}
          <div className="absolute inset-0 bg-gradient-to-t from-[#1A0A03] via-[#2E1205]/40 to-transparent" />
        </div>

        {/* Content — bottom-aligned, left-aligned (mobile) / centered (large) */}
        <div className="relative z-10 max-w-[1160px] mx-auto w-full px-5 md:px-6 pt-24 pb-10 md:pb-14">
          <div className="max-w-[640px]">
            {/* Live badge */}
            <div
              className="inline-flex items-center gap-2 border border-white/[0.18] bg-white/[0.10] backdrop-blur-sm rounded-full pl-2.5 pr-3.5 py-1.5 text-xs font-semibold tracking-[0.02em] mb-5"
              style={{ color: 'rgba(251,240,220,0.85)' }}
            >
              <span className="relative flex h-[7px] w-[7px]">
                <span className="absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-40 animate-pulse-green" />
                <span className="relative inline-flex h-[7px] w-[7px] rounded-full bg-green-400" />
              </span>
              <MapPin size={11} className="opacity-80" />
              Dahanu · Bordi · Gholvad · Palghar
            </div>

            {/* H1 — coastal serif */}
            <h1
              className="font-display text-white mb-4"
              style={{
                fontSize: 'clamp(38px, 7vw, 64px)',
                lineHeight: 1.05,
                letterSpacing: '-0.02em',
              }}
            >
              Discover the coastal soul of <em className="italic text-[#F0C87A]">Dahanu.</em>
            </h1>

            <p
              className="text-base max-w-[460px] leading-[1.6] mb-7"
              style={{ color: 'rgba(251,240,220,0.78)' }}
            >
              Businesses, food, jobs, services — your whole local community, right here.
            </p>

            {/* Search bar — pill style */}
            <form action="/search" method="get" className="mb-5 max-w-[560px]">
              <div className="relative group">
                <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-[#9A7A60]">
                  <Search size={18} />
                </div>
                <input
                  type="text"
                  name="q"
                  placeholder="Explore dining, stays, services, secrets…"
                  className="w-full h-14 pl-12 pr-32 bg-white/95 backdrop-blur-sm border-none rounded-2xl text-[15px] text-[#2E1205] placeholder-[#9A7A60] focus:outline-none focus:ring-2 focus:ring-[#F0C87A] shadow-search transition-all"
                />
                <button
                  type="submit"
                  className="absolute right-[6px] top-[6px] bottom-[6px] px-5 bg-[#C0582E] hover:bg-[#8A3618] text-white font-semibold text-sm rounded-xl transition-all"
                >
                  Search
                </button>
              </div>
            </form>

            {/* Hero quick tags */}
            <div className="flex flex-wrap gap-2 mb-7">
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
                  className="text-xs font-medium border border-white/15 bg-white/[0.10] rounded-full px-3 py-[5px] transition-all hover:bg-white/[0.18] hover:border-white/25"
                  style={{ color: 'rgba(251,240,220,0.75)' }}
                >
                  {label}
                </SafeAppLink>
              ))}
            </div>

            {/* CTA buttons */}
            <div className="flex flex-wrap gap-3">
              <SafeAppLink
                href="/listings"
                className="inline-flex items-center gap-2 px-[22px] py-3 bg-[#C8881E] hover:bg-[#D49A28] text-[#2E1205] font-bold text-sm rounded-xl transition-all hover:-translate-y-[1px] shadow-lg"
              >
                <Store size={15} />
                Explore Businesses
              </SafeAppLink>
              <SafeAppLink
                href="/listings/submit"
                className="inline-flex items-center gap-2 px-[22px] py-3 bg-white/[0.12] hover:bg-white/[0.20] border border-white/25 backdrop-blur-sm text-white font-semibold text-sm rounded-xl transition-all"
              >
                <Plus size={15} />
                List Your Business
              </SafeAppLink>
            </div>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          2. QUICK CATEGORIES — circular icons, horizontal scroll
      ───────────────────────────────────────────────────────────── */}
      <section className="bg-white border-b border-[#E8DDD2]">
        <div className="max-w-[1160px] mx-auto px-5 md:px-6 py-7">
          <div className="flex items-center justify-between sm:justify-around gap-4 overflow-x-auto scrollbar-hide -mx-2 px-2">
            {[
              {
                icon: '🍽️',
                label: 'Dining',
                href: getCategoryPath('Homemade Food'),
                bg: 'bg-[#FFE6CC]',
                fg: 'text-[#7A3D14]',
              },
              {
                icon: '🛏️',
                label: 'Stays',
                href: '/listings',
                bg: 'bg-[#E8E0F4]',
                fg: 'text-[#3D2A6E]',
              },
              {
                icon: '🛍️',
                label: 'Shops',
                href: '/listings',
                bg: 'bg-[#FBF0DC]',
                fg: 'text-[#7A4520]',
              },
              {
                icon: '🩺',
                label: 'Health',
                href: getCategoryPath('Healthcare & Clinics'),
                bg: 'bg-[#FFE0E0]',
                fg: 'text-[#7A1A1A]',
              },
              {
                icon: '🌿',
                label: 'Nature',
                href: '/listings',
                bg: 'bg-[#DDEFE0]',
                fg: 'text-[#1F4A28]',
              },
              {
                icon: '💼',
                label: 'Jobs',
                href: '/jobs',
                bg: 'bg-[#E0EAF8]',
                fg: 'text-[#1A3D7A]',
              },
              {
                icon: '🆘',
                label: 'Emergency',
                href: '/emergency',
                bg: 'bg-[#FFE0E0]',
                fg: 'text-[#7A1A1A]',
              },
            ].map((item) => (
              <SafeAppLink
                key={item.label}
                href={item.href}
                prefetch={false}
                className="group flex flex-col items-center gap-2 min-w-[72px] flex-shrink-0"
              >
                <span
                  className={`w-16 h-16 rounded-full ${item.bg} ${item.fg} flex items-center justify-center text-[26px] shadow-[0_2px_10px_rgba(46,18,5,0.06)] transition-transform duration-200 group-active:scale-95 group-hover:-translate-y-[2px] group-hover:shadow-[0_8px_20px_rgba(192,88,46,0.18)]`}
                  aria-hidden
                >
                  {item.icon}
                </span>
                <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#7A4520] whitespace-nowrap">
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
          6. WHAT'S NEW — horizontal scroll, snap-x
      ───────────────────────────────────────────────────────────── */}
      {newListings.length > 0 && (
        <section className="py-12 md:py-16">
          <div className="max-w-[1160px] mx-auto px-5 md:px-6 mb-6">
            <SectionHeader
              label="Just added"
              title="What's New"
              sub="Fresh additions — be the first to check them out"
              viewAllHref="/listings"
            />
          </div>
          <div className="max-w-[1160px] mx-auto">
            <div className="flex overflow-x-auto scrollbar-hide gap-4 px-5 md:px-6 pb-4 snap-x">
              {newListings.map((listing) => {
                const href = getListingHref(listing.id, listing.subdomain)
                const address = summarizeAddress(listing.address, 2)
                return (
                  <SafeAppLink
                    key={listing.id}
                    href={href}
                    className="group min-w-[280px] sm:min-w-[300px] snap-start bg-white border border-[#E8DDD2] rounded-2xl overflow-hidden transition-all duration-200 hover:border-[#E8C49A] hover:-translate-y-1 hover:shadow-card-hover flex-shrink-0"
                  >
                    <div
                      className="relative h-[170px] overflow-hidden"
                      style={{ background: 'linear-gradient(135deg, #F4EDE3, #E8C49A)' }}
                    >
                      {listing.image_url ? (
                        <Image
                          src={listing.image_url}
                          alt={listing.name}
                          fill
                          sizes="300px"
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
                      {listing.verified && (
                        <span className="absolute top-3 right-3 bg-blue-700 text-white text-[10px] font-bold px-2.5 py-[3px] rounded-full flex items-center gap-1">
                          <CheckCircle2 size={9} />
                          Verified
                        </span>
                      )}
                    </div>
                    <div className="p-4">
                      <span className="font-label-sm text-[11px] font-semibold uppercase tracking-[0.08em] text-[#C0582E]">
                        {listing.category}
                      </span>
                      <h4 className="font-display text-[18px] text-[#2E1205] leading-[1.25] mt-1 group-hover:text-[#C0582E] transition-colors line-clamp-2">
                        {listing.name}
                      </h4>
                      {listing.tagline && (
                        <p className="text-xs text-[#9A7A60] mt-1.5 line-clamp-1">
                          {listing.tagline}
                        </p>
                      )}
                      <div className="flex items-center justify-between text-xs mt-3">
                        {listing.rating && listing.rating > 0 ? (
                          <div className="flex items-center gap-1">
                            <Star size={11} className="fill-amber-400 text-amber-400" />
                            <span className="font-bold text-[12px] text-[#2E1205]">
                              {listing.rating.toFixed(1)}
                            </span>
                            <span className="text-[#9A7A60]">({listing.review_count ?? 0})</span>
                          </div>
                        ) : (
                          <span className="text-[11px] text-[#9A7A60] bg-[#F4EDE3] px-2 py-0.5 rounded-full">
                            Be the first
                          </span>
                        )}
                        {address && (
                          <span className="flex items-center gap-1 text-[#9A7A60]">
                            <MapPin size={10} />
                            <span className="truncate max-w-[100px]">{address}</span>
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
          8.7 COMMUNITY STORIES — big visual heritage card
      ───────────────────────────────────────────────────────────── */}
      <section className="py-12 md:py-16">
        <div className="max-w-[1160px] mx-auto px-5 md:px-6">
          <SafeAppLink
            href="/about"
            className="group relative block rounded-3xl overflow-hidden aspect-[4/5] sm:aspect-[16/9] md:aspect-[21/9]"
          >
            {/* Layered backdrop — sunset-over-sea + warli + silhouette */}
            <div className="absolute inset-0">
              {/* Warm sunset gradient base */}
              <div
                className="absolute inset-0"
                style={{
                  background:
                    'linear-gradient(135deg, #1A0A03 0%, #3D1808 30%, #8A3618 55%, #C0582E 75%, #E8A855 95%)',
                }}
              />
              {/* Sun/moon glow */}
              <div
                className="absolute w-[400px] h-[400px] rounded-full pointer-events-none"
                style={{
                  top: '-15%',
                  right: '-8%',
                  background:
                    'radial-gradient(circle, rgba(240,200,122,0.5) 0%, rgba(232,168,85,0.2) 40%, transparent 75%)',
                }}
              />
              {/* Warli pattern overlay */}
              <div className="absolute inset-0 warli-pattern opacity-[0.10] pointer-events-none" />

              {/* Boat + waves silhouette */}
              <svg
                className="absolute bottom-0 left-0 w-full pointer-events-none"
                viewBox="0 0 1440 280"
                preserveAspectRatio="none"
                aria-hidden
                style={{ height: '50%' }}
              >
                <path
                  d="M0,160 Q360,135 720,158 T1440,160 L1440,280 L0,280 Z"
                  fill="rgba(20, 8, 0, 0.40)"
                />
                <path
                  d="M0,200 Q300,175 600,198 T1200,205 T1440,200 L1440,280 L0,280 Z"
                  fill="rgba(15, 4, 0, 0.65)"
                />
                {/* Lone fishing boat silhouette */}
                <g transform="translate(960, 165)">
                  <path
                    d="M-40,12 Q-32,22 0,22 Q32,22 40,12 L30,0 L-30,0 Z"
                    fill="rgba(15, 4, 0, 0.95)"
                  />
                  <line x1="0" y1="0" x2="0" y2="-32" stroke="rgba(15, 4, 0, 0.95)" strokeWidth="1.5" />
                  <path d="M0,-30 L18,-8 L0,-8 Z" fill="rgba(20, 8, 0, 0.85)" />
                </g>
              </svg>

              {/* Bottom dark gradient for text legibility */}
              <div className="absolute inset-0 bg-gradient-to-t from-[#1A0A03] via-[#2E1205]/60 to-transparent" />
            </div>

            {/* Content */}
            <div className="relative z-10 h-full flex flex-col justify-end p-6 md:p-10 lg:p-12">
              <div className="max-w-[560px]">
                <span className="inline-block font-label-sm text-[11px] font-semibold uppercase tracking-[0.18em] text-[#F0C87A] mb-3">
                  Heritage
                </span>
                <h2
                  className="font-display text-white leading-[1.05] tracking-[-0.01em] mb-4"
                  style={{ fontSize: 'clamp(28px, 4.2vw, 44px)' }}
                >
                  The last traditional <em className="italic text-[#F0C87A]">fishermen.</em>
                </h2>
                <p className="text-[#FBF0DC]/85 text-sm md:text-[15px] leading-[1.65] mb-6 max-w-[460px]">
                  Preserving a thousand-year-old connection to the Arabian Sea through art, ritual,
                  and community memory. Discover the people who keep Dahanu's coastal soul alive.
                </p>
                <span className="inline-flex items-center gap-2 bg-white text-[#2E1205] font-semibold text-sm px-5 py-2.5 rounded-full transition-all group-hover:gap-3 group-hover:bg-[#F0C87A] shadow-lg">
                  Read the Story
                  <ArrowRight size={14} />
                </span>
              </div>
            </div>
          </SafeAppLink>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          9. ABOUT DAHANU
      ───────────────────────────────────────────────────────────── */}
      <section className="py-12 md:py-16">
        <div className="max-w-[1160px] mx-auto px-5 md:px-6">
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
