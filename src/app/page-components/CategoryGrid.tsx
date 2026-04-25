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
    <section className="bg-[var(--color-muted)] py-14">
      <div className="max-w-[1160px] mx-auto px-6">
        <SectionHeader
          label="Browse"
          title="Popular Categories"
          sub="The most searched services in Dahanu"
          viewAllHref="/listings"
        />
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {topCategoryLabels.map((label) => {
            const count = categoryCounts[label] || 0
            const emoji = LISTING_CATEGORY_EMOJIS[label] || '🏪'
            return (
              <SafeAppLink
                key={label}
                href={getCategoryPath(label)}
                className="bg-white border border-[var(--color-border)] rounded-2xl px-4 py-5 text-center transition-all duration-200 hover:border-[#E8C49A] hover:-translate-y-[3px] hover:shadow-card-hover"
              >
                <div className="text-[26px] mb-2.5" aria-hidden>
                  {emoji}
                </div>
                <div className="text-xs font-semibold text-[var(--color-bark)] leading-[1.3]">
                  {label}
                </div>
                <div className="text-[11px] text-[var(--color-text-muted)] mt-0.5">
                  {count} {count === 1 ? 'business' : 'businesses'}
                </div>
              </SafeAppLink>
            )
          })}
        </div>
      </div>
    </section>
  )
}
