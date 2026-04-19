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

  const linkClass = 'text-sm text-[rgba(251,240,220,0.5)] hover:text-[#FBF0DC] transition-colors'

  return (
    <ul className="flex flex-col gap-2.5">
      {authState === 'signed_out' ? (
        <li>
          <Link href={buildAbsoluteUrl('/login')} className={linkClass}>
            Sign In / Join
          </Link>
        </li>
      ) : null}
      <li>
        <Link href={buildAbsoluteUrl('/dashboard')} className={linkClass}>
          {user ? 'My Dashboard' : 'Dashboard'}
        </Link>
      </li>
      <li>
        <Link href={buildAbsoluteUrl('/my-business')} className={linkClass}>
          My Business
        </Link>
      </li>
      <li>
        <Link href={buildAbsoluteUrl('/profile')} className={linkClass}>
          My Profile
        </Link>
      </li>
      {authState === 'signed_in' ? (
        <li>
          <Link href={buildAbsoluteUrl('/account/notifications')} className={linkClass}>
            Notifications
          </Link>
        </li>
      ) : null}
    </ul>
  )
}
