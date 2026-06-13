import { createBrowserClient } from '@supabase/ssr'

let client: ReturnType<typeof createBrowserClient> | null = null

const isProduction =
  typeof window !== 'undefined' && window.location.hostname.endsWith('ourdahanu.in')

export function createClient() {
  if (!client) {
    client = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookieOptions: isProduction ? { domain: '.ourdahanu.in' } : undefined,
      }
    )
  }
  return client
}
