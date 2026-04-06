'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'

import { createClient } from '@/lib/supabase/client'
import { buildAbsoluteUrl } from '@/lib/site'

interface NavbarAuthControlsProps {
  mobile?: boolean
}

function getDisplayName(user: User) {
  return user.user_metadata?.full_name?.split(' ')[0] || 'Account'
}

function getAvatarUrl(user: User) {
  return (
    user.user_metadata?.avatar_url ||
    `https://ui-avatars.com/api/?name=${encodeURIComponent(user.email || 'OurDahanu')}&background=C4663A&color=FBF0DC`
  )
}

export default function NavbarAuthControls({ mobile = false }: NavbarAuthControlsProps) {
  const [supabase] = useState(() => createClient())
  const [user, setUser] = useState<User | null>(null)

  useEffect(() => {
    let mounted = true

    supabase.auth.getUser().then(({ data }) => {
      if (mounted) {
        setUser(data.user)
      }
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_, session) => {
      setUser(session?.user ?? null)
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [supabase])

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    window.location.href = buildAbsoluteUrl('/')
  }

  if (mobile) {
    if (user) {
      return (
        <div className="flex flex-col gap-2">
          <Link
            href={buildAbsoluteUrl('/my-business')}
            className="flex items-center gap-2 text-warli-terra font-bold py-2.5 px-3 bg-warli-light rounded-xl text-sm"
          >
            My Business
          </Link>
          <div className="flex items-center justify-between py-2">
            <Link href={buildAbsoluteUrl('/dashboard')} className="flex items-center gap-2 text-sm font-medium text-chikoo-brown">
              <img src={getAvatarUrl(user)} alt="avatar" className="w-8 h-8 rounded-full" />
              {getDisplayName(user)}
            </Link>
            <button type="button" onClick={handleSignOut} className="text-red-700 font-medium text-sm">
              Sign out
            </button>
          </div>
        </div>
      )
    }

    return (
      <Link
        href={buildAbsoluteUrl('/login')}
        className="block bg-warli-terra text-warli-cream text-center py-3 rounded-xl font-bold text-sm"
      >
        Sign In
      </Link>
    )
  }

  if (user) {
    return (
      <div className="flex items-center gap-3">
        <Link
          href={buildAbsoluteUrl('/my-business')}
          className="text-sm font-medium text-chikoo-brown hover:text-warli-terra px-3 py-1.5 rounded-lg hover:bg-warli-light transition-colors"
        >
          My Business
        </Link>
        <Link
          href={buildAbsoluteUrl('/dashboard')}
          className="flex items-center gap-2 text-sm text-chikoo-brown hover:text-warli-terra"
        >
          <img src={getAvatarUrl(user)} alt="avatar" className="w-8 h-8 rounded-full" />
          <span className="font-medium">{getDisplayName(user)}</span>
        </Link>
        <button type="button" onClick={handleSignOut} className="text-sm text-chikoo-brown/50 hover:text-red-700 transition-colors">
          Sign out
        </button>
      </div>
    )
  }

  return (
    <Link
      href={buildAbsoluteUrl('/login')}
      className="bg-warli-terra hover:bg-warli-deep text-warli-cream px-4 py-2 rounded-lg font-medium text-sm transition-colors"
    >
      Sign In
    </Link>
  )
}
