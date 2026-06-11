import { NextResponse, type NextRequest } from 'next/server'

import { getBusinessSubdomain } from '@/lib/subdomain'

export function proxy(request: NextRequest) {
  const host = request.headers.get('host') || ''
  const subdomain = getBusinessSubdomain(host)

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

// Keep all values in export const config as pure inline literals.
// Next.js's extractExportedConstValue cannot resolve variable references inside this export
// and will mark the config as "unsupported", failing the build with
// "Invalid segment configuration export detected".
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
    {
      // Standalone product detail pages — middleware sets x-subdomain header
      source: '/p/:path*',
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
      // Standalone service detail pages — middleware sets x-subdomain header
      source: '/s/:path*',
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
