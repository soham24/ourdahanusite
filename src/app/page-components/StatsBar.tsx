import { Store, LayoutGrid, Users, Sparkles } from 'lucide-react'

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
    {
      val: formatStat(totalListings, '30+'),
      label: 'Local Businesses',
      Icon: Store,
    },
    {
      val: `${topCategoryLabelsLength || 8}+`,
      label: 'Categories',
      Icon: LayoutGrid,
    },
    {
      val: '1,000+',
      label: 'Dahanukars',
      Icon: Users,
    },
    {
      val: 'Free',
      label: 'to browse',
      Icon: Sparkles,
    },
  ]

  return (
    <section
      className="relative border-y border-[var(--color-border)]"
      style={{
        background:
          'linear-gradient(180deg, #FBF5EC 0%, #F6EDDD 100%)',
      }}
    >
      <div
        className="absolute inset-0 opacity-[0.35] pointer-events-none warli-bg"
        aria-hidden
      />
      <div className="relative max-w-[1160px] mx-auto px-6 py-6 grid grid-cols-2 sm:grid-cols-4 gap-y-5 gap-x-4 sm:divide-x sm:divide-[rgba(192,88,46,0.14)]">
        {stats.map(({ val, label, Icon }) => (
          <div
            key={label}
            className="flex items-center justify-center gap-3 sm:gap-3.5 px-2 sm:px-4"
          >
            <div
              className="flex items-center justify-center w-10 h-10 rounded-full flex-shrink-0 border border-[rgba(192,88,46,0.22)]"
              style={{
                background:
                  'linear-gradient(135deg, rgba(240,200,122,0.35), rgba(192,88,46,0.12))',
              }}
              aria-hidden
            >
              <Icon size={16} className="text-[var(--color-brand-strong)]" strokeWidth={2.25} />
            </div>
            <div className="flex flex-col leading-none">
              <span className="font-display text-[26px] md:text-[28px] text-[var(--color-bark)] tracking-tight">
                {val}
              </span>
              <span className="text-[11px] uppercase tracking-[0.1em] font-semibold text-[var(--color-brown)] mt-1">
                {label}
              </span>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
