import {
  getAuthCookieOptions,
  getLegacyHostOnlyAuthCookieRemovals,
} from '@/lib/supabase/auth-cookie'
import { ROOT_DOMAIN } from '@/lib/site-config'

export function shouldInitializeBrowserAuth(hostname: string): boolean {
  const normalized = hostname.split(',')[0].trim().split(':')[0].toLowerCase()
  return normalized !== `find.${ROOT_DOMAIN}` && normalized !== 'find.localhost'
}

export function getBrowserAuthPlan(
  hostname: string,
  cookieHeader: string,
): { shouldInitialize: boolean; legacyCookieRemovals: string[] } {
  const sharesProductionCookies = Boolean(getAuthCookieOptions(hostname).domain)

  return {
    shouldInitialize: shouldInitializeBrowserAuth(hostname),
    legacyCookieRemovals: sharesProductionCookies
      ? getLegacyHostOnlyAuthCookieRemovals(cookieHeader)
      : [],
  }
}

export async function loadInitialAuthUser<T>(
  getUser: () => Promise<{ data: { user: T | null } }>,
): Promise<T | null> {
  try {
    return (await getUser()).data.user
  } catch {
    return null
  }
}
