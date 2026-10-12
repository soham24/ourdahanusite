import Link from 'next/link'
import { MapPin, Phone } from 'lucide-react'

import { getCachedListingDetail } from '@/lib/data/listing-detail'
import { formatAddressForDisplay, formatPhoneForDisplay, normalizePhoneOrNull } from '@/lib/listing-content'
import BottomViewportSpacer from '@/components/BottomViewportSpacer'
import { siteConfig } from '@/lib/site'

/**
 * Footer for business subdomain pages (e.g. organic.ourdahanu.in).
 *
 * These microsites are submitted for the business's own Razorpay account
 * review, so the footer must contain only that business's content — no
 * generic OurDahanu navigation (jobs, classifieds, etc.).
 */
export default async function BusinessFooter({ subdomain }: { subdomain: string }) {
  const data = await getCachedListingDetail(subdomain)
  const listing = data?.listing as Record<string, unknown> | null
  if (!listing) return null

  const name = String(listing.name ?? subdomain)
  const tagline = typeof listing.tagline === 'string' && listing.tagline ? listing.tagline : null
  const address = formatAddressForDisplay(typeof listing.address === 'string' ? listing.address : null)
  const phoneHref = normalizePhoneOrNull(typeof listing.phone === 'string' ? listing.phone : null)
  const phoneLabel = formatPhoneForDisplay(typeof listing.phone === 'string' ? listing.phone : null)

  return (
    <footer className="bg-[#180A02] text-[rgba(251,240,220,0.55)] mt-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 pb-8">
        <div className="mb-8">
          <p className="font-bold text-[17px] text-[#FBF0DC] tracking-[-0.01em] mb-1">{name}</p>
          {tagline && (
            <p className="text-[13px] leading-[1.7] max-w-[420px]">{tagline}</p>
          )}
          <div className="mt-4 flex flex-col gap-2 text-[13px]">
            {address && (
              <p className="flex items-start gap-2">
                <MapPin size={14} className="mt-0.5 flex-shrink-0" />
                <span>{address}</span>
              </p>
            )}
            {phoneHref && phoneLabel && (
              <a
                href={phoneHref}
                className="inline-flex items-center gap-2 hover:text-[#FBF0DC] transition-colors"
              >
                <Phone size={14} className="flex-shrink-0" />
                {phoneLabel}
              </a>
            )}
          </div>
        </div>

        <div className="border-t border-white/[0.06] pt-6 flex flex-col md:flex-row items-center justify-between text-xs gap-2">
          <p className="text-[rgba(251,240,220,0.45)]">© 2026 {name}. All rights reserved.</p>
          <p className="text-[rgba(251,240,220,0.45)]">
            Powered by{' '}
            <Link href={`https://${siteConfig.domain}`} className="hover:text-[#FBF0DC] transition-colors">
              {siteConfig.name}
            </Link>
          </p>
        </div>
        <BottomViewportSpacer until="md" />
      </div>
    </footer>
  )
}
