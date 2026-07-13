import { ArrowRight, ShieldCheck } from 'lucide-react'

// The people directory lives on its own subdomain, so links are absolute.
const FIND_URL = 'https://find.ourdahanu.in'

interface FindDahanuSectionProps {
  categories: { label: string; count: number }[]
  total: number
}

function professionHref(label: string) {
  return `${FIND_URL}/?profession=${encodeURIComponent(label)}`
}

export default function FindDahanuSection({ categories, total }: FindDahanuSectionProps) {
  if (total === 0) return null

  return (
    <section className="py-12 md:py-16">
      <div className="mx-auto max-w-[1160px] px-5 md:px-6">
        <div className="relative overflow-hidden rounded-3xl border border-[var(--od-border)] bg-[var(--color-surface-2)] shadow-[0_16px_46px_rgba(46,18,5,0.06)]">
          <div className="warli-bg pointer-events-none absolute inset-0 opacity-50" aria-hidden />
          <div className="relative grid gap-8 p-7 md:grid-cols-[1fr_1.05fr] md:p-10">
            {/* Pitch */}
            <div className="flex flex-col justify-center">
              <p className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--od-brand)]">
                Vouched by neighbours
              </p>
              <h2 className="font-display text-[30px] leading-[1.12] tracking-[-0.01em] text-[var(--od-ink)] md:text-[34px]">
                Find trusted people in Dahanu
              </h2>
              <p className="mt-3 max-w-md text-sm leading-6 text-[var(--od-muted)]">
                Electricians, plumbers, doctors, tutors and more — added by neighbours and rated
                only by people who actually hired them.{' '}
                <strong className="font-semibold text-[var(--od-ink-2)]">
                  {total} professional{total !== 1 ? 's' : ''}
                </strong>{' '}
                and growing.
              </p>
              <p className="mt-3 inline-flex items-center gap-1.5 text-xs font-bold text-[var(--od-ink-2)]">
                <ShieldCheck size={13} className="text-[var(--od-success)]" aria-hidden />
                Every rating checked by a moderator
              </p>
              <a
                href={FIND_URL}
                className="mt-5 inline-flex w-fit items-center gap-2 rounded-xl bg-[var(--od-brand-strong)] px-5 py-2.5 text-sm font-bold text-[#FFFAF3] shadow-[0_8px_20px_rgba(192,88,46,0.25)] transition-transform duration-200 hover:-translate-y-0.5 active:scale-[0.98]"
              >
                Browse the directory
                <ArrowRight size={15} aria-hidden />
              </a>
            </div>

            {/* Category quick-links */}
            <div className="flex flex-col justify-center">
              <p className="mb-2.5 text-[11px] font-bold uppercase tracking-[0.1em] text-[var(--od-muted)]">
                Popular categories
              </p>
              <div className="flex flex-wrap gap-2">
                {categories.map((c) => (
                  <a
                    key={c.label}
                    href={professionHref(c.label)}
                    className="group inline-flex items-center gap-1.5 rounded-full border border-[var(--od-border)] bg-white/80 px-3.5 py-2 text-[13px] font-semibold text-[var(--od-ink-2)] transition-colors duration-150 hover:border-[var(--od-gold)] hover:bg-white"
                  >
                    {c.label}
                    <span className="rounded-full bg-[var(--od-surface-soft)] px-1.5 py-0.5 text-[11px] font-bold tabular-nums text-[var(--od-brand-strong)]">
                      {c.count}
                    </span>
                  </a>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
