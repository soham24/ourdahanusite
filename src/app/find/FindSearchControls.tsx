'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useState } from 'react'
import { Search, X } from 'lucide-react'

export default function FindSearchControls() {
  const router = useRouter()
  const params = useSearchParams()
  const [q, setQ] = useState(params.get('q') ?? '')

  function submit(value: string) {
    const sp = new URLSearchParams(params.toString())
    if (value.trim()) sp.set('q', value.trim())
    else sp.delete('q')
    const s = sp.toString()
    router.push(s ? `/find?${s}` : '/find')
  }

  return (
    <form
      role="search"
      onSubmit={(e) => {
        e.preventDefault()
        submit(q)
      }}
      className="relative"
    >
      <Search
        size={16}
        aria-hidden
        className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[var(--od-muted)]"
      />
      <input
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search by name, area, or keyword…"
        aria-label="Search professionals"
        className="od-input h-12 w-full pl-10 pr-[6.5rem] text-[15px] [&::-webkit-search-cancel-button]:hidden"
      />
      {q && (
        <button
          type="button"
          aria-label="Clear search"
          onClick={() => {
            setQ('')
            submit('')
          }}
          className="absolute right-[5.4rem] top-1/2 -translate-y-1/2 rounded-full p-1 text-[var(--od-muted)] transition-colors hover:bg-[var(--color-gray-100)]"
        >
          <X size={14} aria-hidden />
        </button>
      )}
      <button
        type="submit"
        className="od-button-primary absolute right-1.5 top-1/2 h-9 -translate-y-1/2 px-4 text-sm active:scale-[0.98]"
      >
        Search
      </button>
    </form>
  )
}
