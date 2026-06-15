'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin-client'
import { rateLimit } from '@/lib/rate-limit'

export interface RiderProfile {
  id: string
  full_name: string
  phone: string
  vehicle_type: string
  status: 'pending' | 'approved' | 'suspended'
  is_online: boolean
  rating: number | null
  payout_upi: string | null
  home_business_id: string | null
}

const VEHICLES = new Set(['bike', 'cycle', 'scooter', 'car', 'foot'])

/** The signed-in user's rider profile, or null if they haven't applied. */
export async function getMyRider(): Promise<RiderProfile | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabase
    .from('riders')
    .select('id, full_name, phone, vehicle_type, status, is_online, rating, payout_upi, home_business_id')
    .eq('user_id', user.id)
    .maybeSingle()
  return (data as RiderProfile | null) ?? null
}

/** Apply to become a rider. Creates a pending rider row (admin approves later). */
export async function applyAsRider(
  formData: FormData,
): Promise<{ error?: string; ok?: true }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Please sign in.' }

  const fullName = String(formData.get('full_name') ?? '').trim()
  const phone = String(formData.get('phone') ?? '').trim()
  const vehicleType = String(formData.get('vehicle_type') ?? 'bike').trim()
  const payoutUpi = String(formData.get('payout_upi') ?? '').trim() || null

  if (!fullName || fullName.length < 2) return { error: 'Enter your full name.' }
  if (!/^\+?\d{10,13}$/.test(phone.replace(/[\s-]/g, ''))) return { error: 'Enter a valid phone number.' }
  if (!VEHICLES.has(vehicleType)) return { error: 'Pick a valid vehicle.' }

  const { error } = await supabase.from('riders').insert({
    user_id: user.id,
    full_name: fullName,
    phone,
    vehicle_type: vehicleType,
    payout_upi: payoutUpi,
    status: 'pending',
  })
  if (error) {
    if (error.code === '23505') return { error: 'You have already applied as a rider.' }
    return { error: 'Could not submit your application.' }
  }
  return { ok: true }
}

/** Approved rider toggles their availability. */
export async function setRiderOnline(online: boolean): Promise<{ error?: string; ok?: true }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Please sign in.' }

  const { data: rider } = await supabase.from('riders').select('id, status').eq('user_id', user.id).maybeSingle()
  if (!rider) return { error: 'Not a rider.' }
  if (rider.status !== 'approved') return { error: 'Your rider account is not approved yet.' }

  const { error } = await supabase
    .from('riders')
    .update({ is_online: online, updated_at: new Date().toISOString() })
    .eq('user_id', user.id)
  if (error) return { error: 'Could not update availability.' }
  return { ok: true }
}

/** Rider location ping (called periodically by the rider app while online). */
export async function pingRiderLocation(lat: number, lng: number): Promise<{ ok?: true; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Please sign in.' }
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return { error: 'Invalid coordinates.' }
  // Pings fire ~every 20s; cap abusive frequency.
  if (!rateLimit(`rider-ping:${user.id}`, 30, 60 * 1000).ok) return { error: 'Slow down.' }

  const { error } = await supabase
    .from('riders')
    .update({ current_lat: lat, current_lng: lng, last_ping_at: new Date().toISOString() })
    .eq('user_id', user.id)
  if (error) return { error: 'Could not update location.' }
  return { ok: true }
}

/** Earnings summary for the rider dashboard. */
export async function getRiderEarnings(): Promise<{ pendingPaise: number; settledPaise: number }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { pendingPaise: 0, settledPaise: 0 }
  const { data: rider } = await supabase.from('riders').select('id').eq('user_id', user.id).maybeSingle()
  if (!rider) return { pendingPaise: 0, settledPaise: 0 }

  const { data } = await supabase
    .from('rider_earnings')
    .select('amount_paise, status')
    .eq('rider_id', rider.id)

  let pendingPaise = 0
  let settledPaise = 0
  for (const r of (data ?? []) as Array<{ amount_paise: number; status: string }>) {
    if (r.status === 'settled') settledPaise += r.amount_paise
    else pendingPaise += r.amount_paise
  }
  return { pendingPaise, settledPaise }
}

// ── Admin rider management ─────────────────────────────────────────────────

export async function setRiderStatus(
  riderId: string,
  status: 'approved' | 'suspended' | 'pending',
): Promise<{ error?: string; ok?: true }> {
  const supabase = await createClient()
  const { getUserRole } = await import('@/app/actions/admin')
  const { role } = await getUserRole(supabase)
  if (role !== 'admin' && role !== 'moderator') return { error: 'Not authorized.' }

  const admin = createAdminClient()
  if (!admin) return { error: 'Server configuration error.' }
  const { error } = await admin
    .from('riders')
    .update({ status, ...(status !== 'approved' ? { is_online: false } : {}), updated_at: new Date().toISOString() })
    .eq('id', riderId)
  if (error) return { error: 'Could not update rider.' }
  return { ok: true }
}
