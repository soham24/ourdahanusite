'use client'

import Link from 'next/link'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { useState } from 'react'
import { getCategoryPath } from '@/lib/listing-category'

interface Props {
  /** All categories sorted by count: ["All", "Restaurants", ...] */
  sortedCategories: string[]
  activeCategory: string
  categoryCounts?: Record<string, number>
}

export default function CategoryFilter({ sortedCategories, activeCategory, categoryCounts = {} }: Props) {
  const [expanded, setExpanded] = useState(activeCategory !== 'All' && !sortedCategories.slice(0, 8).includes(activeCategory))

  const visible = expanded ? sortedCategories : sortedCategories.slice(0, 8)
  const hiddenCount = sortedCategories.length - 8

  function href(cat: string) {
    if (cat === 'All') return '/listings'
    return getCategoryPath(cat)
  }

  return (
    <div className="mb-8">
      <div className="flex flex-wrap gap-2">
        {visible.map(cat => (
          <Link
            key={cat}
            href={href(cat)}
            className={`whitespace-nowrap px-4 py-2 rounded-full text-sm font-semibold transition-colors ${
              activeCategory === cat
                ? 'bg-[var(--od-brand)] text-white shadow-[0_8px_18px_rgba(192,88,46,0.18)]'
                : 'bg-white/76 text-[var(--od-ink-2)] border border-[var(--od-border)] hover:bg-[#F4EDE3] hover:text-[var(--od-brand-strong)]'
            }`}
          >
            <span>{cat}</span>
            {cat !== 'All' && categoryCounts[cat] ? (
              <span className={`ml-1.5 text-xs ${activeCategory === cat ? 'text-white/80' : 'text-[var(--od-muted)]'}`}>
                {categoryCounts[cat]}
              </span>
            ) : null}
          </Link>
        ))}
        {hiddenCount > 0 && (
          <button
            onClick={() => setExpanded(e => !e)}
            className="flex items-center gap-1 whitespace-nowrap rounded-full border border-[var(--od-border)] bg-white/70 px-4 py-2 text-sm font-semibold text-[var(--od-muted)] transition-colors hover:bg-[#F4EDE3] hover:text-[var(--od-brand-strong)]"
          >
            {expanded ? <><ChevronUp size={14} /> Less</> : <><ChevronDown size={14} /> {hiddenCount} more</>}
          </button>
        )}
      </div>
    </div>
  )
}
