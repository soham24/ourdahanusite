'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'

import { createClient } from '@/lib/supabase/client'
import { buildAbsoluteUrl } from '@/lib/site'

type AuthState = 'loading' | 'signed_out' | 'signed_in'

export default function FooterAccountLinks() {
  const [supabase] = useState(() => createClient())
  const [authState, setAuthState] = useState<AuthState>('loading')
  const [user, setUser] = useState<User | null>(null)

  useEffect(() => {
    let mounted = true

    supabase.auth.getUser().then(({ data }) => {
      if (!mounted) return
      setUser(data.user)
      setAuthState(data.user ? 'signed_in' : 'signed_out')
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_, session) => {
      setUser(session?.user ?? null)
      setAuthState(session?.user ? 'signed_in' : 'signed_out')
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [supabase])

  return (
    <ul className="space-y-2 text-sm text-warli-sand/65">
      {authState === 'signed_out' ? (
        <li>
          <Link href={buildAbsoluteUrl('/login')} className="hover:text-warli-cream transition-colors">
            Sign In / Join
          </Link>
        </li>
      ) : null}
      <li>
        <Link href={buildAbsoluteUrl('/dashboard')} className="hover:text-warli-cream transition-colors">
          {user ? 'My Dashboard' : 'Dashboard'}
        </Link>
      </li>
      <li>
        <Link href={buildAbsoluteUrl('/my-business')} className="hover:text-warli-cream transition-colors">
          My Business
        </Link>
      </li>
      <li>
        <Link href={buildAbsoluteUrl('/profile')} className="hover:text-warli-cream transition-colors">
          My Profile
        </Link>
      </li>
    </ul>
  )
}
