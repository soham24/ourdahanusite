'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Plus } from 'lucide-react'
import { PROFESSIONS } from '@/lib/find/professions'
import type { AdminFindCounts } from '@/lib/find/types'
import AddProfessionalForm from './AddProfessionalForm'

const SEGMENTS: { key: string; label: string }[] = [
  { key: 'pending', label: 'Pending' },
  { key: 'approved', label: 'Approved' },
  { key: 'rejected', label: 'Rejected' },
  { key: 'inactive', label: 'Inactive' },
  { key: 'all', label: 'All' },
]

function buildHref(currentQuery: string, overrides: Record<string, string>) {
  const params = new URLSearchParams(currentQuery)
  for (const [key, value] of Object.entries(overrides)) {
    if (value) params.set(key, value); else params.delete(key)
  }
  return `/admin/find?${params.toString()}`
}

function countFor(counts: AdminFindCounts, key: string): number {
  if (key === 'pending') return counts.pending
  if (key === 'approved') return counts.approved
  if (key === 'rejected') return counts.rejected
  if (key === 'inactive') return counts.inactive
  return counts.total
}

export default function FindToolbar({
  status,
  q,
  profession,
  counts,
  currentQuery,
}: {
  status: string
  q: string
  profession: string
  counts: AdminFindCounts
  currentQuery: string
}) {
  const router = useRouter()
  const [query, setQuery] = useState(q)
  const [showAdd, setShowAdd] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => { setQuery(q) }, [q])

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current)
    }
  }, [])

  function onSearchChange(value: string) {
    setQuery(value)
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      router.replace(buildHref(currentQuery, { q: value }))
    }, 350)
  }

  return (
    <div className="mb-4 space-y-3">
      <div className="flex flex-wrap gap-2">
        {SEGMENTS.map((s) => (
          <Link
            key={s.key}
            href={buildHref(currentQuery, { status: s.key })}
            replace
            className={`rounded-md px-3 py-1.5 text-sm font-semibold ${
              status === s.key ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-700'
            }`}
          >
            {s.label} ({countFor(counts, s.key)})
          </Link>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={query}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search name, phone, locality…"
          className="w-56 rounded border border-gray-300 px-2 py-1.5 text-sm"
        />
        <select
          value={profession}
          onChange={(e) => router.replace(buildHref(currentQuery, { profession: e.target.value }))}
          className="rounded border border-gray-300 px-2 py-1.5 text-sm"
        >
          <option value="">All professions</option>
          {PROFESSIONS.map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => setShowAdd((v) => !v)}
          className="ml-auto inline-flex items-center gap-1 rounded bg-gray-800 px-3 py-1.5 text-sm font-semibold text-white"
        >
          <Plus size={14} /> Add professional
        </button>
      </div>
      {showAdd && <AddProfessionalForm onDone={() => setShowAdd(false)} />}
    </div>
  )
}
