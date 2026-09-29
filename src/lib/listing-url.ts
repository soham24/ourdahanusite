import { siteConfig } from './site-config'

// The production domain on purpose, not the current deployment's host:
// canonical URLs and share links must keep working after a preview
// deployment is gone.
const PRODUCTION_ROOT_DOMAIN = siteConfig.domain

function normalizeSubdomain(subdomain?: string | null): string | null {
  const value = subdomain?.trim().toLowerCase()
  return value || null
}

function normalizeHost(host?: string | null): string {
  return (host || '').split(',')[0]?.trim().toLowerCase() || ''
}

function isLocalHost(host: string): boolean {
  return /(^|\.)localhost(?::\d+)?$/.test(host)
}

function isOurdahanuHost(host: string): boolean {
  return host === PRODUCTION_ROOT_DOMAIN || host === `www.${PRODUCTION_ROOT_DOMAIN}` || host.endsWith(`.${PRODUCTION_ROOT_DOMAIN}`)
}

export function getCanonicalListingUrl(id: string | number, subdomain?: string | null): string {
  const normalizedSubdomain = normalizeSubdomain(subdomain)
  if (normalizedSubdomain) {
    return `https://${normalizedSubdomain}.${PRODUCTION_ROOT_DOMAIN}`
  }

  return `https://${PRODUCTION_ROOT_DOMAIN}/listings/${id}`
}

export function getListingHref(
  id: string | number,
  subdomain?: string | null,
  currentHost?: string | null,
): string {
  const normalizedSubdomain = normalizeSubdomain(subdomain)
  if (!normalizedSubdomain) {
    return `/listings/${id}`
  }

  const host = normalizeHost(currentHost)
  if (!host) {
    return getCanonicalListingUrl(id, normalizedSubdomain)
  }
  if (isLocalHost(host)) {
    const localPort = host.match(/:(\d+)$/)?.[1] || '3000'
    return `http://${normalizedSubdomain}.localhost:${localPort}`
  }
  if (isOurdahanuHost(host)) {
    return getCanonicalListingUrl(id, normalizedSubdomain)
  }

  return `/listings/${normalizedSubdomain}`
}

export function shouldRedirectListingToSubdomain(
  currentHost: string | null | undefined,
  subdomain?: string | null,
): boolean {
  const normalizedSubdomain = normalizeSubdomain(subdomain)
  if (!normalizedSubdomain) {
    return false
  }

  const host = normalizeHost(currentHost)
  if (!host) {
    return false
  }

  return host === PRODUCTION_ROOT_DOMAIN || host === `www.${PRODUCTION_ROOT_DOMAIN}` || /^localhost(?::\d+)?$/.test(host)
}
