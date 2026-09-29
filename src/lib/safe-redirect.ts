import { siteConfig } from './site-config'

/**
 * Decide where an OAuth callback is allowed to send the browser.
 *
 * `next` arrives from a query string, so it is attacker-controlled: without
 * this gate, /auth/callback?next=https://evil.com is an open redirect that
 * can be used to phish OurDahanu users with a genuine ourdahanu.in link.
 *
 * There is a single parse-then-validate path, on purpose: `next` is parsed
 * exactly once via `new URL(next, origin)` (which resolves relative paths
 * against `origin` and leaves absolute URLs as-is), and the resulting host
 * is checked against the allowlist below no matter which shape the input
 * had. A separate "trust relative paths" branch is what created the
 * original bug — the WHATWG URL parser treats a backslash as `/` for
 * special schemes and strips tab/LF/CR from anywhere in the input, so
 * inputs like '/\evil.com' or '/\t/evil.com' start with a single '/' yet
 * parse to a foreign host. Validating the host unconditionally closes that
 * off regardless of what the input looked like before parsing.
 *
 * IMPORTANT: because relative paths are resolved with `new URL(next, origin)`,
 * a relative path's fate depends entirely on `origin` being allowed by one
 * of the rules below — an ordinary relative path like '/checkout/abc' is
 * NOT unconditionally safe by virtue of being relative. On a Vercel preview
 * deployment `origin` is `https://<branch>.vercel.app`, which is on none of
 * the allowlists, so a plain relative `next` would previously fail the host
 * check and silently lose its path. The same-origin check below fixes that:
 * a result whose origin matches the *request's own* origin is safe by
 * construction (it cannot redirect anywhere the browser didn't already
 * come from), independent of what that origin happens to be.
 *
 * Allowed:
 *   - anything that resolves to the same origin as `origin` (covers all
 *     relative paths, and any absolute URL that happens to match `origin`)
 *   - https URLs on ourdahanu.in or any *.ourdahanu.in subdomain
 *   - localhost (any port, any subdomain) so local dev sign-in works
 * Everything else falls back to the origin root.
 */
export function resolveSafeRedirect(next: string | null, origin: string): string {
  const fallback = new URL('/', origin).toString()
  if (!next) return fallback

  let parsed: URL
  try {
    parsed = new URL(next, origin)
  } catch {
    return fallback
  }

  // Same-origin as the request itself is safe by definition — it cannot be
  // an open redirect to anywhere the browser wasn't already pointed. This
  // is what makes relative paths work on origins outside the brand
  // allowlist (Vercel previews, custom local hostnames, etc.) without
  // loosening the allowlist for absolute foreign URLs. `origin` already
  // parsed successfully above (it's how `fallback` was built), so this
  // reuses that guarantee rather than re-wrapping it in another try/catch.
  const requestOrigin = new URL(origin).origin
  if (parsed.origin === requestOrigin) return parsed.toString()

  const host = parsed.hostname.toLowerCase()
  const isLocalhost = host === 'localhost' || host.endsWith('.localhost')

  // Only https off-localhost: http would let a network attacker strip TLS.
  if (parsed.protocol !== (isLocalhost ? 'http:' : 'https:')) return fallback

  // Note the leading dot on the suffix check: for a domain of ourdahanu.in,
  // 'notourdahanu.in' and 'ourdahanu.in.evil.com' must both fail.
  const ourDomain = siteConfig.domain.toLowerCase()
  const isOurDomain = host === ourDomain || host.endsWith(`.${ourDomain}`)
  if (!isOurDomain && !isLocalhost) return fallback

  return parsed.toString()
}
