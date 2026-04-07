import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import {
  ArrowRight,
  Briefcase,
  CheckCircle,
  Clock,
  MapPin,
  Plus,
  Search,
  Star,
  Store,
} from 'lucide-react'

import { getHomePageData, type FeaturedListing } from '@/lib/data/home'
import { summarizeAddress } from '@/lib/listing-content'
import { getCategoryPath } from '@/lib/listing-category'
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
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Dahanu Business Directory, Local Jobs & Community',
    description:
      'Discover Dahanu businesses, restaurants, hotels, services, local jobs, and community updates on OurDahanu.',
  },
}

export const unstable_instant = false

const CATEGORY_EMOJIS: Record<string, string> = {
  Restaurants: '🍽️',
  'Homemade Food': '🍱',
  'Hotels & Stay': '🏨',
  'Hotels & Stays': '🏨',
  'Grocery & Shops': '🛒',
  Grocery: '🛒',
  'Healthcare & Clinics': '🏥',
  'Medical Store': '💊',
  Hardware: '🔩',
  'Education & Coaching': '📚',
  Tutors: '📚',
  'Transport & Taxi': '🚕',
  Transport: '🚕',
  'Salons & Beauty': '💇',
  'Massage & Wellness': '💆',
  'Warli Art': '🎨',
  'Warli Arts & Crafts': '🎨',
  'Arts & Crafts': '🖼️',
  Photography: '📸',
  'Event Services': '🎉',
  'Repair Services': '🔧',
  'Electricians & Plumbing': '⚡',
  'Contractors & Construction': '🏗️',
  'Cleaning Services': '🧹',
  Tailoring: '🧵',
  'Farms & Organic': '🌱',
  'Dairy & Milk': '🥛',
  'Bakers & Sweets': '🍰',
  'Home-based Sellers': '🏡',
  'Financial Services': '💰',
  'Content Creators': '📱',
  'Video Editors': '🎬',
  'Graphic Designers': '🖌️',
  'Social Media & Marketing': '📣',
  'Freelancers & Digital': '💻',
  Other: '🏪',
}

const CATEGORY_COLORS = [
  { bg: '#FEF3E8', border: '#FDDCBA', text: '#92400E', hover: '#FDE8CC' },
  { bg: '#F0FDF4', border: '#BBF7D0', text: '#166534', hover: '#DCFCE7' },
  { bg: '#FFF7ED', border: '#FED7AA', text: '#9A3412', hover: '#FFEDD5' },
  { bg: '#EFF6FF', border: '#BFDBFE', text: '#1E40AF', hover: '#DBEAFE' },
  { bg: '#FDF2F8', border: '#FBCFE8', text: '#9D174D', hover: '#FCE7F3' },
  { bg: '#F5F3FF', border: '#DDD6FE', text: '#5B21B6', hover: '#EDE9FE' },
]

