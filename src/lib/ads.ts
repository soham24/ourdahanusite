// Google AdSense configuration.
//
// Everything is inert unless NEXT_PUBLIC_ADSENSE_CLIENT_ID is set to a real
// `ca-pub-…` value. Following the same pattern as NEXT_PUBLIC_GA_ID, this var
// is set ONLY in Vercel's Production environment, so dev/preview never load
// ads and there are no empty ad units before the ID is configured. The env
// var is inlined at build time, so this check is safe in both server and
// client components.

export const ADSENSE_CLIENT_ID = process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID ?? ''

/** True only when a real AdSense publisher ID is configured. */
export function adsEnabled(): boolean {
  return /^ca-pub-\d+$/.test(ADSENSE_CLIENT_ID)
}

/** `ca-pub-1234…` → `pub-1234…`, the form used in the ads.txt authorization line. */
export function adsTxtPublisherId(): string {
  return ADSENSE_CLIENT_ID.replace(/^ca-/, '')
}
