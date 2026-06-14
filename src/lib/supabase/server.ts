import { createServerClient } from '@supabase/ssr'
import { cookies, headers } from 'next/headers'

const isProduction = process.env.NEXT_PUBLIC_SITE_URL?.includes('ourdahanu.in')
const cookieDomain = isProduction ? '.ourdahanu.in' : undefined

function bearerToken(headerValue: string | null): string | null {
  if (!headerValue) return null
  const match = /^Bearer\s+(.+)$/i.exec(headerValue.trim())
  return match ? match[1].trim() : null
}

/**
 * Server-side Supabase client with **dual authentication**:
 *
 * - Web: reads the session from cookies (PKCE), as before.
 * - Native app / API clients: if the request carries `Authorization: Bearer
 *   <jwt>`, the client runs as that user — the token is sent on every PostgREST
 *   request (so RLS resolves the mobile user) and `auth.getUser()` (called with
 *   no argument throughout `src/app/actions/*`) defaults to validating that
 *   token. This lets every existing action and API route serve both clients
 *   from one code path.
 */
export async function createClient() {
  const cookieStore = await cookies()

  const headerStore = await headers()
  const token = bearerToken(headerStore.get('authorization'))

  const client = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      ...(token ? { global: { headers: { Authorization: `Bearer ${token}` } } } : {}),
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

  if (token) {
    // Existing actions call `getUser()` with no argument (cookie session). With
    // a bearer token there is no cookie session, so default the no-arg call to
    // validate the token against the auth server. Explicit `getUser(jwt)` calls
    // are passed through unchanged.
    const originalGetUser = client.auth.getUser.bind(client.auth)
    client.auth.getUser = (jwt?: string) => originalGetUser(jwt ?? token)
  }

  return client
}
