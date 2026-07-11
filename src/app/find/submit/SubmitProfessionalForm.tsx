'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { PROFESSIONS } from '@/lib/find/professions'
import { submitProfessional } from '@/app/actions/find'

export default function SubmitProfessionalForm() {
  const router = useRouter()
  const [profession, setProfession] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const [pending, setPending] = useState(false)

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setPending(true)
    const fd = new FormData(e.currentTarget)
    const res = await submitProfessional({
      name: String(fd.get('name') || ''),
      phone: String(fd.get('phone') || ''),
      whatsapp: fd.get('whatsapp') === 'on',
      profession: String(fd.get('profession') || ''),
      professionOther: String(fd.get('professionOther') || ''),
      locality: String(fd.get('locality') || ''),
      note: String(fd.get('note') || ''),
    })
    setPending(false)
    if (res.error) { setError(res.error); return }
    setDone(true)
  }

  if (done) {
    return (
      <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-800">
        Thanks! Your submission will appear once a moderator approves it.
        <button onClick={() => router.push('/find')} className="ml-2 underline">Back to directory</button>
      </div>
    )
  }

  const inputCls = 'w-full rounded-md border border-gray-300 px-3 py-2 text-sm'
  return (
    <form onSubmit={onSubmit} className="space-y-3">
      {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      <input name="name" placeholder="Full name *" className={inputCls} required />
      <input name="phone" placeholder="Phone number *" className={inputCls} required />
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="whatsapp" /> This number is on WhatsApp
      </label>
      <select name="profession" value={profession} onChange={(e) => setProfession(e.target.value)} className={inputCls} required>
        <option value="">Select profession *</option>
        {PROFESSIONS.map((p) => <option key={p} value={p}>{p}</option>)}
      </select>
      {profession === 'Other' && (
        <input name="professionOther" placeholder="Describe the profession *" className={inputCls} />
      )}
      <input name="locality" placeholder="Area / locality in Dahanu" className={inputCls} />
      <textarea name="note" placeholder="Short note (optional)" rows={3} className={inputCls} />
      <button disabled={pending} className="rounded-md bg-[var(--od-brand,#c0582e)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
        {pending ? 'Submitting…' : 'Submit for review'}
      </button>
    </form>
  )
}
