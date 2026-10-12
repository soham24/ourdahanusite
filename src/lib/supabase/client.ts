import { createBrowserClient } from '@supabase/ssr'
import {
  getAuthCookieOptions,
  getLegacyHostOnlyAuthCookieRemovals,
} from './auth-cookie'

let client: ReturnType<typeof createBrowserClient> | null = null

export function createClient() {
  if (!client) {
    const cookieOptions = getAuthCookieOptions(
      typeof window === 'undefined' ? undefined : window.location.hostname,
    )

    if (cookieOptions.domain && typeof document !== 'undefined') {
      for (const removal of getLegacyHostOnlyAuthCookieRemovals(document.cookie)) {
        document.cookie = removal
      }
    }

    client = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      // Newer Supabase projects call this key "publishable".
      (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)!,
      { cookieOptions },
    )
  }
  return client
}
