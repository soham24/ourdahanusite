import { ArrowRight } from 'lucide-react'
import SafeAppLink from '@/components/SafeAppLink'

export default function HeritageSection() {
  return (
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
                  'linear-gradient(135deg, #1A0A03 0%, #3D1808 30%, var(--color-brand-strong) 55%, var(--color-brand) 75%, #E8A855 95%)',
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
            <div className="absolute inset-0 bg-gradient-to-t from-[#1A0A03] via-[var(--color-bark)]/60 to-transparent" />
          </div>

          {/* Content */}
          <div className="relative z-10 flex h-full flex-col justify-end p-5 md:p-10 lg:p-12">
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
              <p className="text-[var(--color-cream)]/85 text-sm md:text-[15px] leading-[1.65] mb-6 max-w-[460px]">
                Preserving a thousand-year-old connection to the Arabian Sea through art, ritual,
                and community memory. Discover the people who keep Dahanu's coastal soul alive.
              </p>
              <span className="inline-flex items-center gap-2 bg-white text-[var(--color-bark)] font-semibold text-sm px-5 py-2.5 rounded-full transition-all group-hover:gap-3 group-hover:bg-[#F0C87A] shadow-lg">
                Read the Story
                <ArrowRight size={14} />
              </span>
            </div>
          </div>
        </SafeAppLink>
      </div>
    </section>
  )
}
