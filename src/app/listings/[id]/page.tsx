import Link from 'next/link'
import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { permanentRedirect } from 'next/navigation'
import { Suspense } from 'react'
import { ArrowLeft } from 'lucide-react'
import StructuredData from '@/components/StructuredData'
import Button from '@/components/ui/Button'
import Skeleton from '@/components/ui/Skeleton'
import EmptyState from '@/components/ui/EmptyState'
import { getCategoryUrl } from '@/lib/listing-category'
import { 
  buildDirectionsUrl, 
  formatAddressForDisplay, 
  formatPhoneForDisplay, 
  normalizePhoneOrNull,
  normalizeAppointmentSettings 
} from '@/lib/listing-content'
import { 
  getCanonicalListingUrl, 
  getListingHref, 
  shouldRedirectListingToSubdomain 
} from '@/lib/listing-url'
import { buildAbsoluteUrl } from '@/lib/site'
import { getCachedListingDetail } from '@/lib/data/listing-detail'
import { truncateAtWord } from '@/lib/text'
import { ListingViewerProvider } from './ListingViewerContext'

// Modular Components
import ListingHero from './components/ListingHero'
import ListingNavigation from './components/ListingNavigation'
import ListingContent from './components/ListingContent'
import ListingSidebar from './components/ListingSidebar'
import ListingReviewsSection from './components/ListingReviewsSection'
import ListingQASection from './components/ListingQASection'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params
  const listingDetail = await getCachedListingDetail(id)
  const listing = listingDetail?.listing as Record<string, unknown> | null

  if (!listing) {
    return { title: 'Business Listing' }
  }

  // Parse tags and services for keywords
  const parsedTags: string[] = (() => {
    try {
      const r = listing.tags
      if (Array.isArray(r)) return r as string[]
      return typeof r === 'string' ? JSON.parse(r) : []
    } catch { return [] }
  })()
  const parsedServices: { name: string }[] = (() => {
    try {
      const r = listing.services
      if (Array.isArray(r)) return r as { name: string }[]
      return typeof r === 'string' ? JSON.parse(r) : []
    } catch { return [] }
  })()

  // Build rich description (≤160 chars)
  const descParts: string[] = []
  if (listing.tagline) descParts.push(String(listing.tagline))
  if (listing.description) descParts.push(String(listing.description).replace(/\s+/g, ' ').trim())
  const baseDesc = truncateAtWord(descParts.join(' — '), 130)
  const locationSuffix = `${listing.category} in Dahanu${listing.address ? `, ${String(listing.address).split(',')[0]}` : ''}, Maharashtra.`
  const description = baseDesc
    ? truncateAtWord(`${baseDesc}. ${locationSuffix}`, 159)
    : `${String(listing.name)} — ${locationSuffix} Find contact info, reviews & more on OurDahanu.`

  // Build keyword list
  const nearbyAreas = ['Dahanu', 'Bordi', 'Gholvad', 'Palghar', 'Dahanu Road', 'Maharashtra']
  const serviceNames = parsedServices.slice(0, 5).map(s => s.name).filter(Boolean)
  const keywords = [
    String(listing.name),
    String(listing.category),
    ...nearbyAreas,
    'OurDahanu',
    ...parsedTags,
    ...serviceNames,
    listing.established_year ? `Est ${listing.established_year}` : null,
  ].filter((k): k is string => Boolean(k)).join(', ')

  const canonicalUrl = getCanonicalListingUrl(String(listing.id), typeof listing.subdomain === 'string' ? listing.subdomain : null)
  const title = `${String(listing.name)} | ${String(listing.category)} in Dahanu`
  const images = [listing.image_url, listing.cover_image]
    .filter((u): u is string => typeof u === 'string' && u.startsWith('http'))

  return {
    title,
    description,
    keywords,
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph: {
      title,
      description,
      url: canonicalUrl,
      images: images.map(url => ({ url, width: 1200, height: 630 })),
      type: 'website',
      siteName: 'OurDahanu',
      locale: 'en_IN',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: images.slice(0, 1),
    },
    other: {
      'geo.region': 'IN-MH',
      'geo.placename': 'Dahanu, Maharashtra, India',
      'geo.position': '19.9667;72.7167',
      'ICBM': '19.9667, 72.7167',
    },
  }
}

