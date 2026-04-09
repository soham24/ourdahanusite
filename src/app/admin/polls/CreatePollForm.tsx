'use client'

import { useActionState, useRef, useEffect } from 'react'
import { Plus } from 'lucide-react'
import { createPoll } from '@/app/actions/polls'

export default function CreatePollForm() {
  const [state, action, isPending] = useActionState(createPoll, {})
  const formRef = useRef<HTMLFormElement>(null)

  // Only reset the form on success
  useEffect(() => {
    if (state.success && formRef.current) {
      formRef.current.reset()
    }
  }, [state.success])

  return (
    <form ref={formRef} action={action} className="bg-white rounded-2xl border border-gray-100 p-6 space-y-5">
      {state.error && (
        <div className="text-sm text-red-700 bg-red-50 border border-red-100 rounded-xl px-4 py-3">
          {state.error}
        </div>
      )}
      {state.success && (
        <div className="text-sm text-green-700 bg-green-50 border border-green-100 rounded-xl px-4 py-3">
          Poll created successfully!
        </div>
      )}

      <div>
        <label htmlFor="title" className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">
          Question
        </label>
        <input
          type="text"
          id="title"
          name="title"
          required
          defaultValue={state.fields?.title ?? ''}
          placeholder="What should be the next community event?"
          className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:border-warli-terra focus:ring-1 focus:ring-warli-terra/30 outline-none transition"
        />
      </div>

      <div>
        <label htmlFor="options" className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">
          Options (one per line)
        </label>
        <textarea
          id="options"
          name="options"
          required
          rows={5}
          defaultValue={state.fields?.options ?? ''}
          placeholder={"Beach cleanup drive\nFood festival\nTree plantation\nCricket tournament"}
          className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:border-warli-terra focus:ring-1 focus:ring-warli-terra/30 outline-none transition resize-none"
        />
        <p className="text-xs text-gray-400 mt-1">2-10 options. One per line.</p>
      </div>

      <div>
        <label htmlFor="ends_at" className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">
          End Time
        </label>
        <input
          type="datetime-local"
          id="ends_at"
          name="ends_at"
          required
          defaultValue={state.fields?.ends_at ?? ''}
          className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:border-warli-terra focus:ring-1 focus:ring-warli-terra/30 outline-none transition"
        />
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="w-full flex items-center justify-center gap-2 bg-warli-terra hover:bg-warli-deep text-warli-cream font-bold px-5 py-3 rounded-xl transition-colors text-sm disabled:opacity-60"
      >
        <Plus size={16} /> {isPending ? 'Creating…' : 'Create Poll'}
      </button>
    </form>
  )
}
