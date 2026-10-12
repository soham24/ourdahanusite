'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin-client'
import {
  revalidateCouponCache,
  revalidatePricingCache,
} from '@/lib/cache-tags'
import {
  getCachedPricingConfig,
  type Coupon,
  type PricingConfig,
} from '@/lib/data/pricing'
import { getListingSubmissionCharge } from '@/lib/payment-security'
import { fetchAllRedemptions } from '@/lib/data/coupon-redemptions'
import {
  summariseByCoupon,
  summariseByPerson,
  type CouponTotals,
  type PersonTotals,
} from '@/lib/coupon-reporting'
import { getUserRole } from './admin'

export type { Coupon, PricingConfig } from '@/lib/data/pricing'

async function checkAdmin() {
  const supabase = await createClient()
  const { role, user } = await getUserRole(supabase)
  if (!user || (role !== 'admin' && role !== 'moderator')) throw new Error('Unauthorized')
  const adminClient = createAdminClient()
  if (!adminClient) throw new Error('Admin client unavailable')
  return adminClient
}

// ── Read (public — used by API route & submit form) ──────────────────────────

export async function getPricingConfig(): Promise<PricingConfig> {
  return getCachedPricingConfig()
}

/**
 * What one coupon code does to the listing fee, for the submit and renew
 * forms. The forms used to receive every active code up front, which put
 * them all in the page source; this answers for the code typed, nothing
 * more. The server re-checks the code again when the order is created.
 */
export async function checkListingCoupon(
  code: string,
): Promise<{ code: string; label: string; finalPrice: number } | { error: string }> {
  const charge = await getListingSubmissionCharge(code.slice(0, 64))
  if (!charge.couponValid || !charge.couponCode) {
    return { error: 'Invalid coupon code. Please check and try again.' }
  }
  return { code: charge.couponCode, label: charge.couponLabel ?? charge.couponCode.toUpperCase(), finalPrice: charge.finalPrice }
}

export async function getAllCoupons(): Promise<Coupon[]> {
  try {
    const db = await checkAdmin()
    const { data } = await db
      .from('coupons')
      .select('*')
      .order('created_at', { ascending: false })
    return data ?? []
  } catch { return [] }
}

// ── Update pricing ───────────────────────────────────────────────────────────

export async function updatePricing(formData: FormData): Promise<{ error?: string }> {
  try {
    const db = await checkAdmin()
    const base_price = parseInt(formData.get('base_price') as string)
    const current_price = parseInt(formData.get('current_price') as string)
    if (isNaN(base_price) || isNaN(current_price)) return { error: 'Invalid prices.' }
    if (current_price > base_price) return { error: 'Current price cannot exceed base price.' }

    // Upsert: on a fresh database there may be no row yet, and an update
    // would silently save nothing.
    const { error } = await db
      .from('pricing_config')
      .upsert({ id: 1, base_price, current_price, updated_at: new Date().toISOString() }, { onConflict: 'id' })

    if (error) return { error: error.message }
    revalidatePricingCache()
    return {}
  } catch (e: unknown) {
    return { error: e instanceof Error ? e.message : 'Failed to update pricing.' }
  }
}

// ── Coupon CRUD ──────────────────────────────────────────────────────────────

export async function createCoupon(formData: FormData): Promise<{ error?: string }> {
  try {
    const db = await checkAdmin()
    const code = (formData.get('code') as string)?.trim().toLowerCase()
    const label = (formData.get('label') as string)?.trim()
    const final_price = parseInt(formData.get('final_price') as string)
    const enabled = formData.get('enabled') === 'true'
    const assigned_to = ((formData.get('assigned_to') as string) ?? '').trim() || null

    if (!code || !label) return { error: 'Code and label are required.' }
    if (isNaN(final_price) || final_price < 0) return { error: 'Invalid price.' }
    if (!/^[a-z0-9]+$/.test(code)) return { error: 'Code must be lowercase letters and numbers only.' }

    const { error } = await db.from('coupons').insert({ code, label, final_price, enabled, assigned_to })
    if (error) {
      if (error.code === '23505') return { error: `Coupon code "${code}" already exists.` }
      return { error: error.message }
    }
    revalidateCouponCache()
    return {}
  } catch (e: unknown) {
    return { error: e instanceof Error ? e.message : 'Failed to create coupon.' }
  }
}

export async function toggleCoupon(id: string, enabled: boolean): Promise<{ error?: string }> {
  try {
    const db = await checkAdmin()
    const { error } = await db.from('coupons').update({ enabled }).eq('id', id)
    if (error) return { error: error.message }
    revalidateCouponCache()
    return {}
  } catch (e: unknown) {
    return { error: e instanceof Error ? e.message : 'Failed to toggle coupon.' }
  }
}

export async function deleteCoupon(id: string): Promise<{ error?: string }> {
  try {
    const db = await checkAdmin()
    const { error } = await db.from('coupons').delete().eq('id', id)
    if (error) return { error: error.message }
    revalidateCouponCache()
    return {}
  } catch (e: unknown) {
    return { error: e instanceof Error ? e.message : 'Failed to delete coupon.' }
  }
}

export async function getCouponReport(): Promise<{
  byCoupon: CouponTotals[]
  byPerson: PersonTotals[]
}> {
  try {
    const db = await checkAdmin()
    const rows = await fetchAllRedemptions()

    const { data } = await db.from('coupons').select('code, assigned_to')
    const assignedBy = Object.create(null) as Record<string, string | null>
    for (const c of (data ?? []) as { code: string; assigned_to: string | null }[]) {
      assignedBy[c.code] = c.assigned_to
    }

    return {
      byCoupon: summariseByCoupon(rows),
      byPerson: summariseByPerson(rows, assignedBy),
    }
  } catch (err) {
    console.error('[coupon-report]', err)
    return { byCoupon: [], byPerson: [] }
  }
}

export async function setCouponAssignedTo(
  id: string,
  assignedTo: string,
): Promise<{ error?: string }> {
  try {
    const db = await checkAdmin()
    const value = assignedTo.trim() || null
    const { error } = await db.from('coupons').update({ assigned_to: value }).eq('id', id)
    if (error) return { error: error.message }
    revalidateCouponCache()
    return {}
  } catch (e: unknown) {
    return { error: e instanceof Error ? e.message : 'Failed to update coupon.' }
  }
}
