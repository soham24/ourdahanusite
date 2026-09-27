/**
 * Where to send someone who tapped something that needs an account.
 *
 * Both halves of this were getting written by hand at each call site, and
 * both were getting it slightly wrong:
 *
 *   - `/login?next=...` was built with `window.location.pathname` alone, so
 *     the query string was dropped. Someone signing in from a filtered or
 *     searched page came back to the unfiltered one.
 *   - the navigation itself used `window.location.href = ...`, a full
 *     document load, where a client-side push keeps the router cache and the
 *     app shell. That is also what @next/next/no-location-assign-relative-
 *     destination is warning about.
 *
 * The `next` value ends up back on the server, where resolveSafeRedirect in
 * src/lib/safe-redirect.ts is what actually decides whether it is safe to
 * follow — nothing here is a security boundary, and nothing here should be
 * relied on as one.
 */

/** The sign-in URL that returns to `next` afterwards. */
export function loginHref(next: string): string {
  return `/login?next=${encodeURIComponent(next)}`
}

/**
 * The current page as a `next` value: path and query, no origin.
 *
 * Takes the two fields it reads rather than touching `window` itself, so it
 * can be tested and so a caller on a business subdomain gets a path that
 * stays on that subdomain.
 */
export function currentPathForLogin(location: { pathname: string; search: string }): string {
  return `${location.pathname}${location.search}`
}
