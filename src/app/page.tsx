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

import { getHomePageData } from '@/lib/data/home'
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

function formatStat(value: number, fallback: string): string {
  if (!value) return fallback
  if (value >= 1000) return `${Math.round(value / 100) / 10}k+`
  return String(value)
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

  const stats = [
    { value: formatStat(totalListings, '50+'), label: 'Live listings' },
    { value: String(topCategoryLabels.length || 8), label: 'Top categories' },
    { value: formatStat(totalJobs, '1'), label: 'Open jobs' },
  ]

  return (
    <div className="min-h-screen bg-[#FDFAF6]">
      <section className="relative overflow-hidden bg-gradient-to-br from-chikoo-bark via-chikoo-brown to-warli-terra text-warli-cream">
        <div className="absolute inset-0 opacity-[0.06] pointer-events-none">
          <div className="absolute inset-0 warli-pattern" />
        </div>
        <div className="relative mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8 lg:py-20">
          <div className="grid gap-10 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-warli-cream/20 bg-warli-cream/10 px-4 py-1.5 text-xs font-semibold">
                <MapPin size={12} />
                Dahanu, Bordi, Gholvad and nearby Palghar
              </div>
              <h1 className="mt-5 max-w-3xl text-4xl font-bold leading-tight md:text-6xl">
                Find trusted local businesses in Dahanu
              </h1>
              <p className="mt-4 max-w-2xl text-base leading-relaxed text-warli-sand/90 md:text-lg">
                Search restaurants, clinics, home bakers, repair services, educators, and more.
                OurDahanu helps locals discover businesses fast, and helps business owners get found.
              </p>

              <form method="get" action="/search" className="relative mt-6 max-w-xl">
                <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-warli-sand/60" />
                <input
                  type="text"
                  name="q"
                  placeholder="Search businesses, services, categories..."
                  className="w-full rounded-2xl border border-warli-cream/25 bg-white/10 py-3.5 pl-11 pr-32 text-sm text-warli-cream placeholder-warli-sand/60 focus:bg-white/15 focus:outline-none"
                />
                <button
                  type="submit"
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-xl bg-chikoo-gold px-4 py-2 text-sm font-bold text-chikoo-bark transition-colors hover:bg-chikoo-amber"
                >
                  Search
                </button>
              </form>

              <div className="mt-6 flex flex-wrap gap-3">
                <Link
                  href="/listings"
                  className="inline-flex items-center gap-2 rounded-2xl bg-chikoo-gold px-5 py-3 text-sm font-bold text-chikoo-bark transition-all hover:scale-[1.02] hover:bg-chikoo-amber"
                >
                  <Store size={16} />
                  Browse Listings
                </Link>
                <Link
                  href="/listings/submit"
                  className="inline-flex items-center gap-2 rounded-2xl border border-warli-cream/30 bg-warli-cream/10 px-5 py-3 text-sm font-semibold text-warli-cream transition-colors hover:bg-warli-cream/20"
                >
                  <Plus size={16} />
                  List Your Business
                </Link>
              </div>
            </div>

            <div className="rounded-[2rem] border border-warli-cream/20 bg-warli-cream/10 p-6 backdrop-blur-sm">
              <p className="text-sm font-semibold text-chikoo-gold">Why people use OurDahanu</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
                {stats.map((stat) => (
                  <div key={stat.label} className="rounded-2xl border border-warli-cream/15 bg-black/10 px-4 py-4">
                    <div className="text-2xl font-bold text-warli-cream">{stat.value}</div>
                    <div className="mt-1 text-sm text-warli-sand/80">{stat.label}</div>
                  </div>
                ))}
              </div>
              <div className="mt-5 rounded-2xl bg-warli-cream/10 p-4">
                <p className="text-sm font-semibold text-warli-cream">Best for local discovery</p>
                <ul className="mt-3 space-y-2 text-sm text-warli-sand/85">
                  <li className="flex items-center gap-2">
                    <CheckCircle size={14} className="text-chikoo-gold" />
                    Direct business pages with custom <span className="font-mono text-xs">businessname.ourdahanu.in</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle size={14} className="text-chikoo-gold" />
                    Phone, WhatsApp, reviews, and directions in one place
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle size={14} className="text-chikoo-gold" />
                    Local jobs and business discovery on the same platform
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-chikoo-bark">Top Categories</h2>
            <p className="mt-1 text-sm text-chikoo-brown">Start with the most searched business categories in Dahanu.</p>
          </div>
          <Link
            href="/listings"
            className="hidden items-center gap-1 text-sm font-semibold text-warli-terra transition-colors hover:text-warli-deep sm:inline-flex"
          >
            View all categories
            <ArrowRight size={14} />
          </Link>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
          {topCategories.map((category) => (
            <Link
              key={category.label}
              href={getCategoryPath(category.label)}
              className="rounded-2xl border border-warli-sand/60 bg-white px-4 py-4 text-left transition-all hover:-translate-y-0.5 hover:border-warli-terra hover:bg-warli-light"
            >
              <div className="text-2xl">{category.emoji}</div>
              <div className="mt-3 text-sm font-semibold text-chikoo-bark">{category.label}</div>
              <div className="mt-1 text-xs text-chikoo-brown/70">
                {category.count} live {category.count === 1 ? 'business' : 'businesses'}
              </div>
            </Link>
          ))}
        </div>

        <div className="mt-4 sm:hidden">
          <Link
            href="/listings"
            className="inline-flex items-center gap-1 text-sm font-semibold text-warli-terra transition-colors hover:text-warli-deep"
          >
            View all categories
            <ArrowRight size={14} />
          </Link>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-14 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-chikoo-bark">Popular Around Dahanu</h2>
            <p className="mt-1 text-sm text-chikoo-brown">Featured and highly reviewed local businesses.</p>
          </div>
          <Link
            href="/listings"
            className="inline-flex items-center gap-1 text-sm font-semibold text-warli-terra transition-colors hover:text-warli-deep"
          >
            View all
            <ArrowRight size={14} />
          </Link>
        </div>

        {listings.length > 0 ? (
          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {listings.map((listing) => {
              const href = getListingHref(listing.id, listing.subdomain)
              const address = summarizeAddress(listing.address, 2)

              return (
                <Link
                  key={listing.id}
                  href={href}
                  className="listing-card group overflow-hidden rounded-[1.75rem] border border-warli-sand/50 bg-white"
                >
                  <div className="relative h-48 bg-gradient-to-br from-warli-light to-warli-sand/40">
                    {listing.image_url ? (
                      <Image
                        src={listing.image_url}
                        alt={listing.name}
                        fill
                        className="object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-5xl opacity-30">🏪</div>
                    )}
                    <div className="absolute bottom-3 left-3">
                      <span className="rounded-full bg-black/55 px-2.5 py-1 text-[11px] font-semibold text-warli-cream backdrop-blur-sm">
                        {listing.category}
                      </span>
                    </div>
                    {listing.verified ? (
                      <div className="absolute right-3 top-3 rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-semibold text-blue-700">
                        Verified
                      </div>
                    ) : null}
                  </div>
                  <div className="p-5">
                    <h3 className="text-lg font-bold text-chikoo-bark transition-colors hover:text-warli-terra">
                      {listing.name}
                    </h3>
                    {listing.tagline ? (
                      <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-chikoo-brown/75">
                        {listing.tagline}
                      </p>
                    ) : null}
                    <div className="mt-4 flex items-center justify-between gap-3 text-sm">
                      <div className="flex items-center gap-1.5">
                        {listing.rating && listing.rating > 0 ? (
                          <>
                            <Star size={14} className="fill-yellow-400 text-yellow-400" />
                            <span className="font-semibold text-chikoo-bark">{listing.rating.toFixed(1)}</span>
                            <span className="text-chikoo-brown/55">({listing.review_count ?? 0})</span>
                          </>
                        ) : (
                          <span className="text-chikoo-brown/55">New listing</span>
                        )}
                      </div>
                      {address ? (
                        <div className="flex items-center gap-1 text-xs text-chikoo-brown/65">
                          <MapPin size={11} className="text-warli-terra" />
                          <span className="truncate">{address}</span>
                        </div>
                      ) : null}
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        ) : (
          <div className="mt-6 rounded-[1.75rem] border border-warli-sand/60 bg-white p-10 text-center">
            <div className="text-4xl">🏪</div>
            <p className="mt-3 text-sm text-chikoo-brown">No listings are live yet. Be the first business on OurDahanu.</p>
            <Link
              href="/listings/submit"
              className="mt-5 inline-flex items-center gap-2 rounded-xl bg-warli-terra px-5 py-3 text-sm font-semibold text-warli-cream transition-colors hover:bg-warli-deep"
            >
              <Plus size={15} />
              List Your Business
            </Link>
          </div>
        )}
      </section>

      <div className="warli-divider" />

      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-warli-terra">For business owners</p>
            <h2 className="mt-2 text-3xl font-bold text-chikoo-bark">Claim a profile that locals can remember</h2>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-chikoo-brown">
              From home bakers to consultants and repair shops, every Dahanu business can get its own
              shareable profile on OurDahanu with contact info, reviews, photos, and WhatsApp enquiry.
            </p>
            <ul className="mt-5 space-y-2 text-sm text-chikoo-brown">
              <li className="flex items-center gap-2">
                <CheckCircle size={15} className="text-warli-terra" />
                Your own custom subdomain like <span className="font-mono text-xs">yourname.ourdahanu.in</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle size={15} className="text-warli-terra" />
                Phone, WhatsApp, address, website, photos, and customer reviews
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle size={15} className="text-warli-terra" />
                Reviewed by the OurDahanu team before going live
              </li>
            </ul>
          </div>

          <div className="rounded-[2rem] border-2 border-warli-terra bg-gradient-to-br from-warli-light to-warli-sand/30 p-8 text-center">
            <div className="text-xs font-bold uppercase tracking-[0.18em] text-warli-terra">Launch Offer</div>
            <div className="mt-4 flex items-end justify-center gap-2">
              <span className="text-5xl font-bold text-chikoo-bark">₹{currentPrice}</span>
              <span className="pb-1 text-sm text-chikoo-brown/70">/ year</span>
            </div>
            <div className="mt-1 text-sm text-gray-400 line-through">₹{basePrice} / year</div>
            <Link
              href="/listings/submit"
              className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-warli-terra px-6 py-3 text-sm font-bold text-warli-cream transition-colors hover:bg-warli-deep"
            >
              Claim Your Profile
            </Link>
          </div>
        </div>
      </section>

      <div className="warli-divider" />

      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-chikoo-bark">Jobs in Dahanu</h2>
            <p className="mt-1 text-sm text-chikoo-brown">Local opportunities for local people.</p>
          </div>
          <Link
            href="/jobs"
            className="inline-flex items-center gap-1 text-sm font-semibold text-warli-terra transition-colors hover:text-warli-deep"
          >
            View all
            <ArrowRight size={14} />
          </Link>
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-[1fr_280px]">
          <div className="grid gap-4">
            {recentJobs.length > 0 ? (
              recentJobs.map((job) => (
                <Link
                  key={job.id}
                  href={`/jobs/${job.id}`}
                  className="rounded-[1.5rem] border border-warli-sand/50 bg-white p-5 transition-all hover:border-warli-terra hover:shadow-sm"
                >
                  <div className="flex items-start gap-4">
                    <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-warli-light">
                      <Briefcase size={20} className="text-warli-terra" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-chikoo-brown/75">
                        <span>{job.category}</span>
                        <span className="rounded-full bg-warli-light px-2 py-0.5 text-warli-terra">{job.type}</span>
                      </div>
                      <h3 className="mt-2 text-lg font-bold text-chikoo-bark">{job.title}</h3>
                      <p className="mt-1 text-sm text-chikoo-brown">{job.company}</p>
                      <div className="mt-3 flex flex-wrap items-center gap-4 text-sm text-chikoo-brown/75">
                        {job.location ? (
                          <span className="flex items-center gap-1">
                            <MapPin size={13} className="text-warli-terra" />
                            {job.location}
                          </span>
                        ) : null}
                        {job.salary ? <span className="font-medium text-warli-terra">₹ {job.salary}</span> : null}
                        <span className="flex items-center gap-1">
                          <Clock size={13} className="text-warli-terra" />
                          {job.type}
                        </span>
                      </div>
                    </div>
                  </div>
                </Link>
              ))
            ) : (
              <div className="rounded-[1.5rem] border border-warli-sand/60 bg-white p-10 text-center">
                <p className="text-sm text-chikoo-brown">No open jobs yet. Employers can post the first one today.</p>
              </div>
            )}
          </div>

          <div className="rounded-[1.75rem] bg-gradient-to-br from-warli-terra to-chikoo-bark p-6 text-warli-cream">
            <p className="text-sm font-semibold text-warli-sand">Hiring locally?</p>
            <h3 className="mt-2 text-2xl font-bold">Post a job in minutes</h3>
            <p className="mt-3 text-sm leading-relaxed text-warli-sand/85">
              Reach job seekers around Dahanu without building your own hiring page.
            </p>
            <div className="mt-5 text-xs text-warli-sand/60 line-through">₹{jobBasePrice} / posting</div>
            <div className="text-3xl font-bold text-chikoo-gold">₹{jobCurrentPrice}</div>
            <div className="mt-5">
              <Link
                href="/jobs/submit"
                className="inline-flex items-center gap-2 rounded-2xl bg-chikoo-gold px-5 py-3 text-sm font-bold text-chikoo-bark transition-colors hover:bg-chikoo-amber"
              >
                <Plus size={15} />
                Post a Job
              </Link>
            </div>
          </div>
        </div>
      </section>

      <div className="warli-divider" />

      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="rounded-[2rem] border border-warli-sand/60 bg-white p-8 md:p-10">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-warli-terra">About Dahanu</p>
            <h2 className="mt-2 text-3xl font-bold text-chikoo-bark">A coastal town with strong local identity</h2>
            <p className="mt-3 text-sm leading-relaxed text-chikoo-brown">
              Dahanu is known for chikoo orchards, beaches, Warli art, and a strong sense of local community.
              OurDahanu is built to help that community discover, support, and recommend local businesses.
            </p>
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl bg-warli-light p-5">
              <div className="text-lg font-bold text-warli-terra">Chikoo Capital</div>
              <p className="mt-2 text-sm text-chikoo-brown">Dahanu’s orchards are part of everyday local identity and economy.</p>
            </div>
            <div className="rounded-2xl bg-warli-light p-5">
              <div className="text-lg font-bold text-warli-terra">Warli Heritage</div>
              <p className="mt-2 text-sm text-chikoo-brown">The region’s visual culture gives the platform a distinctive local character.</p>
            </div>
            <div className="rounded-2xl bg-warli-light p-5">
              <div className="text-lg font-bold text-warli-terra">Built for locals</div>
              <p className="mt-2 text-sm text-chikoo-brown">Designed to help Dahanu residents find trusted services and support local businesses.</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
