'use client'

import { useState } from 'react'
import { Star } from 'lucide-react'
import { submitRating } from '@/app/actions/find'

export default function RatingForm({
  professionalId,
  alreadyRated,
}: {
  professionalId: string
  alreadyRated: boolean
}) {
  const [rating, setRating] = useState(0)
  const [hover, setHover] = useState(0)
  const [used, setUsed] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const [pending, setPending] = useState(false)

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setPending(true)
    const fd = new FormData(e.currentTarget)
    const res = await submitRating({
      professionalId,
      rating,
      comment: String(fd.get('comment') || ''),
      usedService: used,
    })
    setPending(false)
    if (res.error) { setError(res.error); return }
    setDone(true)
  }

  if (done) {
    return (
      <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-800">
        Thanks — your rating will appear once a moderator approves it.
      </div>
    )
  }

  return (
    <form onSubmit={onSubmit} className="rounded-lg border border-gray-200 bg-white p-4">
      <h3 className="font-bold">{alreadyRated ? 'Update your rating' : 'Rate this professional'}</h3>
      {alreadyRated && (
        <p className="mt-1 text-xs text-gray-500">You already rated this professional. Submitting again replaces your rating and returns it to review.</p>
      )}
      {error && <p className="mt-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      <div className="mt-3 flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button type="button" key={n} onClick={() => setRating(n)}
            onMouseEnter={() => setHover(n)} onMouseLeave={() => setHover(0)} aria-label={`${n} stars`}>
            <Star size={26} className={n <= (hover || rating) ? 'text-amber-400 fill-amber-400' : 'text-gray-300 fill-gray-200'} />
          </button>
        ))}
      </div>
      <textarea name="comment" rows={3} required placeholder="Describe your experience — you must have used this service."
        className="mt-3 w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
      <label className="mt-2 flex items-start gap-2 text-sm text-gray-700">
        <input type="checkbox" checked={used} onChange={(e) => setUsed(e.target.checked)} className="mt-0.5" />
        I confirm I have personally used this service.
      </label>
      <button disabled={pending} className="mt-3 rounded-md bg-[var(--od-brand,#c0582e)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
        {pending ? 'Submitting…' : 'Submit rating'}
      </button>
    </form>
  )
}
