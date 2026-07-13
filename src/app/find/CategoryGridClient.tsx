'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { chipOff, chipOn, Mr } from './find-ui'

export interface CategoryTile {
  href: string
  label: string
  mr: string | null
  count: number
  active: boolean
}

const tileBase =
  'flex items-center justify-between gap-2 rounded-[14px] border px-3.5 py-2.5 text-sm font-semibold transition-colors duration-150 active:scale-[0.98]'

// How many category tiles (after the "All" tile) stay visible on phones
// before the "Show all" expander — keeps the grid from pushing results
// below several screens of tiles now that there are 25+ categories.
const MOBILE_VISIBLE = 7

export default function CategoryGridClient({
  tiles,
  allHref,
  allActive,
  total,
}: {
  tiles: CategoryTile[]
  allHref: string
  allActive: boolean
  total: number
}) {
  const [showAll, setShowAll] = useState(false)
  const collapsible = tiles.length > MOBILE_VISIBLE

  return (
    <nav aria-label="Filter by profession" className="mt-5">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
        <Link
          href={allHref}
          aria-current={allActive ? 'page' : undefined}
          className={`${tileBase} ${allActive ? chipOn : chipOff}`}
        >
          <span>All</span>
          <span className="shrink-0 text-xs font-bold tabular-nums opacity-70">{total}</span>
        </Link>
        {tiles.map((t, i) => {
          // The active tile always stays visible so a filtered page never
          // hides its own filter inside the collapsed set.
          const collapsedOnMobile = collapsible && !showAll && i >= MOBILE_VISIBLE && !t.active
          return (
            <Link
              key={t.label}
              href={t.href}
              aria-current={t.active ? 'page' : undefined}
              className={`${collapsedOnMobile ? 'hidden sm:flex' : 'flex'} ${tileBase} ${t.active ? chipOn : chipOff}`}
            >
              <span className="min-w-0 truncate">
                {t.label} <Mr text={t.mr} />
              </span>
              <span className="shrink-0 text-xs font-bold tabular-nums opacity-70">{t.count}</span>
            </Link>
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
          {showAll ? (
            <>
              Show fewer categories <ChevronUp size={14} aria-hidden />
            </>
          ) : (
            <>
              Show all {tiles.length} categories <ChevronDown size={14} aria-hidden />
            </>
          )}
        </button>
      )}
    </nav>
  )
}
