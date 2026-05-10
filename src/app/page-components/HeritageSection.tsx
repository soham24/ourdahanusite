import { ArrowRight, MessageCircle, UsersRound } from 'lucide-react'

import SafeAppLink from '@/components/SafeAppLink'

const people = [
  ['SR', 180, 150],
  ['AT', 390, 78],
  ['KK', 610, 142],
  ['AB', 820, 208],
  ['NM', 1030, 118],
  ['KB', 1210, 72],
] as const

export default function HeritageSection() {
  return (
    <section className="py-12 md:py-16">
      <div className="max-w-[1160px] mx-auto px-5 md:px-6">
        <SafeAppLink
          href="/about"
          className="group relative block overflow-hidden rounded-3xl aspect-[4/5] sm:aspect-[16/9] md:aspect-[21/9]"
        >
          <div className="absolute inset-0">
            <div
              className="absolute inset-0"
              style={{
                background:
                  'linear-gradient(135deg, #1A0A03 0%, #2E1205 34%, #6F2D14 68%, #C0582E 100%)',
              }}
            />
            <div
              className="absolute h-[420px] w-[420px] rounded-full pointer-events-none"
              style={{
                top: '-18%',
                right: '-6%',
                background:
                  'radial-gradient(circle, rgba(240,200,122,0.5) 0%, rgba(232,168,85,0.2) 40%, transparent 75%)',
              }}
            />
            <div className="absolute inset-0 warli-pattern opacity-[0.10] pointer-events-none" />

            <svg
              className="absolute inset-y-0 right-0 hidden h-full w-[55%] pointer-events-none opacity-80 md:block"
              viewBox="0 0 1440 280"
              preserveAspectRatio="none"
              aria-hidden
            >
              <path
                d="M160,140 C300,40 470,38 620,132 C760,220 940,214 1100,90"
                fill="none"
                stroke="rgba(240,200,122,0.26)"
                strokeWidth="3"
                strokeDasharray="10 14"
              />
              <path
                d="M260,210 C430,120 560,112 720,190 C870,264 1020,212 1180,130"
                fill="none"
                stroke="rgba(255,255,255,0.16)"
                strokeWidth="2"
                strokeDasharray="8 14"
              />
              {people.map(([label, cx, cy]) => (
                <g key={label}>
                  <circle
                    cx={cx}
                    cy={cy}
                    r="46"
                    fill="rgba(15,4,0,0.68)"
                    stroke="rgba(240,200,122,0.35)"
                    strokeWidth="2"
                  />
                  <text
                    x={cx}
                    y={cy + 8}
                    textAnchor="middle"
                    fill="#F0C87A"
                    fontSize="24"
                    fontWeight="700"
                  >
                    {label}
                  </text>
                </g>
              ))}
              <g transform="translate(1015 186)">
                <rect x="0" y="0" width="190" height="54" rx="18" fill="rgba(255,255,255,0.12)" />
                <text x="24" y="34" fill="#F8E9D5" fontSize="18" fontWeight="700">
                  WhatsApp groups
                </text>
              </g>
            </svg>

            <div className="absolute inset-0 bg-gradient-to-t from-[#1A0A03] via-[var(--color-bark)]/60 to-transparent" />
          </div>

          <div className="relative z-10 flex h-full flex-col justify-end p-5 md:p-10 lg:p-12">
            <div className="max-w-[600px]">
              <span className="inline-block font-label-sm text-[11px] font-semibold uppercase tracking-[0.18em] text-[#F0C87A] mb-3">
                Who runs OurDahanu
              </span>
              <h2
                className="font-display text-white leading-[1.05] tracking-normal mb-4"
                style={{ fontSize: 'clamp(28px, 4.2vw, 44px)' }}
              >
                A local core team carrying the <em className="italic text-[#F0C87A]">community forward.</em>
              </h2>
              <p className="text-[var(--color-cream)]/85 text-sm md:text-[15px] leading-[1.65] mb-5 max-w-[500px]">
                Founded by Soham Railkar and managed with Ankit, Khushboo, Ajay, Nupur and
                Khushbu Bari, OurDahanu connects social pages, WhatsApp groups and the
                marketplace into one trusted local network.
              </p>
              <div className="mb-6 flex flex-wrap gap-2">
                {[
                  { icon: UsersRound, label: 'Core group' },
                  { icon: MessageCircle, label: 'WhatsApp communities' },
                ].map(({ icon: Icon, label }) => (
                  <span
                    key={label}
                    className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-semibold text-[#F8E9D5]"
                  >
                    <Icon size={13} />
                    {label}
                  </span>
                ))}
              </div>
              <span className="inline-flex items-center gap-2 bg-white text-[var(--color-bark)] font-semibold text-sm px-5 py-2.5 rounded-full transition-all group-hover:gap-3 group-hover:bg-[#F0C87A] shadow-lg">
                Meet the team
                <ArrowRight size={14} />
              </span>
            </div>
          </div>
        </SafeAppLink>
      </div>
    </section>
  )
}
