import { SITE_URL } from './site'

// Subdomains that serve a standalone OurDahanu product with its own layout.
// src/proxy.ts rewrites each one to /<name>/*, and SiteChrome hides the main
// site's navbar, emergency ribbon, bottom tabs and footer on them.
export const STANDALONE_SUBDOMAINS = ['find', 'appointments', 'jobs'] as const

export type StandaloneSubdomain = (typeof STANDALONE_SUBDOMAINS)[number]

/**
 * The absolute URL for a path on a standalone product's own host, e.g.
 * `buildStandaloneUrl('jobs', '/post')` → `https://jobs.ourdahanu.in/post`.
 *
 * Linking to the apex path (`/jobs`) instead of this host renders the
 * product's own header/footer *inside* the main site's chrome, because
 * SiteChrome only hides the main chrome by host, not by path — see the
 * comment on SiteChrome.tsx.
 */
export function buildStandaloneUrl(subdomain: StandaloneSubdomain, path = '/'): string {
  const site = new URL(SITE_URL)
  site.hostname = `${subdomain}.${site.hostname}`
  return new URL(path, site).toString()
}

function bareHost(host: string | null | undefined): string {
  return (host ?? '').split(',')[0].trim().split(':')[0].toLowerCase()
}

/** Which standalone product a request host belongs to, if any. */
export function getStandaloneSubdomain(host: string | null | undefined): StandaloneSubdomain | null {
  const normalized = bareHost(host)
  for (const name of STANDALONE_SUBDOMAINS) {
    if (normalized === `${name}.ourdahanu.in` || normalized === `${name}.localhost`) return name
  }
  return null
}

/**
 * A main-site login URL that returns to `returnPath` on the same host.
 *
 * Login must run on the main domain: a standalone proxy rewrites every path
 * under /<name>/*, so <name>.ourdahanu.in/login would 404. Session cookies are
 * scoped to .ourdahanu.in, so the session created on the main domain is
 * visible back on the subdomain.
 */
export function buildStandaloneLoginHref(rawHost: string, returnPath: string): string {
  const host = rawHost.split(',')[0].trim()
  const proto = host.includes('localhost') ? 'http' : 'https'
  const returnUrl = `${proto}://${host}${returnPath}`
  const mainHost = host.replace(/^(?:find|appointments|jobs)\./, '')
  return `${proto}://${mainHost}/login?next=${encodeURIComponent(returnUrl)}`
}
