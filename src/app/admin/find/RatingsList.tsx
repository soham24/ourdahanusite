'use client'

import { useState } from 'react'
import { Star } from 'lucide-react'
import RatingModerationButtons from './RatingModerationButtons'

export interface AdminPendingRating {
  id: string
  user_id: string
  rating: number
  comment: string
  created_at: string
  find_professionals: { name: string } | null
}

export default function RatingsList({
  initialRows,
  nameById,
}: {
  initialRows: AdminPendingRating[]
  nameById: Record<string, string>
}) {
  const [rows, setRows] = useState(initialRows)

  // Take fresh rows from the server after a refresh, adjusting state during
  // render rather than in an effect.
  const [syncedRows, setSyncedRows] = useState(initialRows)
  if (initialRows !== syncedRows) {
    setSyncedRows(initialRows)
    setRows(initialRows)
  }

  if (rows.length === 0) {
    return <p className="text-sm text-gray-500">No pending ratings.</p>
  }

  return (
    <ul className="space-y-3">
      {rows.map((r) => (
        <li key={r.id} className="rounded-lg border border-gray-200 bg-white p-4">
          <div className="flex items-center justify-between">
            <span className="font-semibold">{r.find_professionals?.name ?? 'Unknown'}</span>
            <span className="flex items-center gap-0.5">
              {[1, 2, 3, 4, 5].map((n) => (
                <Star key={n} size={13} className={n <= r.rating ? 'text-amber-400 fill-amber-400' : 'text-gray-200 fill-gray-200'} />
              ))}
            </span>
          </div>
          <p className="text-xs text-gray-500">by {nameById[r.user_id] ?? 'Unknown user'}</p>
          <p className="mt-2 text-sm text-gray-700">{r.comment}</p>
          <RatingModerationButtons
            ratingId={r.id}
            onActed={() => setRows((cur) => cur.filter((x) => x.id !== r.id))}
          />
        </li>
      ))}
    </ul>
  )
}
