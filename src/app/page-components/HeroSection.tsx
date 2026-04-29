import { Search, MapPin, Store, Plus } from 'lucide-react'
import Button from '@/components/ui/Button'

export default function HeroSection() {
  return (
    <section className="relative flex min-h-[560px] flex-col justify-end overflow-hidden md:min-h-[680px]">
      {/* Layered coastal backdrop — sunset gradient + scene */}
      <div className="absolute inset-0 z-0">
        {/* Base sunset gradient — sky to sea to bark */}
        <div
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(180deg, #1A0A03 0%, var(--color-bark) 28%, #6E2D11 52%, var(--color-terra) 72%, var(--color-sand) 86%, var(--color-gold-light) 100%)',
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
        <div className="absolute inset-0 bg-gradient-to-t from-[#1A0A03] via-[rgba(46,18,5,0.4)] to-transparent" />
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
            Discover the coastal soul of <em className="italic text-[var(--color-gold-light)]">Dahanu.</em>
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
              <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-[var(--od-muted)]">
                <Search size={18} />
              </div>
              <input
                type="text"
                name="q"
                placeholder="Explore dining, stays, services, secrets…"
                className="w-full h-14 pl-12 pr-32 bg-white/95 backdrop-blur-sm border-none rounded-2xl text-[15px] text-[var(--od-ink)] placeholder-[var(--od-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-gold-light)] shadow-search transition-all"
              />
              <button
                type="submit"
                className="absolute right-[6px] top-[6px] bottom-[6px] px-5 bg-[var(--od-brand)] hover:bg-[var(--od-brand-strong)] text-white font-semibold text-sm rounded-xl transition-all"
              >
                Search
              </button>
            </div>
          </form>

          {/* CTA buttons */}
          <div className="flex flex-wrap gap-3">
            <Button href="/listings" size="lg" icon={<Store size={15} />} className="bg-[var(--od-gold)] text-[var(--od-ink)] hover:bg-[var(--color-gold-light)]">
              Explore Businesses
            </Button>
            <Button href="/listings/submit" variant="outline" size="lg" icon={<Plus size={15} />} className="bg-white/[0.12] border-white/25 text-white hover:bg-white/[0.20]">
              List Your Business
            </Button>
          </div>
        </div>
      </div>
    </section>
  )
}
