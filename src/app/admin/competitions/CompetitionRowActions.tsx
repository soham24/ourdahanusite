'use client'

import { useState, useTransition } from 'react'
import { Trash2 } from 'lucide-react'
import { deleteCompetition, setCompetitionActive } from '@/app/actions/admin-competitions'

export default function CompetitionRowActions({ id, active }: { id: string; active: boolean }) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function toggle() {
    setError(null)
    startTransition(async () => {
      const result = await setCompetitionActive(id, !active)
      if (result.error) setError(result.error)
    })
  }

  function remove() {
    if (!window.confirm('Delete this competition? This cannot be undone.')) return
    setError(null)
    startTransition(async () => {
      const result = await deleteCompetition(id)
      if (result.error) setError(result.error)
    })
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-2">
        <button
          type="button"
          role="switch"
          aria-checked={active}
          aria-label={active ? 'Switch competition off' : 'Switch competition on'}
          onClick={toggle}
          disabled={isPending}
          className={`rounded-full px-3 py-1 text-xs font-bold transition-colors disabled:opacity-50 ${
            active ? 'bg-green-50 text-green-700 hover:bg-green-100' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
          }`}
        >
          {active ? 'On' : 'Off'}
        </button>
        <button
          type="button"
          onClick={remove}
          disabled={isPending}
          className="text-gray-400 hover:text-red-600 transition-colors p-2 rounded-lg hover:bg-red-50 disabled:opacity-50"
          title="Delete competition"
          aria-label="Delete competition"
        >
          <Trash2 size={15} />
        </button>
      </div>
      {error && <p className="max-w-56 text-right text-xs text-red-500">{error}</p>}
    </div>
  )
}
