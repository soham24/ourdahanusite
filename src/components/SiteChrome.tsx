import { headers } from 'next/headers'

import BottomTabBar from '@/components/BottomTabBar'
import BusinessFooter from '@/components/BusinessFooter'
import EmergencyRibbon from '@/components/EmergencyRibbon'
import Footer from '@/components/Footer'
import Navbar from '@/components/Navbar'
import { getBusinessSubdomain } from '@/lib/subdomain'

// Business subdomains (e.g. organic.ourdahanu.in) are standalone microsites —
// each one is reviewed for the business's own Razorpay account, so they must
// not show generic OurDahanu chrome (navbar, jobs links, emergency ribbon,
// bottom tabs). These wrappers read the request host and swap or drop the
// chrome accordingly. They access headers(), so each must be rendered inside
// a <Suspense> boundary (cacheComponents requirement).

function isFindHost(host: string | null | undefined): boolean {
  const h = (host ?? '').split(',')[0].trim().split(':')[0].toLowerCase()
  return h === 'find.ourdahanu.in' || h === 'find.localhost'
}

async function getRequestHost(): Promise<string | null> {
  const headersList = await headers()
  return headersList.get('x-forwarded-host') ?? headersList.get('host')
}

export async function SiteNavbar() {
  const host = await getRequestHost()
  if (getBusinessSubdomain(host) || isFindHost(host)) return null
  return <Navbar />
}

export async function SiteEmergencyRibbon() {
  const host = await getRequestHost()
  if (getBusinessSubdomain(host) || isFindHost(host)) return null
  return <EmergencyRibbon />
}

export async function SiteBottomTabBar() {
  const host = await getRequestHost()
  if (getBusinessSubdomain(host) || isFindHost(host)) return null
  return <BottomTabBar />
}

export async function SiteFooter() {
  const host = await getRequestHost()
  if (isFindHost(host)) return null
  const subdomain = getBusinessSubdomain(host)
  if (subdomain) return <BusinessFooter subdomain={subdomain} />
  return <Footer />
}
