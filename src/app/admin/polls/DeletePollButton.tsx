'use client'

import { useActionState } from 'react'
import { Trash2 } from 'lucide-react'
import { deletePoll } from '@/app/actions/polls'

export default function DeletePollButton({ pollId }: { pollId: string }) {
  const [state, action, isPending] = useActionState(deletePoll.bind(null, pollId), {})

  return (
    <form action={action}>
      <button
        type="submit"
        disabled={isPending}
        className="text-gray-400 hover:text-red-600 transition-colors p-2 rounded-lg hover:bg-red-50 disabled:opacity-50"
        title="End poll"
      >
        <Trash2 size={15} />
      </button>
      {state.error && (
        <p className="text-xs text-red-500 mt-1">{state.error}</p>
      )}
    </form>
  )
}
