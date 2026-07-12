'use client'

import { useState } from 'react'
import { CheckCircle2, Star } from 'lucide-react'
import { submitRating } from '@/app/actions/find'

const RATING_WORDS = ['', 'Poor', 'Okay', 'Good', 'Very good', 'Excellent']

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
    if (rating < 1) {
      setError('Please choose a star rating.')
      return
    }
    setPending(true)
    const fd = new FormData(e.currentTarget)
    const res = await submitRating({
      professionalId,
      rating,
      comment: String(fd.get('comment') || ''),
      usedService: used,
    })
    setPending(false)
    if (res.error) {
      setError(res.error)
      return
    }
    setDone(true)
  }

  if (done) {
    return (
      <div className="od-card flex items-start gap-3 border-[rgba(19,138,75,0.35)] bg-[rgba(19,138,75,0.05)] p-5">
        <CheckCircle2 size={20} className="mt-0.5 shrink-0 text-[var(--od-success)]" aria-hidden />
        <div>
          <p className="font-bold text-[var(--od-success)]">Rating submitted</p>
          <p className="mt-0.5 text-sm text-[var(--od-ink-2)]">
            A moderator will check it shortly — it appears here once approved.
          </p>
        </div>
      </div>
    )
  }

  const shown = hover || rating

  return (
    <form onSubmit={onSubmit} className="od-card p-5">
      <h3 className="font-display text-xl">
        {alreadyRated ? 'Update your rating' : 'Rate this professional'}
      </h3>
      {alreadyRated && (
        <p className="mt-1 text-xs text-[var(--od-muted)]">
          You already rated this professional. Submitting again replaces your rating and returns
          it to review.
        </p>
      )}
      <p role="alert" aria-live="assertive">
        {error && (
          <span className="mt-3 block rounded-[12px] border border-[rgba(180,35,24,0.25)] bg-[rgba(180,35,24,0.06)] px-3 py-2 text-sm font-semibold text-[var(--od-danger)]">
            {error}
          </span>
        )}
      </p>

      <span id="rating-label" className="mt-3 block text-[13px] font-bold text-[var(--od-ink-2)]">
        Your rating <span className="text-[var(--od-brand)]">*</span>
      </span>
      <div role="radiogroup" aria-labelledby="rating-label" className="mt-1 flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            type="button"
            key={n}
            role="radio"
            aria-checked={rating === n}
            disabled={pending}
            onClick={() => setRating(n)}
            onMouseEnter={() => setHover(n)}
            onMouseLeave={() => setHover(0)}
            aria-label={`${n} star${n > 1 ? 's' : ''}${n === 1 ? ' — Poor' : ''}${n === 5 ? ' — Excellent' : ''}`}
            className="flex h-10 w-10 items-center justify-center rounded-xl transition-transform duration-100 hover:scale-110 active:scale-95 disabled:opacity-50"
          >
            <Star
              size={26}
              className={
                n <= shown
                  ? 'fill-[var(--od-gold)] text-[var(--od-gold)]'
                  : 'fill-[var(--color-gray-200)] text-[var(--color-gray-200)]'
              }
            />
          </button>
        ))}
        <span aria-live="polite" className="ml-2 text-sm font-bold text-[var(--od-ink-2)]">
          {shown > 0 ? RATING_WORDS[shown] : ''}
        </span>
      </div>

      <label className="mt-4 block">
        <span className="mb-1 block text-[13px] font-bold text-[var(--od-ink-2)]">
          Your experience <span className="text-[var(--od-brand)]">*</span>
        </span>
        <textarea
          name="comment"
          rows={3}
          required
          disabled={pending}
          placeholder="What work did they do for you? How did it go?"
          className="od-input w-full px-3.5 py-2.5 text-[15px] disabled:opacity-60"
        />
      </label>

      <label className="mt-3 flex items-start gap-2.5 rounded-[12px] border border-[var(--od-border)] bg-[var(--color-surface-2)] px-3.5 py-3 text-sm text-[var(--od-ink-2)]">
        <input
          type="checkbox"
          checked={used}
          disabled={pending}
          onChange={(e) => setUsed(e.target.checked)}
          className="mt-0.5 h-4 w-4 accent-[var(--od-brand)]"
        />
        I confirm I have personally used this service.
      </label>

      <button
        disabled={pending}
        className="od-button-primary mt-4 h-11 w-full px-5 text-[15px] active:scale-[0.99] disabled:opacity-60 sm:w-auto"
      >
        {pending ? 'Submitting…' : 'Submit rating'}
      </button>
    </form>
  )
}
