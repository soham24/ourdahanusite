import 'server-only'

import { cacheLife, cacheTag } from 'next/cache'

import { CACHE_TAGS } from '@/lib/cache-tags'
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

  cacheLife({ stale: 1800, revalidate: 3600, expire: 86400 })
  cacheTag(CACHE_TAGS.emergency)

  try {
    const supabase = createPublicClient()
    const now = new Date().toISOString()
    const { data } = await supabase
      .from('emergency_alerts')
      .select('id, title, severity, active, expires_at')
      .eq('active', true)
      .or(`expires_at.is.null,expires_at.gt.${now}`)
      .order('severity', { ascending: true })
      .order('created_at', { ascending: false })
      .limit(1)

    return (data?.[0] as EmergencyAlert | undefined) ?? null
  } catch {
    return null
  }
}
