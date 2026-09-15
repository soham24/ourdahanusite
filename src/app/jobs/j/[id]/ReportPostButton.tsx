'use client'

import { useState } from 'react'
import { Flag } from 'lucide-react'

import { reportJobPost } from '@/app/actions/jobs'

const REASONS: Array<{ value: string; label: string }> = [
  { value: 'asks_for_money', label: 'Asks for money' },
  { value: 'fake', label: 'Fake or misleading' },
  { value: 'filled', label: 'Already filled' },
  { value: 'offensive', label: 'Offensive' },
  { value: 'my_number', label: 'This is my number — remove it' },
  { value: 'other', label: 'Something else' },
]

export default function ReportPostButton({ postId }: { postId: string }) {
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [note, setNote] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPending(true)
    setError(null)
    try {
      const result = await reportJobPost(postId, reason, note.trim() || null)
      if ('loginUrl' in result) {
        window.location.href = result.loginUrl
        return
      }
      if ('error' in result) {
        setError(result.error)
        return
      }
      setDone(true)
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setPending(false)
    }
  }

  if (done) {
    return (
      <p role="status" className="text-sm text-[var(--od-muted)]">
        Thanks — a moderator will look at this post.
      </p>
    )
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-[var(--od-muted)] transition-colors hover:text-[var(--od-danger)]"
      >
        <Flag size={13} aria-hidden /> Report this post
      </button>
    )
  }

  return (
    <form onSubmit={submit} className="od-card w-full space-y-3 p-4">
      <fieldset>
        <legend className="mb-2 text-[13px] font-bold text-[var(--od-ink-2)]">Why are you reporting this post?</legend>
        <div className="space-y-1.5">
          {REASONS.map((option) => (
            <label key={option.value} className="flex items-center gap-2 text-sm text-[var(--od-ink-2)]">
              <input
                type="radio"
                name="reason"
                value={option.value}
                checked={reason === option.value}
                onChange={() => setReason(option.value)}
                className="accent-[var(--od-brand)]"
              />
              {option.label}
            </label>
          ))}
        </div>
      </fieldset>
      <label className="block">
        <span className="mb-1 block text-[13px] font-bold text-[var(--od-ink-2)]">Anything else? (optional)</span>
        <textarea
          value={note}
          onChange={(event) => setNote(event.target.value)}
          rows={2}
          maxLength={500}
          className="od-input w-full px-3.5 py-2.5 text-[15px]"
        />
      </label>
      {error && (
        <p role="alert" className="text-sm font-semibold text-[var(--od-danger)]">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <button disabled={pending || !reason} className="od-button-primary px-4 py-2 text-sm disabled:opacity-60">
          {pending ? 'Sending…' : 'Send report'}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="od-button-secondary px-4 py-2 text-sm">
          Cancel
        </button>
      </div>
    </form>
  )
}
