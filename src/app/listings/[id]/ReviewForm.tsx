'use client'

import { useFormStatus } from 'react-dom'
import { useRouter } from 'next/navigation'
import { useRef, useState, useTransition } from 'react'
import { submitReview } from '@/app/actions/listings'

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className="flex items-center gap-2 bg-brand hover:bg-brand-strong disabled:opacity-70 disabled:cursor-not-allowed text-bg font-semibold px-6 py-2.5 rounded-xl transition-colors text-sm"
    >
      {pending ? (
        <>
          <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z" />
          </svg>
          Submitting…
        </>
      ) : (
        'Submit Review'
      )}
    </button>
  )
}

export default function ReviewForm({
  listingId,
  userName,
}: {
  listingId: string
  userName: string | null
}) {
  const router = useRouter()
  const formRef = useRef<HTMLFormElement>(null)
  const [, startTransition] = useTransition()
  const [error, setError] = useState('')

  async function handleAction(formData: FormData) {
    setError('')
    const result = await submitReview(formData)
    if (result.error) {
      setError(result.error)
      return
    }
    // Force page refresh so new review + updated rating shows immediately
    startTransition(() => {
      router.refresh()
    })
    formRef.current?.reset()
  }

  return (
    <form ref={formRef} action={handleAction} className="space-y-4">
      <input type="hidden" name="listing_id" value={listingId} />

      {userName && (
        <div className="flex items-center gap-2 text-sm text-gray-500 bg-surface-soft/60 px-3 py-2 rounded-xl border border-border/50">
          <div className="w-6 h-6 bg-brand text-bg rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">
            {userName.slice(0, 1).toUpperCase()}
          </div>
          <span>Reviewing as <span className="font-semibold text-gray-700">{userName}</span></span>
        </div>
      )}

      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-1.5">
          Rating <span className="text-red-500">*</span>
        </label>
        <select
          name="rating"
          required
          className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-brand text-sm bg-white"
        >
          <option value="">Select rating</option>
          <option value="5">⭐⭐⭐⭐⭐ — Excellent</option>
          <option value="4">⭐⭐⭐⭐ — Good</option>
          <option value="3">⭐⭐⭐ — Average</option>
          <option value="2">⭐⭐ — Poor</option>
          <option value="1">⭐ — Very Poor</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-1.5">Your Review</label>
        <textarea
          name="comment"
          rows={3}
          maxLength={500}
          placeholder="Share what was good, what stood out, or what others should know..."
          className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-brand text-sm resize-none"
        />
        <p className="mt-1 text-xs text-gray-400">Optional. Keep it genuine and useful for other locals.</p>
      </div>

      {error && (
        <p role="alert" className="text-sm text-red-700">{error}</p>
      )}
      <SubmitButton />
    </form>
  )
}
