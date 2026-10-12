import 'server-only'

import { createClient } from '@supabase/supabase-js'

/**
 * Creates a Supabase client with the service-role key.
 * Only use this in server actions / API routes — NEVER expose to the browser.
 * Returns null if neither SUPABASE_SERVICE_ROLE_KEY nor SUPABASE_SECRET_KEY
 * (what newer Supabase projects and the Vercel integration call it) is set.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY
  if (!url || !key) return null
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}
