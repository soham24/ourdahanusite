'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { PROFESSIONS, professionMarathi } from '@/lib/find/professions'
import { createProfessionalAsAdmin, type AdminProfessionalFields } from '@/app/actions/admin-find'
import BusinessPicker from './BusinessPicker'
import { siteConfig } from '@/lib/site'

export default function AddProfessionalForm({ onDone }: { onDone: () => void }) {
  const router = useRouter()
  const [professions, setProfessions] = useState<string[]>([])
  const [businessId, setBusinessId] = useState<string | null>(null)
  const [hasBusiness, setHasBusiness] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  function toggle(p: string) {
    setProfessions((cur) => cur.includes(p) ? cur.filter((x) => x !== p) : [...cur, p])
  }

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null); setMsg(null); setPending(true)
    const fd = new FormData(e.currentTarget)
    const fields: AdminProfessionalFields = {
      name: String(fd.get('name') || ''),
      phone: String(fd.get('phone') || ''),
      whatsapp: fd.get('whatsapp') === 'on',
      professions,
      professionOther: String(fd.get('professionOther') || ''),
      locality: String(fd.get('locality') || ''),
      note: String(fd.get('note') || ''),
      businessListingId: hasBusiness ? businessId : null,
    }
    const res = await createProfessionalAsAdmin(fields)
    setPending(false)
    if (res.error) { setError(res.error); return }
    setMsg('Added.')
    router.refresh()
    setTimeout(onDone, 600)
  }

  const cls = 'w-full rounded border border-gray-300 px-2 py-1 text-sm'
  return (
    <form onSubmit={submit} className="space-y-2 rounded-lg border border-gray-200 bg-gray-50 p-3">
      {error && <p className="rounded bg-red-50 px-2 py-1 text-xs text-red-700">{error}</p>}
      {msg && <p className="rounded bg-green-50 px-2 py-1 text-xs text-green-700">{msg}</p>}
      <div className="grid grid-cols-2 gap-2">
        <input name="name" placeholder="Name" className={cls} />
        <input name="phone" placeholder="Phone" className={cls} />
        <input name="locality" placeholder="Locality" className={cls} />
        <label className="flex items-center gap-2 text-xs">
          <input type="checkbox" name="whatsapp" /> WhatsApp
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
        <input name="professionOther" placeholder="Other profession" className={cls} />
      )}
      <div className="rounded border border-gray-300 p-2">
        <label className="flex items-center gap-2 text-xs font-medium">
          <input
            type="checkbox"
            checked={hasBusiness}
            onChange={(e) => { setHasBusiness(e.target.checked); if (!e.target.checked) setBusinessId(null) }}
          />
          Has an {siteConfig.name} business page (premium + verified)
        </label>
        {hasBusiness && (
          <div className="mt-2">
            <BusinessPicker value={businessId} onChange={(id) => setBusinessId(id)} />
          </div>
        )}
      </div>
      <textarea name="note" placeholder="Note" rows={2} className={cls} />
      <div className="flex gap-2">
        <button type="submit" disabled={pending} className="rounded bg-gray-800 px-3 py-1 text-xs font-semibold text-white disabled:opacity-60">
          Add professional
        </button>
        <button type="button" onClick={onDone} className="rounded border border-gray-300 px-3 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-50">
          Cancel
        </button>
      </div>
    </form>
  )
}
