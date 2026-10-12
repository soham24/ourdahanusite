'use client'

import Link from 'next/link'
import type { User } from '@supabase/supabase-js'

import NotificationBell from '@/components/NotificationBell'
import { useAuth } from '@/lib/auth-context'
import { buildAbsoluteUrl, siteConfig } from '@/lib/site'

interface NavbarAuthControlsProps {
  mobile?: boolean
}

function getDisplayName(user: User) {
  return user.user_metadata?.full_name?.split(' ')[0] || 'Account'
}

function getAvatarUrl(user: User) {
  return (
    user.user_metadata?.avatar_url ||
    `https://ui-avatars.com/api/?name=${encodeURIComponent(user.email || siteConfig.name)}&background=C0582E&color=FBF0DC`
  )
}

export default function NavbarAuthControls({ mobile = false }: NavbarAuthControlsProps) {
  const { user, signOut } = useAuth()

  const handleSignOut = async () => {
    await signOut()
    window.location.href = buildAbsoluteUrl('/')
  }

  if (mobile) {
    if (user) {
      return (
        <div className="flex flex-col gap-2">
          <Link
            href={buildAbsoluteUrl('/my-business')}
            className="flex items-center gap-2 text-[#C0582E] font-bold py-2.5 px-3 bg-[#F4EDE3] rounded-xl text-sm"
          >
            My Business
          </Link>
          <Link
            href={buildAbsoluteUrl('/account/orders')}
            className="flex items-center gap-2 text-[#7A4520] font-medium py-2.5 px-3 rounded-xl text-sm hover:bg-[#F4EDE3] transition-colors"
          >
            My Orders
          </Link>
          <Link
            href={buildAbsoluteUrl('/account/notifications')}
            className="flex items-center gap-2 text-[#7A4520] font-medium py-2.5 px-3 rounded-xl text-sm hover:bg-[#F4EDE3] transition-colors"
          >
            Notifications
          </Link>
          <div className="flex items-center justify-between py-2">
            <Link href={buildAbsoluteUrl('/dashboard')} className="flex items-center gap-2 text-sm font-medium text-[#7A4520]">
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
        className="block bg-[#2E1205] hover:bg-[#8A3618] text-[#FAFAF7] text-center py-3 rounded-xl font-semibold text-sm transition-colors"
      >
        Sign In
      </Link>
    )
  }

  if (user) {
    return (
      <div className="flex items-center gap-2">
        <Link
          href={buildAbsoluteUrl('/my-business')}
          className="text-sm font-medium text-[#7A4520] hover:text-[#2E1205] px-3 py-1.5 rounded-lg hover:bg-[#F4EDE3] transition-colors"
        >
          My Business
        </Link>
        <Link
          href={buildAbsoluteUrl('/account/orders')}
          className="text-sm font-medium text-[#7A4520] hover:text-[#2E1205] px-3 py-1.5 rounded-lg hover:bg-[#F4EDE3] transition-colors"
        >
          My Orders
        </Link>
        <NotificationBell userId={user.id} />
        <Link
          href={buildAbsoluteUrl('/dashboard')}
          className="flex items-center gap-2 text-sm text-[#7A4520] hover:text-[#2E1205]"
        >
          <img src={getAvatarUrl(user)} alt="avatar" className="w-7 h-7 rounded-full" />
          <span className="font-medium">{getDisplayName(user)}</span>
        </Link>
        <button type="button" onClick={handleSignOut} className="text-sm text-[#9A7A60] hover:text-red-700 transition-colors">
          Sign out
        </button>
      </div>
    )
  }

  return (
    <Link
      href={buildAbsoluteUrl('/login')}
      className="bg-[#2E1205] hover:bg-[#8A3618] text-[#FAFAF7] px-[18px] py-2 rounded-[9px] font-semibold text-sm transition-colors"
    >
      Sign In
    </Link>
  )
}
