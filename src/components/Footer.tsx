import Image from 'next/image'
import Link from 'next/link'
import { ShieldAlert } from 'lucide-react'

import FooterAccountLinks from '@/components/FooterAccountLinks'
import { buildAbsoluteUrl } from '@/lib/site'

const EXPLORE_LINKS = [
  { href: '/listings', label: 'Business Listings' },
  { href: '/guides', label: 'Dahanu Guides' },
  { href: '/listings/submit', label: 'List Your Business' },
  { href: '/emergency', label: 'Emergency & Safety' },
  { href: '/search', label: 'Search' },
  { href: '/about', label: 'About OurDahanu' },
]

export default function Footer() {
  return (
    <footer className="bg-[#180A02] text-[rgba(251,240,220,0.55)] mt-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-14 pb-8">
        <div className="grid grid-cols-1 md:grid-cols-[2fr_1fr_1fr] gap-12 mb-10">

          {/* Brand */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Image src="/logo.png" alt="OurDahanu" width={28} height={28} className="rounded-full" />
              <span className="font-bold text-[18px] text-[#FBF0DC] tracking-[-0.01em]">OurDahanu</span>
            </div>
            <p className="text-[13px] leading-[1.7] mb-5 max-w-[280px]">
              Dahanu&apos;s own community platform — find local businesses, services, and connect with 30,000+ people of Dahanu, Bordi, Gholvad and Palghar.
            </p>
            <Link
              href={buildAbsoluteUrl('/emergency')}
              className="inline-flex items-center gap-1.5 bg-red-900 hover:bg-red-800 text-red-100 text-[13px] font-semibold px-4 py-2 rounded-lg transition-colors"
            >
              <ShieldAlert size={14} />
              Emergency Contacts
            </Link>
          </div>

          {/* Explore */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-[0.08em] text-[rgba(251,240,220,0.4)] mb-4">
              Explore
            </h4>
            <ul className="flex flex-col gap-2.5">
              {EXPLORE_LINKS.map((link) => (
                <li key={link.href}>
                  <Link
                    href={buildAbsoluteUrl(link.href)}
                    className="text-sm text-[rgba(251,240,220,0.5)] hover:text-[#FBF0DC] transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Account */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-[0.08em] text-[rgba(251,240,220,0.4)] mb-4">
              Account
            </h4>
            <FooterAccountLinks />
          </div>

        </div>

        <div className="border-t border-white/[0.06] pt-6 flex flex-col md:flex-row items-center justify-between text-xs gap-2">
          <p className="text-[rgba(251,240,220,0.45)]">© 2026 OurDahanu. All rights reserved.</p>
          <div className="flex items-center gap-4">
            <Link
              href={buildAbsoluteUrl('/contact')}
              className="text-[rgba(251,240,220,0.45)] hover:text-[#FBF0DC] transition-colors"
            >
              Contact
            </Link>
            <Link
              href={buildAbsoluteUrl('/privacy')}
              className="text-[rgba(251,240,220,0.45)] hover:text-[#FBF0DC] transition-colors"
            >
              Privacy Policy
            </Link>
            <Link
              href={buildAbsoluteUrl('/terms')}
              className="text-[rgba(251,240,220,0.45)] hover:text-[#FBF0DC] transition-colors"
            >
              Terms
            </Link>
            <p className="text-[rgba(251,240,220,0.45)]">Made in Dahanu</p>
          </div>
        </div>
      </div>
    </footer>
  )
}
