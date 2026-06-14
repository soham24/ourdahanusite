import type { User } from '@supabase/supabase-js'

import { createClient } from '@/lib/supabase/server'

export interface ApiAuthContext {
  user: User
  supabase: Awaited<ReturnType<typeof createClient>>
}

/**
 * Resolve the authenticated user for an /api/v1 request. The Supabase client is
 * dual-auth (see createClient): it picks up `Authorization: Bearer <jwt>` from
 * the native app, or the session cookie on web. Returns null when unauthenticated
 * so the caller can respond 401.
 */
export async function getApiUser(): Promise<ApiAuthContext | null> {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return null
  return { user, supabase }
}