function ListingDetailFallback() {
  return (
    <div className="od-page min-h-screen animate-warli-fade-in">
      <div className="relative w-full h-48 md:h-64 bg-gradient-to-br from-brand/30 to-ink/20 overflow-hidden">
        <div className="absolute inset-0 skeleton-shimmer opacity-40" />
      </div>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 -mt-12">
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    </div>
  )
}

function getYouTubeEmbedId(url: string): string | null {
  try {
    const u = new URL(url)
    if (u.hostname.includes('youtu.be')) return u.pathname.slice(1)
    return u.searchParams.get('v')
  } catch { return null }
}

function getListingSchemaType(category: string): string {
  const normalized = category.trim().toLowerCase()
  if (normalized === 'restaurants') return 'Restaurant'
  if (normalized === 'hotels & stay' || normalized === 'hotels & stays') return 'Hotel'
  if (normalized === 'medical store') return 'Pharmacy'
  if (normalized === 'healthcare & clinics') return 'MedicalClinic'
  if (normalized === 'hardware') return 'HardwareStore'
  if (normalized === 'salons & beauty') return 'HairSalon'
  if (normalized === 'transport & taxi') return 'TaxiService'
  return 'LocalBusiness'
}

function inferAddressLocality(address: string): string {
  const normalized = address.toLowerCase()
  if (normalized.includes('bordi')) return 'Bordi'
  if (normalized.includes('gholvad')) return 'Gholvad'
  if (normalized.includes('palghar')) return 'Palghar'
  return 'Dahanu'
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseJson(raw: any, fallback: any = []) {
  try {
    if (Array.isArray(raw)) return raw
    if (raw && typeof raw === 'object') return raw
    if (typeof raw === 'string') return JSON.parse(raw)
  } catch { /* ignore */ }
  return fallback
}

export default function ListingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  return (
    <Suspense fallback={<ListingDetailFallback />}>
      <ListingDetailContent params={params} />
    </Suspense>
  )
}

