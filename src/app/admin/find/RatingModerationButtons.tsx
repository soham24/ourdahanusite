'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { setRatingStatus, deleteRating } from '@/app/actions/admin-find'

export default function RatingModerationButtons({
  ratingId,
  onActed,
}: {
  ratingId: string
  onActed?: (status: 'approved' | 'rejected') => void
}) {
  const router = useRouter()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function act(status: 'approved' | 'rejected') {
    setPending(true); setError(null)
    const res = await setRatingStatus(ratingId, status)
    setPending(false)
    if (res.error) { setError(res.error); return }
    onActed?.(status)
  }

  async function remove() {
    if (!window.confirm('Permanently delete this rating? This cannot be undone.')) return
    setPending(true); setError(null)
    const res = await deleteRating(ratingId)
    setPending(false)
    if (res.error) { setError(res.error); return }
    router.refresh()
  }

  return (
    <div className="mt-3 flex items-center gap-2">
      <button disabled={pending} onClick={() => act('approved')} className="rounded bg-green-600 px-3 py-1 text-xs font-semibold text-white disabled:opacity-60">Approve</button>
      <button disabled={pending} onClick={() => act('rejected')} className="rounded bg-red-600 px-3 py-1 text-xs font-semibold text-white disabled:opacity-60">Reject</button>
      <button disabled={pending} onClick={remove} className="ml-auto rounded border border-red-300 px-3 py-1 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-60">Delete</button>
      {error && <span className="text-xs text-red-700">{error}</span>}
    </div>
  )
}
