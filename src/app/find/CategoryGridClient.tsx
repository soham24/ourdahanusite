'use client'

import { useState } from 'react'
import { ChevronDown, LayoutGrid } from 'lucide-react'
import { PROFESSION_ICON } from '@/lib/find/profession-icons'
import type { Profession } from '@/lib/find/professions'
import { chipOff, chipOn, Mr } from './find-ui'

export interface CategoryTile {
  label: Profession
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
  open,
  onOpenChange,
}: {
  tiles: CategoryTile[]
  total: number
  active: string | null
  onSelect: (profession: string | null) => void
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [showAll, setShowAll] = useState(false)
  const collapsible = tiles.length > MOBILE_VISIBLE
  const activeTile = active ? tiles.find((t) => t.label === active) : null
  const ActiveIcon = activeTile ? PROFESSION_ICON[activeTile.label] : null

  return (
    <nav aria-label="Filter by profession" className="mt-5">
      {/* Header toggle — always visible so the grid can be expanded/collapsed.
          It auto-collapses when the search is engaged (results then sit right
          under the search box); the active filter stays visible here as a chip
          while collapsed so it's never lost. */}
      <button
        type="button"
        onClick={() => onOpenChange(!open)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-2 rounded-[14px] border border-[var(--od-border)] bg-white/70 px-3.5 py-2.5 text-sm font-semibold text-[var(--od-ink-2)] transition-colors hover:border-[var(--od-gold)]"
      >
        <span className="flex min-w-0 items-center gap-2">
          <LayoutGrid size={15} className="shrink-0 text-[var(--od-muted)]" aria-hidden />
          <span className="shrink-0">Categories</span>
          {activeTile && ActiveIcon && !open && (
            <span className="flex min-w-0 items-center gap-1 truncate rounded-full bg-[rgba(192,88,46,0.09)] px-2 py-0.5 text-[12px] font-bold text-[var(--od-brand-strong)]">
              <ActiveIcon size={12} className="shrink-0" aria-hidden />
              <span className="truncate">
                {activeTile.label} <Mr text={activeTile.mr} />
              </span>
            </span>
          )}
        </span>
        <ChevronDown
          size={16}
          aria-hidden
          className={`shrink-0 text-[var(--od-muted)] transition-transform duration-300 ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {/* grid-template-rows 0fr↔1fr animates the height without measuring it. */}
      <div
        className="grid transition-[grid-template-rows] duration-300 ease-out motion-reduce:transition-none"
        style={{ gridTemplateRows: open ? '1fr' : '0fr' }}
      >
        <div className="overflow-hidden" inert={!open}>
          <div className="grid grid-cols-2 gap-2 pt-2 sm:grid-cols-3 lg:grid-cols-4">
            <button
              type="button"
              onClick={() => onSelect(null)}
              aria-current={!active ? 'page' : undefined}
              className={`${tileBase} ${!active ? chipOn : chipOff}`}
            >
              <span className="flex min-w-0 items-center gap-1.5">
                <LayoutGrid size={14} className="shrink-0 opacity-70" aria-hidden />
                All
              </span>
              <span className="shrink-0 text-xs font-bold tabular-nums opacity-70">{total}</span>
            </button>
            {tiles.map((t, i) => {
              const on = active === t.label
              const collapsedOnMobile = collapsible && !showAll && i >= MOBILE_VISIBLE && !on
              const Icon = PROFESSION_ICON[t.label]
              return (
                <button
                  type="button"
                  key={t.label}
                  onClick={() => onSelect(t.label)}
                  aria-current={on ? 'page' : undefined}
                  className={`${collapsedOnMobile ? 'hidden sm:flex' : 'flex'} ${tileBase} ${on ? chipOn : chipOff}`}
                >
                  <span className="flex min-w-0 items-center gap-1.5 truncate">
                    <Icon size={14} className="shrink-0 opacity-70" aria-hidden />
                    <span className="truncate">
                      {t.label} <Mr text={t.mr} />
                    </span>
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
              {showAll ? (<>Show fewer categories <ChevronDown size={14} className="rotate-180" aria-hidden /></>) : (<>Show all {tiles.length} categories <ChevronDown size={14} aria-hidden /></>)}
            </button>
          )}
        </div>
      </div>
    </nav>
  )
}
