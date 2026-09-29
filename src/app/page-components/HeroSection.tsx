import Link from 'next/link'
import {
  ArrowRight,
  BedDouble,
  BriefcaseBusiness,
  Camera,
  CarFront,
  HeartPulse,
  MapPin,
  Search,
  Utensils,
} from 'lucide-react'

import { getCategoryPath } from '@/lib/listing-category'
import { siteConfig } from '@/lib/site'

const FIND_URL = 'https://find.ourdahanu.in'

const QUICK_NEEDS = [
  { label: 'Eat & order', href: getCategoryPath('Restaurants'), Icon: Utensils },
  { label: 'Find a doctor', href: getCategoryPath('Healthcare & Clinics'), Icon: HeartPulse },
  { label: 'Book a stay', href: getCategoryPath('Hotels & Stay'), Icon: BedDouble },
  { label: 'Plan an event', href: getCategoryPath('Event Services'), Icon: Camera },
  { label: 'Find professionals', href: FIND_URL, Icon: BriefcaseBusiness },
  { label: 'Book a taxi', href: getCategoryPath('Transport & Taxi'), Icon: CarFront },
]

export default function HeroSection() {
  return (
    <section className="relative overflow-hidden bg-[var(--color-bark)]">
      <div className="absolute inset-0" aria-hidden>
        <div className="absolute inset-0 bg-[linear-gradient(145deg,#1A0A03_0%,#4B1C0C_45%,#8A3618_100%)]" />
        <div className="absolute -right-24 -top-28 h-[360px] w-[360px] rounded-full bg-[radial-gradient(circle,rgba(240,200,122,0.34),transparent_68%)]" />
        <div className="absolute inset-0 hidden opacity-[0.045] warli-pattern sm:block" />
        <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-[#1A0A03]/70 to-transparent" />
      </div>

      <div className="relative mx-auto w-full max-w-[1160px] px-4 pb-8 pt-16 sm:px-6 sm:pb-12 sm:pt-24 md:py-24">
        <div className="max-w-[720px]">
          <div className="mb-4 inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/[0.08] px-3 py-1.5 text-xs font-semibold text-[var(--color-cream)] backdrop-blur-sm">
            <MapPin size={13} aria-hidden />
            {siteConfig.town}, Bordi, Gholvad & nearby
          </div>

          <h1 className="max-w-[650px] font-display text-[38px] leading-[1.02] tracking-[-0.025em] text-white sm:text-[50px] md:text-[62px]">
            Find what you need in <em className="italic text-[var(--color-gold-light)]">{siteConfig.town}.</em>
          </h1>
          <p className="mt-3 max-w-[520px] text-[15px] leading-6 text-[rgba(251,240,220,0.76)] sm:mt-4 sm:text-base">
            Search trusted local businesses, services and professionals in one place.
          </p>

          <form action="/search" method="get" className="mt-6 max-w-[620px] sm:mt-8">
            <label htmlFor="home-search" className="sr-only">Search local businesses</label>
            <div className="flex min-h-14 items-center rounded-2xl border border-white/20 bg-white p-1.5 shadow-[0_20px_50px_rgba(18,7,2,0.34)] focus-within:ring-4 focus-within:ring-[rgba(240,200,122,0.20)]">
              <Search className="ml-2.5 shrink-0 text-[var(--od-brand)]" size={20} aria-hidden />
              <input id="home-search" name="q" type="search" enterKeyHint="search" autoComplete="off" placeholder="Restaurant, doctor, photographer..." className="min-w-0 flex-1 bg-transparent px-3 py-2 text-base text-[var(--od-ink)] outline-none placeholder:text-[var(--od-muted)]" />
              <button type="submit" className="inline-flex h-11 shrink-0 items-center justify-center rounded-xl bg-[var(--od-brand)] px-4 text-sm font-bold text-white transition-transform active:scale-[0.98] sm:px-5">Search</button>
            </div>
          </form>

          <div className="mt-5 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap" aria-label="Popular needs">
            {QUICK_NEEDS.map(({ label, href, Icon }) => (
              <Link key={label} href={href} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/15 bg-white/[0.08] px-3 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-white/[0.15] active:scale-[0.98]">
                <Icon size={15} className="shrink-0 text-[var(--color-gold-light)]" aria-hidden />
                <span className="truncate">{label}</span>
              </Link>
            ))}
          </div>

          <Link href="/listings" className="mt-5 inline-flex min-h-11 items-center gap-1.5 text-sm font-bold text-[var(--color-gold-light)] hover:text-white">
            Explore every category <ArrowRight size={15} aria-hidden />
          </Link>
        </div>
      </div>
    </section>
  )
}
