import Image from 'next/image'
import { ShieldAlert } from 'lucide-react'

import NavbarAuthControls from '@/components/NavbarAuthControls'
import SafeAppLink from '@/components/SafeAppLink'
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
    <SafeAppLink href={buildAbsoluteUrl('/')} className="flex items-center gap-2.5 flex-shrink-0">
      <Image src="/logo.png" alt="OurDahanu" width={34} height={34} className="rounded-full" />
      <span className="font-bold text-[17px] text-[#2E1205] tracking-[-0.02em]">
        OurDahanu
      </span>
    </SafeAppLink>
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
    <SafeAppLink
      href={href}
      className="px-[14px] py-1.5 text-sm font-medium text-[#7A4520] rounded-lg hover:bg-[#F4EDE3] hover:text-[#2E1205] transition-all duration-150"
    >
      {label}
    </SafeAppLink>
  )
}

function EmergencyButton() {
  return (
    <SafeAppLink
      href={buildAbsoluteUrl('/emergency')}
      className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-red-700 border border-red-200 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-lg transition-all duration-150"
    >
      <ShieldAlert size={14} />
      Emergency
    </SafeAppLink>
  )
}

export function NavbarFallback() {
  return (
    <nav className="sticky top-0 z-50 bg-[#FAFAF7]/96 backdrop-blur-md border-b border-[#E8DDD2]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between gap-6 h-[60px]">
          <Brand />

          <div className="hidden lg:flex items-center gap-0.5 flex-1 justify-center">
            {NAV_LINKS.map((link) => (
              <NavLink key={link.href} {...link} />
            ))}
          </div>

          <div className="hidden lg:flex items-center gap-2.5">
            <EmergencyButton />
            <SafeAppLink
              href={buildAbsoluteUrl('/login')}
              className="bg-[#2E1205] hover:bg-[#8A3618] text-[#FAFAF7] px-[18px] py-2 rounded-[9px] font-semibold text-sm transition-colors"
            >
              Sign In
            </SafeAppLink>
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
          <EmergencyButton />
          <NavbarAuthControls />
        </>
      )}
      mobileMenu={(
        <>
          <div className="grid grid-cols-2 gap-1 mb-4">
            {MOBILE_NAV.map((link) => (
              <SafeAppLink
                key={link.href}
                href={link.href}
                className="block text-[#7A4520] hover:text-[#2E1205] hover:bg-[#F4EDE3] font-medium py-2.5 px-3 rounded-xl transition-colors text-sm"
              >
                {link.label}
              </SafeAppLink>
            ))}
          </div>
          <div className="pt-3 border-t border-[#E8DDD2] flex flex-col gap-2">
            <SafeAppLink
              href={buildAbsoluteUrl('/emergency')}
              className="flex items-center gap-2 text-red-700 font-bold py-2.5 px-3 bg-red-50 border border-red-200 rounded-xl text-sm"
            >
              <ShieldAlert size={16} />
              Emergency Contacts
            </SafeAppLink>
            <NavbarAuthControls mobile />
          </div>
        </>
      )}
    />
  )
}
