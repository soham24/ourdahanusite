'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, Store, Search, UserRound, Gamepad2 } from 'lucide-react'

import { buildAbsoluteUrl } from '@/lib/site'

const TABS = [
  { href: buildAbsoluteUrl('/'), matchPath: '/', label: 'Home', icon: Home },
  { href: buildAbsoluteUrl('/listings'), matchPath: '/listings', label: 'Listings', icon: Store },
  { href: buildAbsoluteUrl('/search'), matchPath: '/search', label: 'Search', icon: Search },
  { href: buildAbsoluteUrl('/play'), matchPath: '/play', label: 'Play', icon: Gamepad2 },
  { href: buildAbsoluteUrl('/dashboard'), matchPath: '/dashboard', label: 'Profile', icon: UserRound },
]

export default function BottomTabBar() {
  const pathname = usePathname()

  return (
    <nav
      className="lg:hidden fixed bottom-0 left-0 right-0 z-50 border-t border-[var(--od-border)] bg-[rgba(250,250,247,0.96)] shadow-[0_-10px_30px_rgba(46,18,5,0.08)] backdrop-blur-xl"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      <div className="grid grid-cols-5">
        {TABS.map(({ href, matchPath, label, icon: Icon }) => {
          const active = matchPath === '/' ? pathname === '/' : pathname.startsWith(matchPath)
          return (
            <Link
              key={href}
              href={href}
              className={`relative flex flex-col items-center justify-center gap-1 py-2.5 transition-colors active:opacity-70 ${
                active
                  ? 'text-[var(--od-brand)]'
                  : 'text-[rgba(79,52,36,0.55)] hover:text-[var(--od-ink-2)]'
              }`}
            >
              <Icon
                size={22}
                strokeWidth={active ? 2.5 : 1.8}
                className={active ? 'text-[var(--od-brand)]' : ''}
              />
              <span className={`text-[11px] font-medium ${active ? 'font-semibold' : ''}`}>
                {label}
              </span>
              {active && (
                <span className="absolute top-0 left-1/4 right-1/4 h-0.5 rounded-b-full bg-[var(--od-brand)]" />
              )}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
