import { headers } from 'next/headers'

import BottomTabBar from '@/components/BottomTabBar'
import BusinessFooter from '@/components/BusinessFooter'
import EmergencyRibbon from '@/components/EmergencyRibbon'
import Footer from '@/components/Footer'
import Navbar from '@/components/Navbar'
import { getStandaloneSubdomain } from '@/lib/standalone-hosts'
import { getBusinessSubdomain } from '@/lib/subdomain'

// Business subdomains (e.g. organic.ourdahanu.in) are standalone microsites —
// each one is reviewed for the business's own Razorpay account, so they must
// not show generic OurDahanu chrome (navbar, jobs links, emergency ribbon,
// bottom tabs). The standalone products — find, appointments and jobs — render
// their own header and footer, so the main chrome is hidden there too; before
// appointments was added here it rendered two footers and a doubled ribbon.
// These wrappers read the request host and swap or drop the chrome
// accordingly. They access headers(), so each must be rendered inside a
// <Suspense> boundary (cacheComponents requirement).

async function getRequestHost(): Promise<string | null> {
  const headersList = await headers()
  return headersList.get('x-forwarded-host') ?? headersList.get('host')
}

export async function SiteNavbar() {
  const host = await getRequestHost()
  if (getBusinessSubdomain(host) || getStandaloneSubdomain(host)) return null
  return <Navbar />
}

export async function SiteEmergencyRibbon() {
  const host = await getRequestHost()
  if (getBusinessSubdomain(host) || getStandaloneSubdomain(host)) return null
  return <EmergencyRibbon />
}

export async function SiteBottomTabBar() {
  const host = await getRequestHost()
  if (getBusinessSubdomain(host) || getStandaloneSubdomain(host)) return null
  return <BottomTabBar />
}

export async function SiteFooter() {
  const host = await getRequestHost()
  if (getStandaloneSubdomain(host)) return null
  const subdomain = getBusinessSubdomain(host)
  if (subdomain) return <BusinessFooter subdomain={subdomain} />
  return <Footer />
}
