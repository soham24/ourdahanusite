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
            className={`whitespace-nowrap px-4 py-2 rounded-full text-sm font-medium transition-colors ${
              activeCategory === cat
                ? 'bg-warli-terra text-warli-cream'
                : 'bg-gray-100 text-gray-600 hover:bg-warli-light hover:text-warli-terra'
            }`}
          >
            <span>{cat}</span>
            {cat !== 'All' && categoryCounts[cat] ? (
              <span className={`ml-1.5 text-xs ${activeCategory === cat ? 'text-warli-cream/80' : 'text-gray-400'}`}>
                {categoryCounts[cat]}
              </span>
            ) : null}
          </Link>
        ))}
        {hiddenCount > 0 && (
          <button
            onClick={() => setExpanded(e => !e)}
            className="whitespace-nowrap flex items-center gap-1 px-4 py-2 rounded-full text-sm font-medium bg-gray-50 border border-gray-200 text-gray-500 hover:bg-gray-100 transition-colors"
          >
            {expanded ? <><ChevronUp size={14} /> Less</> : <><ChevronDown size={14} /> {hiddenCount} more</>}
          </button>
        )}
      </div>
    </div>
  )
}
