'use client'

import { Search, X } from 'lucide-react'

export default function FindSearchControls({
  value,
  onChange,
}: {
  value: string
  onChange: (q: string) => void
}) {
  return (
    <div role="search" className="relative">
      <Search
        size={16}
        aria-hidden
        className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[var(--od-muted)]"
      />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Search by name, area, or keyword…"
        aria-label="Search professionals"
        className="od-input h-12 w-full pl-10 pr-10 text-[15px] [&::-webkit-search-cancel-button]:hidden"
      />
      {value && (
        <button
          type="button"
          aria-label="Clear search"
          onClick={() => onChange('')}
          className="absolute right-3 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-[var(--od-muted)] transition-colors hover:bg-[var(--color-gray-100)]"
        >
          <X size={16} aria-hidden />
        </button>
      )}
    </div>
  )
}
