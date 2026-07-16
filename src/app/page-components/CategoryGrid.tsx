import { ArrowUpRight } from 'lucide-react'
import SafeAppLink from '@/components/SafeAppLink'
import { getCategoryPath, LISTING_CATEGORY_EMOJIS } from '@/lib/listing-category'
import SectionHeader from '@/components/ui/SectionHeader'

interface CategoryGridProps {
  topCategoryLabels: string[]
  categoryCounts: Record<string, number>
}

export default function CategoryGrid({ topCategoryLabels, categoryCounts }: CategoryGridProps) {
  if (topCategoryLabels.length === 0) return null

  return (
    <section
      className="relative py-16"
      style={{
        background:
          'linear-gradient(180deg, var(--color-bg) 0%, #F4EADC 100%)',
      }}
    >
      <div className="relative max-w-[1160px] mx-auto px-6">
        <SectionHeader
          label="Browse by need"
          title="Explore Categories"
          sub="One clear place to jump into food, shops, services, health and more"
          viewAllHref="/listings"
        />
        <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-3 lg:grid-cols-5">
          {topCategoryLabels.map((label) => {
            const count = categoryCounts[label] || 0
            const emoji = LISTING_CATEGORY_EMOJIS[label] || '🏪'
            return (
              <SafeAppLink
                key={label}
                href={getCategoryPath(label)}
                className="group relative bg-white border border-[var(--color-border)] rounded-2xl p-5 text-center transition-all duration-300 hover:border-[rgba(192,88,46,0.45)] hover:-translate-y-1 hover:shadow-[0_18px_44px_rgba(192,88,46,0.14)] overflow-hidden"
              >
                <span
                  className="pointer-events-none absolute -top-12 -right-12 w-28 h-28 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                  style={{
                    background:
                      'radial-gradient(circle, rgba(240,200,122,0.45) 0%, transparent 70%)',
                  }}
                  aria-hidden
                />
                <span
                  className="absolute top-3 right-3 w-7 h-7 rounded-full bg-[var(--color-surface-soft)] border border-[var(--color-border)] flex items-center justify-center opacity-0 group-hover:opacity-100 group-hover:bg-[var(--color-brand)] group-hover:border-[var(--color-brand)] transition-all duration-300"
                  aria-hidden
                >
                  <ArrowUpRight size={13} className="text-[var(--color-brand)] group-hover:text-white transition-colors" />
                </span>

                <div
                  className="relative mx-auto mb-3 flex items-center justify-center w-14 h-14 rounded-2xl border border-[rgba(192,88,46,0.18)] transition-transform duration-300 group-hover:scale-110 group-hover:rotate-[-4deg]"
                  style={{
                    background:
                      'linear-gradient(135deg, #FBF0DC 0%, #F0D9B0 100%)',
                    boxShadow: 'inset 0 -2px 4px rgba(192,88,46,0.08)',
                  }}
                >
                  <span className="text-[28px] leading-none" aria-hidden>
                    {emoji}
                  </span>
                </div>
                <div className="relative text-[13px] font-bold text-[var(--color-bark)] leading-[1.3] group-hover:text-[var(--color-brand-strong)] transition-colors">
                  {label}
                </div>
                <div className="relative text-[11px] text-[var(--color-text-muted)] mt-1 font-medium">
                  <span className="text-[var(--color-brown)]">{count}</span>{' '}
                  {count === 1 ? 'business' : 'businesses'}
                </div>
              </SafeAppLink>
            )
          })}
        </div>
      </div>
    </section>
  )
}