async function ListingDetailContent({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const [publicData, headersList] = await Promise.all([
    getCachedListingDetail(id),
    headers(),
  ])

  const currentHost = headersList.get('x-forwarded-host') ?? headersList.get('host')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const listing: Record<string, any> | null = (publicData?.listing as Record<string, any> | null) ?? null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const reviews: Record<string, any>[] = (publicData?.reviews as Record<string, any>[] | undefined) ?? []
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const questions: Record<string, any>[] = (publicData?.questions as Record<string, any>[] | undefined) ?? []
  const hasMoreReviews = publicData?.hasMoreReviews ?? false
  const recommendCount = publicData?.recommendCount ?? 0
  const favouriteCount = publicData?.favouriteCount ?? 0
  const similarListings = publicData?.similarListings ?? []
  const marketplaceProducts = publicData?.products ?? []
  const marketplaceReady = publicData?.marketplaceReady ?? false

  if (!listing) {
    return (
      <div className="od-page min-h-screen">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <Link
            href={buildAbsoluteUrl('/listings')}
            className="inline-flex items-center gap-1.5 text-sm text-[var(--od-muted)] hover:text-brand mb-6 transition-colors"
          >
            <ArrowLeft size={15} /> Back to Listings
          </Link>
          <EmptyState
            icon="🏪"
            title="Listing not found"
            description="This business listing may have been removed or the link is incorrect."
            action={
              <Button href={buildAbsoluteUrl('/listings')} variant="primary" size="md">
                Browse all listings
              </Button>
            }
          />
        </div>
      </div>
    )
  }

  const listingId   = listing.id as string
  const rating      = (listing.rating as number) || 0
  // Exact count from the reviews table. listings.review_count is a
  // denormalised counter that has already drifted in production, and it feeds
  // both the hero and the aggregateRating JSON-LD.
  const reviewCount = publicData?.reviewCount ?? reviews.length
  const subdomain   = listing.subdomain as string | null

  if (shouldRedirectListingToSubdomain(currentHost, subdomain)) {
    permanentRedirect(getCanonicalListingUrl(listingId, subdomain))
  }

  // Parse all JSON fields
  const services      = parseJson(listing.services, [])
  const tags          = parseJson(listing.tags, [])
  const photos        = parseJson(listing.photos, [])
  const highlights    = parseJson(listing.highlights, [])
  const certifications = parseJson(listing.certifications, [])
  const paymentMethods = parseJson(listing.payment_methods, [])
  const deliveryInfo   = parseJson(listing.delivery_info, null)
  const beforeAfter    = parseJson(listing.before_after, null)
  const appointmentSettings = normalizeAppointmentSettings(listing.appointment_settings)
  const appointmentsEnabled = listing.appointments_enabled === true && !!appointmentSettings
  const appointmentBookingFee = Number.parseFloat(String(listing.appointment_booking_fee ?? '0')) || 0

  const whatsappNum  = (listing.whatsapp as string) || (listing.phone as string) || null
  const phoneHref    = normalizePhoneOrNull(listing.phone as string | null)
  const phoneLabel   = formatPhoneForDisplay(listing.phone as string | null)
  const displayAddress = formatAddressForDisplay(listing.address as string | null)
  const directionsUrl  = buildDirectionsUrl(listing.map_url as string | null, listing.address as string | null)
  const businessUrl    = getCanonicalListingUrl(listingId, subdomain)
  const platformListingsUrl = buildAbsoluteUrl('/listings')
  const platformLoginUrl    = buildAbsoluteUrl(`/login?next=${encodeURIComponent(`/listings/${listingId}`)}`)
  const platformEditUrl     = buildAbsoluteUrl(`/my-business/edit/${listingId}`)
  const hasReviews          = reviewCount > 0 && rating > 0
  const videoEmbedId        = listing.video_url ? getYouTubeEmbedId(String(listing.video_url)) : null

  // WhatsApp Enquiry
  const enquiryMsg = encodeURIComponent(
    `Hi! I found your business on OurDahanu — ${String(listing.name)}.\n\nI'd like to know more about your services. Can you help me?\n\n${businessUrl}`
  )
  const enquiryLink = whatsappNum ? `https://wa.me/${whatsappNum.replace(/\D/g, '')}?text=${enquiryMsg}` : null

  // WhatsApp Status Share
  const shareText = encodeURIComponent(
    `🏪 *${String(listing.name)}*\n${listing.tagline ? `_${String(listing.tagline)}_\n` : ''}📍 ${listing.address || 'Dahanu'}\n\n✅ Find them on OurDahanu:\n${businessUrl}`
  )
  const statusShareLink = `https://wa.me/?text=${shareText}`

  // Schema & Metadata Images
  const imageUrls = [...new Set([
    listing.image_url as string | null,
    listing.cover_image as string | null,
    ...photos,
  ].filter((url): url is string => typeof url === 'string' && url.startsWith('http')))]
  
  const sameAs = [
    listing.website ? String(listing.website) : null,
    listing.facebook ? String(listing.facebook) : null,
    listing.instagram ? `https://instagram.com/${String(listing.instagram).replace('@', '')}` : null,
  ].filter((url): url is string => Boolean(url))

  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://ourdahanu.in' },
      { '@type': 'ListItem', position: 2, name: 'Business Listings', item: 'https://ourdahanu.in/listings' },
      { '@type': 'ListItem', position: 3, name: String(listing.category), item: getCategoryUrl(String(listing.category)) },
      { '@type': 'ListItem', position: 4, name: String(listing.name), item: businessUrl },
    ],
  }

  const localBusinessSchema = {
    '@context': 'https://schema.org',
    '@type': getListingSchemaType(String(listing.category)),
    name: String(listing.name),
    description: String(listing.description || listing.tagline || `${listing.name} in ${listing.category} listed on OurDahanu.`),
    url: businessUrl,
    ...(imageUrls.length > 0 ? { image: imageUrls } : {}),
    ...(listing.phone ? { telephone: String(listing.phone) } : {}),
    ...(listing.address ? {
      address: {
        '@type': 'PostalAddress',
        streetAddress: String(listing.address),
        addressLocality: inferAddressLocality(String(listing.address)),
        addressRegion: 'Maharashtra',
        postalCode: '401602',
        addressCountry: 'IN',
      },
    } : {}),
    ...(sameAs.length > 0 ? { sameAs } : {}),
    ...(reviewCount > 0 && rating > 0 ? {
      aggregateRating: {
        '@type': 'AggregateRating',
        ratingValue: Number(rating.toFixed(1)),
        reviewCount,
        bestRating: 5,
        worstRating: 1,
      },
    } : {}),
    ...(Boolean(listing.verified) ? { isVerified: true } : {}),
  }

  return (
    <ListingViewerProvider listingId={listingId}>
    <div className="od-page min-h-screen">
      <StructuredData data={[breadcrumbSchema, localBusinessSchema]} />

      <ListingHero 
        listing={listing}
        subdomain={subdomain}
        platformListingsUrl={platformListingsUrl}
        platformEditUrl={platformEditUrl}
        rating={rating}
        reviewCount={reviewCount}
        hasReviews={hasReviews}
        recommendCount={recommendCount}
        tags={tags}
        phoneHref={phoneHref}
        phoneLabel={phoneLabel}
        enquiryLink={enquiryLink}
        statusShareLink={statusShareLink}
        listingId={listingId}
      />

      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        <ListingNavigation 
          services={services}
          marketplaceProducts={marketplaceProducts}
          photos={photos}
        />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pb-32 md:pb-20">
          <div className="lg:col-span-2 space-y-5">
            <ListingContent 
              listing={listing}
              photos={photos}
              beforeAfter={beforeAfter}
              videoEmbedId={videoEmbedId}
              highlights={highlights}
              services={services}
              listingId={listingId}
              whatsappNum={whatsappNum}
              businessUrl={businessUrl}
              marketplaceReady={marketplaceReady}
              marketplaceProducts={marketplaceProducts}
              appointmentsEnabled={appointmentsEnabled}
              appointmentSettings={appointmentSettings}
              appointmentBookingFee={appointmentBookingFee}
            />

            <ListingReviewsSection 
              listing={listing}
              reviews={reviews}
              reviewCount={reviewCount}
              hasMoreReviews={hasMoreReviews}
              rating={rating}
              platformLoginUrl={platformLoginUrl}
              listingId={listingId}
            />

            <ListingQASection 
              listingId={listingId}
              subdomain={subdomain}
              questions={questions}
              similarListings={similarListings}
              listingCategory={String(listing.category)}
            />
          </div>

          <div className="space-y-4">
            <ListingSidebar 
              listing={listing}
              phoneHref={phoneHref}
              phoneLabel={phoneLabel}
              displayAddress={displayAddress}
              directionsUrl={directionsUrl}
              certifications={certifications}
              paymentMethods={paymentMethods}
              deliveryInfo={deliveryInfo}
              favouriteCount={favouriteCount}
              platformEditUrl={platformEditUrl}
            />
          </div>
        </div>
      </div>

      {/* Mobile Floating Action Bar */}
      {(phoneHref || enquiryLink || directionsUrl) && (
        <div
          className="fixed inset-x-0 z-40 px-3 md:hidden"
          style={{ bottom: 'calc(4rem + env(safe-area-inset-bottom, 0px))' }}
        >
          <div className="mx-auto flex max-w-md gap-2 rounded-2xl border border-border/70 bg-white/95 p-2 shadow-lg backdrop-blur-sm">
            {phoneHref && (
              <a href={`tel:${phoneHref}`} className="flex flex-1 items-center justify-center rounded-xl bg-brand px-3 py-3 text-sm font-semibold text-white">
                Call
              </a>
            )}
            {enquiryLink && (
              <a href={enquiryLink} target="_blank" rel="noopener noreferrer" className="flex flex-1 items-center justify-center rounded-xl bg-green-600 px-3 py-3 text-sm font-semibold text-white">
                WhatsApp
              </a>
            )}
            {directionsUrl && (
              <a href={directionsUrl} target="_blank" rel="noopener noreferrer" className="flex flex-1 items-center justify-center rounded-xl border border-border px-3 py-3 text-sm font-semibold text-ink">
                Map
              </a>
            )}
          </div>
        </div>
      )}
    </div>
    </ListingViewerProvider>
  )
}
