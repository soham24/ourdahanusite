'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, Store, Search, User } from 'lucide-react'

import { buildAbsoluteUrl } from '@/lib/site'

const TABS = [
  { href: buildAbsoluteUrl('/'), matchPath: '/', label: 'Home', icon: Home },
  { href: buildAbsoluteUrl('/listings'), matchPath: '/listings', label: 'Listings', icon: Store },
  { href: buildAbsoluteUrl('/search'), matchPath: '/search', label: 'Search', icon: Search },
  { href: buildAbsoluteUrl('/dashboard'), matchPath: '/dashboard', label: 'Profile', icon: User },
]

export default function BottomTabBar() {
  const pathname = usePathname()

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-warli-cream border-t border-warli-sand/80 shadow-[0_-4px_20px_rgba(61,26,8,0.08)]">
      <div className="grid grid-cols-4">
        {TABS.map(({ href, matchPath, label, icon: Icon }) => {
          const active = matchPath === '/' ? pathname === '/' : pathname.startsWith(matchPath)
          return (
            <Link
              key={href}
              href={href}
              className={`flex flex-col items-center justify-center gap-1 py-2.5 transition-colors ${
                active
                  ? 'text-warli-terra'
                  : 'text-chikoo-brown/50 hover:text-chikoo-brown'
              }`}
            >
              <Icon
                size={22}
                strokeWidth={active ? 2.5 : 1.8}
                className={active ? 'text-warli-terra' : ''}
              />
              <span className={`text-[10px] font-medium ${active ? 'font-semibold' : ''}`}>
                {label}
              </span>
              {active && (
                <span className="absolute bottom-0 w-8 h-0.5 bg-warli-terra rounded-t-full" />
              )}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
