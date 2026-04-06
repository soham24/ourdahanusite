import type { Metadata, Viewport } from 'next'
import { Suspense } from 'react'
import { Plus_Jakarta_Sans } from 'next/font/google'
import './globals.css'
import Navbar, { NavbarFallback } from '@/components/Navbar'
import Footer from '@/components/Footer'
import BottomTabBar from '@/components/BottomTabBar'
import EmergencyRibbon, { EmergencyRibbonFallback } from '@/components/EmergencyRibbon'
import ServiceWorkerRegistration from '@/components/ServiceWorkerRegistration'
import StructuredData from '@/components/StructuredData'
import { buildAbsoluteUrl, SITE_URL } from '@/lib/site'

const METADATA_BASE_URL = 'https://ourdahanu.in'
const LOGO_URL = 'https://ourdahanu.in/logo.png'

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
  themeColor: '#16a34a',
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
    <html lang="en" className={jakarta.variable}>
      <body>
        <StructuredData data={siteSchema} />
        <Suspense fallback={<EmergencyRibbonFallback />}>
          <EmergencyRibbon />
        </Suspense>
        <Suspense fallback={<NavbarFallback />}>
          <Navbar />
        </Suspense>
        {/* pt-[5.5rem] = fixed ribbon (32px) + fixed navbar (56px) */}
        <main className="pt-[5.5rem] pb-16 lg:pb-0 min-h-screen">
          {children}
        </main>
        <Footer />
        <Suspense fallback={null}>
          <BottomTabBar />
        </Suspense>
        <ServiceWorkerRegistration />
      </body>
    </html>
  )
}
