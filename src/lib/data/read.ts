/**
 * Unwraps a Supabase read, throwing when it failed.
 *
 * Use it inside every `'use cache'` fetcher. supabase-js reports a failed
 * request as `{ data: null, error }` rather than throwing, so a fetcher that
 * only reads `data` turns an outage into "no rows" -- and that empty result is
 * then cached for up to a day: an empty home page section, or a cached 404 for
 * a business that exists. Throwing instead means nothing is cached: on a
 * revalidation Next.js keeps serving the last good version and retries on the
 * next request.
 */
export function readOrThrow<T>(result: { data: T; error: { message: string } | null }, what: string): T {
  if (result.error) {
    // `next build` prerenders pages, and CI, Docker and forks build with no
    // reachable database. There a failed read stays "no rows", as it always
    // was, so the build succeeds; the first revalidation fills the page in.
    if (process.env.NEXT_PHASE === 'phase-production-build') {
      console.warn(`[build] could not read ${what}, prerendering it empty: ${result.error.message}`)
      return result.data
    }
    throw new Error(`Could not read ${what}: ${result.error.message}`)
  }
  return result.data
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Whether a value from a URL can be a row id. Check before reading by id: a
 * malformed id makes Postgres reply with an error, which readOrThrow would
 * turn into an error page where the visitor should get a 404.
 */
export function isUuid(value: string): boolean {
  return UUID.test(value)
}
