'use client'

import Link from 'next/link'
import { useAuth } from '@/lib/auth-context'
import { buildAbsoluteUrl } from '@/lib/site'

export default function FooterAccountLinks() {
  const { user, loading } = useAuth()

  const linkClass = 'text-sm text-[rgba(251,240,220,0.5)] hover:text-[#FBF0DC] transition-colors'

  return (
    <ul className="flex flex-col gap-2.5">
      {!loading && !user ? (
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
      {user ? (
        <li>
          <Link href={buildAbsoluteUrl('/account/notifications')} className={linkClass}>
            Notifications
          </Link>
        </li>
      ) : null}
    </ul>
  )
}
