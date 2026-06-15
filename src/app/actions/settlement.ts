'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin-client'

export interface RiderSettlement {
  riderId: string
  fullName: string
  phone: string
  payoutUpi: string | null
  pendingEarningsPaise: number
  unsettledCodPaise: number
}

async function ensureAdmin(): Promise<boolean> {
  const supabase = await createClient()
  const { getUserRole } = await import('@/app/actions/admin')
  const { role } = await getUserRole(supabase)
  return role === 'admin' || role === 'moderator'
}

/** Per-rider settlement view: delivery fees we owe riders, and COD cash riders owe in. */
export async function getSettlementSummary(): Promise<RiderSettlement[]> {
  if (!(await ensureAdmin())) return []
  const admin = createAdminClient()
  if (!admin) return []

  const [{ data: earnings }, { data: cod }, { data: riders }] = await Promise.all([
    admin.from('rider_earnings').select('rider_id, amount_paise, status').eq('status', 'pending'),
    admin.from('cod_collections').select('rider_id, amount_paise, settled').eq('settled', false),
    admin.from('riders').select('id, full_name, phone, payout_upi'),
  ])

  const earnByRider = new Map<string, number>()
  for (const e of (earnings ?? []) as Array<{ rider_id: string; amount_paise: number }>) {
    earnByRider.set(e.rider_id, (earnByRider.get(e.rider_id) ?? 0) + e.amount_paise)
  }
  const codByRider = new Map<string, number>()
  for (const c of (cod ?? []) as Array<{ rider_id: string | null; amount_paise: number }>) {
    if (!c.rider_id) continue
    codByRider.set(c.rider_id, (codByRider.get(c.rider_id) ?? 0) + c.amount_paise)
  }

  const out: RiderSettlement[] = []
  for (const r of (riders ?? []) as Array<{ id: string; full_name: string; phone: string; payout_upi: string | null }>) {
    const pendingEarningsPaise = earnByRider.get(r.id) ?? 0
    const unsettledCodPaise = codByRider.get(r.id) ?? 0
    if (pendingEarningsPaise === 0 && unsettledCodPaise === 0) continue
    out.push({ riderId: r.id, fullName: r.full_name, phone: r.phone, payoutUpi: r.payout_upi, pendingEarningsPaise, unsettledCodPaise })
  }
  return out
}

/** Mark a rider's pending earnings as settled (after paying them out). */
export async function settleRiderEarnings(riderId: string): Promise<{ error?: string; ok?: true }> {
  if (!(await ensureAdmin())) return { error: 'Not authorized.' }
  const admin = createAdminClient()
  if (!admin) return { error: 'Server configuration error.' }
  const { error } = await admin.from('rider_earnings').update({ status: 'settled' }).eq('rider_id', riderId).eq('status', 'pending')
  if (error) return { error: 'Could not settle earnings.' }
  return { ok: true }
}

/** Mark a rider's collected COD cash as reconciled (handed in / adjusted). */
export async function settleRiderCod(riderId: string): Promise<{ error?: string; ok?: true }> {
  if (!(await ensureAdmin())) return { error: 'Not authorized.' }
  const admin = createAdminClient()
  if (!admin) return { error: 'Server configuration error.' }
  const { error } = await admin.from('cod_collections').update({ settled: true }).eq('rider_id', riderId).eq('settled', false)
  if (error) return { error: 'Could not reconcile COD.' }
  return { ok: true }
}
