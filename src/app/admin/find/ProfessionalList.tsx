'use client'

import { useEffect, useState } from 'react'
import type { FindProfessional } from '@/lib/find/types'
import { setProfessionalStatus } from '@/app/actions/admin-find'
import EditProfessionalForm from './EditProfessionalForm'

export interface AdminProfessionalRow extends FindProfessional {
  business: { name: string; subdomain: string | null } | null
}

function businessLabelOf(business: AdminProfessionalRow['business']): string | null {
  if (!business) return null
  return business.subdomain ? `${business.name} · ${business.subdomain}.ourdahanu.in` : business.name
}

export default function ProfessionalList({
  initialRows,
  nameById,
}: {
  initialRows: AdminProfessionalRow[]
  nameById: Record<string, string>
}) {
  const [rows, setRows] = useState(initialRows)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [errorById, setErrorById] = useState<Record<string, string>>({})

  useEffect(() => { setRows(initialRows) }, [initialRows])

  async function quickAction(id: string, status: 'approved' | 'rejected') {
    setPendingId(id)
    setErrorById((cur) => ({ ...cur, [id]: '' }))
    const res = await setProfessionalStatus(id, status)
    setPendingId(null)
    if (res.error) {
      setErrorById((cur) => ({ ...cur, [id]: res.error! }))
      return
    }
    setRows((cur) => cur.map((r) => (r.id === id ? { ...r, status } : r)))
  }

  if (rows.length === 0) {
    return <p className="text-sm text-gray-500">No professionals in this view.</p>
  }

  return (
    <ul className="space-y-2">
      {rows.map((p) => {
        const isExpanded = expandedId === p.id
        const chips = p.professions.slice(0, 2)
        const extra = p.professions.length - chips.length
        return (
          <li key={p.id} className="rounded-lg border border-gray-200 bg-white">
            <button
              type="button"
              onClick={() => setExpandedId(isExpanded ? null : p.id)}
              className="flex w-full flex-wrap items-center gap-2 px-3 py-2.5 text-left text-sm"
            >
              <span className={`rounded px-2 py-0.5 text-xs font-semibold ${
                p.status === 'pending' ? 'bg-amber-100 text-amber-800'
                : p.status === 'approved' ? 'bg-green-100 text-green-800'
                : 'bg-red-100 text-red-800'}`}>{p.status}</span>
              {!p.is_active && <span className="rounded bg-gray-200 px-2 py-0.5 text-xs text-gray-700">inactive</span>}
              <span className="font-semibold text-gray-900">{p.name}</span>
              <span className="text-xs text-gray-500">
                {chips.join(', ')}{extra > 0 ? ` +${extra}` : ''}
              </span>
              {p.locality && <span className="text-xs text-gray-400">{p.locality}</span>}
              <span className="text-xs text-gray-400">{p.phone}</span>
              <span className="ml-auto text-xs text-gray-400">
                {p.submitted_by ? nameById[p.submitted_by] ?? 'Unknown user' : 'Added by admin'}
              </span>
            </button>
            {errorById[p.id] && <p className="px-3 pb-2 text-xs text-red-700">{errorById[p.id]}</p>}
            {p.status === 'pending' && !isExpanded && (
              <div className="flex gap-2 border-t border-gray-100 px-3 py-2">
                <button
                  type="button"
                  disabled={pendingId === p.id}
                  onClick={() => quickAction(p.id, 'approved')}
                  className="rounded bg-green-600 px-3 py-1 text-xs font-semibold text-white disabled:opacity-60"
                >
                  Approve
                </button>
                <button
                  type="button"
                  disabled={pendingId === p.id}
                  onClick={() => quickAction(p.id, 'rejected')}
                  className="rounded bg-red-600 px-3 py-1 text-xs font-semibold text-white disabled:opacity-60"
                >
                  Reject
                </button>
              </div>
            )}
            {isExpanded && (
              <div className="border-t border-gray-100">
                <EditProfessionalForm
                  pro={p}
                  businessLabel={businessLabelOf(p.business)}
                  onSaved={() => setExpandedId(null)}
                />
              </div>
            )}
          </li>
        )
      })}
    </ul>
  )
}
