import { createClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/'

  const oauthError = searchParams.get('error')
  if (oauthError) {
    console.error('[auth/callback] OAuth provider error:', oauthError, searchParams.get('error_description'))
    return NextResponse.redirect(`${origin}/login?error=auth_failed`)
  }

  if (code) {
    const cookieStore = await cookies()
    const allCookies = cookieStore.getAll()
    const cookieNames = allCookies.map((c) => c.name)
    const verifierCookie = cookieNames.find((n) => n.includes('code-verifier'))
    console.log('[auth/callback] cookies present:', cookieNames.length, 'verifier:', verifierCookie ?? 'MISSING')

    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (error) {
      console.error('[auth/callback] exchangeCodeForSession failed:', error.message, error.status, (error as any).code)
    }
    if (!error) {
      // Auto-upsert profile with Google name so reviews/posts show real name
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          const fullName = user.user_metadata?.full_name || user.user_metadata?.name || null
          await supabase.from('profiles').upsert({
            id: user.id,
            email: user.email,
            ...(fullName ? { full_name: fullName } : {}),
          }, { onConflict: 'id', ignoreDuplicates: false })
        }
      } catch { /* non-fatal */ }

      // next may be a full URL (e.g. https://abcd.ourdahanu.in) or a path (e.g. /dashboard)
      const isFullUrl = next.startsWith('https://') || next.startsWith('http://')
      const redirectUrl = isFullUrl ? next : `${origin}${next}`
      return NextResponse.redirect(redirectUrl)
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_failed`)
}
