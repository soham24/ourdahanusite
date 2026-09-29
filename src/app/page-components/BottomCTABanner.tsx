import { Store, Search } from 'lucide-react'
import Button from '@/components/ui/Button'
import { siteConfig } from '@/lib/site'

export default function BottomCTABanner() {
  return (
    <section className="od-mobile-section relative overflow-hidden bg-[var(--color-bark)] py-20 text-center">
      <div className="absolute inset-0 warli-pattern opacity-[0.04] pointer-events-none" />
      <div className="relative max-w-[600px] mx-auto px-6">
        <h2
          className="font-display text-[var(--color-cream)] mb-4"
          style={{
            fontSize: 'clamp(32px, 5vw, 50px)',
            lineHeight: 1.1,
            letterSpacing: '-0.02em',
          }}
        >
          {siteConfig.town} is yours.
          <br />
          <em className="italic text-[#F0C87A]">Make it yours online too.</em>
        </h2>
        <p
          className="text-[15px] mb-9"
          style={{ color: 'rgba(232,196,154,0.5)' }}
        >
          Join hundreds of local businesses and residents already on {siteConfig.name}.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <Button href="/listings/submit" size="lg" icon={<Store size={15} />} className="bg-[#C8881E] hover:bg-[#D49A28] text-[var(--color-bark)] font-bold">
            List Your Business
          </Button>
          <Button href="/listings" size="lg" variant="outline" icon={<Search size={15} />} className="bg-white/[0.09] hover:bg-white/[0.15] border-white/20 text-[var(--color-cream)] font-semibold">
            Explore {siteConfig.town}
          </Button>
        </div>
      </div>
    </section>
  )
}
