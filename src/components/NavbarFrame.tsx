'use client'

import { type ReactNode, useState } from 'react'
import { Menu, X } from 'lucide-react'

interface NavbarFrameProps {
  brand: ReactNode
  desktopNav: ReactNode
  desktopActions: ReactNode
  mobileMenu: ReactNode
}

export default function NavbarFrame({
  brand,
  desktopNav,
  desktopActions,
  mobileMenu,
}: NavbarFrameProps) {
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <nav className="sticky top-0 z-50 border-b border-[var(--od-border)] bg-[rgba(250,250,247,0.9)] backdrop-blur-xl">
      <div className="od-shell">
        <div className="flex h-[62px] items-center justify-between gap-6">
          {brand}

          <div className="hidden lg:flex items-center gap-0.5 flex-1 justify-center">
            {desktopNav}
          </div>

          <div className="hidden lg:flex items-center gap-2.5 flex-shrink-0">
            {desktopActions}
          </div>

          <button
            type="button"
            className="lg:hidden rounded-xl border border-[var(--od-border)] bg-white/70 p-2 text-[var(--od-ink-2)] hover:text-[var(--od-brand-strong)] transition-colors"
            onClick={() => setMenuOpen((open) => !open)}
            aria-expanded={menuOpen}
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          >
            {menuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>

      {menuOpen ? (
        <div className="lg:hidden border-t border-[var(--od-border)] bg-[var(--od-bg)] px-4 py-4 shadow-[0_18px_40px_rgba(46,18,5,0.08)]">
          {mobileMenu}
        </div>
      ) : null}
    </nav>
  )
}
