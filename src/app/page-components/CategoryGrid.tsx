'use client'

import { useState } from 'react'
import Image from 'next/image'
import { ArrowUpRight, ChevronDown } from 'lucide-react'

import SafeAppLink from '@/components/SafeAppLink'
import SectionHeader from '@/components/ui/SectionHeader'
import type { CategoryGroupSummary } from '@/lib/category-groups'

interface CategoryGridProps {
  groups: CategoryGroupSummary[]
}

/** The first tile carries the most listings, so it earns the wide slot. */
function tileSpanClass(index: number): string {
  return index === 0 ? 'col-span-2' : ''
}

function Thumbs({ group }: { group: CategoryGroupSummary }) {
  // Fewer than two reads as a lopsided fragment rather than a mosaic, so the
  // tile shows its icon alone instead.
  if (group.thumbs.length < 2) return null

  const remainder = group.count - group.thumbs.length

  return (
    <div className="mt-3 flex items-center justify-center" aria-hidden>
      <div className="flex -space-x-2">
        {group.thumbs.map((thumb) => (
          <span
            key={thumb.id}
            className="relative block h-8 w-8 overflow-hidden rounded-full border-2 border-white bg-[var(--color-surface-soft)] shadow-sm"
            title={thumb.name}
          >
            <Image src={thumb.imageUrl} alt="" fill sizes="32px" className="object-cover" />
          </span>
        ))}
      </div>
      {remainder > 0 && (
        <span className="ml-2 text-[11px] font-semibold text-[var(--color-text-muted)]">
          +{remainder}
        </span>
      )}
    </div>
  )
}

export default function CategoryGrid({ groups }: CategoryGridProps) {
  const [openSlug, setOpenSlug] = useState<string | null>(null)

  if (groups.length === 0) return null

  return (
    <section
      className="relative py-16"
      style={{
        background: 'linear-gradient(180deg, var(--color-bg) 0%, #F4EADC 100%)',
      }}
    >
      <div className="relative max-w-[1160px] mx-auto px-6">
        <SectionHeader
          label="Browse by need"
          title="Explore Categories"
          sub="One clear place to jump into food, shops, services, health and more"
          viewAllHref="/listings"
        />

        <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-4">
          {groups.map((group, index) => {
            const isOpen = openSlug === group.slug
            return (
              <div key={group.slug} className={`flex flex-col ${tileSpanClass(index)}`}>
                <button
                  type="button"
                  onClick={() => setOpenSlug(isOpen ? null : group.slug)}
                  aria-expanded={isOpen}
                  aria-controls={`category-group-${group.slug}`}
                  className="group relative w-full flex-1 bg-white border border-[var(--color-border)] rounded-2xl p-5 text-center transition-all duration-300 hover:border-[rgba(192,88,46,0.45)] hover:-translate-y-1 hover:shadow-[0_18px_44px_rgba(192,88,46,0.14)] overflow-hidden"
                >
                  <span
                    className="pointer-events-none absolute -top-12 -right-12 w-28 h-28 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                    style={{
                      background:
                        'radial-gradient(circle, rgba(240,200,122,0.45) 0%, transparent 70%)',
                    }}
                    aria-hidden
                  />

                  <div
                    className="relative mx-auto mb-3 flex items-center justify-center w-14 h-14 rounded-2xl border border-[rgba(192,88,46,0.18)] transition-transform duration-300 group-hover:scale-110 group-hover:rotate-[-4deg]"
                    style={{
                      background: 'linear-gradient(135deg, #FBF0DC 0%, #F0D9B0 100%)',
                      boxShadow: 'inset 0 -2px 4px rgba(192,88,46,0.08)',
                    }}
                  >
                    <span className="text-[28px] leading-none" aria-hidden>
                      {group.icon}
                    </span>
                  </div>

                  <div className="relative text-[13px] font-bold text-[var(--color-bark)] leading-[1.3] group-hover:text-[var(--color-brand-strong)] transition-colors">
                    {group.label}
                  </div>
                  <div className="relative text-[11px] text-[var(--color-text-muted)] mt-1 font-medium">
                    <span className="text-[var(--color-brown)]">{group.count}</span> places
                  </div>

                  <Thumbs group={group} />

                  <span className="relative mt-3 inline-flex items-center gap-1 text-[11px] font-semibold text-[var(--color-brand)]">
                    {isOpen ? 'Hide' : 'See inside'}
                    <ChevronDown
                      size={12}
                      className={`transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}
                    />
                  </span>
                </button>

                <div
                  id={`category-group-${group.slug}`}
                  hidden={!isOpen}
                  className="mt-2 flex flex-wrap gap-2 rounded-2xl border border-[var(--color-border)] bg-white/70 p-3"
                >
                  {group.members.map((member) => (
                    <SafeAppLink
                      key={member.href}
                      href={member.href}
                      className="inline-flex items-center gap-1 rounded-full border border-[var(--color-border)] bg-white px-3 py-1.5 text-[11px] font-semibold text-[var(--color-bark)] transition-colors hover:border-[rgba(192,88,46,0.45)] hover:text-[var(--color-brand-strong)]"
                    >
                      {member.label}
                      <span className="text-[var(--color-text-muted)]">{member.count}</span>
                      <ArrowUpRight size={11} />
                    </SafeAppLink>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
