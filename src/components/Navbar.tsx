import Image from 'next/image'
import Link from 'next/link'
import { ShieldAlert } from 'lucide-react'

import NavbarAuthControls from '@/components/NavbarAuthControls'
import NavbarFrame from '@/components/NavbarFrame'
import { buildAbsoluteUrl } from '@/lib/site'

const NAV_LINKS = [
  { href: buildAbsoluteUrl('/listings'), label: 'Listings' },
  { href: buildAbsoluteUrl('/jobs'), label: 'Jobs' },
  { href: buildAbsoluteUrl('/about'), label: 'About Dahanu' },
]

const MOBILE_NAV = [
  { href: buildAbsoluteUrl('/'), label: 'Home' },
  { href: buildAbsoluteUrl('/listings'), label: 'Listings' },
  { href: buildAbsoluteUrl('/jobs'), label: 'Jobs' },
  { href: buildAbsoluteUrl('/search'), label: 'Search' },
  { href: buildAbsoluteUrl('/about'), label: 'About' },
]

function Brand() {
  return (
    <Link href={buildAbsoluteUrl('/')} className="flex items-center gap-2 flex-shrink-0">
      <Image src="/logo.png" alt="OurDahanu" width={36} height={36} className="rounded-full" />
      <span className="font-bold text-xl text-chikoo-bark">OurDahanu</span>
    </Link>
  )
}

function NavLink({
  href,
  label,
}: {
  href: string
  label: string
}) {
  return (
    <Link
      href={href}
      className="px-3 py-2 text-sm text-chikoo-brown hover:text-warli-terra font-medium transition-colors rounded-lg hover:bg-warli-light"
    >
      {label}
    </Link>
  )
}

export function NavbarFallback() {
  return (
    <nav className="fixed top-8 left-0 right-0 z-50 bg-warli-cream/96 backdrop-blur-sm border-b border-warli-sand/60">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14">
          <Brand />

          <div className="hidden lg:flex items-center gap-1">
            {NAV_LINKS.map((link) => (
              <NavLink key={link.href} {...link} />
            ))}
          </div>

          <div className="hidden lg:flex items-center gap-3">
            <Link
              href={buildAbsoluteUrl('/emergency')}
              className="flex items-center gap-1.5 text-red-700 hover:text-red-800 text-sm font-semibold border border-red-200 hover:border-red-400 px-3 py-1.5 rounded-lg transition-colors"
            >
              <ShieldAlert size={14} />
              Emergency
            </Link>
            <Link
              href={buildAbsoluteUrl('/login')}
              className="bg-warli-terra hover:bg-warli-deep text-warli-cream px-4 py-2 rounded-lg font-medium text-sm transition-colors"
            >
              Sign In
            </Link>
          </div>

          <div className="lg:hidden w-10 h-10" aria-hidden="true" />
        </div>
      </div>
    </nav>
  )
}

export default function Navbar() {
  return (
    <NavbarFrame
      brand={<Brand />}
      desktopNav={NAV_LINKS.map((link) => (
        <NavLink key={link.href} {...link} />
      ))}
      desktopActions={(
        <>
          <Link
            href={buildAbsoluteUrl('/emergency')}
            className="flex items-center gap-1.5 text-red-700 hover:text-red-800 text-sm font-semibold border border-red-200 hover:border-red-400 px-3 py-1.5 rounded-lg transition-colors"
          >
            <ShieldAlert size={14} />
            Emergency
          </Link>
          <NavbarAuthControls />
        </>
      )}
      mobileMenu={(
        <>
          <div className="grid grid-cols-2 gap-1 mb-4">
            {MOBILE_NAV.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="block text-chikoo-brown hover:text-warli-terra hover:bg-warli-light font-medium py-2.5 px-3 rounded-xl transition-colors text-sm"
              >
                {link.label}
              </Link>
            ))}
          </div>
          <div className="pt-3 border-t border-warli-sand flex flex-col gap-2">
            <Link
              href={buildAbsoluteUrl('/emergency')}
              className="flex items-center gap-2 text-red-700 font-bold py-2.5 px-3 bg-red-50 rounded-xl text-sm"
            >
              <ShieldAlert size={16} />
              Emergency Contacts
            </Link>
            <NavbarAuthControls mobile />
          </div>
        </>
      )}
    />
  )
}
