import { createClient } from '@/lib/supabase/server'
import type { FindRating, ProfessionalWithStats } from '@/lib/find/types'

// Aggregate approved ratings into avg + count per professional id.
async function statsFor(
  supabase: Awaited<ReturnType<typeof createClient>>,
  ids: string[],
): Promise<Map<string, { avg: number; count: number }>> {
  const map = new Map<string, { avg: number; count: number }>()
  if (ids.length === 0) return map
  const { data } = await supabase
    .from('find_ratings')
    .select('professional_id, rating')
    .eq('status', 'approved')
    .in('professional_id', ids)
  for (const row of data ?? []) {
    const cur = map.get(row.professional_id) ?? { avg: 0, count: 0 }
    cur.avg += row.rating
    cur.count += 1
    map.set(row.professional_id, cur)
  }
  for (const [, v] of map) v.avg = v.count ? v.avg / v.count : 0
  return map
}

export async function getApprovedProfessionals(
  opts: { q?: string; profession?: string } = {},
): Promise<ProfessionalWithStats[]> {
  const supabase = await createClient()
  let query = supabase
    .from('find_professionals')
    .select('*')
    .eq('status', 'approved')
    .eq('is_active', true)
    .order('created_at', { ascending: false })

  if (opts.profession && opts.profession !== 'All') {
    query = query.contains('professions', [opts.profession])
  }
  if (opts.q && opts.q.trim()) {
    // Strip PostgREST or()-grammar special chars so a term with commas or
    // parentheses can't break the filter expression.
    const cleaned = opts.q.trim().replace(/[,()%]/g, ' ').trim()
    if (cleaned) {
      const term = `%${cleaned}%`
      query = query.or(`name.ilike.${term},note.ilike.${term},locality.ilike.${term}`)
    }
  }

  const { data } = await query
  const rows = data ?? []
  const stats = await statsFor(supabase, rows.map((r) => r.id))
  return rows.map((r) => ({
    ...r,
    avg_rating: stats.get(r.id)?.avg ?? 0,
    rating_count: stats.get(r.id)?.count ?? 0,
  }))
}

export async function getProfessionalById(
  id: string,
): Promise<ProfessionalWithStats | null> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('find_professionals')
    .select('*')
    .eq('id', id)
    .eq('status', 'approved')
    .eq('is_active', true)
    .maybeSingle()
  if (!data) return null
  const stats = await statsFor(supabase, [id])
  return {
    ...data,
    avg_rating: stats.get(id)?.avg ?? 0,
    rating_count: stats.get(id)?.count ?? 0,
  }
}

export async function getApprovedRatings(
  professionalId: string,
): Promise<FindRating[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('find_ratings')
    .select('*')
    .eq('professional_id', professionalId)
    .eq('status', 'approved')
    .order('created_at', { ascending: false })
  return data ?? []
}
