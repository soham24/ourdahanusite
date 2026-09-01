'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin-client'
import {
  revalidateCouponCache,
  revalidatePricingCache,
} from '@/lib/cache-tags'
import {
  getCachedActiveCoupons,
  getCachedPricingConfig,
  type Coupon,
  type PricingConfig,
} from '@/lib/data/pricing'
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

export async function getActiveCoupons(): Promise<Coupon[]> {
  return getCachedActiveCoupons()
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

    const { error } = await db
      .from('pricing_config')
      .update({ base_price, current_price, updated_at: new Date().toISOString() })
      .eq('id', 1)

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

    if (!code || !label) return { error: 'Code and label are required.' }
    if (isNaN(final_price) || final_price < 0) return { error: 'Invalid price.' }
    if (!/^[a-z0-9]+$/.test(code)) return { error: 'Code must be lowercase letters and numbers only.' }

    const { error } = await db.from('coupons').insert({ code, label, final_price, enabled })
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
