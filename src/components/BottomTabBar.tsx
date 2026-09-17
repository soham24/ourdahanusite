'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, Store, Search, UserRound, Gamepad2 } from 'lucide-react'

import { buildAbsoluteUrl } from '@/lib/site'
import BottomViewportSpacer from '@/components/BottomViewportSpacer'

const TABS = [
  { href: buildAbsoluteUrl('/'), matchPath: '/', label: 'Home', icon: Home },
  { href: buildAbsoluteUrl('/listings'), matchPath: '/listings', label: 'Explore', icon: Store },
  { href: buildAbsoluteUrl('/search'), matchPath: '/search', label: 'Search', icon: Search },
  { href: buildAbsoluteUrl('/play'), matchPath: '/play', label: 'Play', icon: Gamepad2 },
  { href: buildAbsoluteUrl('/dashboard'), matchPath: '/dashboard', label: 'Profile', icon: UserRound },
]

export default function BottomTabBar() {
  const pathname = usePathname()

  // The checkout page has its own sticky footer with the Pay button. On
  // the apex/www domain (the only place this component renders — business
  // subdomains and find.* already suppress it in SiteBottomTabBar) this
  // fixed nav would otherwise sit on top of that footer and make Pay
  // untappable. Hide site navigation for the whole checkout flow.
  if (pathname?.startsWith('/checkout/')) return null

  return (
    <>
      <nav
        data-mobile-bottom-chrome
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
                className={`relative flex min-h-[58px] flex-col items-center justify-center gap-1 py-2 transition-[color,transform] active:scale-[0.96] ${
                  active
                    ? 'text-[var(--od-brand)]'
                    : 'text-[rgba(79,52,36,0.55)] hover:text-[var(--od-ink-2)]'
                } ${matchPath === '/search' ? '-mt-2' : ''}`}
              >
                <span className={matchPath === '/search' ? 'flex h-10 w-10 items-center justify-center rounded-full bg-[var(--od-brand)] text-white shadow-[0_8px_20px_rgba(192,88,46,0.28)]' : ''}>
                  <Icon size={matchPath === '/search' ? 20 : 22} strokeWidth={active ? 2.5 : 1.8} />
                </span>
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
      <BottomViewportSpacer until="lg" />
    </>
  )
}
