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

async function getRequestBusinessSubdomain(): Promise<string | null> {
  const headersList = await headers()
  return getBusinessSubdomain(headersList.get('x-forwarded-host') ?? headersList.get('host'))
}

export async function SiteNavbar() {
  if (await getRequestBusinessSubdomain()) return null
  return <Navbar />
}

export async function SiteEmergencyRibbon() {
  if (await getRequestBusinessSubdomain()) return null
  return <EmergencyRibbon />
}

export async function SiteBottomTabBar() {
  if (await getRequestBusinessSubdomain()) return null
  return <BottomTabBar />
}

export async function SiteFooter() {
  const subdomain = await getRequestBusinessSubdomain()
  if (subdomain) return <BusinessFooter subdomain={subdomain} />
  return <Footer />
}
