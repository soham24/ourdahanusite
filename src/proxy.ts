import { createServerClient } from '@supabase/ssr'
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

export async function proxy(request: NextRequest) {
  const host = request.headers.get('host') || ''
  const subdomain = getSubdomain(host)

  // Set cookie domain to root domain so cookies work across all subdomains
  const isProduction = host.endsWith('ourdahanu.in')
  const cookieDomain = isProduction ? '.ourdahanu.in' : undefined

  const pathname = request.nextUrl.pathname

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

  const shouldRewrite = subdomain && (pathname === '/' || pathname === '')

  let supabaseResponse = shouldRewrite
    ? NextResponse.rewrite(
        Object.assign(request.nextUrl.clone(), { pathname: `/listings/${subdomain}` }),
      )
    : NextResponse.next({ request })

  if (subdomain) {
    supabaseResponse.headers.set('x-subdomain', subdomain)
    // Also pass subdomain as a URL param for non-rewrite paths so the listing page knows context
    if (!shouldRewrite) {
      supabaseResponse.headers.set('x-original-host', host)
    }
  }

  // Always refresh the session so auth state is available on ALL pages (including subdomains)
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          // For subdomain rewrites, update the existing rewrite response
          // For normal requests, create a new response carrying updated request cookies
          if (!subdomain) {
            supabaseResponse = NextResponse.next({ request })
          }
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, {
              ...options,
              // Share cookies across all subdomains in production
              ...(cookieDomain ? { domain: cookieDomain } : {}),
            })
          )
        },
      },
    }
  )

  await supabase.auth.getUser()

  return supabaseResponse
}

export const config = {
  matcher: [
    {
      source:
        '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
      missing: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' },
      ],
    },
  ],
}
