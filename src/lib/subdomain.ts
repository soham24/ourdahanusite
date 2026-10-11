import { ROOT_DOMAIN } from './site-config'

const ROOT_SUFFIX = `.${ROOT_DOMAIN}`

// Reserved prefixes that are never business subdomains. Keep in sync with
// the inline regex literals in src/proxy.ts `export const config` — those
// cannot reference this module because Next.js requires pure inline
// literals inside that export.
export const RESERVED_SUBDOMAINS = new Set([
  'www', 'admin', 'api', 'app', 'mail', 'shop', 'news', 'events',
  'jobs', 'forum', 'classifieds', 'emergency', 'dashboard', 'login',
  'profile', 'search', 'about', 'listings', 'my-business', 'offline',
  'auth', 'static', 'assets', 'media', 'cdn', 'find', 'appointments',
])

/**
 * Extract the business subdomain from a request host, or null when the
 * request is for the main site (ourdahanu.in, www, reserved prefixes,
 * plain localhost).
 *
 * Handles both production (`organic.ourdahanu.in`) and local dev
 * (`organic.localhost:3000`).
 */
export function getBusinessSubdomain(host: string | null | undefined): string | null {
  const normalized = (host || '').split(',')[0]?.trim().toLowerCase() || ''
  if (!normalized) return null

  if (normalized.endsWith(ROOT_SUFFIX)) {
    const prefix = normalized.slice(0, normalized.length - ROOT_SUFFIX.length)
    if (prefix && !prefix.includes('.') && !RESERVED_SUBDOMAINS.has(prefix)) return prefix
  } else if (normalized.includes('.localhost')) {
    const withoutPort = normalized.split(':')[0]
    const parts = withoutPort.split('.')
    if (parts.length >= 2 && parts[0] && !RESERVED_SUBDOMAINS.has(parts[0])) return parts[0]
  }

  return null
}
