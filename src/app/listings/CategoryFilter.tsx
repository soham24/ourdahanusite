'use client'

import Link from 'next/link'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { getCategoryPath } from '@/lib/listing-category'

interface Props {
  /** All categories sorted by count: ["All", "Restaurants", ...] */
  sortedCategories: string[]
  activeCategory: string
  categoryCounts?: Record<string, number>
}

export default function CategoryFilter({ sortedCategories, activeCategory, categoryCounts = {} }: Props) {
  const searchParams = useSearchParams()
  const [expanded, setExpanded] = useState(activeCategory !== 'All' && !sortedCategories.slice(0, 8).includes(activeCategory))

  const visible = expanded ? sortedCategories : sortedCategories.slice(0, 8)
  const hiddenCount = sortedCategories.length - 8

  function href(cat: string) {
    const path = cat === 'All' ? '/listings' : getCategoryPath(cat)
    const params = new URLSearchParams()
    for (const key of ['q', 'sort']) {
      const value = searchParams.get(key)
      if (value) params.set(key, value)
    }
    const query = params.toString()
    return `${path}${query ? `?${query}` : ''}`
  }

  return (
    <div className="mb-5">
      <div className={`flex gap-2.5 ${expanded ? 'flex-wrap' : 'overflow-x-auto pb-2 sm:flex-wrap'}`}>
        {visible.map(cat => (
          <Link
            key={cat}
            href={href(cat)}
            aria-current={activeCategory === cat ? 'page' : undefined}
            className={`whitespace-nowrap px-4 py-2 rounded-xl text-[13px] font-bold transition-all duration-200 ${
              activeCategory === cat
                ? 'bg-[var(--od-brand)] text-white shadow-[0_8px_20px_rgba(192,88,46,0.18)] translate-y-[-1px]'
                : 'bg-white text-[var(--od-ink-2)] border border-[var(--od-border)] hover:border-[rgba(192,88,46,0.35)] hover:text-[var(--od-brand-strong)] hover:bg-[var(--od-surface-soft)]'
            }`}
          >
            <span>{cat}</span>
            {cat !== 'All' && categoryCounts[cat] ? (
              <span className={`ml-2 text-[11px] font-bold ${activeCategory === cat ? 'text-white/80' : 'text-[var(--od-muted)]'}`}>
                {categoryCounts[cat]}
              </span>
            ) : null}
          </Link>
        ))}
        {hiddenCount > 0 && (
          <button
            type="button"
            aria-expanded={expanded}
            onClick={() => setExpanded(e => !e)}
            className="flex items-center gap-1.5 whitespace-nowrap rounded-xl border border-[var(--od-border)] bg-white px-4 py-2 text-[13px] font-bold text-[var(--od-muted)] transition-all hover:border-[rgba(192,88,46,0.35)] hover:bg-[var(--od-surface-soft)] hover:text-[var(--od-brand-strong)]"
          >
            {expanded ? <><ChevronUp size={14} /> Less</> : <><ChevronDown size={14} /> {hiddenCount} more</>}
          </button>
        )}
      </div>
    </div>
  )
}
