import { BadgeCheck, LayoutGrid, Store } from 'lucide-react'

interface StatsBarProps {
  totalListings: number
  topCategoryLabelsLength: number
}

function formatStat(value: number, fallback: string): string {
  if (!value) return fallback
  if (value >= 1000) return `${Math.round(value / 100) / 10}k+`
  return `${value}+`
}

export default function StatsBar({ totalListings, topCategoryLabelsLength }: StatsBarProps) {
  const stats = [
    { val: formatStat(totalListings, '30+'), label: 'local businesses', Icon: Store },
    { val: `${topCategoryLabelsLength || 8}+`, label: 'useful categories', Icon: LayoutGrid },
    { val: 'Verified', label: 'business details', Icon: BadgeCheck },
  ]

  return (
    <section
      className="relative border-b border-[var(--color-border)]"
      style={{
        background:
          'linear-gradient(180deg, #FBF5EC 0%, #F6EDDD 100%)',
      }}
    >
      <div className="relative mx-auto grid max-w-[900px] grid-cols-3 divide-x divide-[rgba(192,88,46,0.14)] px-3 py-4 sm:px-6 sm:py-5">
        {stats.map(({ val, label, Icon }) => (
          <div
            key={label}
            className="flex min-w-0 flex-col items-center justify-center gap-1 px-2 text-center sm:flex-row sm:gap-3"
          >
            <div
              className="hidden h-9 w-9 flex-shrink-0 items-center justify-center rounded-full border border-[rgba(192,88,46,0.22)] sm:flex"
              style={{
                background:
                  'linear-gradient(135deg, rgba(240,200,122,0.35), rgba(192,88,46,0.12))',
              }}
              aria-hidden
            >
              <Icon size={16} className="text-[var(--color-brand-strong)]" strokeWidth={2.25} />
            </div>
            <div className="flex min-w-0 flex-col leading-none">
              <span className="font-display text-[20px] text-[var(--color-bark)] tracking-tight sm:text-[25px]">
                {val}
              </span>
              <span className="mt-1 text-[10px] font-semibold leading-tight text-[var(--color-brown)] sm:text-[11px]">
                {label}
              </span>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
