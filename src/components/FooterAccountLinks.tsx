'use client'

import { useSyncExternalStore } from 'react'
import Link from 'next/link'
import { useAuth } from '@/lib/auth-context'
import { buildAbsoluteUrl } from '@/lib/site'

const subscribeNever = () => () => {}

// This component sits inside a <Suspense fallback={null}> boundary (the
// footer), which React can hydrate well after AuthProvider's own effect
// has already resolved — so `loading`/`user` may already reflect the real
// auth state by the time THIS component hydrates, while the SSR HTML it's
// hydrating against was always rendered with loading=true. Gating on our
// own hydrated flag (not the shared auth state) keeps this component's
// first client render identical to the server's, regardless of when
// AuthProvider's effect happened to fire.
function useHydrated(): boolean {
  return useSyncExternalStore(subscribeNever, () => true, () => false)
}

export default function FooterAccountLinks() {
  const { user, loading } = useAuth()
  const hydrated = useHydrated()

  // Treat auth as unresolved (SSR's actual state) until we're hydrated, so
  // every branch below matches the server markup on first paint.
  const knownUser = hydrated ? user : null

  const linkClass = 'text-sm text-[rgba(251,240,220,0.5)] hover:text-[#FBF0DC] transition-colors'

  return (
    <ul className="flex flex-col gap-2.5">
      {hydrated && !loading && !knownUser ? (
        <li>
          <Link href={buildAbsoluteUrl('/login')} className={linkClass}>
            Sign In / Join
          </Link>
        </li>
      ) : null}
      <li>
        <Link href={buildAbsoluteUrl('/dashboard')} className={linkClass}>
          {knownUser ? 'My Dashboard' : 'Dashboard'}
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
      {knownUser ? (
        <li>
          <Link href={buildAbsoluteUrl('/account/notifications')} className={linkClass}>
            Notifications
          </Link>
        </li>
      ) : null}
    </ul>
  )
}
