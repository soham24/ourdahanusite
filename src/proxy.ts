import { NextResponse, type NextRequest } from 'next/server'

const RESERVED = new Set([
  'www', 'admin', 'api', 'app', 'mail', 'shop', 'news', 'events',
  'jobs', 'forum', 'classifieds', 'emergency', 'dashboard', 'login',
  'profile', 'search', 'about', 'listings', 'my-business', 'offline',
  'auth', 'static', 'assets', 'media', 'cdn',
])

function getSubdomain(host: string): string | null {
  if (host.endsWith('.ourdahanu.in')) {
    const prefix = host.slice(0, host.length - '.ourdahanu.in'.length)
    if (prefix && !prefix.includes('.') && !RESERVED.has(prefix)) return prefix
  } else if (host.includes('.localhost')) {
    const withoutPort = host.split(':')[0]
    const parts = withoutPort.split('.')
    if (parts.length >= 2 && parts[0] && !RESERVED.has(parts[0])) return parts[0]
  }
  return null
}

export function proxy(request: NextRequest) {
  const host = request.headers.get('host') || ''
  const subdomain = getSubdomain(host)

  const pathname = request.nextUrl.pathname

  if (!subdomain) {
    return NextResponse.next()
  }

  // On subdomain, rewrite:
  //   / and '' → /listings/[subdomain]  (the listing page)
  //   /sitemap.xml → /sitemap.xml on main domain (pass-through, already works)
  //   /robots.txt → serve inline robots.txt pointing at subdomain's canonical
  if (subdomain && pathname === '/robots.txt') {
    const robotsTxt = [
      'User-agent: *',
      'Allow: /',
      '',
      `Sitemap: https://ourdahanu.in/sitemap.xml`,
      `Host: https://${subdomain}.ourdahanu.in`,
    ].join('\n')
    return new NextResponse(robotsTxt, {
      headers: { 'Content-Type': 'text/plain', 'Cache-Control': 'public, max-age=86400' },
    })
  }

  const shouldRewrite = pathname === '/' || pathname === ''

  const response = shouldRewrite
    ? NextResponse.rewrite(
        Object.assign(request.nextUrl.clone(), { pathname: `/listings/${subdomain}` }),
      )
    : NextResponse.next({ request })

  response.headers.set('x-subdomain', subdomain)
  // Also pass subdomain as a URL param for non-rewrite paths so the listing page knows context
  if (!shouldRewrite) {
    response.headers.set('x-original-host', host)
  }

  return response
}

export const config = {
  matcher: [
    {
      source: '/',
      has: [
        {
          type: 'header',
          key: 'host',
          value:
            '(?!(?:www|admin|api|app|mail|shop|news|events|jobs|forum|classifieds|emergency|dashboard|login|profile|search|about|listings|my-business|offline|auth|static|assets|media|cdn)\\.)(?:[^.]+\\.ourdahanu\\.in|[^.]+\\.localhost(?::\\d+)?)',
        },
      ],
    },
    {
      source: '/robots.txt',
      has: [
        {
          type: 'header',
          key: 'host',
          value:
            '(?!(?:www|admin|api|app|mail|shop|news|events|jobs|forum|classifieds|emergency|dashboard|login|profile|search|about|listings|my-business|offline|auth|static|assets|media|cdn)\\.)(?:[^.]+\\.ourdahanu\\.in|[^.]+\\.localhost(?::\\d+)?)',
        },
      ],
    },
  ],
}
