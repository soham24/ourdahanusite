import Link from 'next/link'
import { ShieldAlert } from 'lucide-react'

import FooterAccountLinks from '@/components/FooterAccountLinks'
import { buildAbsoluteUrl } from '@/lib/site'

export default function Footer() {
  return (
    <footer className="bg-chikoo-bark text-warli-cream mt-16">
      <div className="warli-divider opacity-60" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">

          {/* Brand */}
          <div className="md:col-span-2">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 bg-warli-terra rounded-full flex items-center justify-center warli-pattern">
                <span className="text-warli-cream font-bold text-sm">OD</span>
              </div>
              <span className="font-bold text-xl text-warli-cream">OurDahanu</span>
            </div>
            <p className="text-warli-sand/75 text-sm leading-relaxed max-w-xs mb-5">
              Dahanu's own community platform — find local businesses, services and connect with 30,000+ people of Dahanu, Bordi, Gholvad and Palghar.
            </p>
            <Link
              href={buildAbsoluteUrl('/emergency')}
              className="inline-flex items-center gap-2 bg-red-700 hover:bg-red-600 text-white text-sm font-bold px-4 py-2 rounded-xl transition-colors"
            >
              <ShieldAlert size={14} />
              Emergency Contacts
            </Link>
          </div>

          {/* Explore */}
          <div>
            <h3 className="font-semibold text-warli-sand mb-3 text-sm">Explore</h3>
            <ul className="space-y-2 text-sm text-warli-sand/65">
              <li><Link href={buildAbsoluteUrl('/listings')} className="hover:text-warli-cream transition-colors">Business Listings</Link></li>
              <li><Link href={buildAbsoluteUrl('/listings/submit')} className="hover:text-warli-cream transition-colors">List Your Business</Link></li>
              <li><Link href={buildAbsoluteUrl('/jobs')} className="hover:text-warli-cream transition-colors">Jobs in Dahanu</Link></li>
              <li><Link href={buildAbsoluteUrl('/emergency')} className="hover:text-warli-cream transition-colors">Emergency &amp; Safety</Link></li>
              <li><Link href={buildAbsoluteUrl('/search')} className="hover:text-warli-cream transition-colors">Search</Link></li>
              <li><Link href={buildAbsoluteUrl('/about')} className="hover:text-warli-cream transition-colors">About Dahanu</Link></li>
            </ul>
          </div>

          {/* Account */}
          <div>
            <h3 className="font-semibold text-warli-sand mb-3 text-sm">Account</h3>
            <FooterAccountLinks />
          </div>

        </div>

        <div className="border-t border-chikoo-brown/60 mt-10 pt-6 flex flex-col md:flex-row items-center justify-between text-xs text-warli-sand/40 gap-2">
          <p>© 2026 OurDahanu. All rights reserved.</p>
          <p>Made with ❤️ for the Dahanu community</p>
        </div>
      </div>
    </footer>
  )
}
