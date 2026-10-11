import { NextResponse, type NextRequest } from 'next/server'

import { ROOT_DOMAIN } from '@/lib/site-config'
import { getBusinessSubdomain } from '@/lib/subdomain'

export function proxy(request: NextRequest) {
  const host = request.headers.get('host') || ''

  // find.ourdahanu.in → /find/* (standalone directory, own layout)
  const findHost = host.split(':')[0].toLowerCase()
  if (findHost === `find.${ROOT_DOMAIN}` || findHost === 'find.localhost') {
    const pathname = request.nextUrl.pathname
    // Let Next serve framework internals, API routes, and static files
    // directly — only page paths get rewritten under /find.
    const isInternalOrAsset =
      pathname.startsWith('/_next') ||
      pathname.startsWith('/api') ||
      /\.[^/]+$/.test(pathname) // any path with a file extension (favicon.ico, *.png, *.css, ...)
    if (isInternalOrAsset) {
      return NextResponse.next()
    }
    const url = request.nextUrl.clone()
    if (!url.pathname.startsWith('/find')) {
      url.pathname = url.pathname === '/' ? '/find' : `/find${url.pathname}`
    }
    return NextResponse.rewrite(url)
  }

  // appointments.ourdahanu.in → /appointments/* (standalone booking directory,
  // own layout). Same shape as the find branch above.
  if (findHost === `appointments.${ROOT_DOMAIN}` || findHost === 'appointments.localhost') {
    const pathname = request.nextUrl.pathname
    const isInternalOrAsset =
      pathname.startsWith('/_next') ||
      pathname.startsWith('/api') ||
      /\.[^/]+$/.test(pathname)
    if (isInternalOrAsset) {
      return NextResponse.next()
    }
    const url = request.nextUrl.clone()
    if (!url.pathname.startsWith('/appointments')) {
      url.pathname = url.pathname === '/' ? '/appointments' : `/appointments${url.pathname}`
    }
    return NextResponse.rewrite(url)
  }

  // jobs.ourdahanu.in → /jobs/* (standalone jobs board, own layout). Same
  // shape as the find and appointments branches above.
  if (findHost === `jobs.${ROOT_DOMAIN}` || findHost === 'jobs.localhost') {
    const pathname = request.nextUrl.pathname
    const isInternalOrAsset =
      pathname.startsWith('/_next') ||
      pathname.startsWith('/api') ||
      /\.[^/]+$/.test(pathname)
    if (isInternalOrAsset) {
      return NextResponse.next()
    }
    const url = request.nextUrl.clone()
    if (!url.pathname.startsWith('/jobs')) {
      url.pathname = url.pathname === '/' ? '/jobs' : `/jobs${url.pathname}`
    }
    return NextResponse.rewrite(url)
  }

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
      `Sitemap: https://${ROOT_DOMAIN}/sitemap.xml`,
      `Host: https://${subdomain}.${ROOT_DOMAIN}`,
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
            '(?!(?:www|admin|api|app|mail|shop|news|events|jobs|forum|classifieds|emergency|dashboard|login|profile|search|about|listings|my-business|offline|auth|static|assets|media|cdn|find|appointments)\\.)(?:[^.]+\\.ourdahanu\\.in|[^.]+\\.localhost(?::\\d+)?)',
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
            '(?!(?:www|admin|api|app|mail|shop|news|events|jobs|forum|classifieds|emergency|dashboard|login|profile|search|about|listings|my-business|offline|auth|static|assets|media|cdn|find|appointments)\\.)(?:[^.]+\\.ourdahanu\\.in|[^.]+\\.localhost(?::\\d+)?)',
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
            '(?!(?:www|admin|api|app|mail|shop|news|events|jobs|forum|classifieds|emergency|dashboard|login|profile|search|about|listings|my-business|offline|auth|static|assets|media|cdn|find|appointments)\\.)(?:[^.]+\\.ourdahanu\\.in|[^.]+\\.localhost(?::\\d+)?)',
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
            '(?!(?:www|admin|api|app|mail|shop|news|events|jobs|forum|classifieds|emergency|dashboard|login|profile|search|about|listings|my-business|offline|auth|static|assets|media|cdn|find|appointments)\\.)(?:[^.]+\\.ourdahanu\\.in|[^.]+\\.localhost(?::\\d+)?)',
        },
      ],
    },
    {
      // Checkout pages — middleware sets the x-subdomain header for parity
      // with /p and /s. The page itself resolves everything from productId,
      // so nothing reads this header today; it is here so subdomain context
      // is available if checkout ever needs it.
      source: '/checkout/:path*',
      has: [
        {
          type: 'header',
          key: 'host',
          value:
            '(?!(?:www|admin|api|app|mail|shop|news|events|jobs|forum|classifieds|emergency|dashboard|login|profile|search|about|listings|my-business|offline|auth|static|assets|media|cdn|find|appointments)\\.)(?:[^.]+\\.ourdahanu\\.in|[^.]+\\.localhost(?::\\d+)?)',
        },
      ],
    },
    {
      // find.ourdahanu.in — standalone professionals directory
      source: '/:path*',
      has: [
        {
          type: 'header',
          key: 'host',
          value: '(?:find\\.ourdahanu\\.in|find\\.localhost(?::\\d+)?)',
        },
      ],
    },
    {
      // appointments.ourdahanu.in — standalone booking directory
      source: '/:path*',
      has: [
        {
          type: 'header',
          key: 'host',
          value: '(?:appointments\\.ourdahanu\\.in|appointments\\.localhost(?::\\d+)?)',
        },
      ],
    },
    {
      // jobs.ourdahanu.in — standalone jobs board
      source: '/:path*',
      has: [
        {
          type: 'header',
          key: 'host',
          value: '(?:jobs\\.ourdahanu\\.in|jobs\\.localhost(?::\\d+)?)',
        },
      ],
    },
  ],
}
