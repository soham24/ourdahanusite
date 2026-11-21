/**
 * Server-side Supabase requests give up after this long.
 *
 * Without a limit, a Supabase outage holds every request open until the
 * hosting platform kills the function (300 s on Vercel). That happened on
 * 2026-11-16: pages hung for five minutes and cached fetchers timed out
 * during prerendering. A request that fails fast lets the page show its
 * error state, and a cached fetcher fall back, while the database recovers.
 */
export const SUPABASE_FETCH_TIMEOUT_MS = 15_000

/** A fetch that aborts after `timeoutMs`, while still honouring a caller's own signal. */
export function fetchWithTimeout(
  timeoutMs: number = SUPABASE_FETCH_TIMEOUT_MS,
  baseFetch: typeof fetch = fetch,
): typeof fetch {
  return (input, init) => {
    const timeout = AbortSignal.timeout(timeoutMs)
    const signal = init?.signal ? AbortSignal.any([init.signal, timeout]) : timeout
    return baseFetch(input, { ...init, signal })
  }
}
