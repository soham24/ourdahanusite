const DEFAULT_SITE_URL = 'https://ourdahanu.in'

export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || DEFAULT_SITE_URL).replace(/\/$/, '')
export const ROOT_DOMAIN = 'ourdahanu.in'

export function buildAbsoluteUrl(path = '/'): string {
  return new URL(path, SITE_URL).toString()
}
