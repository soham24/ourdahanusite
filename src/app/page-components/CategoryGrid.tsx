import SafeAppLink from '@/components/SafeAppLink'
import { getCategoryPath } from '@/lib/listing-category'
import SectionHeader from '@/components/ui/SectionHeader'

interface Category {
  label: string
  emoji: string
  count: number
}

interface CategoryGridProps {
  categories: Category[]
}

export default function CategoryGrid({ categories }: CategoryGridProps) {
  if (categories.length === 0) return null

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
          {categories.map((cat) => (
            <SafeAppLink
              key={cat.label}
              href={getCategoryPath(cat.label)}
              className="bg-white border border-[var(--color-border)] rounded-2xl px-4 py-5 text-center transition-all duration-200 hover:border-[#E8C49A] hover:-translate-y-[3px] hover:shadow-card-hover"
            >
              <div className="text-[26px] mb-2.5" aria-hidden>
                {cat.emoji}
              </div>
              <div className="text-xs font-semibold text-[var(--color-bark)] leading-[1.3]">
                {cat.label}
              </div>
              <div className="text-[11px] text-[var(--color-text-muted)] mt-0.5">
                {cat.count} {cat.count === 1 ? 'business' : 'businesses'}
              </div>
            </SafeAppLink>
          ))}
        </div>
      </div>
    </section>
  )
}
