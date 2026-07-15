import { adsEnabled, adsTxtPublisherId } from '@/lib/ads'

// Serves /ads.txt. Empty until the AdSense publisher ID is configured (prod
// only); then it emits the authorization line AdSense requires to serve ads.
// Reads only build-inlined env, so Next prerenders it as static text.
export function GET() {
  const body = adsEnabled()
    ? `google.com, ${adsTxtPublisherId()}, DIRECT, f08c47fec0942fa0\n`
    : ''
  return new Response(body, {
    headers: { 'content-type': 'text/plain; charset=utf-8' },
  })
}
