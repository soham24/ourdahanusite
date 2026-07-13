'use client'

import { useEffect, useRef, useState } from 'react'
import { Search, X } from 'lucide-react'
import { searchBusinessListings } from '@/app/actions/admin-find'

type Listing = { id: string; name: string; subdomain: string | null }

export default function BusinessPicker({
  value,
  initialLabel,
  onChange,
}: {
  value: string | null
  initialLabel?: string | null
  onChange: (id: string | null, label: string | null) => void
}) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Listing[]>([])
  const [open, setOpen] = useState(false)
  const [label, setLabel] = useState<string | null>(initialLabel ?? null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current)
    if (query.trim().length < 2) { setResults([]); return }
    timer.current = setTimeout(async () => {
      setResults(await searchBusinessListings(query))
      setOpen(true)
    }, 250)
    return () => { if (timer.current) clearTimeout(timer.current) }
  }, [query])

  const cls = 'w-full rounded border border-gray-300 px-2 py-1 text-sm'

  if (value) {
    return (
      <div className="flex items-center gap-2 rounded border border-[var(--od-border)] bg-[var(--color-surface-2)] px-2 py-1 text-sm">
        <span className="min-w-0 flex-1 truncate font-semibold">{label ?? 'Selected business'}</span>
        <button
          type="button"
          onClick={() => { onChange(null, null); setLabel(null); setQuery('') }}
          className="shrink-0 rounded p-0.5 text-gray-500 hover:bg-gray-100"
          aria-label="Remove business page"
        >
          <X size={14} />
        </button>
      </div>
    )
  }

  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-gray-400">
        <Search size={14} />
      </span>
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => results.length && setOpen(true)}
        placeholder="Search business pages…"
        className={`${cls} pl-7`}
      />
      {open && results.length > 0 && (
        <ul className="absolute z-10 mt-1 max-h-56 w-full overflow-auto rounded border border-gray-200 bg-white shadow-md">
          {results.map((r) => (
            <li key={r.id}>
              <button
                type="button"
                onClick={() => {
                  const lbl = r.subdomain ? `${r.name} · ${r.subdomain}.ourdahanu.in` : r.name
                  onChange(r.id, lbl); setLabel(lbl); setOpen(false); setQuery('')
                }}
                className="flex w-full flex-col items-start px-2 py-1.5 text-left text-sm hover:bg-gray-50"
              >
                <span className="font-semibold">{r.name}</span>
                {r.subdomain && <span className="text-xs text-gray-500">{r.subdomain}.ourdahanu.in</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
