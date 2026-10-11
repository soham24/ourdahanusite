import Link from 'next/link'
import {
  ArrowUpRight,
  BadgeCheck,
  BriefcaseBusiness,
  Camera,
  Hammer,
  Palette,
  UserSearch,
} from 'lucide-react'
import { siteConfig } from '@/lib/site'

const FIND_URL = `https://find.${siteConfig.domain}`

const PROFESSIONS = [
  { label: 'Photographers', Icon: Camera },
  { label: 'Electricians', Icon: Hammer },
  { label: 'Designers', Icon: Palette },
]

export default function FindProfessionalsSection() {
  return (
    <section className="od-mobile-section bg-[var(--color-bg)] pb-10 md:pb-16">
      <div className="mx-auto max-w-[1160px] px-4 sm:px-6">
        <div className="relative overflow-hidden rounded-3xl border border-[rgba(192,88,46,0.18)] bg-[var(--color-bark)] p-5 text-white shadow-[0_18px_50px_rgba(46,18,5,0.12)] sm:p-8 md:grid md:grid-cols-[1fr_auto] md:items-center md:gap-8 md:p-10">
          <div className="pointer-events-none absolute -right-16 -top-20 h-60 w-60 rounded-full bg-[radial-gradient(circle,rgba(240,200,122,0.24),transparent_70%)]" aria-hidden />
          <div className="relative">
            <div className="mb-3 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--color-gold-light)]">
              <UserSearch size={15} aria-hidden />
              Find {siteConfig.name}
            </div>
            <h2 className="max-w-[620px] font-display text-[28px] leading-[1.08] tracking-[-0.015em] sm:text-[34px]">
              Looking for a skilled local professional?
            </h2>
            <p className="mt-3 max-w-[600px] text-sm leading-6 text-[rgba(251,240,220,0.72)] sm:text-[15px]">
              Discover local people by profession, view their work and contact the right person directly.
            </p>

            <div className="mt-4 flex flex-wrap gap-2">
              {PROFESSIONS.map(({ label, Icon }) => (
                <span key={label} className="inline-flex items-center gap-1.5 rounded-full border border-white/12 bg-white/[0.08] px-3 py-1.5 text-xs font-semibold text-[var(--color-cream)]">
                  <Icon size={13} className="text-[var(--color-gold-light)]" aria-hidden />
                  {label}
                </span>
              ))}
            </div>
          </div>

          <div className="relative mt-6 md:mt-0 md:min-w-[240px]">
            <Link
              href={FIND_URL}
              prefetch={false}
              className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[var(--color-gold)] px-5 text-sm font-bold text-[var(--color-bark)] transition-[background-color,transform] hover:bg-[var(--color-gold-light)] active:scale-[0.98]"
            >
              Browse local professionals
              <ArrowUpRight size={16} aria-hidden />
            </Link>
            <div className="mt-2.5 flex items-center justify-center gap-1.5 text-xs text-[rgba(251,240,220,0.58)]">
              <BadgeCheck size={13} aria-hidden />
              find.{siteConfig.domain}
            </div>
          </div>

          <BriefcaseBusiness className="pointer-events-none absolute -bottom-8 right-5 hidden text-white/[0.035] md:block" size={150} strokeWidth={1} aria-hidden />
        </div>
      </div>
    </section>
  )
}

