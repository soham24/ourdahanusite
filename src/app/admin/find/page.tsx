import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin-client'
import { requireAdmin } from '@/app/actions/admin'
import type { AdminFindCounts } from '@/lib/find/types'
import FindToolbar from './FindToolbar'
import ProfessionalList, { type AdminProfessionalRow } from './ProfessionalList'
import RatingsList, { type AdminPendingRating } from './RatingsList'
import Pagination from './Pagination'

const PAGE_SIZE = 25

const PROFESSIONAL_COLUMNS =
  'id, name, phone, whatsapp, professions, profession_other, locality, note, status, is_active, submitted_by, business_listing_id, created_at, updated_at'

const STATUS_FILTERS = new Set(['pending', 'approved', 'rejected', 'inactive', 'all'])

export default async function AdminFindPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; status?: string; q?: string; profession?: string; page?: string }>
}) {
  const supabase = await createClient()
  await requireAdmin(supabase)
  const db = createAdminClient()
  if (!db) return <p className="p-6 text-red-600">Service role key not configured.</p>

  const params = await searchParams
  const tab = params.tab === 'ratings' ? 'ratings' : 'professionals'
  const q = (params.q ?? '').trim()
  const profession = params.profession ?? ''
  const page = Math.max(1, parseInt(params.page ?? '1', 10) || 1)
  const offset = (page - 1) * PAGE_SIZE

  const { data: countsRaw } = await db.rpc('get_admin_find_counts')
  const counts = (countsRaw ?? {
    pending: 0, approved: 0, rejected: 0, inactive: 0, total: 0, pending_ratings: 0,
  }) as AdminFindCounts

  const status = params.status && STATUS_FILTERS.has(params.status)
    ? params.status
    : (counts.pending > 0 ? 'pending' : 'approved')

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

  let professionals: AdminProfessionalRow[] = []
  let ratings: AdminPendingRating[] = []
  let total = 0

  if (tab === 'ratings') {
    const { data, count } = await db
      .from('find_ratings')
      .select('id, user_id, rating, comment, created_at, find_professionals(name)', { count: 'exact' })
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1)
    ratings = (data ?? []) as unknown as AdminPendingRating[]
    total = count ?? 0
    await loadNames(new Set(ratings.map((r) => r.user_id).filter(Boolean)))
  } else {
    let query = db
      .from('find_professionals')
      .select(`${PROFESSIONAL_COLUMNS}, business:listings(name, subdomain)`, { count: 'exact' })

    if (status === 'inactive') query = query.eq('is_active', false)
    else if (status !== 'all') query = query.eq('status', status)

    if (profession) query = query.contains('professions', [profession])
    if (q) {
      const pattern = `%${q.replace(/[%_,()]/g, ' ').trim()}%`
      query = query.or(`name.ilike.${pattern},phone.ilike.${pattern},locality.ilike.${pattern}`)
    }

    const { data, count } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1)

    professionals = (data ?? []) as unknown as AdminProfessionalRow[]
    total = count ?? 0
    await loadNames(new Set(professionals.map((p) => p.submitted_by).filter((v): v is string => !!v)))
  }

  const qp = new URLSearchParams()
  if (tab !== 'professionals') qp.set('tab', tab)
  if (status && status !== 'pending') qp.set('status', status)
  if (q) qp.set('q', q)
  if (profession) qp.set('profession', profession)
  const currentQuery = qp.toString()

  function hrefFor(targetPage: number) {
    const p = new URLSearchParams(currentQuery)
    if (targetPage > 1) p.set('page', String(targetPage)); else p.delete('page')
    return `/admin/find?${p.toString()}`
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
          Pending ratings{counts.pending_ratings ? ` (${counts.pending_ratings})` : ''}
        </Link>
      </div>

      {tab === 'ratings' ? (
        <>
          <RatingsList initialRows={ratings} nameById={Object.fromEntries(nameById)} />
          <Pagination page={page} pageSize={PAGE_SIZE} total={total} hrefFor={hrefFor} />
        </>
      ) : (
        <>
          <FindToolbar status={status} q={q} profession={profession} counts={counts} currentQuery={currentQuery} />
          <ProfessionalList
            initialRows={professionals}
            nameById={Object.fromEntries(nameById)}
          />
          <Pagination page={page} pageSize={PAGE_SIZE} total={total} hrefFor={hrefFor} />
        </>
      )}
    </div>
  )
}
