import Link from 'next/link'
import { ArrowLeft, Star } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin-client'
import { requireAdmin } from '@/app/actions/admin'
import type { FindProfessional } from '@/lib/find/types'
import EditProfessionalForm from './EditProfessionalForm'
import RatingModerationButtons from './RatingModerationButtons'

// Only the fields the ratings tab renders — narrower than the full FindRating
// row, so we can select just these columns.
type PendingRating = {
  id: string
  user_id: string
  rating: number
  comment: string
  find_professionals: { name: string } | null
}

export default async function AdminFindPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>
}) {
  const supabase = await createClient()
  await requireAdmin(supabase)
  const db = createAdminClient()
  if (!db) return <p className="p-6 text-red-600">Service role key not configured.</p>

  const { tab = 'professionals' } = await searchParams
  const isRatings = tab === 'ratings'

  const PROFESSIONAL_COLUMNS =
    'id, name, phone, whatsapp, professions, profession_other, locality, note, status, is_active, submitted_by, created_at, updated_at'

  // Resolve profile display names (admin-only) for the given ids in one query.
  const nameById = new Map<string, string>()
  async function loadNames(ids: Set<string>) {
    if (ids.size === 0) return
    const { data } = await db!
      .from('profiles')
      .select('id, full_name, email')
      .in('id', Array.from(ids))
    for (const row of data ?? []) {
      nameById.set(row.id, row.full_name || row.email || 'Unknown user')
    }
  }

  // Only the active tab's rows are fetched. The pending-ratings badge shows on
  // both tabs, so the professionals tab pulls just a HEAD count (no rows/join)
  // instead of every pending rating.
  let professionals: FindProfessional[] = []
  let ratings: PendingRating[] = []
  let pendingRatingsCount = 0

  if (isRatings) {
    const { data } = await db
      .from('find_ratings')
      .select('id, user_id, rating, comment, created_at, find_professionals(name)')
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
    ratings = (data ?? []) as unknown as PendingRating[]
    pendingRatingsCount = ratings.length
    await loadNames(new Set(ratings.map((r) => r.user_id).filter(Boolean)))
  } else {
    const [prosRes, countRes] = await Promise.all([
      db.from('find_professionals').select(PROFESSIONAL_COLUMNS).order('created_at', { ascending: false }),
      db.from('find_ratings').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    ])
    // Pending first regardless of alpha order:
    professionals = ((prosRes.data ?? []) as unknown as FindProfessional[]).sort((a, b) =>
      (a.status === 'pending' ? 0 : 1) - (b.status === 'pending' ? 0 : 1),
    )
    pendingRatingsCount = countRes.count ?? 0
    await loadNames(new Set(professionals.map((p) => p.submitted_by).filter((v): v is string => !!v)))
  }

  const tabCls = (t: string) =>
    `rounded-md px-3 py-1.5 text-sm font-semibold ${tab === t ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-700'}`

  return (
    <div className="mx-auto max-w-4xl p-4">
      <Link href="/admin" className="mb-3 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800">
        <ArrowLeft size={14} /> Admin
      </Link>
      <h1 className="mb-4 text-2xl font-bold">Find Directory</h1>
      <div className="mb-4 flex gap-2">
        <Link href="/admin/find?tab=professionals" className={tabCls('professionals')}>Professionals</Link>
        <Link href="/admin/find?tab=ratings" className={tabCls('ratings')}>
          Pending ratings{pendingRatingsCount ? ` (${pendingRatingsCount})` : ''}
        </Link>
      </div>

      {tab === 'ratings' ? (
        ratings.length === 0 ? (
          <p className="text-sm text-gray-500">No pending ratings.</p>
        ) : (
          <ul className="space-y-3">
            {ratings.map((r) => (
              <li key={r.id} className="rounded-lg border border-gray-200 bg-white p-4">
                <div className="flex items-center justify-between">
                  <span className="font-semibold">{r.find_professionals?.name ?? 'Unknown'}</span>
                  <span className="flex items-center gap-0.5">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <Star key={n} size={13} className={n <= r.rating ? 'text-amber-400 fill-amber-400' : 'text-gray-200 fill-gray-200'} />
                    ))}
                  </span>
                </div>
                <p className="text-xs text-gray-500">by {nameById.get(r.user_id) ?? 'Unknown user'}</p>
                <p className="mt-2 text-sm text-gray-700">{r.comment}</p>
                <RatingModerationButtons ratingId={r.id} />
              </li>
            ))}
          </ul>
        )
      ) : (
        <ul className="space-y-4">
          {professionals.map((p) => (
            <li key={p.id}>
              <div className="mb-1 flex items-center gap-2 text-xs">
                <span className={`rounded px-2 py-0.5 font-semibold ${
                  p.status === 'pending' ? 'bg-amber-100 text-amber-800'
                  : p.status === 'approved' ? 'bg-green-100 text-green-800'
                  : 'bg-red-100 text-red-800'}`}>{p.status}</span>
                {!p.is_active && <span className="rounded bg-gray-200 px-2 py-0.5 text-gray-700">inactive</span>}
                <span className="text-gray-500">
                  {p.submitted_by ? `Submitted by ${nameById.get(p.submitted_by) ?? 'Unknown user'}` : 'Added by admin'}
                </span>
              </div>
              <EditProfessionalForm pro={p} />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
