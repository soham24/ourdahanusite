'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useState } from 'react'
import { PROFESSIONS } from '@/lib/find/professions'

export default function FindSearchControls() {
  const router = useRouter()
  const params = useSearchParams()
  const [q, setQ] = useState(params.get('q') ?? '')
  const profession = params.get('profession') ?? 'All'

  function apply(next: { q?: string; profession?: string }) {
    const sp = new URLSearchParams(params.toString())
    if (next.q !== undefined) {
      if (next.q) sp.set('q', next.q)
      else sp.delete('q')
    }
    if (next.profession !== undefined) {
      if (next.profession && next.profession !== 'All') sp.set('profession', next.profession)
      else sp.delete('profession')
    }
    router.push(`/find?${sp.toString()}`)
  }

  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row">
      <form
        className="flex-1"
        onSubmit={(e) => {
          e.preventDefault()
          apply({ q })
        }}
      >
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by name, area, or keyword…"
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
        />
      </form>
      <select
        value={profession}
        onChange={(e) => apply({ profession: e.target.value })}
        className="rounded-md border border-gray-300 px-3 py-2 text-sm"
      >
        <option value="All">All professions</option>
        {PROFESSIONS.map((p) => (
          <option key={p} value={p}>{p}</option>
        ))}
      </select>
    </div>
  )
}
