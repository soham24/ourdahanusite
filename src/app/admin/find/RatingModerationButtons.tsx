'use client'

import { useState } from 'react'
import { setRatingStatus } from '@/app/actions/admin-find'

export default function RatingModerationButtons({ ratingId }: { ratingId: string }) {
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function act(status: 'approved' | 'rejected') {
    setPending(true); setError(null)
    const res = await setRatingStatus(ratingId, status)
    setPending(false)
    if (res.error) setError(res.error)
  }

  return (
    <div className="mt-3 flex items-center gap-2">
      <button disabled={pending} onClick={() => act('approved')} className="rounded bg-green-600 px-3 py-1 text-xs font-semibold text-white disabled:opacity-60">Approve</button>
      <button disabled={pending} onClick={() => act('rejected')} className="rounded bg-red-600 px-3 py-1 text-xs font-semibold text-white disabled:opacity-60">Reject</button>
      {error && <span className="text-xs text-red-700">{error}</span>}
    </div>
  )
}
