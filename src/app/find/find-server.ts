import { headers } from 'next/headers'

/**
 * Build a login URL that works from the `find` subdomain.
 *
 * Login must run on the MAIN domain: the find-host proxy rewrites every path
 * to `/find/*`, so `find.ourdahanu.in/login` would resolve to `/find/login`
 * (404). We send the user to `<main-origin>/login` with a `next` that returns
 * them to the exact find page they were on. Session cookies are scoped to
 * `.ourdahanu.in` (see src/lib/supabase/server.ts), so the session created on
 * the main domain is visible back on the find subdomain.
 *
 * @param returnPath find-relative path to come back to, e.g. `/submit` or `/p/<id>`
 */
export async function findLoginHref(returnPath: string): Promise<string> {
  const h = await headers()
  const rawHost = (h.get('x-forwarded-host') ?? h.get('host') ?? 'find.ourdahanu.in')
    .split(',')[0]
    .trim()
  const proto = rawHost.includes('localhost') ? 'http' : 'https'
  const returnUrl = `${proto}://${rawHost}${returnPath}`
  const mainHost = rawHost.replace(/^find\./, '')
  return `${proto}://${mainHost}/login?next=${encodeURIComponent(returnUrl)}`
}
