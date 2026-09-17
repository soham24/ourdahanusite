import {
  ArrowRight,
  BedDouble,
  BriefcaseBusiness,
  HeartPulse,
  House,
  ShoppingBag,
  Utensils,
  type LucideIcon,
} from 'lucide-react'

import SafeAppLink from '@/components/SafeAppLink'
import SectionHeader from '@/components/ui/SectionHeader'
import type { CategoryGroupSummary } from '@/lib/category-groups'

interface CategoryGridProps {
  groups: CategoryGroupSummary[]
}
function groupIcon(label: string): LucideIcon {
  if (label.includes('Food')) return Utensils
  if (label.includes('Health')) return HeartPulse
  if (label.includes('Stay')) return BedDouble
  if (label.includes('Shopping')) return ShoppingBag
  if (label.includes('Home')) return House
  return BriefcaseBusiness
}

export default function CategoryGrid({ groups }: CategoryGridProps) {
  const visibleGroups = groups.slice(0, 6)
  if (visibleGroups.length === 0) return null

  return (
    <section className="od-mobile-section bg-[var(--color-bg)] py-10 md:py-16">
      <div className="mx-auto max-w-[1160px] px-4 sm:px-6">
        <SectionHeader
          label="Start here"
          title="What do you need today?"
          sub="Choose a need and go straight to matching local businesses"
          viewAllHref="/listings"
          className="mb-5 md:mb-8"
        />

        <div className="grid grid-cols-2 gap-2.5 md:grid-cols-3 lg:grid-cols-6">
          {visibleGroups.map((group) => {
            const Icon = groupIcon(group.label)
            const href = group.members[0]?.href ?? '/listings'
            return (
              <SafeAppLink
                key={group.slug}
                href={href}
                aria-label={`${group.label}, ${group.count} places`}
                className="group flex min-h-[132px] flex-col justify-between rounded-2xl border border-[var(--od-border)] bg-white p-4 shadow-[0_6px_20px_rgba(46,18,5,0.04)] transition-[transform,border-color,box-shadow] hover:-translate-y-0.5 hover:border-[rgba(192,88,46,0.4)] hover:shadow-[0_12px_28px_rgba(46,18,5,0.08)] active:scale-[0.98]"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--od-surface-soft)] text-[var(--od-brand)]">
                  <Icon size={20} strokeWidth={1.8} aria-hidden />
                </span>
                <span>
                  <span className="block text-sm font-bold leading-tight text-[var(--od-ink)]">{group.label}</span>
                  <span className="mt-1 flex items-center justify-between gap-2 text-xs text-[var(--od-muted)]">
                    {group.count} places
                    <ArrowRight size={13} className="text-[var(--od-brand)]" aria-hidden />
                  </span>
                </span>
              </SafeAppLink>
            )
          })}
        </div>

        <SafeAppLink href="/listings" className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-[var(--od-border)] bg-white text-sm font-bold text-[var(--od-brand)] active:scale-[0.99] sm:hidden">
          Explore all categories <ArrowRight size={15} aria-hidden />
        </SafeAppLink>
      </div>
    </section>
  )
}
