'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import { Loader2 } from 'lucide-react'
import { buildAbsoluteUrl } from '@/lib/site'
import { siteConfig } from '@/lib/site'

function LoginContent() {
  const searchParams = useSearchParams()
  const error = searchParams.get('error')
  const supabase = createClient()
  const [signingIn, setSigningIn] = useState(false)
  const [signInError, setSignInError] = useState(false)
  const checkoutMatch = /^\/checkout\/([a-f0-9-]{36})$/i.exec(searchParams.get('next') || '')

  const handleGoogleSignIn = async () => {
    if (signingIn) return
    setSigningIn(true)
    setSignInError(false)

    // Purge any stale code-verifier cookies (no-domain and domain-scoped)
    // so the browser only sends the fresh one the OAuth flow is about to create.
    document.cookie.split(';').forEach((c) => {
      const name = c.split('=')[0].trim()
      if (name.includes('code-verifier')) {
        document.cookie = `${name}=; max-age=0; path=/`
        document.cookie = `${name}=; max-age=0; path=/; domain=.${siteConfig.domain}`
      }
    })

    const hostname = window.location.hostname
    const isSubdomain = hostname !== siteConfig.domain && hostname.endsWith(`.${siteConfig.domain}`)
    // Always callback via the main domain so cookies get the apex domain scope
    const callbackOrigin = isSubdomain ? `https://${siteConfig.domain}` : window.location.origin
    // After auth, redirect back to where the user came from. On a business
    // subdomain the callback runs on the apex, so `next` must be absolute —
    // but it still has to keep the path, or a buyer signing in from a product
    // lands on the shop root instead of their checkout.
    const next = isSubdomain
      ? window.location.origin + (searchParams.get('next') || '/')
      : (searchParams.get('next') || '/')
    try {
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${callbackOrigin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
      })
      if (oauthError) setSignInError(true)
    } catch {
      setSignInError(true)
    } finally {
      setSigningIn(false)
    }
  }

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-3xl shadow-xl border border-gray-100 p-8 md:p-10">
          {/* Logo */}
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-brand rounded-2xl flex items-center justify-center mx-auto mb-4">
              <span className="text-bg font-bold text-2xl">OD</span>
            </div>
            <h1 className="text-2xl font-bold text-gray-900">{checkoutMatch ? 'Sign in to finish your order' : `Welcome to ${siteConfig.name}`}</h1>
            <p className="text-gray-500 mt-2">{checkoutMatch ? 'You’ll return to checkout after signing in. No payment is taken at this step.' : 'Sign in to access your community'}</p>
            {checkoutMatch && <a href={`/p/${checkoutMatch[1]}`} className="mt-3 inline-block text-sm font-semibold text-brand hover:underline">Back to item</a>}
          </div>

          {(error || signInError) && (
            <div role="alert" className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 mb-6 text-sm text-center">
              Authentication failed. Please try again.
            </div>
          )}

          {/* Google Sign In */}
          <button
            onClick={handleGoogleSignIn}
            disabled={signingIn}
            className="w-full flex items-center justify-center gap-3 bg-white border-2 border-gray-200 hover:border-brand hover:bg-surface-soft disabled:opacity-60 disabled:cursor-not-allowed text-gray-800 font-semibold px-6 py-4 rounded-xl transition-all text-base"
          >
            {signingIn ? (
              <Loader2 size={20} className="animate-spin" />
            ) : (
              <svg width="22" height="22" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
            )}
            {signingIn ? 'Redirecting to Google…' : 'Continue with Google'}
          </button>

          <div className="mt-6 text-center text-sm text-gray-400">
            By signing in, you agree to our{' '}
            <a href={buildAbsoluteUrl('/terms')} className="text-brand hover:underline">Terms of Service</a>
            {' '}and{' '}
            <a href={buildAbsoluteUrl('/privacy')} className="text-brand hover:underline">Privacy Policy</a>
          </div>

          {/* Features */}
          <div className="mt-8 pt-6 border-t border-gray-100">
            <p className="text-xs text-gray-400 text-center mb-4">What you get with {siteConfig.name}</p>
            <div className="grid grid-cols-2 gap-3">
              {[
                { icon: '🛒', text: 'Buy local products' },
                { icon: '📅', text: 'Join events' },
                { icon: '📌', text: 'Post listings' },
                { icon: '🤝', text: '30k+ community' },
              ].map(item => (
                <div key={item.text} className="flex items-center gap-2 text-sm text-gray-600">
                  <span>{item.icon}</span>
                  <span>{item.text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginContent />
    </Suspense>
  )
}
