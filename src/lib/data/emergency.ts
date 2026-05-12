import 'server-only'

import { cacheLife, cacheTag } from 'next/cache'

import { CACHE_TAGS } from '@/lib/cache-tags'
import { URGENT_PUBLIC_CACHE } from '@/lib/cache-policy'
import { logCacheRegeneration } from '@/lib/isr-debug'
import { createPublicClient } from '@/lib/supabase/public'

export interface EmergencyAlert {
  id: string
  title: string
  severity: string
  active: boolean
  expires_at: string | null
}

export async function getActiveEmergencyAlert(): Promise<EmergencyAlert | null> {
  'use cache'

  cacheLife(URGENT_PUBLIC_CACHE)
  cacheTag(CACHE_TAGS.emergency)
  logCacheRegeneration({ scope: 'layout:emergency-ribbon', tags: [CACHE_TAGS.emergency] })

  try {
    const supabase = createPublicClient()
    const { data } = await supabase
      .from('emergency_alerts')
      .select('id, title, severity, active, expires_at')
      .eq('active', true)
      .order('severity', { ascending: true })
      .order('created_at', { ascending: false })
      .order('id', { ascending: true })
      .limit(1)

    return (data?.[0] as EmergencyAlert | undefined) ?? null
  } catch {
    return null
  }
}
