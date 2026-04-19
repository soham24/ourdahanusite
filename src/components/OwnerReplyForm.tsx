'use client'

import { useState, useTransition } from 'react'
import { Loader2, MessageCircle, Send } from 'lucide-react'

import { replyToReview } from '@/app/actions/listings'

/**
 * Inline form shown to a listing owner beneath a review that has no
 * owner reply yet. Submits via the `replyToReview` server action and
 * collapses into a success message on completion.
 */
export default function OwnerReplyForm({
  reviewId,
  compact = false,
}: {
  reviewId: string
  compact?: boolean
}) {
  const [text, setText] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    const trimmed = text.trim()
    if (trimmed.length < 2) {
      setError('Please write a reply first.')
      return
    }

    const fd = new FormData()
    fd.set('reply', trimmed)

    startTransition(async () => {
      const result = await replyToReview(reviewId, fd)
      if (result?.error) {
        setError(result.error)
        return
      }
      setSuccess(trimmed)
      setText('')
    })
  }

  if (success) {
    return (
      <div
        className={`mt-3 rounded-xl border border-warli-terra/20 bg-warli-light/40 px-3 py-2 text-sm text-gray-800 ${
          compact ? '' : 'sm:px-4 sm:py-3'
        }`}
      >
        <div className="flex items-center gap-1.5 text-warli-terra font-semibold text-xs mb-1">
          <MessageCircle size={14} />
          <span>Your reply was posted</span>
        </div>
        <p className="whitespace-pre-wrap break-words text-gray-700">{success}</p>
        <p className="text-[11px] text-gray-500 mt-1">
          The reviewer and admins were notified.
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="mt-3 space-y-2">
      <label className="sr-only" htmlFor={`reply-${reviewId}`}>
        Reply to this review
      </label>
      <textarea
        id={`reply-${reviewId}`}
        name="reply"
        rows={compact ? 2 : 3}
        maxLength={1000}
        value={text}
        onChange={(e) => {
          setText(e.target.value)
          if (error) setError(null)
        }}
        placeholder="Write a thoughtful reply — this will be public on your listing."
        disabled={isPending}
        className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-warli-terra focus:outline-none focus:ring-2 focus:ring-warli-terra/20 disabled:opacity-60"
      />
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] text-gray-500">
          You can reply <strong>once</strong> per review.
        </p>
        <button
          type="submit"
          disabled={isPending || text.trim().length < 2}
          className="inline-flex items-center gap-1.5 rounded-xl bg-warli-terra px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-warli-terra/90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isPending ? (
            <>
              <Loader2 size={14} className="animate-spin" />
              Posting…
            </>
          ) : (
            <>
              <Send size={14} />
              Post reply
            </>
          )}
        </button>
      </div>
      {error && (
        <p className="text-xs text-red-600" role="alert">
          {error}
        </p>
      )}
    </form>
  )
}
