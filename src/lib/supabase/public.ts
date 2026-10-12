import 'server-only'

import { createClient } from '@supabase/supabase-js'

import type { Database } from '@/lib/database.types'

let publicClient: ReturnType<typeof createClient<Database>> | null = null

export function createPublicClient() {
  if (publicClient) {
    return publicClient
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  // Newer Supabase projects call this key "publishable".
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY

  if (!url || !anonKey) {
    throw new Error('Public Supabase environment variables are not configured.')
  }

  publicClient = createClient<Database>(url, anonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    global: {
      headers: {
        'X-Client-Info': 'ourdahanu-public-server',
      },
    },
  })

  return publicClient
}
