import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

const isProduction = process.env.NEXT_PUBLIC_SITE_URL?.includes('ourdahanu.in')
const cookieDomain = isProduction ? '.ourdahanu.in' : undefined

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, {
                ...options,
                ...(cookieDomain ? { domain: cookieDomain } : {}),
              })
            )
          } catch {
            // Server Component — cookies can't be set
          }
        },
      },
    }
  )
}
