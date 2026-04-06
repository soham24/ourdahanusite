'use client'

import { useState, useTransition } from 'react'
import { Loader2, UserCheck, XCircle, RotateCcw } from 'lucide-react'
import { updateJobStatus } from '@/app/actions/jobs'

interface Props {
  jobId: string
  currentStatus: string
}

export default function JobStatusButton({ jobId, currentStatus }: Props) {
  const [status, setStatus] = useState(currentStatus)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState('')

  const handle = (newStatus: 'open' | 'hiring' | 'closed') => {
    setError('')
    startTransition(async () => {
      const res = await updateJobStatus(jobId, newStatus)
      if (res.error) setError(res.error)
      else setStatus(newStatus)
    })
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {status !== 'open' && (
          <button
            onClick={() => handle('open')}
            disabled={isPending}
            className="inline-flex items-center gap-1.5 bg-green-50 hover:bg-green-100 border border-green-200 text-green-700 text-sm font-semibold px-4 py-2 rounded-xl transition-colors disabled:opacity-60"
          >
            {isPending ? <Loader2 size={13} className="animate-spin" /> : <RotateCcw size={13} />}
            Mark as Open
          </button>
        )}
        {status !== 'hiring' && (
          <button
            onClick={() => handle('hiring')}
            disabled={isPending}
            className="inline-flex items-center gap-1.5 bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-700 text-sm font-semibold px-4 py-2 rounded-xl transition-colors disabled:opacity-60"
          >
            {isPending ? <Loader2 size={13} className="animate-spin" /> : <UserCheck size={13} />}
            Hiring in Progress
          </button>
        )}
        {status !== 'closed' && (
          <button
            onClick={() => handle('closed')}
            disabled={isPending}
            className="inline-flex items-center gap-1.5 bg-red-50 hover:bg-red-100 border border-red-200 text-red-700 text-sm font-semibold px-4 py-2 rounded-xl transition-colors disabled:opacity-60"
          >
            {isPending ? <Loader2 size={13} className="animate-spin" /> : <XCircle size={13} />}
            Close / Inactive
          </button>
        )}
      </div>
      {status === 'closed' && (
        <p className="text-xs text-gray-400">This job is closed and hidden from the public board.</p>
      )}
      {error && <p className="text-red-500 text-xs">{error}</p>}
    </div>
  )
}
