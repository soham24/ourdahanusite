import Link from 'next/link'
import { Suspense } from 'react'
import {
  ArrowRight,
  BedDouble,
  BriefcaseBusiness,
  CarFront,
  HeartPulse,
  MapPin,
  Search,
  Utensils,
} from 'lucide-react'

import SafeAppLink from '@/components/SafeAppLink'
import { getHomeHeroData, type HomeHeroPhoto } from '@/lib/data/home'
import { getCategoryPath } from '@/lib/listing-category'
import { getListingHref } from '@/lib/listing-url'
import { siteConfig } from '@/lib/site'

const FIND_URL = `https://find.${siteConfig.domain}`

// Five, so they sit in one scrolling row instead of wrapping into an orphan.
const QUICK_NEEDS = [
  { label: 'Eat & order', href: getCategoryPath('Restaurants'), Icon: Utensils },
  { label: 'Doctors', href: getCategoryPath('Healthcare & Clinics'), Icon: HeartPulse },
  { label: 'Stays', href: getCategoryPath('Hotels & Stay'), Icon: BedDouble },
  { label: 'Taxis', href: getCategoryPath('Transport & Taxi'), Icon: CarFront },
  { label: 'Professionals', href: FIND_URL, Icon: BriefcaseBusiness },
]

/** Grid placement for the five collage tiles: one hero image, four around it. */
const TILE_AREAS = [
  'col-span-4 row-span-4',
  'col-start-5 col-span-2 row-span-3',
  'col-start-5 col-span-2 row-start-4 row-span-3',
  'col-span-2 row-start-5 row-span-2',
  'col-start-3 col-span-2 row-start-5 row-span-2',
]

function PhotoTile({ photo, className, priority }: { photo: HomeHeroPhoto; className: string; priority?: boolean }) {
  return (
    <SafeAppLink
      href={getListingHref(photo.id, photo.subdomain)}
      className={`group relative block overflow-hidden rounded-2xl bg-white/[0.06] ring-1 ring-white/10 ${className}`}
    >
      <img
        src={photo.imageUrl}
        alt={`${photo.name}, ${photo.category}`}
        loading={priority ? 'eager' : 'lazy'}
        decoding="async"
        className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.04]"
      />
      <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 via-black/25 to-transparent px-3 pb-2.5 pt-8">
        <span className="block truncate text-[13px] font-semibold leading-tight text-white">{photo.name}</span>
        <span className="block truncate text-[11px] text-white/70">{photo.category}</span>
      </span>
    </SafeAppLink>
  )
}

async function HeroCollage() {
  const { photos } = await getHomeHeroData()
  if (photos.length < 3) return <CollageFallback />

  return (
    <>
      {/* Desktop: a bento of real businesses, the page's first proof that this is Dahanu. */}
      <div className="hidden aspect-square w-full grid-cols-6 grid-rows-6 gap-2.5 lg:grid" aria-label={`Businesses on ${siteConfig.name}`}>
        {photos.slice(0, TILE_AREAS.length).map((photo, i) => (
          <PhotoTile key={photo.id} photo={photo} className={TILE_AREAS[i]} priority={i === 0} />
        ))}
      </div>
      {/* Phone: the same photos as a swipeable strip under the search. */}
      <div className="-mx-4 flex snap-x gap-2.5 overflow-x-auto px-4 pb-1 [scrollbar-width:none] lg:hidden [&::-webkit-scrollbar]:hidden">
        {photos.map((photo) => (
          <PhotoTile key={photo.id} photo={photo} className="h-28 w-40 shrink-0 snap-start" />
        ))}
      </div>
    </>
  )
}

function CollageFallback() {
  return (
    <>
      <div className="hidden aspect-square w-full grid-cols-6 grid-rows-6 gap-2.5 lg:grid" aria-hidden>
        {TILE_AREAS.map((area) => (
          <div key={area} className={`rounded-2xl bg-white/[0.05] ring-1 ring-white/[0.06] ${area}`} />
        ))}
      </div>
      <div className="flex gap-2.5 lg:hidden" aria-hidden>
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-28 w-40 shrink-0 rounded-2xl bg-white/[0.05]" />
        ))}
      </div>
    </>
  )
}

const number = (n: number) => n.toLocaleString('en-IN')

async function HeroProof() {
  const { counts } = await getHomeHeroData()
  const facts = [
    counts.businesses && `${number(counts.businesses)} businesses`,
    counts.reviews && `${number(counts.reviews)} reviews`,
    counts.items && `${number(counts.items)} products & services`,
    counts.professionals && `${number(counts.professionals)} professionals`,
  ].filter(Boolean) as string[]
  if (facts.length === 0) return null

  return (
    <p className="mt-6 grid grid-cols-2 gap-x-3 gap-y-1 text-[13px] text-[rgba(251,240,220,0.62)] sm:flex sm:flex-wrap sm:items-center">
      {facts.map((fact, i) => (
        <span key={fact} className="inline-flex items-center gap-3">
          {i > 0 && <span className="hidden h-1 w-1 rounded-full bg-[var(--color-gold-light)]/50 sm:block" aria-hidden />}
          <span className="tabular-nums">{fact}</span>
        </span>
      ))}
    </p>
  )
}

