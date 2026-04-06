'use client'

import { useActionState } from 'react'
import { subscribeNewsletter } from '@/app/actions/newsletter'

const initial = { success: false, message: '' }

export default function NewsletterForm() {
  const [state, action, pending] = useActionState(subscribeNewsletter, initial)

  if (state.success) {
    return (
      <div className="flex items-center gap-2 bg-green-500/30 border border-green-400/30 text-white rounded-xl px-5 py-3 text-sm font-medium w-full md:w-auto">
        ✅ {state.message}
      </div>
    )
  }

  return (
    <form action={action} className="flex flex-col w-full md:w-auto gap-2">
      <div className="flex gap-2">
        <input
          type="email"
          name="email"
          placeholder="Your email address"
          className="flex-1 md:w-64 px-4 py-3 rounded-xl text-gray-900 text-sm focus:outline-none"
          required
        />
        <button
          type="submit"
          disabled={pending}
          className="bg-yellow-400 hover:bg-yellow-300 text-green-900 font-bold px-5 py-3 rounded-xl transition-colors whitespace-nowrap text-sm disabled:opacity-60"
        >
          {pending ? '…' : 'Subscribe'}
        </button>
      </div>
      {state.message && (
        <p className="text-red-200 text-xs">{state.message}</p>
      )}
    </form>
  )
}
