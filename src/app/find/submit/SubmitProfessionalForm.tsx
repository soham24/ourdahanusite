'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2, MessageCircle } from 'lucide-react'
import { PROFESSIONS } from '@/lib/find/professions'
import { submitProfessional } from '@/app/actions/find'
import { chipBase, chipOff, chipOn } from '../find-ui'

const labelCls = 'mb-1 block text-[13px] font-bold text-[var(--od-ink-2)]'
const inputCls = 'od-input h-11 w-full px-3.5 text-[15px] disabled:opacity-60'

export default function SubmitProfessionalForm() {
  const router = useRouter()
  const [professions, setProfessions] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const [pending, setPending] = useState(false)

  function toggle(p: string) {
    setProfessions((cur) => (cur.includes(p) ? cur.filter((x) => x !== p) : [...cur, p]))
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setPending(true)
    const fd = new FormData(e.currentTarget)
    const res = await submitProfessional({
      name: String(fd.get('name') || ''),
      phone: String(fd.get('phone') || ''),
      whatsapp: fd.get('whatsapp') === 'on',
      professions,
      professionOther: String(fd.get('professionOther') || ''),
      locality: String(fd.get('locality') || ''),
      note: String(fd.get('note') || ''),
    })
    setPending(false)
    if (res.error) {
      setError(res.error)
      return
    }
    setDone(true)
  }

  if (done) {
    return (
      <div className="od-card flex flex-col items-center px-6 py-10 text-center">
        <CheckCircle2 size={32} className="text-[var(--od-success)]" aria-hidden />
        <h2 className="mt-3 font-display text-2xl">Submitted for review</h2>
        <p className="mt-1 max-w-sm text-sm leading-relaxed text-[var(--od-muted)]">
          A moderator will check the details. Once approved, the listing appears in the
          directory.
        </p>
        <button
          onClick={() => router.push('/find')}
          className="od-button-primary mt-5 px-5 py-2 text-sm"
        >
          Back to directory
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={onSubmit} className="od-card space-y-4 p-5">
      <p role="alert" aria-live="assertive">
        {error && (
          <span className="block rounded-[12px] border border-[rgba(180,35,24,0.25)] bg-[rgba(180,35,24,0.06)] px-3 py-2 text-sm font-semibold text-[var(--od-danger)]">
            {error}
          </span>
        )}
      </p>

      <label className="block">
        <span className={labelCls}>
          Full name <span className="text-[var(--od-brand)]">*</span>
        </span>
        <input name="name" required disabled={pending} autoComplete="name" className={inputCls} />
      </label>

      <label className="block">
        <span className={labelCls}>
          Phone number <span className="text-[var(--od-brand)]">*</span>
        </span>
        <input
          name="phone"
          type="tel"
          inputMode="tel"
          required
          disabled={pending}
          autoComplete="tel"
          placeholder="e.g. 98765 43210"
          className={inputCls}
        />
      </label>

      <label className="flex items-center gap-2.5 rounded-[12px] border border-[var(--od-border)] bg-[var(--color-surface-2)] px-3.5 py-3 text-sm text-[var(--od-ink-2)]">
        <input type="checkbox" name="whatsapp" disabled={pending} className="h-4 w-4 accent-[var(--od-brand)]" />
        <MessageCircle size={15} className="text-[var(--od-success)]" aria-hidden />
        This number is on WhatsApp
      </label>

      <fieldset>
        <legend className={labelCls}>
          Professions <span className="text-[var(--od-brand)]">*</span>{' '}
          <span className="font-normal text-[var(--od-muted)]">(pick one or more)</span>
        </legend>
        <div className="flex flex-wrap gap-2">
          {PROFESSIONS.map((p) => {
            const on = professions.includes(p)
            return (
              <button
                key={p}
                type="button"
                aria-pressed={on}
                disabled={pending}
                onClick={() => toggle(p)}
                className={`${chipBase} disabled:opacity-60 ${on ? chipOn : chipOff}`}
              >
                {p}
              </button>
            )
          })}
        </div>
      </fieldset>

      {professions.includes('Other') && (
        <label className="block">
          <span className={labelCls}>
            Describe the profession <span className="text-[var(--od-brand)]">*</span>
          </span>
          <input name="professionOther" required disabled={pending} className={inputCls} />
        </label>
      )}

      <label className="block">
        <span className={labelCls}>Area / locality in Dahanu</span>
        <input
          name="locality"
          disabled={pending}
          placeholder="e.g. Dahanu West, Malyan"
          className={inputCls}
        />
      </label>

      <label className="block">
        <span className={labelCls}>Short note</span>
        <textarea
          name="note"
          rows={3}
          disabled={pending}
          placeholder="What kind of work do they do well?"
          className="od-input w-full px-3.5 py-2.5 text-[15px] disabled:opacity-60"
        />
      </label>

      <button
        disabled={pending}
        className="od-button-primary h-11 w-full text-[15px] active:scale-[0.99] disabled:opacity-60"
      >
        {pending ? 'Submitting…' : 'Submit for review'}
      </button>
    </form>
  )
}
