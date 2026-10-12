import type { Metadata, Viewport } from 'next'
import { Suspense } from 'react'
import localFont from 'next/font/local'
import './globals.css'
import { NavbarFallback } from '@/components/Navbar'
import { EmergencyRibbonFallback } from '@/components/EmergencyRibbon'
import { SiteNavbar, SiteFooter, SiteBottomTabBar, SiteEmergencyRibbon } from '@/components/SiteChrome'
import LoaderFontsReady from '@/components/LoaderFontsReady'
import PaymentRecoveryWatcher from '@/components/PaymentRecoveryWatcher'
import StructuredData from '@/components/StructuredData'
import { buildAbsoluteUrl, SITE_URL, siteConfig } from '@/lib/site'
import Script from 'next/script'
import { Analytics } from '@vercel/analytics/next'
import { GoogleAnalytics } from '@next/third-parties/google'
import { AuthProvider } from '@/lib/auth-context'
import { ADSENSE_CLIENT_ID, adsEnabled } from '@/lib/ads'

// Only set in Vercel's Production environment (see .env.local.example) so
// dev/preview traffic never gets sent to the real GA4 property.
const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_ID

const METADATA_BASE_URL = `https://${siteConfig.domain}`
const LOGO_URL = `${METADATA_BASE_URL}/logo.png`

// The default title and description every page falls back to. Pages that
// set their own override these; these are what the homepage and anything
// without its own metadata get.
const SITE_TITLE = `${siteConfig.name} - ${siteConfig.town} Business Directory, Jobs & Community`

// The font files live in ./fonts (from Fontsource, OFL-1.1) rather than
// coming through next/font/google, because that fetches from Google Fonts
// at build time and a slow response there has failed a production build.

// Primary body font — DM Sans (revamped design system)
const dmSans = localFont({
  src: [
    { path: './fonts/dm-sans-latin-300-normal.woff2', weight: '300', style: 'normal' },
    { path: './fonts/dm-sans-latin-400-normal.woff2', weight: '400', style: 'normal' },
    { path: './fonts/dm-sans-latin-500-normal.woff2', weight: '500', style: 'normal' },
    { path: './fonts/dm-sans-latin-600-normal.woff2', weight: '600', style: 'normal' },
    { path: './fonts/dm-sans-latin-700-normal.woff2', weight: '700', style: 'normal' },
  ],
  variable: '--font-dm',
  display: 'swap',
})

// Display serif for hero + section headlines
const instrumentSerif = localFont({
  src: [
    { path: './fonts/instrument-serif-latin-400-normal.woff2', weight: '400', style: 'normal' },
    { path: './fonts/instrument-serif-latin-400-italic.woff2', weight: '400', style: 'italic' },
  ],
  variable: '--font-instrument',
  display: 'swap',
  adjustFontFallback: 'Times New Roman',
})

// Devanagari support for the loader logo ("आपले डहाणू"). Loaded so the
// curved text renders consistently on devices that don't ship a
// compatible system Devanagari font (e.g. iOS mobile Safari).
const notoDevanagari = localFont({
  src: [
    { path: './fonts/noto-sans-devanagari-devanagari-400-normal.woff2', weight: '400', style: 'normal' },
    { path: './fonts/noto-sans-devanagari-devanagari-500-normal.woff2', weight: '500', style: 'normal' },
    { path: './fonts/noto-sans-devanagari-devanagari-600-normal.woff2', weight: '600', style: 'normal' },
  ],
  variable: '--font-devanagari',
  display: 'swap',
})

export const metadata: Metadata = {
  metadataBase: new URL(METADATA_BASE_URL),
  title: {
    default: SITE_TITLE,
    template: `%s | ${siteConfig.name}`,
  },
  description: siteConfig.tagline,
  keywords: [
    siteConfig.town,
    siteConfig.name,
    `${siteConfig.town} business directory`,
    `businesses in ${siteConfig.town}`,
    `restaurants in ${siteConfig.town}`,
    `hotels in ${siteConfig.town}`,
    `services in ${siteConfig.town}`,
    `${siteConfig.town} jobs`,
    `${siteConfig.town} community`,
  ],
  applicationName: siteConfig.name,
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
  // Only what is true of every page. Metadata merges shallowly, so a title,
  // description or url here was inherited by every page without its own
  // openGraph -- about eighteen of them previewed as the homepage when
  // shared. Without them, link previews fall back to each page's own
  // <title> and description; the homepage sets its own openGraph.
  openGraph: {
    siteName: siteConfig.name,
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
    images: [LOGO_URL],
  },
  icons: {
    icon: '/logo.png',
    apple: '/logo.png',
    shortcut: '/logo.png',
  },
  appleWebApp: {
    capable: true,
    title: siteConfig.name,
    statusBarStyle: 'default',
  },
  // AdSense site-ownership verification. Rendered as
  // <meta name="google-adsense-account" content="ca-pub-…"> in <head>, and
  // only when a real publisher ID is configured (prod).
  ...(adsEnabled() && { other: { 'google-adsense-account': ADSENSE_CLIENT_ID } }),
}

export const viewport: Viewport = {
  themeColor: '#2E1205',
  viewportFit: 'cover',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const siteSchema = [
    {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: siteConfig.name,
      url: SITE_URL,
      logo: buildAbsoluteUrl('/logo.png'),
      description: siteConfig.tagline,
      areaServed: {
        '@type': 'Place',
        name: `${siteConfig.town}, ${siteConfig.region}`,
      },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: siteConfig.name,
      url: SITE_URL,
      inLanguage: 'en-IN',
      // Enables Google's sitelinks search box under the site's main result.
      potentialAction: {
        '@type': 'SearchAction',
        target: {
          '@type': 'EntryPoint',
          urlTemplate: `${SITE_URL}/search?q={search_term_string}`,
        },
        'query-input': 'required name=search_term_string',
      },
    },
  ]

  return (
    <html
      lang="en"
      className={`${dmSans.variable} ${instrumentSerif.variable} ${notoDevanagari.variable}`}
    >
      <body>
        <StructuredData data={siteSchema} />
        <LoaderFontsReady />
        <AuthProvider>
          <Suspense fallback={<EmergencyRibbonFallback />}>
            <SiteEmergencyRibbon />
          </Suspense>
          <Suspense fallback={<NavbarFallback />}>
            <SiteNavbar />
          </Suspense>
          {/* Navbar is sticky (not fixed), so <main> no longer needs top padding */}
          <main className="min-h-screen">
            {children}
          </main>
          <Suspense fallback={null}>
            <SiteFooter />
          </Suspense>
          <Suspense fallback={null}>
            <SiteBottomTabBar />
          </Suspense>
          <Suspense fallback={null}>
            <PaymentRecoveryWatcher />
          </Suspense>
        </AuthProvider>
        <Analytics />
        {/* AdSense loader, gated on a configured publisher ID. Loaded once the
            page is idle (lazyOnload): beforeInteractive fetched it ahead of
            every first-party script on every page. Auto ads still run from
            it; ownership verification is the meta tag in `metadata.other`. */}
        {adsEnabled() && (
          <Script
            id="adsbygoogle-init"
            strategy="lazyOnload"
            crossOrigin="anonymous"
            src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT_ID}`}
          />
        )}
      </body>
      {GA_MEASUREMENT_ID && <GoogleAnalytics gaId={GA_MEASUREMENT_ID} />}
    </html>
  )
}
