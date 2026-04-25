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
    { val: formatStat(totalListings, '30+'), label: 'Local Businesses' },
    { val: `${topCategoryLabelsLength || 8}+`, label: 'Categories' },
    { val: '1,000+', label: 'Dahanukars' },
    { val: 'Free', label: 'to browse' },
  ]

  return (
    <section className="bg-[var(--color-muted)] border-b border-[var(--color-border)]">
      <div className="max-w-[1160px] mx-auto px-6 py-4 flex items-center justify-center gap-10 flex-wrap">
        {stats.map((s, i) => (
          <div key={s.label} className="flex items-center gap-6">
            {i > 0 && <div className="hidden sm:block w-px h-8 bg-[var(--color-border)]" aria-hidden />}
            <div className="flex items-center gap-2.5">
              <span className="font-display text-[26px] text-[var(--color-brand)] leading-none">{s.val}</span>
              <span className="text-xs text-[var(--color-text-muted)] font-medium max-w-[80px] leading-[1.3]">
                {s.label}
              </span>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
