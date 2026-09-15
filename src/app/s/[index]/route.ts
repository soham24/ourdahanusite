import { headers } from 'next/headers'
import { NextResponse } from 'next/server'

import { fetchLegacyServiceTarget } from '@/lib/data/product-detail'
import { getCanonicalListingUrl } from '@/lib/listing-url'
import { getBusinessSubdomain } from '@/lib/subdomain'

// Old "Services & Products" share links (/s/<position>) point at the item
// copied from that position into the catalog.
export async function GET(_request: Request, { params }: { params: Promise<{ index: string }> }) {
  const { index } = await params
  const headerList = await headers()
  const subdomain =
    headerList.get('x-subdomain') ?? getBusinessSubdomain(headerList.get('x-forwarded-host') ?? headerList.get('host'))

  if (!subdomain || !/^\d{1,4}$/.test(index)) {
    return new NextResponse('Not found', { status: 404 })
  }

  const target = await fetchLegacyServiceTarget(subdomain, Number(index))
  if (!target) return new NextResponse('Not found', { status: 404 })

  const businessUrl = getCanonicalListingUrl(target.listingId, subdomain)
  if (!target.productId) return NextResponse.redirect(businessUrl, 307)
  return NextResponse.redirect(`${businessUrl}/p/${target.productId}`, 308)
}
