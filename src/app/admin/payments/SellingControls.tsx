'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'

import { resumeListingSelling, suspendListingSelling } from '@/app/actions/listing-payments'

export default function SellingControls({
  listingId,
  suspended,
}: {
  listingId: string
  suspended: boolean
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function run(action: () => Promise<{ error?: string }>) {
    setError(null)
    startTransition(async () => {
      const result = await action()
      if (result.error) {
        setError(result.error)
        return
      }
      setOpen(false)
      setReason('')
      router.refresh()
    })
  }

  const errorLine = error && (
    <p role="alert" className="mt-2 text-xs font-semibold text-[var(--od-danger)]">
      {error}
    </p>
  )

  if (suspended) {
    return (
      <div>
        <button
          type="button"
          onClick={() => run(() => resumeListingSelling(listingId))}
          disabled={pending}
          className="od-button-secondary px-3 py-2 text-sm disabled:opacity-60"
        >
          {pending && <Loader2 size={14} className="animate-spin" aria-hidden />}
          Lift suspension
        </button>
        {errorLine}
      </div>
    )
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center justify-center rounded-xl px-3 py-2 text-sm font-semibold text-[var(--od-muted)] transition-colors hover:text-[var(--od-danger)]"
      >
        Suspend selling
      </button>
    )
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        run(() => suspendListingSelling(listingId, reason))
      }}
      className="w-full space-y-2 sm:w-80"
    >
      <label className="block">
        <span className="mb-1 block text-[12px] font-bold text-[var(--od-ink-2)]">Reason the owner will see</span>
        <input
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          maxLength={300}
          required
          disabled={pending}
          className="od-input h-10 w-full px-3 text-sm"
        />
      </label>
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pending || !reason.trim()}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--od-danger)] px-3 py-2 text-sm font-bold text-white transition-opacity disabled:opacity-60"
        >
          {pending && <Loader2 size={14} className="animate-spin" aria-hidden />}
          Suspend
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          disabled={pending}
          className="od-button-secondary px-3 py-2 text-sm"
        >
          Cancel
        </button>
      </div>
      {errorLine}
    </form>
  )
}
