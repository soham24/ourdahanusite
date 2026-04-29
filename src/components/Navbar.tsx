import Image from 'next/image'
import { BriefcaseBusiness, Plus, Search, ShieldAlert, Store, UsersRound } from 'lucide-react'

import NavbarAuthControls from '@/components/NavbarAuthControls'
import SafeAppLink from '@/components/SafeAppLink'
import NavbarFrame from '@/components/NavbarFrame'
import { buildAbsoluteUrl } from '@/lib/site'

const NAV_LINKS = [
  { href: buildAbsoluteUrl('/listings'), label: 'Businesses' },
  { href: buildAbsoluteUrl('/jobs'), label: 'Jobs' },
  { href: buildAbsoluteUrl('/search'), label: 'Search' },
  { href: buildAbsoluteUrl('/about'), label: 'About' },
]

const MOBILE_NAV = [
  { href: buildAbsoluteUrl('/listings'), label: 'Explore Businesses', icon: Store },
  { href: buildAbsoluteUrl('/search'), label: 'Search Everything', icon: Search },
  { href: buildAbsoluteUrl('/jobs'), label: 'Jobs in Dahanu', icon: BriefcaseBusiness },
  { href: buildAbsoluteUrl('/about'), label: 'About OurDahanu', icon: UsersRound },
  { href: buildAbsoluteUrl('/listings/submit'), label: 'Add Business', icon: Plus },
]

function Brand() {
  return (
    <SafeAppLink href={buildAbsoluteUrl('/')} className="flex items-center gap-2.5 flex-shrink-0">
      <Image src="/logo.png" alt="OurDahanu" width={34} height={34} className="rounded-full" />
      <span className="font-bold text-[17px] text-[var(--od-ink)] tracking-[-0.02em]">
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
      className="px-[14px] py-1.5 text-sm font-semibold text-[var(--od-ink-2)] rounded-lg hover:bg-[#F4EDE3] hover:text-[var(--od-brand-strong)] transition-all duration-150"
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
            <SafeAppLink href={buildAbsoluteUrl('/listings/submit')} className="od-button-primary px-4 py-2 text-sm">
              <Plus size={15} /> Add Business
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
            {MOBILE_NAV.map(({ icon: Icon, ...link }) => (
              <SafeAppLink
                key={link.href}
                href={link.href}
                className="flex items-center gap-2 text-[var(--od-ink-2)] hover:text-[var(--od-brand-strong)] hover:bg-[#F4EDE3] font-semibold py-2.5 px-3 rounded-xl transition-colors text-sm"
              >
                <Icon size={15} />
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