function FeaturedSpotlight({ listing }: { listing: FeaturedListing }) {
  const href = getListingHref(listing.id, listing.subdomain)
  const address = summarizeAddress(listing.address, 2)

  return (
    <section className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
      {/* Section label */}
      <div className="flex items-center gap-3 mb-4">
        <span className="text-[11px] font-bold uppercase tracking-widest text-chikoo-gold">⭐ Featured Spotlight</span>
        <div className="flex-1 h-px" style={{ background: 'linear-gradient(to right, rgba(212,149,42,0.4), transparent)' }} />
      </div>

      <Link href={href} className="group block">
        <div
          className="relative overflow-hidden rounded-[2rem] transition-all duration-300 group-hover:shadow-warm-lg"
          style={{ background: 'linear-gradient(135deg, #FBF0DC 0%, #F0E4C4 50%, #E8D5A8 100%)' }}
        >
          {/* Warli pattern watermark */}
          <div className="absolute inset-0 warli-pattern opacity-[0.07] pointer-events-none" />

          <div className="relative grid md:grid-cols-[420px_1fr]">
            {/* Image */}
            <div className="relative h-60 md:h-auto min-h-[280px] overflow-hidden rounded-t-[2rem] md:rounded-t-none md:rounded-l-[2rem]">
              {listing.image_url ? (
                <Image
                  src={listing.image_url}
                  alt={listing.name}
                  fill
                  className="object-cover transition-transform duration-500 group-hover:scale-[1.04]"
                  priority
                />
              ) : (
                <div className="h-full flex items-center justify-center text-8xl opacity-20"
                  style={{ background: 'linear-gradient(135deg, #E8C99A, #D4952A22)' }}>
                  🏪
                </div>
              )}
              {/* Edge fade into content on desktop */}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-transparent to-[#F0E4C4] hidden md:block" />
              {/* Gold ribbon */}
              <div className="absolute top-4 left-4">
                <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-bold text-chikoo-bark shadow-md"
                  style={{ background: 'linear-gradient(135deg, #D4952A, #E8A832)' }}>
                  ⭐ Featured
                </span>
              </div>
            </div>

            {/* Content */}
            <div className="p-7 md:p-10 flex flex-col justify-center">
              {/* Category badge */}
              <span className="inline-flex items-center w-fit rounded-full bg-warli-terra/10 border border-warli-terra/20 px-2.5 py-0.5 text-[11px] font-semibold text-warli-terra mb-3">
                {CATEGORY_EMOJIS[listing.category] ?? '🏪'} {listing.category}
              </span>

              {/* Name */}
              <h2 className="text-2xl md:text-3xl font-bold text-chikoo-bark leading-tight group-hover:text-warli-terra transition-colors">
                {listing.name}
              </h2>

              {/* Tagline */}
              {listing.tagline && (
                <p className="mt-2 text-sm text-chikoo-brown/75 leading-relaxed max-w-md line-clamp-2">
                  {listing.tagline}
                </p>
              )}

              {/* Rating + address row */}
              <div className="flex flex-wrap items-center gap-4 mt-4 text-sm">
                {listing.rating && listing.rating > 0 ? (
                  <div className="flex items-center gap-1.5">
                    <Star size={14} className="fill-yellow-400 text-yellow-400" />
                    <span className="font-bold text-chikoo-bark">{listing.rating.toFixed(1)}</span>
                    <span className="text-xs text-chikoo-brown/55">({listing.review_count ?? 0} reviews)</span>
                  </div>
                ) : (
                  <span className="text-xs bg-warli-light text-warli-terra font-medium px-2.5 py-1 rounded-full">New on OurDahanu</span>
                )}
                {listing.verified && (
                  <span className="inline-flex items-center gap-1 text-xs text-blue-700 bg-blue-50 border border-blue-100 px-2.5 py-1 rounded-full font-medium">
                    <CheckCircle size={11} /> Verified
                  </span>
                )}
                {address && (
                  <span className="flex items-center gap-1 text-xs text-chikoo-brown/60">
                    <MapPin size={11} className="text-warli-terra" />
                    {address}
                  </span>
                )}
              </div>

              {/* Visit CTA */}
              <div className="mt-7 flex flex-wrap gap-3 items-center">
                <span
                  className="inline-flex items-center gap-2 rounded-2xl px-6 py-3 text-sm font-bold text-white transition-all group-hover:scale-[1.03]"
                  style={{ background: 'linear-gradient(135deg, #C4663A, #8B3A1A)', boxShadow: '0 4px 16px rgba(196,102,58,0.35)' }}
                >
                  Visit Page <ArrowRight size={14} />
                </span>
                {listing.subdomain && (
                  <span className="text-xs text-chikoo-brown/50 font-mono">
                    {listing.subdomain}.ourdahanu.in
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </Link>
    </section>
  )
}

function formatStat(value: number, fallback: string): string {
  if (!value) return fallback
  if (value >= 1000) return `${Math.round(value / 100) / 10}k+`
  return `${value}+`
}

export default async function HomePage() {
  const {
    listings,
    recentJobs,
    topCategoryLabels,
    categoryCounts,
    totalListings,
    totalJobs,
    pricing,
    featuredListing,
  } = await getHomePageData()

  const topCategories = topCategoryLabels
    .filter((label) => label !== 'Other')
    .slice(0, 6)
    .map((label) => ({
      label,
      emoji: CATEGORY_EMOJIS[label] || '🏪',
      count: categoryCounts[label] || 0,
    }))

  const currentPrice = pricing.current_price
  const basePrice = pricing.base_price
  const jobCurrentPrice = pricing.job_current_price
  const jobBasePrice = pricing.job_base_price

  return (
    <div className="min-h-screen bg-[#FDFAF6]">

      {/* ─────────────────────────────────────────────────────────────────
          1. HERO — full-width, centered, deep earthy dark
      ───────────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden" style={{
        background: 'linear-gradient(145deg, #1C0A02 0%, #3D1A08 45%, #5C2910 75%, #2C0F03 100%)',
        minHeight: '520px',
      }}>
        {/* Warli pattern overlay */}
        <div className="absolute inset-0 warli-pattern opacity-[0.045] pointer-events-none" />

        {/* Warm glow orbs */}
        <div className="absolute top-0 left-1/4 w-[500px] h-[500px] rounded-full pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(196,102,58,0.18) 0%, transparent 65%)', transform: 'translate(-50%, -30%)' }} />
        <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] rounded-full pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(212,149,42,0.14) 0%, transparent 65%)', transform: 'translate(30%, 30%)' }} />

        <div className="relative mx-auto max-w-5xl px-4 py-16 sm:py-20 lg:py-28 text-center">

          {/* Live badge */}
          <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-1.5 text-xs font-semibold text-warli-sand mb-6 backdrop-blur-sm">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-green-400" />
            </span>
            <MapPin size={11} className="text-warli-sand/70" />
            Dahanu · Bordi · Gholvad · Palghar
          </div>

          {/* Main headline */}
          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold text-warli-cream leading-[1.1] tracking-tight">
            Everything Dahanu.<br />
            <span style={{ color: '#D4952A' }}>One Place.</span>
          </h1>

          <p className="mt-5 text-warli-sand/75 text-base sm:text-lg max-w-lg mx-auto leading-relaxed">
            Businesses, jobs, food, services — your whole local community, right here.
          </p>

          {/* Big search bar */}
          <form method="get" action="/search" className="relative mt-8 max-w-2xl mx-auto">
            <div className="flex items-center bg-white rounded-2xl overflow-hidden border border-white/10"
              style={{ boxShadow: '0 20px 60px rgba(0,0,0,0.4), 0 4px 16px rgba(196,102,58,0.2)' }}>
              <Search size={18} className="ml-4 text-gray-400 flex-shrink-0" />
              <input
                type="text"
                name="q"
                placeholder="Search businesses, services, jobs in Dahanu…"
                className="flex-1 px-4 py-4 text-sm text-gray-800 placeholder-gray-400 focus:outline-none bg-transparent"
              />
              <button
                type="submit"
                className="m-1.5 px-6 py-2.5 rounded-xl text-sm font-bold text-white transition-all hover:scale-[1.03] active:scale-[0.98]"
                style={{ background: 'linear-gradient(135deg, #C4663A, #8B3A1A)' }}
              >
                Search
              </button>
            </div>
          </form>

          {/* Popular searches */}
          <div className="flex flex-wrap items-center justify-center gap-2 mt-4">
            {[
              { label: '🍱 Homemade Food', href: getCategoryPath('Homemade Food') },
              { label: '🔧 Repair', href: getCategoryPath('Repair Services') },
              { label: '💊 Healthcare', href: getCategoryPath('Healthcare & Clinics') },
              { label: '📸 Photography', href: getCategoryPath('Photography') },
              { label: '💇 Salons', href: getCategoryPath('Salons & Beauty') },
            ].map(({ label, href }) => (
              <Link key={label} href={href}
                className="text-xs text-warli-sand/65 bg-white/10 rounded-full px-3 py-1.5 hover:bg-white/20 hover:text-warli-sand transition-all">
                {label}
              </Link>
            ))}
          </div>

          {/* CTA buttons */}
          <div className="flex flex-wrap justify-center gap-3 mt-7">
            <Link href="/listings"
              className="inline-flex items-center gap-2 rounded-2xl bg-chikoo-gold px-6 py-3 text-sm font-bold text-chikoo-bark transition-all hover:bg-chikoo-amber hover:scale-[1.03]"
              style={{ boxShadow: '0 4px 16px rgba(212,149,42,0.4)' }}>
              <Store size={15} />
              Explore Businesses
            </Link>
            <Link href="/listings/submit"
              className="inline-flex items-center gap-2 rounded-2xl border border-white/25 bg-white/10 px-6 py-3 text-sm font-semibold text-warli-cream hover:bg-white/20 transition-all backdrop-blur-sm">
              <Plus size={15} />
              List Your Business
            </Link>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────────
          2. QUICK ACTIONS BAR — Zomato / Swiggy style
      ───────────────────────────────────────────────────────────────── */}
      <section className="bg-white border-b border-warli-sand/25 sticky-quick-bar">
        <div className="mx-auto max-w-6xl px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex gap-3 overflow-x-auto scrollbar-hide pb-0.5">
            {[
              { icon: '🏪', label: 'Businesses', href: '/listings',                              bg: '#FEF3E8', text: '#92400E' },
              { icon: '💼', label: 'Jobs',        href: '/jobs',                                 bg: '#F0FDF4', text: '#166534' },
              { icon: '🍱', label: 'Food',        href: getCategoryPath('Homemade Food'),        bg: '#FFF7ED', text: '#9A3412' },
              { icon: '🔧', label: 'Services',    href: getCategoryPath('Repair Services'),      bg: '#EFF6FF', text: '#1E40AF' },
              { icon: '🏥', label: 'Healthcare',  href: getCategoryPath('Healthcare & Clinics'), bg: '#FDF2F8', text: '#9D174D' },
              { icon: '📚', label: 'Education',   href: getCategoryPath('Education & Coaching'), bg: '#F5F3FF', text: '#5B21B6' },
              { icon: '💇', label: 'Salons',      href: getCategoryPath('Salons & Beauty'),      bg: '#FFF0F0', text: '#9B1C1C' },
              { icon: '📸', label: 'Photography', href: getCategoryPath('Photography'),          bg: '#F0F9FF', text: '#075985' },
            ].map(item => (
              <Link key={item.label} href={item.href}
                className="flex-shrink-0 flex flex-col items-center gap-1.5 rounded-2xl px-4 py-3 text-center transition-all hover:scale-[1.06] hover:-translate-y-0.5 active:scale-100"
                style={{ background: item.bg, minWidth: '72px' }}>
                <span className="text-xl leading-none">{item.icon}</span>
                <span className="text-[11px] font-semibold" style={{ color: item.text }}>{item.label}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────────
          3. TRUST STRIP — social proof numbers
      ───────────────────────────────────────────────────────────────── */}
      <section style={{ background: 'linear-gradient(135deg, #1C0A02 0%, #3D1A08 100%)' }}>
        <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
          <div className="grid grid-cols-3 gap-3 sm:gap-6">
            {[
              { val: formatStat(totalListings, '30+'), label: 'Local Businesses', icon: '🏪' },
              { val: `${topCategoryLabels.length || 8}+`,  label: 'Categories',       icon: '📂' },
              { val: '1,000+',                             label: 'Dahanukars',       icon: '🤝' },
            ].map(s => (
              <div key={s.label} className="rounded-2xl border border-white/10 bg-white/5 p-4 sm:p-6 text-center backdrop-blur-sm">
                <div className="text-xl sm:text-2xl mb-1">{s.icon}</div>
                <div className="text-2xl sm:text-3xl font-bold" style={{ color: '#D4952A' }}>{s.val}</div>
                <div className="text-[11px] sm:text-sm mt-1 text-warli-sand/60">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────────
          3.5 FEATURED SPOTLIGHT — admin-pinned listing
      ───────────────────────────────────────────────────────────────── */}
      {featuredListing && <FeaturedSpotlight listing={featuredListing} />}

      {/* ─────────────────────────────────────────────────────────────────
          4. CATEGORY GRID — color-coded, inviting
      ───────────────────────────────────────────────────────────────── */}
      {topCategories.length > 0 && (
        <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold text-chikoo-bark">Browse by Category</h2>
              <p className="text-sm text-chikoo-brown mt-1">The most searched categories in Dahanu</p>
            </div>
            <Link href="/listings"
              className="hidden sm:inline-flex items-center gap-1 text-sm font-semibold text-warli-terra hover:text-warli-deep transition-colors">
              View all <ArrowRight size={14} />
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {topCategories.map((cat, i) => {
              const c = CATEGORY_COLORS[i % CATEGORY_COLORS.length]
              return (
                <Link key={cat.label} href={getCategoryPath(cat.label)}
                  className="group rounded-2xl px-4 py-4 text-left transition-all hover:-translate-y-1 hover:shadow-md border"
                  style={{ background: c.bg, borderColor: c.border }}>
                  <div className="text-2xl">{cat.emoji}</div>
                  <div className="mt-3 text-sm font-semibold leading-tight" style={{ color: c.text }}>
                    {cat.label}
                  </div>
                  <div className="mt-0.5 text-xs" style={{ color: c.text, opacity: 0.6 }}>
                    {cat.count} {cat.count === 1 ? 'business' : 'businesses'}
                  </div>
                </Link>
              )
            })}
          </div>
          <div className="mt-4 sm:hidden">
            <Link href="/listings"
              className="inline-flex items-center gap-1 text-sm font-semibold text-warli-terra hover:text-warli-deep transition-colors">
              View all categories <ArrowRight size={14} />
            </Link>
          </div>
        </section>
      )}

      {/* ─────────────────────────────────────────────────────────────────
          5. FEATURED BUSINESSES — premium cards on warm bg
      ───────────────────────────────────────────────────────────────── */}
      {listings.length > 0 && (
        <section style={{ background: '#F9F4ED' }} className="py-12">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold text-chikoo-bark">Popular Around Dahanu</h2>
                <p className="text-sm text-chikoo-brown mt-1">Trusted and highly-reviewed local businesses</p>
              </div>
              <Link href="/listings"
                className="inline-flex items-center gap-1 text-sm font-semibold text-warli-terra hover:text-warli-deep transition-colors">
                View all <ArrowRight size={14} />
              </Link>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {listings.map((listing) => {
                const href = getListingHref(listing.id, listing.subdomain)
                const address = summarizeAddress(listing.address, 2)
                return (
                  <Link key={listing.id} href={href}
                    className="listing-card group overflow-hidden rounded-[1.75rem] border border-warli-sand/40 bg-white">
                    <div className="relative h-44 bg-gradient-to-br from-warli-light to-warli-sand/40 overflow-hidden">
                      {listing.image_url ? (
                        <Image
                          src={listing.image_url}
                          alt={listing.name}
                          fill
                          className="object-cover transition-transform duration-500 group-hover:scale-[1.07]"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center text-5xl opacity-25">🏪</div>
                      )}
                      {/* Bottom gradient overlay */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
                      <div className="absolute bottom-3 left-3">
                        <span className="rounded-full bg-black/50 px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur-sm">
                          {listing.category}
                        </span>
                      </div>
                      {listing.verified && (
                        <div className="absolute top-3 right-3 rounded-full bg-blue-600 px-2.5 py-1 text-[10px] font-bold text-white flex items-center gap-1">
                          <CheckCircle size={9} />
                          Verified
                        </div>
                      )}
                    </div>
                    <div className="p-4">
                      <h3 className="font-bold text-chikoo-bark text-base leading-snug group-hover:text-warli-terra transition-colors">
                        {listing.name}
                      </h3>
                      {listing.tagline && (
                        <p className="mt-1 line-clamp-1 text-xs text-chikoo-brown/65">{listing.tagline}</p>
                      )}
                      <div className="mt-3 flex items-center justify-between text-xs">
                        <div className="flex items-center gap-1">
                          {listing.rating && listing.rating > 0 ? (
                            <>
                              <Star size={12} className="fill-yellow-400 text-yellow-400" />
                              <span className="font-semibold text-chikoo-bark">{listing.rating.toFixed(1)}</span>
                              <span className="text-chikoo-brown/50">({listing.review_count ?? 0})</span>
                            </>
                          ) : (
                            <span className="text-[11px] text-chikoo-brown/50 bg-warli-light px-2 py-0.5 rounded-full">New</span>
                          )}
                        </div>
                        {address && (
                          <div className="flex items-center gap-1 text-chikoo-brown/55">
                            <MapPin size={10} className="text-warli-terra" />
                            <span className="truncate max-w-[110px]">{address}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </Link>
                )
              })}
            </div>
          </div>
        </section>
      )}

      {/* ─────────────────────────────────────────────────────────────────
          6. BUSINESS OWNER CTA — strong, with mock preview
      ───────────────────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8">
        <div
          className="rounded-[2.5rem] overflow-hidden"
          style={{ background: 'linear-gradient(145deg, #2C0F03 0%, #5C2910 55%, #C4663A 100%)' }}>
          <div className="p-8 md:p-12 grid gap-8 md:grid-cols-2 items-center">
            {/* Left: copy */}
            <div>
              <div className="text-[11px] font-bold uppercase tracking-widest text-chikoo-gold mb-4">
                For Business Owners
              </div>
              <h2 className="text-3xl sm:text-4xl font-bold text-warli-cream leading-tight">
                Get found by<br />
                <span style={{ color: '#D4952A' }}>30,000 locals.</span>
              </h2>
              <p className="mt-4 text-warli-sand/75 text-sm leading-relaxed max-w-sm">
                Your own page at{' '}
                <span className="font-mono text-xs bg-white/15 px-1.5 py-0.5 rounded">
                  yourname.ourdahanu.in
                </span>
                {' '}— searchable on Google, with WhatsApp, photos, and reviews.
              </p>
              <ul className="mt-5 space-y-2.5 text-sm text-warli-sand/75">
                {[
                  'Appear in Google searches instantly',
                  'One-tap WhatsApp from your page',
                  'Customer reviews build trust fast',
                ].map((f) => (
                  <li key={f} className="flex items-center gap-2">
                    <CheckCircle size={14} className="text-chikoo-gold flex-shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
              <div className="mt-7 flex flex-wrap gap-3 items-center">
                <Link
                  href="/listings/submit"
                  className="inline-flex items-center gap-2 rounded-2xl bg-chikoo-gold px-6 py-3 text-sm font-bold text-chikoo-bark transition-all hover:bg-chikoo-amber hover:scale-[1.03]"
                  style={{ boxShadow: '0 4px 16px rgba(212,149,42,0.35)' }}>
                  <Plus size={15} />
                  Claim Your Profile — ₹{currentPrice}/yr
                </Link>
                {basePrice > currentPrice && (
                  <span className="text-xs text-warli-sand/50 line-through">₹{basePrice}</span>
                )}
              </div>
            </div>

            {/* Right: mock listing card */}
            <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-5 border border-white/15">
              <p className="text-[11px] font-semibold text-warli-sand/50 mb-3">Your page preview →</p>
              <div className="bg-white rounded-2xl overflow-hidden shadow-2xl">
                <div className="h-24 flex items-center justify-center text-4xl"
                  style={{ background: 'linear-gradient(135deg, #C4663A, #3D1A08)' }}>
                  🏪
                </div>
                <div className="p-4">
                  <div className="font-bold text-chikoo-bark text-sm">Your Business Name</div>
                  <div className="text-[11px] text-warli-terra mt-0.5 font-mono">yourname.ourdahanu.in</div>
                  <div className="flex items-center gap-0.5 mt-2">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} size={10} className="fill-yellow-400 text-yellow-400" />
                    ))}
                    <span className="text-[10px] text-chikoo-brown/55 ml-1">5.0 (12 reviews)</span>
                  </div>
                  <div className="flex gap-2 mt-3">
                    <div className="flex-1 text-center py-1.5 rounded-lg text-[10px] font-bold text-white"
                      style={{ background: '#25D366' }}>
                      💬 WhatsApp
                    </div>
                    <div className="flex-1 text-center py-1.5 rounded-lg text-[10px] font-bold text-white bg-warli-terra">
                      📞 Call Now
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────────
          7. JOBS SECTION
      ───────────────────────────────────────────────────────────────── */}
      <div className="warli-divider" />
      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-chikoo-bark">Jobs in Dahanu</h2>
            <p className="text-sm text-chikoo-brown mt-1">
              Local opportunities for local people.{' '}
              {totalJobs > 0 && (
                <span className="font-semibold text-warli-terra">{totalJobs} open {totalJobs === 1 ? 'role' : 'roles'}</span>
              )}
            </p>
          </div>
          <Link href="/jobs"
            className="inline-flex items-center gap-1 text-sm font-semibold text-warli-terra hover:text-warli-deep transition-colors">
            View all <ArrowRight size={14} />
          </Link>
        </div>

        <div className="grid gap-4 lg:grid-cols-[1fr_260px]">
          <div className="grid gap-3">
            {recentJobs.length > 0 ? (
              recentJobs.map((job) => (
                <Link key={job.id} href={`/jobs/${job.id}`}
                  className="flex items-start gap-4 rounded-2xl border border-warli-sand/50 bg-white p-5 transition-all hover:border-warli-terra hover:shadow-warm">
                  <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl bg-warli-light">
                    <Briefcase size={18} className="text-warli-terra" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-chikoo-brown/70 mb-1.5">
                      <span>{job.category}</span>
                      <span className="rounded-full bg-warli-light px-2 py-0.5 text-warli-terra font-medium">
                        {job.type}
                      </span>
                    </div>
                    <h3 className="font-bold text-chikoo-bark text-sm">{job.title}</h3>
                    <p className="text-xs text-chikoo-brown/65 mt-0.5">{job.company}</p>
                    <div className="flex flex-wrap gap-3 mt-2 text-xs text-chikoo-brown/60">
                      {job.location && (
                        <span className="flex items-center gap-1">
                          <MapPin size={10} className="text-warli-terra" />
                          {job.location}
                        </span>
                      )}
                      {job.salary && (
                        <span className="font-semibold text-warli-terra">₹ {job.salary}</span>
                      )}
                      <span className="flex items-center gap-1">
                        <Clock size={10} className="text-warli-terra" />
                        {job.type}
                      </span>
                    </div>
                  </div>
                </Link>
              ))
            ) : (
              <div className="rounded-2xl border border-warli-sand/60 bg-white p-10 text-center">
                <p className="text-sm text-chikoo-brown">No open jobs yet. Employers can post the first one today.</p>
              </div>
            )}
          </div>

          {/* Post a job CTA card */}
          <div className="rounded-2xl p-6 text-warli-cream"
            style={{ background: 'linear-gradient(145deg, #C4663A 0%, #3D1A08 100%)' }}>
            <p className="text-xs font-bold uppercase tracking-widest text-warli-sand/60">Hiring locally?</p>
            <h3 className="mt-2 text-xl font-bold">Post a job in minutes</h3>
            <p className="mt-2 text-xs text-warli-sand/75 leading-relaxed">
              Reach job seekers around Dahanu without needing your own hiring page.
            </p>
            <div className="mt-5">
              {jobBasePrice > jobCurrentPrice && (
                <div className="text-xs text-warli-sand/40 line-through">₹{jobBasePrice} / posting</div>
              )}
              <div className="text-3xl font-bold text-chikoo-gold">₹{jobCurrentPrice}</div>
            </div>
            <Link href="/jobs/submit"
              className="mt-4 inline-flex items-center gap-2 rounded-2xl bg-chikoo-gold px-5 py-2.5 text-xs font-bold text-chikoo-bark hover:bg-chikoo-amber transition-colors">
              <Plus size={13} />
              Post a Job
            </Link>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────────
          8. ABOUT DAHANU — local identity & pride
      ───────────────────────────────────────────────────────────────── */}
      <div className="warli-divider" />
      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="rounded-[2rem] border border-warli-sand/50 bg-white p-8 md:p-10">
          <p className="text-[11px] font-bold uppercase tracking-widest text-warli-terra">About Dahanu</p>
          <h2 className="mt-2 text-3xl font-bold text-chikoo-bark">A coastal town with strong local identity</h2>
          <p className="mt-3 text-sm text-chikoo-brown leading-relaxed max-w-2xl">
            Dahanu is known for its chikoo orchards, beaches, Warli art, and a deep sense of community.
            OurDahanu is built to help that community discover, support, and recommend local businesses.
          </p>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {[
              { title: '🌳 Chikoo Capital', desc: "Dahanu's sapodilla orchards are part of everyday life and the local economy." },
              { title: '🎨 Warli Heritage', desc: "The region's visual culture gives our platform a distinctive local character." },
              { title: '🤝 Built for Locals', desc: "Designed to help residents find trusted services and support their neighbours." },
            ].map((c) => (
              <div key={c.title} className="rounded-2xl bg-warli-light p-5">
                <div className="font-bold text-warli-terra">{c.title}</div>
                <p className="mt-2 text-sm text-chikoo-brown leading-relaxed">{c.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────────
          9. BOTTOM CTA BANNER — dark, strong close
      ───────────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden"
        style={{ background: 'linear-gradient(135deg, #1C0A02 0%, #3D1A08 60%, #5C2910 100%)' }}>
        <div className="absolute inset-0 warli-pattern opacity-[0.04] pointer-events-none" />
        <div className="relative mx-auto max-w-5xl px-4 py-16 sm:py-20 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-warli-cream leading-tight">
            Dahanu is yours.<br />
            <span style={{ color: '#D4952A' }}>Make it yours online too.</span>
          </h2>
          <p className="mt-4 text-warli-sand/65 text-sm sm:text-base max-w-md mx-auto">
            Join hundreds of local businesses and residents already on OurDahanu.
          </p>
          <div className="flex flex-wrap justify-center gap-3 mt-8">
            <Link href="/listings/submit"
              className="inline-flex items-center gap-2 rounded-2xl bg-chikoo-gold px-7 py-3.5 text-sm font-bold text-chikoo-bark transition-all hover:bg-chikoo-amber hover:scale-[1.03]"
              style={{ boxShadow: '0 4px 20px rgba(212,149,42,0.4)' }}>
              <Store size={15} />
              List Your Business
            </Link>
            <Link href="/listings"
              className="inline-flex items-center gap-2 rounded-2xl border border-white/25 bg-white/10 px-7 py-3.5 text-sm font-semibold text-warli-cream hover:bg-white/20 transition-all backdrop-blur-sm">
              <Search size={15} />
              Explore Dahanu
            </Link>
          </div>
        </div>
      </section>

    </div>
  )
}
