'use client'

import { useState, useTransition } from 'react'
import { setExclusion } from '@/app/actions/admin-competitions'

export default function ExcludeButton({
  competitionId,
  userId,
  excluded,
  name,
}: {
  competitionId: string
  userId: string
  excluded: boolean
  name: string
}) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function onClick() {
    if (!excluded && !window.confirm(`Disqualify ${name} from this competition?`)) return
    setError(null)
    startTransition(async () => {
      const result = await setExclusion(competitionId, userId, !excluded)
      if (result.error) setError(result.error)
    })
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={onClick}
        disabled={isPending}
        className={`rounded-lg px-3 py-1 text-xs font-bold transition-colors disabled:opacity-50 ${
          excluded
            ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            : 'bg-red-50 text-red-700 hover:bg-red-100'
        }`}
      >
        {isPending ? '…' : excluded ? 'Undo' : 'Disqualify'}
      </button>
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  )
}