export default function HeroSection() {
  return (
    <section className="relative overflow-hidden bg-[var(--color-bark)]">
      <div className="absolute inset-0" aria-hidden>
        <div className="absolute inset-0 bg-[linear-gradient(150deg,#1A0A03_0%,#3E170A_50%,#6E2B13_100%)]" />
        <div className="absolute -left-40 top-1/3 h-[520px] w-[520px] rounded-full bg-[radial-gradient(circle,rgba(192,88,46,0.28),transparent_65%)]" />
        <div className="absolute inset-0 hidden opacity-[0.04] warli-pattern sm:block" />
      </div>

      <div className="relative mx-auto grid w-full max-w-[1200px] gap-8 px-4 pb-10 pt-12 sm:px-6 sm:pt-16 lg:grid-cols-[minmax(0,1fr)_minmax(0,500px)] lg:items-center lg:gap-14 lg:py-20">
        <div className="min-w-0">
          <div className="mb-5 inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/[0.07] px-3 py-1.5 text-xs font-medium text-[var(--color-cream)]">
            <MapPin size={13} aria-hidden />
            {siteConfig.areas}
          </div>

          <h1 className="max-w-[620px] text-balance font-display text-[40px] leading-[1.0] tracking-[-0.03em] text-white sm:text-[54px] lg:text-[64px]">
            Find what you need in <em className="italic text-[var(--color-gold-light)]">{siteConfig.town}.</em>
          </h1>
          <p className="mt-4 max-w-[480px] text-pretty text-[15px] leading-relaxed text-[rgba(251,240,220,0.74)] sm:text-[17px]">
            Local shops, services and the people who run them, with reviews from your neighbours.
          </p>

          <form action="/search" method="get" className="mt-7 max-w-[560px]">
            <label htmlFor="home-search" className="sr-only">Search local businesses</label>
            <div className="flex min-h-[60px] items-center rounded-2xl bg-white p-1.5 shadow-[0_24px_60px_-12px_rgba(18,7,2,0.55)] ring-1 ring-white/30 transition-shadow focus-within:ring-4 focus-within:ring-[rgba(240,200,122,0.35)]">
              <Search className="ml-3 shrink-0 text-[var(--od-brand)]" size={20} aria-hidden />
              <input
                id="home-search"
                name="q"
                type="search"
                enterKeyHint="search"
                autoComplete="off"
                placeholder="Cake, plumber, taxi, a shop name…"
                className="min-w-0 flex-1 bg-transparent px-3 py-2 text-base text-[var(--od-ink)] outline-none placeholder:text-[var(--od-muted)]"
              />
              <button
                type="submit"
                className="inline-flex h-12 shrink-0 items-center justify-center rounded-xl bg-[var(--od-brand)] px-5 text-sm font-semibold text-white transition-[background-color,transform] hover:bg-[var(--od-brand-strong)] active:scale-[0.98]"
              >
                Search
              </button>
            </div>
          </form>

          <nav
            aria-label="Popular needs"
            className="-mx-4 mt-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:px-0 [&::-webkit-scrollbar]:hidden"
          >
            {QUICK_NEEDS.map(({ label, href, Icon }) => (
              <Link
                key={label}
                href={href}
                className="inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-full border border-white/15 bg-white/[0.06] px-3.5 text-[13px] font-medium text-white transition-[background-color,transform] hover:bg-white/[0.14] active:scale-[0.97]"
              >
                <Icon size={14} className="shrink-0 text-[var(--color-gold-light)]" aria-hidden />
                {label}
              </Link>
            ))}
            <Link
              href="/listings"
              // The category grid sits right below on wide screens; on phones this
              // is the end of a swipeable row.
              className="inline-flex min-h-10 shrink-0 items-center gap-1 px-2 text-[13px] font-semibold text-[var(--color-gold-light)] transition-colors hover:text-white lg:hidden"
            >
              Every category <ArrowRight size={14} aria-hidden />
            </Link>
          </nav>

          <Suspense fallback={<p className="mt-6 h-5" aria-hidden />}>
            <HeroProof />
          </Suspense>
        </div>

        <div className="min-w-0">
          <Suspense fallback={<CollageFallback />}>
            <HeroCollage />
          </Suspense>
        </div>
      </div>
    </section>
  )
}
