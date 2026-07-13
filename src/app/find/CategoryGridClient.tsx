'use client'

import { useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { chipOff, chipOn, Mr } from './find-ui'

export interface CategoryTile {
  label: string
  mr: string | null
  count: number
}

const tileBase =
  'flex items-center justify-between gap-2 rounded-[14px] border px-3.5 py-2.5 text-sm font-semibold transition-colors duration-150 active:scale-[0.98]'
const MOBILE_VISIBLE = 7

export default function CategoryGridClient({
  tiles,
  total,
  active,
  onSelect,
}: {
  tiles: CategoryTile[]
  total: number
  active: string | null
  onSelect: (profession: string | null) => void
}) {
  const [showAll, setShowAll] = useState(false)
  const collapsible = tiles.length > MOBILE_VISIBLE

  return (
    <nav aria-label="Filter by profession" className="mt-5">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
        <button
          type="button"
          onClick={() => onSelect(null)}
          aria-current={!active ? 'page' : undefined}
          className={`${tileBase} ${!active ? chipOn : chipOff}`}
        >
          <span>All</span>
          <span className="shrink-0 text-xs font-bold tabular-nums opacity-70">{total}</span>
        </button>
        {tiles.map((t, i) => {
          const on = active === t.label
          const collapsedOnMobile = collapsible && !showAll && i >= MOBILE_VISIBLE && !on
          return (
            <button
              type="button"
              key={t.label}
              onClick={() => onSelect(t.label)}
              aria-current={on ? 'page' : undefined}
              className={`${collapsedOnMobile ? 'hidden sm:flex' : 'flex'} ${tileBase} ${on ? chipOn : chipOff}`}
            >
              <span className="min-w-0 truncate">
                {t.label} <Mr text={t.mr} />
              </span>
              <span className="shrink-0 text-xs font-bold tabular-nums opacity-70">{t.count}</span>
            </button>
          )
        })}
      </div>
      {collapsible && (
        <button
          type="button"
          onClick={() => setShowAll((v) => !v)}
          aria-expanded={showAll}
          className="mt-2 flex w-full items-center justify-center gap-1 rounded-[14px] border border-dashed border-[var(--od-border)] py-2 text-[13px] font-semibold text-[var(--od-muted)] transition-colors hover:text-[var(--od-brand-strong)] sm:hidden"
        >
          {showAll ? (<>Show fewer categories <ChevronUp size={14} aria-hidden /></>) : (<>Show all {tiles.length} categories <ChevronDown size={14} aria-hidden /></>)}
        </button>
      )}
    </nav>
  )
}
