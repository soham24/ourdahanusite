import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

const RESERVED = new Set([
  'www', 'admin', 'api', 'app', 'mail', 'shop', 'news', 'events',
  'jobs', 'forum', 'classifieds', 'emergency', 'dashboard', 'login',
  'profile', 'search', 'about', 'listings', 'my-business', 'offline',
  'auth', 'static', 'assets', 'media', 'cdn',
])

export async function GET(request: NextRequest) {
  const subdomain = request.nextUrl.searchParams.get('s')?.trim().toLowerCase()

  if (!subdomain) {
    return NextResponse.json({ error: 'No subdomain provided' }, { status: 400 })
  }

  if (!/^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$/.test(subdomain)) {
    return NextResponse.json({ available: false, reason: 'invalid' })
  }

  if (RESERVED.has(subdomain)) {
    return NextResponse.json({ available: false, reason: 'reserved' })
  }

  try {
    const supabase = await createClient()
    const { data } = await supabase
      .from('listings')
      .select('id')
      .eq('subdomain', subdomain)
      .maybeSingle()

    return NextResponse.json({ available: !data })
  } catch {
    return NextResponse.json({ error: 'Could not check' }, { status: 500 })
  }
}
