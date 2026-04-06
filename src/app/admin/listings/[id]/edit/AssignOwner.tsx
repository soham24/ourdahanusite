'use client'

import { useState, useTransition } from 'react'
import { adminSearchUsers, adminAssignOwner } from '@/app/actions/admin-listings'
import { Search, Loader2, UserCheck, X, CheckCircle } from 'lucide-react'

interface User { id: string; email: string; name: string }

interface Props {
  listingId: string
  currentOwnerEmail?: string | null
}

export default function AssignOwner({ listingId, currentOwnerEmail }: Props) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<User[]>([])
  const [searching, setSearching] = useState(false)
  const [selected, setSelected] = useState<User | null>(null)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()

  async function search() {
    if (!query.trim()) return
    setSearching(true)
    const { users } = await adminSearchUsers(query)
    setResults(users)
    setSearching(false)
  }

  function assign() {
    if (!selected) return
    setError('')
    startTransition(async () => {
      const res = await adminAssignOwner(listingId, selected.id)
      if (res.error) {
        setError(res.error)
      } else {
        setSaved(true)
        setResults([])
      }
    })
  }

  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-6 mt-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-bold text-gray-800 text-sm uppercase tracking-wide flex items-center gap-2">
          <UserCheck size={15} className="text-blue-500" />
          Assign Owner
        </h2>
        {saved && (
          <span className="flex items-center gap-1 text-xs text-green-600 font-semibold">
            <CheckCircle size={13} /> Owner updated
          </span>
        )}
      </div>

      {currentOwnerEmail && (
        <p className="text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2">
          Current owner: <span className="font-semibold text-gray-700">{currentOwnerEmail}</span>
        </p>
      )}

      {selected ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-blue-700 font-bold text-sm">
                {(selected.name || selected.email)[0].toUpperCase()}
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-800">{selected.name}</p>
                <p className="text-xs text-gray-500">{selected.email}</p>
              </div>
            </div>
            <button type="button" onClick={() => { setSelected(null); setSaved(false) }} className="text-gray-400 hover:text-red-500">
              <X size={16} />
            </button>
          </div>
          <button
            type="button"
            onClick={assign}
            disabled={isPending}
            className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors disabled:opacity-60"
          >
            {isPending ? <><Loader2 size={14} className="animate-spin" /> Saving…</> : <><UserCheck size={14} /> Assign as Owner</>}
          </button>
          {error && <p className="text-red-500 text-xs">{error}</p>}
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex gap-2">
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), search())}
              placeholder="Search user by name or email…"
              className="flex-1 px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-blue-400 text-sm"
            />
            <button type="button" onClick={search} disabled={searching}
              className="px-4 py-3 bg-blue-50 border border-blue-200 text-blue-700 rounded-xl hover:bg-blue-100 transition-colors">
              {searching ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
            </button>
          </div>

          {results.length > 0 && (
            <div className="border border-gray-200 rounded-xl overflow-hidden divide-y divide-gray-100">
              {results.map(u => (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => { setSelected(u); setResults([]) }}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-blue-50 text-left transition-colors"
                >
                  <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-blue-700 font-bold text-sm flex-shrink-0">
                    {(u.name || u.email)[0].toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-800">{u.name}</p>
                    <p className="text-xs text-gray-500">{u.email}</p>
                  </div>
                </button>
              ))}
            </div>
          )}

          {results.length === 0 && query && !searching && (
            <p className="text-xs text-gray-400 text-center py-2">No users found for "{query}"</p>
          )}
        </div>
      )}
    </div>
  )
}
