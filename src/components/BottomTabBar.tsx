'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, Store, Search, UserRound } from 'lucide-react'

import { buildAbsoluteUrl } from '@/lib/site'

const TABS = [
  { href: buildAbsoluteUrl('/'), matchPath: '/', label: 'Home', icon: Home },
  { href: buildAbsoluteUrl('/listings'), matchPath: '/listings', label: 'Listings', icon: Store },
  { href: buildAbsoluteUrl('/search'), matchPath: '/search', label: 'Search', icon: Search },
  { href: buildAbsoluteUrl('/dashboard'), matchPath: '/dashboard', label: 'Profile', icon: UserRound },
]

export default function BottomTabBar() {
  const pathname = usePathname()

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 border-t border-[var(--od-border)] bg-[rgba(250,250,247,0.96)] shadow-[0_-10px_30px_rgba(46,18,5,0.08)] backdrop-blur-xl">
      <div className="grid grid-cols-4">
        {TABS.map(({ href, matchPath, label, icon: Icon }) => {
          const active = matchPath === '/' ? pathname === '/' : pathname.startsWith(matchPath)
          return (
            <Link
              key={href}
              href={href}
              className={`flex flex-col items-center justify-center gap-1 py-2.5 transition-colors ${
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
              <span className={`text-[10px] font-medium ${active ? 'font-semibold' : ''}`}>
                {label}
              </span>
              {active && (
                <span className="absolute bottom-0 h-0.5 w-8 rounded-t-full bg-[var(--od-brand)]" />
              )}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
