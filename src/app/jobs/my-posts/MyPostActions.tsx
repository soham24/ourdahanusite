'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { CheckCircle2, Pencil, RefreshCw } from 'lucide-react'

import { closeJobPost, renewJobPost } from '@/app/actions/jobs'
import { safelySubmit } from '@/lib/find/safe-submission'

export default function MyPostActions({
  postId,
  kind,
  canRenew,
  canClose,
  canEdit,
}: {
  postId: string
  kind: 'hiring' | 'seeking'
  canRenew: boolean
  canClose: boolean
  canEdit: boolean
}) {
  const router = useRouter()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function run(action: () => Promise<{ ok: true } | { error: string }>) {
    setPending(true)
    setError(null)
    const result = await safelySubmit(action)
    setPending(false)
    if ('error' in result) {
      setError(result.error)
      return
    }
    router.refresh()
  }

  function close() {
    const question =
      kind === 'hiring'
        ? 'Mark this job as filled? It comes off the board and cannot be reopened.'
        : 'Mark that you found work? Your profile comes off the board.'
    if (window.confirm(question)) void run(() => closeJobPost(postId))
  }

  if (!canRenew && !canClose && !canEdit) return null

  return (
    <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-[var(--od-border)] pt-3">
      {canRenew && (
        <button
          type="button"
          disabled={pending}
          onClick={() => void run(() => renewJobPost(postId))}
          className="od-button-primary px-3.5 py-1.5 text-sm disabled:opacity-60"
        >
          <RefreshCw size={14} aria-hidden /> Renew for 30 days
        </button>
      )}
      {canEdit && (
        <Link href={`/jobs/my-posts/${postId}/edit`} className="od-button-secondary px-3.5 py-1.5 text-sm">
          <Pencil size={14} aria-hidden /> Edit
        </Link>
      )}
      {canClose && (
        <button
          type="button"
          disabled={pending}
          onClick={close}
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-sm font-semibold text-[var(--od-muted)] transition-colors hover:text-[var(--od-brand-strong)] disabled:opacity-60"
        >
          <CheckCircle2 size={14} aria-hidden /> {kind === 'hiring' ? 'Mark filled' : 'Found work'}
        </button>
      )}
      {error && (
        <p role="alert" className="w-full text-sm font-semibold text-[var(--od-danger)]">
          {error}
        </p>
      )}
    </div>
  )
}
