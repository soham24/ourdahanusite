'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

import { approveJobPost, rejectJobPost, removeJobPost } from '@/app/actions/admin-jobs'

export default function AdminJobActions({ postId, status }: { postId: string; status: string }) {
  const router = useRouter()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function run(action: () => Promise<{ ok: true } | { error: string }>) {
    setPending(true)
    setError(null)
    try {
      const result = await action()
      if ('error' in result) {
        setError(result.error)
        return
      }
      router.refresh()
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setPending(false)
    }
  }

  function reject() {
    const reason = window.prompt('Why is this post not approved? The poster will see this.')
    if (reason === null) return
    void run(() => rejectJobPost(postId, reason))
  }

  function remove() {
    if (!window.confirm('Remove this post from the board? The poster cannot restore it.')) return
    void run(() => removeJobPost(postId))
  }

  const canApprove = status === 'pending' || status === 'rejected'
  const canReject = status === 'pending' || status === 'approved'
  const canRemove = status !== 'removed'

  return (
    <div className="mt-3 flex items-center gap-2">
      {canApprove && (
        <button
          type="button"
          disabled={pending}
          onClick={() => void run(() => approveJobPost(postId))}
          className="rounded bg-green-600 px-3 py-1 text-xs font-semibold text-white disabled:opacity-60"
        >
          Approve
        </button>
      )}
      {canReject && (
        <button
          type="button"
          disabled={pending}
          onClick={reject}
          className="rounded bg-red-600 px-3 py-1 text-xs font-semibold text-white disabled:opacity-60"
        >
          Reject
        </button>
      )}
      {canRemove && (
        <button
          type="button"
          disabled={pending}
          onClick={remove}
          className="ml-auto rounded border border-red-300 px-3 py-1 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-60"
        >
          Remove
        </button>
      )}
      {error && <span className="text-xs text-red-700">{error}</span>}
    </div>
  )
}
