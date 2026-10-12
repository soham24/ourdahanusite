/**
 * The Content-Security-Policy, built per deployment.
 *
 * Sent as Content-Security-Policy-Report-Only for now (next.config.ts):
 * browsers report what the policy would block to /api/csp-report, which
 * logs it, and block nothing. Once the logs show no violations from real
 * traffic (checkout, Google sign-in, ads), switch the header name to
 * enforce it.
 *
 * Every third party the site loads, and why:
 *  - Supabase: the database, auth and storage API (and its realtime websocket).
 *  - Razorpay: checkout.js, its API and its iframes during payment.
 *  - Google Analytics and AdSense: only when their IDs are configured, but
 *    always listed so turning them on needs no policy change.
 *  - Vercel Analytics: same-origin (/_vercel/insights), plus its script host.
 *  - Images: any https source. Listing photos come from Supabase storage,
 *    avatars from Google and ui-avatars.com, and owners paste image URLs.
 *
 * `unsafe-inline` for scripts is needed because Next.js inlines its
 * bootstrap scripts; removing it means adopting per-request nonces.
 */
export function buildContentSecurityPolicy({
  supabaseUrl,
  isDev,
}: {
  supabaseUrl: string | undefined
  isDev: boolean
}): string {
  const supabase: string[] = []
  try {
    const origin = new URL(supabaseUrl ?? '').origin
    supabase.push(origin, origin.replace(/^http/, 'ws'))
  } catch {
    // No Supabase configured: nothing to allow.
  }

  const directives: Record<string, string[]> = {
    'default-src': ["'self'"],
    'script-src': [
      "'self'",
      "'unsafe-inline'",
      // React's dev tooling evaluates code; production never does.
      ...(isDev ? ["'unsafe-eval'"] : []),
      'https://checkout.razorpay.com',
      'https://www.googletagmanager.com',
      'https://pagead2.googlesyndication.com',
      'https://*.adtrafficquality.google',
      'https://va.vercel-scripts.com',
    ],
    'style-src': ["'self'", "'unsafe-inline'"],
    'img-src': ["'self'", 'data:', 'blob:', 'https:'],
    'font-src': ["'self'", 'data:'],
    'connect-src': [
      "'self'",
      ...supabase,
      'https://api.razorpay.com',
      'https://lumberjack.razorpay.com',
      'https://*.google-analytics.com',
      'https://*.analytics.google.com',
      'https://www.googletagmanager.com',
      'https://pagead2.googlesyndication.com',
      'https://*.adtrafficquality.google',
      'https://va.vercel-scripts.com',
    ],
    'frame-src': [
      'https://api.razorpay.com',
      'https://checkout.razorpay.com',
      'https://googleads.g.doubleclick.net',
      'https://tpc.googlesyndication.com',
      'https://www.google.com',
    ],
    'form-action': ["'self'", 'https://api.razorpay.com'],
    'frame-ancestors': ["'self'"],
    'base-uri': ["'self'"],
    'object-src': ["'none'"],
    'report-uri': ['/api/csp-report'],
  }

  return Object.entries(directives)
    .map(([name, values]) => `${name} ${values.join(' ')}`)
    .join('; ')
}
