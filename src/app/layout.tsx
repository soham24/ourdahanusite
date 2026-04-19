import type { Metadata, Viewport } from 'next'
import { Suspense } from 'react'
import { DM_Sans, Instrument_Serif, Plus_Jakarta_Sans } from 'next/font/google'
import './globals.css'
import Navbar, { NavbarFallback } from '@/components/Navbar'
import Footer from '@/components/Footer'
import BottomTabBar from '@/components/BottomTabBar'
import EmergencyRibbon, { EmergencyRibbonFallback } from '@/components/EmergencyRibbon'
import ServiceWorkerRegistration from '@/components/ServiceWorkerRegistration'
import StructuredData from '@/components/StructuredData'
import { buildAbsoluteUrl, SITE_URL } from '@/lib/site'
import { Analytics } from '@vercel/analytics/next'

const METADATA_BASE_URL = 'https://ourdahanu.in'
const LOGO_URL = 'https://ourdahanu.in/logo.png'

// Primary body font — DM Sans (revamped design system)
const dmSans = DM_Sans({
  subsets: ['latin'],
  variable: '--font-dm',
  display: 'swap',
  weight: ['300', '400', '500', '600', '700'],
})

// Display serif for hero + section headlines
const instrumentSerif = Instrument_Serif({
  weight: ['400'],
  style: ['normal', 'italic'],
  subsets: ['latin'],
  variable: '--font-instrument',
  display: 'swap',
})

// Kept for backward compat — some older pages still reference var(--font-jakarta) via the legacy --font-family-sans fallback
const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-jakarta',
  display: 'swap',
  weight: ['400', '500', '600', '700', '800'],
})

export const metadata: Metadata = {
  metadataBase: new URL(METADATA_BASE_URL),
  title: {
    default: 'OurDahanu - Dahanu Business Directory, Jobs & Community',
    template: '%s | OurDahanu',
  },
  description: "OurDahanu is the local platform for Dahanu businesses, services, restaurants, hotels, jobs, and community updates.",
  keywords: [
    'Dahanu',
    'OurDahanu',
    'Dahanu business directory',
    'businesses in Dahanu',
    'restaurants in Dahanu',
    'hotels in Dahanu',
    'services in Dahanu',
    'Dahanu jobs',
    'Palghar community',
  ],
  applicationName: 'OurDahanu',
  manifest: '/manifest.json',
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
      'max-video-preview': -1,
    },
  },
  openGraph: {
    title: 'OurDahanu - Dahanu Business Directory, Jobs & Community',
    description: "OurDahanu is the local platform for Dahanu businesses, services, restaurants, hotels, jobs, and community updates.",
    url: METADATA_BASE_URL,
    siteName: 'OurDahanu',
    type: 'website',
    locale: 'en_IN',
    images: [
      {
        url: LOGO_URL,
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'OurDahanu - Dahanu Business Directory, Jobs & Community',
    description: "OurDahanu is the local platform for Dahanu businesses, services, restaurants, hotels, jobs, and community updates.",
    images: [LOGO_URL],
  },
  icons: {
    icon: '/logo.png',
    apple: '/logo.png',
    shortcut: '/logo.png',
  },
  appleWebApp: {
    capable: true,
    title: 'OurDahanu',
    statusBarStyle: 'default',
  },
}

export const viewport: Viewport = {
  themeColor: '#2E1205',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const siteSchema = [
    {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: 'OurDahanu',
      url: SITE_URL,
      logo: buildAbsoluteUrl('/logo.png'),
      description: "OurDahanu is the local platform for Dahanu businesses, services, restaurants, hotels, jobs, and community updates.",
      areaServed: {
        '@type': 'Place',
        name: 'Dahanu, Palghar, Maharashtra, India',
      },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: 'OurDahanu',
      url: SITE_URL,
      inLanguage: 'en-IN',
    },
  ]

  return (
    <html
      lang="en"
      className={`${dmSans.variable} ${instrumentSerif.variable} ${jakarta.variable}`}
    >
      <body>
        <StructuredData data={siteSchema} />
        <Suspense fallback={<EmergencyRibbonFallback />}>
          <EmergencyRibbon />
        </Suspense>
        <Suspense fallback={<NavbarFallback />}>
          <Navbar />
        </Suspense>
        {/* Navbar is sticky (not fixed), so <main> no longer needs top padding */}
        <main className="pb-16 lg:pb-0 min-h-screen">
          {children}
        </main>
        <Footer />
        <Suspense fallback={null}>
          <BottomTabBar />
        </Suspense>
        <ServiceWorkerRegistration />
        <Analytics />
      </body>
    </html>
  )
}
