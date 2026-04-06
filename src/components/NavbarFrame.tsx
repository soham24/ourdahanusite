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
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20)
    onScroll()
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    setMenuOpen(false)
  }, [pathname])

  return (
    <nav
      className={`fixed top-8 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? 'bg-warli-cream shadow-md shadow-warli-sand/60'
          : 'bg-warli-cream/96 backdrop-blur-sm'
      } border-b border-warli-sand/60`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14">
          {brand}

          <div className="hidden lg:flex items-center gap-1">
            {desktopNav}
          </div>

          <div className="hidden lg:flex items-center gap-3">
            {desktopActions}
          </div>

          <button
            type="button"
            className="lg:hidden p-2 text-chikoo-brown"
            onClick={() => setMenuOpen((open) => !open)}
            aria-expanded={menuOpen}
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          >
            {menuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>

      {menuOpen ? (
        <div className="lg:hidden bg-warli-cream border-t border-warli-sand px-4 py-4">
          {mobileMenu}
        </div>
      ) : null}
    </nav>
  )
}
