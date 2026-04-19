'use client'

import { type ReactNode, useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
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
  const pathname = usePathname()
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    setMenuOpen(false)
  }, [pathname])

  return (
    <nav className="sticky top-0 z-50 bg-[#FAFAF7]/96 backdrop-blur-md border-b border-[#E8DDD2]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between gap-6 h-[60px]">
          {brand}

          <div className="hidden lg:flex items-center gap-0.5 flex-1 justify-center">
            {desktopNav}
          </div>

          <div className="hidden lg:flex items-center gap-2.5 flex-shrink-0">
            {desktopActions}
          </div>

          <button
            type="button"
            className="lg:hidden p-2 text-[#7A4520] hover:text-[#2E1205] transition-colors"
            onClick={() => setMenuOpen((open) => !open)}
            aria-expanded={menuOpen}
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          >
            {menuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>

      {menuOpen ? (
        <div className="lg:hidden bg-[#FAFAF7] border-t border-[#E8DDD2] px-4 py-4">
          {mobileMenu}
        </div>
      ) : null}
    </nav>
  )
}
