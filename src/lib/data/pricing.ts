import 'server-only'

import { cacheLife, cacheTag } from 'next/cache'

import { CACHE_TAGS } from '@/lib/cache-tags'
import { PUBLIC_CONTENT_CACHE } from '@/lib/cache-policy'
import { logCacheRegeneration } from '@/lib/isr-debug'
import { createPublicClient } from '@/lib/supabase/public'

export interface PricingConfig {
  base_price: number
  current_price: number
}

export interface Coupon {
  id: string
  code: string
  label: string
  final_price: number
  enabled: boolean
  usage_count: number
  created_at: string
}

const FALLBACK_PRICING: PricingConfig = {
  base_price: 500,
  current_price: 210,
}

export async function getCachedPricingConfig(): Promise<PricingConfig> {
  'use cache'

  cacheLife(PUBLIC_CONTENT_CACHE)
  cacheTag(CACHE_TAGS.pricing)
  logCacheRegeneration({ scope: 'pricing:config', tags: [CACHE_TAGS.pricing] })

  try {
    const supabase = createPublicClient()
    const { data } = await supabase
      .from('pricing_config')
      .select('base_price, current_price')
      .eq('id', 1)
      .single()

    if (data) {
      return data
    }
  } catch {
    // Fall back to the launch defaults when the table is unavailable.
  }

  return FALLBACK_PRICING
}

export async function getCachedActiveCoupons(): Promise<Coupon[]> {
  'use cache'

  cacheLife(PUBLIC_CONTENT_CACHE)
  cacheTag(CACHE_TAGS.coupons)
  logCacheRegeneration({ scope: 'pricing:coupons', tags: [CACHE_TAGS.coupons] })

  try {
    const supabase = createPublicClient()
    const { data } = await supabase
      .from('coupons')
      .select('id, code, label, final_price, enabled, usage_count, created_at')
      .eq('enabled', true)
      .order('created_at', { ascending: false })
      .order('id', { ascending: true })

    return data ?? []
  } catch {
    return []
  }
}
