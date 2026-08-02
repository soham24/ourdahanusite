import { createClient } from '@/lib/supabase/server'
import { resolveSafeRedirect } from '@/lib/safe-redirect'
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
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (error) {
      console.error('[auth/callback] exchangeCodeForSession failed:', error.message, error.status)
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

      // `next` is attacker-controlled query input — resolveSafeRedirect keeps
      // it to our own domains so this cannot become an open redirect.
      return NextResponse.redirect(resolveSafeRedirect(next, origin))
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_failed`)
}
