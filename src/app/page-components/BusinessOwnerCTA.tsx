import { Check, MessageCircle, Phone, Plus, Star, Store } from 'lucide-react'
import Button from '@/components/ui/Button'
import { siteConfig } from '@/lib/site'

interface BusinessOwnerCTAProps {
  currentPrice: number
  basePrice: number
}

export default function BusinessOwnerCTA({ currentPrice, basePrice }: BusinessOwnerCTAProps) {
  return (
    <section className="od-mobile-section py-10 md:py-12">
      <div className="max-w-[1160px] mx-auto px-4 md:px-6">
        <div className="relative overflow-hidden rounded-3xl bg-[var(--color-bark)] md:rounded-[32px]">
          <div className="absolute inset-0 warli-pattern opacity-[0.04] pointer-events-none" />

          <div className="relative grid grid-cols-1 items-center gap-8 p-6 md:grid-cols-[1fr_320px] md:gap-12 md:p-14">
            {/* Left copy */}
            <div>
              <p
                className="text-[11px] font-bold uppercase tracking-[0.12em] mb-4"
                style={{ color: 'rgba(240,200,122,0.7)' }}
              >
                For Business Owners
              </p>
              <h2
                className="font-display text-[var(--color-cream)] mb-[18px]"
                style={{
                  fontSize: 'clamp(28px, 4.5vw, 40px)',
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
                  yourname.{siteConfig.domain}
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

              <Button href="/listings/submit" size="lg" icon={<Plus size={15} />} className="bg-[#C8881E] hover:bg-[#D49A28] text-[var(--color-bark)] font-bold">
                Claim Your Profile
              </Button>
            </div>

            {/* Right mock card */}
            <div className="hidden md:block bg-white rounded-3xl overflow-hidden shadow-cta">
              <div
                className="h-[100px] flex items-center justify-center text-4xl"
                style={{ background: 'linear-gradient(135deg, var(--color-brand), var(--color-bark))' }}
                aria-hidden
              >
                <Store size={38} className="text-white/75" aria-hidden />
              </div>
              <div className="p-4">
                <div className="font-bold text-sm text-[var(--color-bark)]">Your Business Name</div>
                <div className="font-mono text-[11px] text-[var(--color-brand)] mt-0.5">
                  yourname.{siteConfig.domain}
                </div>
                <div className="flex items-center gap-0.5 mt-2">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} size={11} className="fill-amber-400 text-amber-400" />
                  ))}
                  <span className="text-[11px] text-[var(--color-text-muted)] ml-1">5.0 (12)</span>
                </div>
                <div className="flex gap-2 mt-3">
                  <div className="flex flex-1 items-center justify-center gap-1 py-2 rounded-lg text-[11px] font-bold text-white bg-[#138A4B]">
                    <MessageCircle size={11} aria-hidden /> WhatsApp
                  </div>
                  <div className="flex flex-1 items-center justify-center gap-1 py-2 rounded-lg text-[11px] font-bold text-white bg-[var(--color-brand)]">
                    <Phone size={11} aria-hidden /> Call
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
