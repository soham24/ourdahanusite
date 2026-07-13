'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { PROFESSIONS, professionMarathi } from '@/lib/find/professions'
import { updateProfessional, setProfessionalStatus, deleteProfessional, type AdminProfessionalFields } from '@/app/actions/admin-find'
import type { FindProfessional } from '@/lib/find/types'

export default function EditProfessionalForm({ pro }: { pro: FindProfessional }) {
  const router = useRouter()
  const [professions, setProfessions] = useState<string[]>(pro.professions ?? [])
  const [error, setError] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function remove() {
    if (!window.confirm(`Permanently delete "${pro.name}" and all their ratings? This cannot be undone.`)) return
    setError(null); setMsg(null); setPending(true)
    const res = await deleteProfessional(pro.id)
    setPending(false)
    if (res.error) { setError(res.error); return }
    router.refresh()
  }

  function toggle(p: string) {
    setProfessions((cur) => cur.includes(p) ? cur.filter((x) => x !== p) : [...cur, p])
  }

  function fields(fd: FormData): AdminProfessionalFields {
    return {
      name: String(fd.get('name') || ''),
      phone: String(fd.get('phone') || ''),
      whatsapp: fd.get('whatsapp') === 'on',
      professions,
      professionOther: String(fd.get('professionOther') || ''),
      locality: String(fd.get('locality') || ''),
      note: String(fd.get('note') || ''),
    }
  }

  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null); setMsg(null); setPending(true)
    const res = await updateProfessional(pro.id, fields(new FormData(e.currentTarget)))
    setPending(false)
    if (res.error) setError(res.error); else setMsg('Saved.')
  }

  async function saveAndApprove(formEl: HTMLFormElement) {
    setError(null); setMsg(null); setPending(true)
    const upd = await updateProfessional(pro.id, fields(new FormData(formEl)))
    if (upd.error) { setPending(false); setError(upd.error); return }
    const res = await setProfessionalStatus(pro.id, 'approved')
    setPending(false)
    if (res.error) setError(res.error); else setMsg('Approved and live.')
  }

  const cls = 'w-full rounded border border-gray-300 px-2 py-1 text-sm'
  return (
    <form onSubmit={save} className="space-y-2 rounded-lg border border-gray-200 bg-white p-3">
      {error && <p className="rounded bg-red-50 px-2 py-1 text-xs text-red-700">{error}</p>}
      {msg && <p className="rounded bg-green-50 px-2 py-1 text-xs text-green-700">{msg}</p>}
      <div className="grid grid-cols-2 gap-2">
        <input name="name" defaultValue={pro.name} placeholder="Name" className={cls} />
        <input name="phone" defaultValue={pro.phone} placeholder="Phone" className={cls} />
        <input name="locality" defaultValue={pro.locality ?? ''} placeholder="Locality" className={cls} />
        <label className="flex items-center gap-2 text-xs">
          <input type="checkbox" name="whatsapp" defaultChecked={pro.whatsapp} /> WhatsApp
        </label>
      </div>
      <fieldset className="rounded border border-gray-300 p-2">
        <legend className="px-1 text-xs font-medium">Professions * (pick one or more)</legend>
        <div className="grid grid-cols-2 gap-1">
          {PROFESSIONS.map((p) => (
            <label key={p} className="flex items-center gap-2 text-xs">
              <input type="checkbox" checked={professions.includes(p)} onChange={() => toggle(p)} />
              {p}{' '}
              <span lang="mr" className="font-[family-name:var(--font-devanagari)] text-gray-500">
                {professionMarathi(p)}
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      {professions.includes('Other') && (
        <input name="professionOther" defaultValue={pro.profession_other ?? ''} placeholder="Other profession" className={cls} />
      )}
      <textarea name="note" defaultValue={pro.note ?? ''} placeholder="Note" rows={2} className={cls} />
      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={pending} className="rounded bg-gray-800 px-3 py-1 text-xs font-semibold text-white disabled:opacity-60">Save changes</button>
        {pro.status !== 'approved' && (
          <button type="button" disabled={pending}
            onClick={(e) => saveAndApprove(e.currentTarget.closest('form') as HTMLFormElement)}
            className="rounded bg-green-600 px-3 py-1 text-xs font-semibold text-white disabled:opacity-60">
            Save &amp; take live
          </button>
        )}
        {pro.status !== 'rejected' && (
          <button type="button" disabled={pending}
            onClick={async () => { setPending(true); const r = await setProfessionalStatus(pro.id, 'rejected'); setPending(false); if (r.error) setError(r.error); else setMsg('Rejected.') }}
            className="rounded bg-red-600 px-3 py-1 text-xs font-semibold text-white disabled:opacity-60">
            Reject
          </button>
        )}
        <button type="button" disabled={pending} onClick={remove}
          className="ml-auto rounded border border-red-300 px-3 py-1 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-60">
          Delete
        </button>
      </div>
    </form>
  )
}
