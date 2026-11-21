'use client'

import { useActionState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Plus, Save } from 'lucide-react'
import { saveCompetition } from '@/app/actions/admin-competitions'

export type CompetitionFormValues = {
  id?: string
  day: string
  title: string
  prize: string
  code: string
  active: boolean
}

const inputClass =
  'w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:border-brand focus:ring-1 focus:ring-brand/30 outline-none transition'
const labelClass = 'block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5'

export default function CompetitionForm({ initial }: { initial: CompetitionFormValues }) {
  const [state, action, isPending] = useActionState(saveCompetition, {})
  const formRef = useRef<HTMLFormElement>(null)
  const router = useRouter()
  const editing = Boolean(initial.id)

  useEffect(() => {
    if (!state.success) return
    if (editing) {
      router.replace('/admin/competitions')
    } else {
      formRef.current?.reset()
    }
  }, [state, editing, router])

  const values = state.fields ?? initial

  return (
    <form
      ref={formRef}
      action={action}
      className="bg-white rounded-2xl border border-gray-100 p-6 space-y-5"
    >
      {initial.id && <input type="hidden" name="id" value={initial.id} />}

      {state.error && (
        <div className="text-sm text-red-700 bg-red-50 border border-red-100 rounded-xl px-4 py-3">
          {state.error}
        </div>
      )}
      {state.success && !editing && (
        <div className="text-sm text-green-700 bg-green-50 border border-green-100 rounded-xl px-4 py-3">
          Competition saved.
        </div>
      )}

      <div>
        <label htmlFor="day" className={labelClass}>Date</label>
        <input
          type="date"
          id="day"
          name="day"
          required
          defaultValue={values.day}
          className={inputClass}
        />
      </div>

      <div>
        <label htmlFor="title" className={labelClass}>Title</label>
        <input
          type="text"
          id="title"
          name="title"
          required
          maxLength={80}
          defaultValue={values.title}
          placeholder="Sunday Chikoo Challenge"
          className={inputClass}
        />
      </div>

      <div>
        <label htmlFor="prize" className={labelClass}>Prize</label>
        <input
          type="text"
          id="prize"
          name="prize"
          required
          maxLength={200}
          defaultValue={values.prize}
          placeholder="A box of fresh chikoos"
          className={inputClass}
        />
      </div>

      <div>
        <label htmlFor="code" className={labelClass}>Code</label>
        <input
          type="text"
          id="code"
          name="code"
          required
          maxLength={24}
          autoCapitalize="characters"
          autoComplete="off"
          spellCheck={false}
          defaultValue={values.code}
          placeholder="CHIKOO21"
          className={`${inputClass} font-mono uppercase`}
        />
        <p className="text-xs text-gray-400 mt-1">3 to 24 letters or digits. Share it with players.</p>
      </div>

      <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
        <input
          type="checkbox"
          name="active"
          defaultChecked={values.active}
          className="h-4 w-4 rounded border-gray-300 accent-[var(--od-brand)]"
        />
        Active
      </label>

      <div className="flex flex-col gap-2">
        <button
          type="submit"
          disabled={isPending}
          className="w-full flex items-center justify-center gap-2 bg-brand hover:bg-brand-strong text-bg font-bold px-5 py-3 rounded-xl transition-colors text-sm disabled:opacity-60"
        >
          {editing ? <Save size={16} /> : <Plus size={16} />}
          {isPending ? 'Saving…' : editing ? 'Save changes' : 'Create competition'}
        </button>
        {editing && (
          <Link
            href="/admin/competitions"
            className="text-center text-sm font-medium text-gray-500 hover:text-gray-900"
          >
            Cancel editing
          </Link>
        )}
      </div>
    </form>
  )
}
