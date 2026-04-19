import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import Image from 'next/image'
import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { permanentRedirect } from 'next/navigation'
import { Suspense } from 'react'
import {
  MapPin, Phone, Star, ArrowLeft, Globe, CheckCircle,
  MessageSquare, MessageCircle, ExternalLink, Clock, AtSign,
  Share2, Edit2, IndianRupee, Navigation, Award,
  Truck, CreditCard, Sparkles, MessageCircleQuestion,
  CalendarDays, Zap, Video, ThumbsUp, Heart, Info,
} from 'lucide-react'
import StructuredData from '@/components/StructuredData'
import { getCategoryUrl } from '@/lib/listing-category'
import { buildDirectionsUrl, formatAddressForDisplay, formatPhoneForDisplay, normalizePhoneOrNull } from '@/lib/listing-content'
import { getCanonicalListingUrl, getListingHref, shouldRedirectListingToSubdomain } from '@/lib/listing-url'
import { buildAbsoluteUrl } from '@/lib/site'
import ReviewForm from './ReviewForm'
import RecordView from './RecordView'
import PhotoGalleryDeferred from './PhotoGalleryDeferred'
import BeforeAfterToggleDeferred from './BeforeAfterToggleDeferred'
import FavouriteButton from './FavouriteButton'
import RecommendButton from './RecommendButton'
import QASection from './QASection'
import ServicesSection from './ServicesSection'
import AppointmentBooking from './AppointmentBooking'
import ProductCard from '@/components/ProductCard'
import BuyButton from '@/components/BuyButton'
import OwnerReplyForm from '@/components/OwnerReplyForm'
import { getCachedListingDetail, type ListingProductPublic } from '@/lib/data/listing-detail'
import { normalizeAppointmentSettings } from '@/lib/listing-content'
import type { ServiceImageAspect } from '@/lib/service-image'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params
  const listingDetail = await getCachedListingDetail(id)
  const listing = listingDetail?.listing as Record<string, unknown> | null

  if (!listing) {
    return { title: 'Business Listing | OurDahanu' }
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
  const baseDesc = descParts.join(' — ').slice(0, 130)
  const locationSuffix = `${listing.category} in Dahanu${listing.address ? `, ${String(listing.address).split(',')[0]}` : ''}, Maharashtra.`
  const description = baseDesc
    ? `${baseDesc}. ${locationSuffix}`.slice(0, 160)
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
  const title = `${String(listing.name)} | ${String(listing.category)} in Dahanu | OurDahanu`
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

function StarDisplay({ rating, size = 14 }: { rating: number; size?: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map(s => (
        <Star
          key={s}
          size={size}
          className={s <= Math.round(rating) ? 'text-yellow-400 fill-yellow-400' : 'text-gray-200 fill-gray-200'}
        />
      ))}
    </div>
  )
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
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

type Service = {
  type?: 'service' | 'product'
  name: string
  desc?: string
  price?: string
  image?: string
  imageAspect?: ServiceImageAspect
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

function ListingDetailFallback() {
  return (
    <div className="min-h-screen bg-gray-50 animate-warli-fade-in">
      {/* Hero skeleton — warli gradient instead of flat gray */}
      <div className="relative w-full h-48 md:h-64 bg-gradient-to-br from-warli-terra/30 to-chikoo-bark/20 overflow-hidden">
        <div className="absolute inset-0 skeleton-shimmer opacity-40" />
        <div className="absolute top-4 left-4">
          <div className="h-8 w-24 rounded-xl skeleton-shimmer" />
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Profile card skeleton — overlaps hero */}
        <div className="relative -mt-12 mb-6">
          <div className="bg-white rounded-2xl border border-warli-sand/30 shadow-warm p-6">
            <div className="flex items-start gap-5">
              {/* Avatar skeleton */}
              <div className="w-20 h-20 rounded-2xl skeleton-shimmer shrink-0" />
              <div className="flex-1 space-y-3">
                {/* Name */}
                <div className="h-7 w-56 rounded-lg skeleton-shimmer" />
                {/* Tagline */}
                <div className="h-4 w-40 rounded skeleton-shimmer" />
                {/* Category + rating */}
                <div className="flex gap-3">
                  <div className="h-6 w-28 rounded-full skeleton-shimmer" />
                  <div className="h-6 w-24 rounded-full skeleton-shimmer" />
                </div>
                {/* Tags */}
                <div className="flex gap-2 pt-1">
                  <div className="h-5 w-16 rounded-full skeleton-shimmer" />
                  <div className="h-5 w-20 rounded-full skeleton-shimmer" />
                  <div className="h-5 w-14 rounded-full skeleton-shimmer" />
                </div>
              </div>
            </div>
            {/* Action buttons skeleton */}
            <div className="flex gap-2 mt-5 pt-4 border-t border-warli-sand/20">
              <div className="h-10 w-28 rounded-xl skeleton-shimmer" />
              <div className="h-10 w-32 rounded-xl skeleton-shimmer" />
              <div className="h-10 w-24 rounded-xl skeleton-shimmer" />
            </div>
          </div>
        </div>

        {/* Content grid skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pb-20">
          {/* Main column */}
          <div className="lg:col-span-2 space-y-5">
            {/* About skeleton */}
            <div className="bg-white rounded-2xl border border-warli-sand/20 p-6">
              <div className="h-5 w-20 rounded skeleton-shimmer mb-4" />
              <div className="space-y-2.5">
                <div className="h-3.5 w-full rounded skeleton-shimmer" />
                <div className="h-3.5 w-full rounded skeleton-shimmer" />
                <div className="h-3.5 w-4/5 rounded skeleton-shimmer" />
                <div className="h-3.5 w-3/5 rounded skeleton-shimmer" />
              </div>
            </div>
            {/* Services skeleton */}
            <div className="bg-white rounded-2xl border border-warli-sand/20 p-6">
              <div className="h-5 w-40 rounded skeleton-shimmer mb-4" />
              <div className="grid grid-cols-2 gap-3">
                <div className="h-20 rounded-xl skeleton-shimmer" />
                <div className="h-20 rounded-xl skeleton-shimmer" />
                <div className="h-20 rounded-xl skeleton-shimmer" />
                <div className="h-20 rounded-xl skeleton-shimmer" />
              </div>
            </div>
            {/* Reviews skeleton */}
            <div className="bg-white rounded-2xl border border-warli-sand/20 p-6">
              <div className="h-5 w-36 rounded skeleton-shimmer mb-5" />
              {[1, 2, 3].map(i => (
                <div key={i} className="flex items-start gap-3 py-4 border-b border-warli-sand/10 last:border-0">
                  <div className="w-8 h-8 rounded-full skeleton-shimmer shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3.5 w-28 rounded skeleton-shimmer" />
                    <div className="h-3 w-full rounded skeleton-shimmer" />
                    <div className="h-3 w-3/4 rounded skeleton-shimmer" />
                  </div>
                </div>
              ))}
            </div>
          </div>
          {/* Sidebar */}
          <div className="space-y-4">
            <div className="bg-white rounded-2xl border border-warli-sand/20 p-5">
              <div className="h-4 w-32 rounded skeleton-shimmer mb-4" />
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl skeleton-shimmer shrink-0" />
                  <div className="space-y-1.5 flex-1">
                    <div className="h-2.5 w-12 rounded skeleton-shimmer" />
                    <div className="h-3.5 w-32 rounded skeleton-shimmer" />
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl skeleton-shimmer shrink-0" />
                  <div className="space-y-1.5 flex-1">
                    <div className="h-2.5 w-14 rounded skeleton-shimmer" />
                    <div className="h-3.5 w-44 rounded skeleton-shimmer" />
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl skeleton-shimmer shrink-0" />
                  <div className="space-y-1.5 flex-1">
                    <div className="h-2.5 w-16 rounded skeleton-shimmer" />
                    <div className="h-3.5 w-28 rounded skeleton-shimmer" />
                  </div>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-2xl border border-warli-sand/20 p-5">
              <div className="h-4 w-28 rounded skeleton-shimmer mb-3" />
              <div className="h-14 rounded-xl skeleton-shimmer" />
            </div>
          </div>
        </div>
      </div>

      {/* Centered brand loader */}
      <div className="flex flex-col items-center pb-16">
        <div className="relative w-16 h-16 mb-3">
          <svg className="absolute inset-0 w-full h-full animate-warli-spin" viewBox="0 0 64 64" fill="none">
            {[0, 60, 120, 180, 240, 300].map((angle, i) => (
              <g key={angle} transform={`rotate(${angle} 32 32)`}>
                <polygon points="32,4 29,11 35,11" fill={i % 2 === 0 ? '#C4663A' : '#D4952A'} opacity={0.6 + (i % 3) * 0.2} />
              </g>
            ))}
            <circle cx="32" cy="32" r="24" stroke="#C4663A" strokeWidth="1" strokeDasharray="3 5" fill="none" opacity="0.3" />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-3 h-3 rounded-full bg-warli-terra animate-warli-pulse" />
          </div>
        </div>
        <p className="text-xs text-chikoo-brown/50 tracking-wide">Loading business details&hellip;</p>
      </div>
    </div>
  )
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

/**
 * Main page content — fetches cached listing data + user auth in parallel.
 * The branded ListingDetailFallback skeleton shows while this loads.
 */
async function ListingDetailContent({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  // Fetch cached data + headers in parallel for faster render
  const [publicData, headersList] = await Promise.all([
    getCachedListingDetail(id),
    headers(),
  ])

  const currentHost = headersList.get('x-forwarded-host') ?? headersList.get('host')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let listing: Record<string, any> | null = (publicData?.listing as Record<string, any> | null) ?? null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const reviews: Record<string, any>[] = (publicData?.reviews as Record<string, any>[] | undefined) ?? []
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const questions: Record<string, any>[] = (publicData?.questions as Record<string, any>[] | undefined) ?? []
  let currentUser: { id: string; email?: string } | null = null
  let currentUserName: string | null = null
  let currentUserPhone: string | null = null
  let isFavourited = false
  let isRecommended = false
  const recommendCount = publicData?.recommendCount ?? 0
  const favouriteCount = publicData?.favouriteCount ?? 0
  const similarListings = publicData?.similarListings ?? []
  const marketplaceProducts: ListingProductPublic[] = publicData?.products ?? []
  const marketplaceReady = publicData?.marketplaceReady ?? false

  // Auth check — runs after cached data is already available
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    currentUser = user

    if (!listing && user) {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
      const { data: listingData } = await supabase
        .from('listings')
        .select('*')
        .eq(isUuid ? 'id' : 'subdomain', id)
        .single()

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      listing = listingData as Record<string, any> | null
    }

    if (user && listing) {
      const [profileResult, favResult, recResult] = await Promise.all([
        supabase.from('profiles').select('full_name, phone').eq('id', user.id).single(),
        supabase.from('listing_favourites').select('listing_id').eq('user_id', user.id).eq('listing_id', listing.id).maybeSingle(),
        supabase.from('listing_recommendations').select('listing_id').eq('user_id', user.id).eq('listing_id', listing.id).maybeSingle(),
      ])
      currentUserName = profileResult.data?.full_name || user.email?.split('@')[0] || null
      currentUserPhone = profileResult.data?.phone || null
      isFavourited = !!favResult.data
      isRecommended = !!recResult.data
    }
  } catch { /* auth error — render as logged out */ }

  if (!listing) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <Link
          href={buildAbsoluteUrl('/listings')}
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-warli-terra mb-6 transition-colors"
        >
          <ArrowLeft size={15} /> Back to Listings
        </Link>
        <div className="text-center py-20">
          <div className="text-6xl mb-4">🏪</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Listing Not Found</h2>
          <p className="text-gray-500 mb-6">This business listing may have been removed or the link is incorrect.</p>
          <Link
            href={buildAbsoluteUrl('/listings')}
            className="inline-block bg-warli-terra hover:bg-warli-deep text-warli-cream font-semibold px-6 py-3 rounded-xl transition-colors"
          >
            Browse All Listings
          </Link>
        </div>
      </div>
    )
  }

  const listingId   = listing.id as string
  const rating      = (listing.rating as number) || 0
  const reviewCount = (listing.review_count as number) || reviews.length
  const subdomain   = listing.subdomain as string | null
  const isOwner     = currentUser?.id === (listing.owner_id as string)

  if (shouldRedirectListingToSubdomain(currentHost, subdomain)) {
    permanentRedirect(getCanonicalListingUrl(listingId, subdomain))
  }

  // Parse all JSON fields
  const services: Service[]   = parseJson(listing.services, [])
  const tags: string[]         = parseJson(listing.tags, [])
  const photos: string[]       = parseJson(listing.photos, [])
  const highlights: { label: string; value: string }[] = parseJson(listing.highlights, [])
  const certifications: string[] = parseJson(listing.certifications, [])
  const paymentMethods: string[] = parseJson(listing.payment_methods, [])
  const deliveryInfo: { areas?: string; note?: string } | null = parseJson(listing.delivery_info, null)
  const beforeAfter: { before: string; after: string } | null = parseJson(listing.before_after, null)
  const appointmentSettings = normalizeAppointmentSettings(listing.appointment_settings)
  const appointmentsEnabled = listing.appointments_enabled === true && !!appointmentSettings
  const appointmentBookingFee = (() => {
    const parsed = Number.parseFloat(String(listing.appointment_booking_fee ?? '0'))
    return Number.isFinite(parsed) ? parsed : 0
  })()

  const whatsappNum  = (listing.whatsapp as string) || (listing.phone as string) || null
  const whatsappLink = whatsappNum ? `https://wa.me/${whatsappNum.replace(/\D/g, '')}` : null
  const phoneHref = normalizePhoneOrNull(listing.phone as string | null)
  const phoneLabel = formatPhoneForDisplay(listing.phone as string | null)
  const displayAddress = formatAddressForDisplay(listing.address as string | null)
  const directionsUrl = buildDirectionsUrl(listing.map_url as string | null, listing.address as string | null)
  const platformListingsUrl = buildAbsoluteUrl('/listings')
  const platformLoginUrl = buildAbsoluteUrl(`/login?next=${encodeURIComponent(`/listings/${listingId}`)}`)
  const platformEditUrl = buildAbsoluteUrl(`/my-business/edit/${listingId}`)
  const hasReviews = reviewCount > 0 && rating > 0

  const videoEmbedId = listing.video_url ? getYouTubeEmbedId(String(listing.video_url)) : null

  // WhatsApp enquiry pre-fill
  const businessUrl = getCanonicalListingUrl(listingId, subdomain)
  const enquiryMsg = encodeURIComponent(
    `Hi! I found your business on OurDahanu — ${String(listing.name)}.\n\nI'd like to know more about your services. Can you help me?\n\n${businessUrl}`
  )
  const enquiryLink = whatsappNum
    ? `https://wa.me/${whatsappNum.replace(/\D/g, '')}?text=${enquiryMsg}`
    : null

  // Share as WhatsApp Status
  const shareText = encodeURIComponent(
    `🏪 *${String(listing.name)}*\n${listing.tagline ? `_${String(listing.tagline)}_\n` : ''}📍 ${listing.address || 'Dahanu'}\n\n✅ Find them on OurDahanu:\n${businessUrl}`
  )
  const statusShareLink = `https://wa.me/?text=${shareText}`

  // Offer expiry check
  const offerExpired = listing.offer_expires_at
    ? new Date(String(listing.offer_expires_at)) < new Date()
    : false
  const showOffer = listing.offer_text && !offerExpired
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
      {
        '@type': 'ListItem',
        position: 1,
        name: 'Home',
        item: 'https://ourdahanu.in',
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: 'Business Listings',
        item: 'https://ourdahanu.in/listings',
      },
      {
        '@type': 'ListItem',
        position: 3,
        name: String(listing.category),
        item: getCategoryUrl(String(listing.category)),
      },
      {
        '@type': 'ListItem',
        position: 4,
        name: String(listing.name),
        item: businessUrl,
      },
    ],
  }
  // Build hasOfferCatalog from services
  const offerCatalog = services.length > 0 ? {
    hasOfferCatalog: {
      '@type': 'OfferCatalog',
      name: `${String(listing.name)} Services`,
      itemListElement: services.map(svc => ({
        '@type': 'Offer',
        itemOffered: {
          '@type': svc.type === 'product' ? 'Product' : 'Service',
          name: svc.name,
          ...(svc.desc ? { description: svc.desc } : {}),
          ...(svc.image ? { image: svc.image } : {}),
          ...(svc.type === 'product' && svc.price ? {
            offers: {
              '@type': 'Offer',
              price: svc.price.replace(/[^\d.]/g, '') || svc.price,
              priceCurrency: 'INR',
              availability: 'https://schema.org/InStock',
            },
          } : {}),
        },
        ...(svc.price ? { price: svc.price.replace(/[^\d.]/g, '') || svc.price, priceCurrency: 'INR', priceSpecification: { '@type': 'PriceSpecification', price: svc.price } } : {}),
      })),
    },
  } : {}

  // Build openingHoursSpecification from hours text (basic: mark as open if hours exist)
  const hoursSpec = listing.hours ? {
    openingHours: String(listing.hours).split('\n').filter(Boolean),
  } : {}

  const localBusinessSchema = {
    '@context': 'https://schema.org',
    '@type': getListingSchemaType(String(listing.category)),
    name: String(listing.name),
    description: String(listing.description || listing.tagline || `${listing.name} in ${listing.category} listed on OurDahanu.`),
    url: businessUrl,
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': businessUrl,
    },
    ...(imageUrls.length > 0 ? { image: imageUrls } : {}),
    ...(listing.phone ? { telephone: String(listing.phone) } : {}),
    ...(listing.whatsapp ? { contactPoint: { '@type': 'ContactPoint', telephone: String(listing.whatsapp), contactType: 'customer service', availableLanguage: ['Hindi', 'Marathi', 'English'] } } : {}),
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
    geo: {
      '@type': 'GeoCoordinates',
      latitude: 19.9667,
      longitude: 72.7167,
    },
    ...(directionsUrl ? { hasMap: directionsUrl } : {}),
    ...(sameAs.length > 0 ? { sameAs } : {}),
    ...(listing.established_year ? { foundingDate: String(listing.established_year) } : {}),
    ...(listing.tagline ? { slogan: String(listing.tagline) } : {}),
    ...(tags.length > 0 ? { keywords: tags.join(', ') } : {}),
    ...(certifications.length > 0 ? { award: certifications } : {}),
    areaServed: {
      '@type': 'Place',
      name: deliveryInfo?.areas || 'Dahanu, Bordi, Gholvad, Palghar, Maharashtra',
    },
    ...(reviewCount > 0 && rating > 0 ? {
      aggregateRating: {
        '@type': 'AggregateRating',
        ratingValue: Number(rating.toFixed(1)),
        reviewCount,
        bestRating: 5,
        worstRating: 1,
      },
    } : {}),
    ...offerCatalog,
    ...hoursSpec,
    ...(Boolean(listing.verified) ? { isVerified: true } : {}),
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <StructuredData data={[breadcrumbSchema, localBusinessSchema]} />
      <RecordView listingId={listingId} />

      {/* ── Cover Image / Hero ──────────────────────────────────────────────── */}
      <div className="relative w-full h-48 md:h-64 bg-gradient-to-br from-warli-terra to-chikoo-bark overflow-hidden">
        {listing.cover_image ? (
          <Image src={String(listing.cover_image)} alt="Cover" fill className="object-cover opacity-80" />
        ) : (
          <div className="absolute inset-0 opacity-10 text-8xl flex flex-wrap gap-8 p-8 select-none pointer-events-none">
            🏪🍽️🎨🌿🏗️💇✂️📸
          </div>
        )}

        {/* Subdomain pill */}
        {subdomain && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2">
            <span className="inline-flex items-center gap-1.5 bg-black/40 backdrop-blur-sm text-white text-xs font-semibold px-3 py-1.5 rounded-full border border-white/20">
              <Globe size={11} />
              {subdomain}.ourdahanu.in
            </span>
          </div>
        )}

        {/* Back + Edit */}
        <div className="absolute top-4 left-4 right-4 flex items-center justify-between">
          <Link href={platformListingsUrl}
            className="inline-flex items-center gap-1.5 text-sm text-white/90 hover:text-white bg-black/30 backdrop-blur-sm hover:bg-black/50 px-3 py-1.5 rounded-xl transition-all">
            <ArrowLeft size={14} /> Listings
          </Link>
          {isOwner && (
            <Link href={platformEditUrl}
              className="inline-flex items-center gap-1.5 text-sm text-white bg-warli-terra/90 hover:bg-warli-terra px-3 py-1.5 rounded-xl transition-all">
              <Edit2 size={13} /> Edit Profile
            </Link>
          )}
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* ── Pinned Announcement ─────────────────────────────────────────── */}
        {listing.pinned_announcement && (
          <div className="relative -mt-4 mb-4 z-10">
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-start gap-2.5">
              <span className="text-amber-500 text-lg flex-shrink-0">📢</span>
              <p className="text-sm text-amber-800 font-medium">{String(listing.pinned_announcement)}</p>
            </div>
          </div>
        )}

        {/* ── Profile Card ─────────────────────────────────────────────────── */}
        <div className="relative -mt-12 mb-6">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-md p-6">
            <div className="flex flex-col sm:flex-row items-start gap-5">
              {/* Avatar */}
              <div className="w-20 h-20 rounded-2xl bg-warli-light border-4 border-white shadow flex-shrink-0 overflow-hidden flex items-center justify-center">
                {listing.image_url ? (
                  <Image src={String(listing.image_url)} alt={String(listing.name)} width={80} height={80} className="object-cover w-full h-full" />
                ) : (
                  <span className="text-4xl">🏪</span>
                )}
              </div>

              {/* Name + meta */}
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-start justify-between gap-2 mb-1">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h1 className="text-2xl font-bold text-gray-900">{String(listing.name)}</h1>
                      {Boolean(listing.verified) && (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold bg-blue-100 text-blue-700 px-2.5 py-1 rounded-full">
                          <CheckCircle size={11} /> Verified
                        </span>
                      )}
                    </div>
                    {listing.tagline && (
                      <p className="text-sm text-chikoo-brown mt-0.5 italic">{String(listing.tagline)}</p>
                    )}
                    {/* Established + Response Time */}
                    <div className="flex flex-wrap items-center gap-3 mt-1">
                      {listing.established_year && (
                        <span className="inline-flex items-center gap-1 text-xs text-gray-500">
                          <CalendarDays size={11} /> Est. {String(listing.established_year)}
                        </span>
                      )}
                      {listing.response_time && (
                        <span className="inline-flex items-center gap-1 text-xs text-green-600">
                          <Zap size={11} /> {String(listing.response_time)}
                        </span>
                      )}
                    </div>
                  </div>
                  {subdomain && (
                    <a href={`https://${subdomain}.ourdahanu.in`} target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-warli-terra border border-warli-sand bg-warli-light px-2.5 py-1 rounded-full hover:bg-warli-sand transition-colors font-medium">
                      <Globe size={10} /> {subdomain}.ourdahanu.in <ExternalLink size={9} />
                    </a>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-3 mt-2">
                  <span className="text-sm text-chikoo-brown bg-warli-light px-2.5 py-0.5 rounded-full">
                    {String(listing.category)}
                  </span>
                  {hasReviews ? (
                    <div className="flex items-center gap-1.5">
                      <StarDisplay rating={rating} />
                      <span className="font-semibold text-gray-900 text-sm">{rating.toFixed(1)}</span>
                      <span className="text-xs text-gray-400">({reviewCount} reviews)</span>
                    </div>
                  ) : (
                    <span className="text-xs font-semibold text-gray-400">New listing</span>
                  )}
                  {recommendCount > 0 && (
                    <span className="inline-flex items-center gap-1 text-xs text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                      <ThumbsUp size={10} /> {recommendCount} recommend{recommendCount === 1 ? '' : 's'}
                    </span>
                  )}
                </div>

                {/* Tags */}
                {tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-3">
                    {tags.map(t => (
                      <span key={t} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{t}</span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Quick contact buttons */}
            <div className="flex flex-wrap gap-2 mt-5 pt-4 border-t border-gray-100">
              {phoneHref && (
                <a href={`tel:${phoneHref}`}
                  className="flex items-center gap-2 bg-warli-terra hover:bg-warli-deep text-warli-cream font-semibold px-4 py-2.5 rounded-xl transition-colors text-sm">
                  <Phone size={14} /> Call Now
                </a>
              )}
              {enquiryLink && (
                <a href={enquiryLink} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white font-semibold px-4 py-2.5 rounded-xl transition-colors text-sm">
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                  </svg>
                  Send Enquiry
                </a>
              )}
              {listing.website && (
                <a href={String(listing.website)} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-2 border border-gray-200 text-gray-700 hover:border-warli-sand hover:bg-warli-light font-semibold px-4 py-2.5 rounded-xl transition-colors text-sm">
                  <Globe size={14} /> Website
                </a>
              )}
              {listing.instagram && (
                <a href={`https://instagram.com/${String(listing.instagram).replace('@', '')}`}
                  target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-2 border border-gray-200 text-gray-700 hover:border-pink-300 hover:bg-pink-50 font-semibold px-4 py-2.5 rounded-xl transition-colors text-sm">
                  <AtSign size={14} className="text-pink-500" /> Instagram
                </a>
              )}

              {/* Right side: Favourite + Share buttons */}
              <div className="flex items-center gap-2 ml-auto">
                <FavouriteButton
                  listingId={listingId}
                  subdomain={subdomain}
                  initialFavourited={isFavourited}
                  isLoggedIn={!!currentUser}
                />
                <a href={statusShareLink} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-semibold border border-gray-200 bg-gray-50 text-gray-500 hover:bg-green-50 hover:border-green-200 hover:text-green-700 transition-all">
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                  Share
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* ── Offer Banner ─────────────────────────────────────────────────── */}
        {showOffer && (
          <div className="mb-5 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-2xl px-5 py-4 flex items-center gap-3">
            <span className="text-2xl flex-shrink-0">🎁</span>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-sm">Special Offer</p>
              <p className="text-sm opacity-90">{String(listing.offer_text)}</p>
            </div>
            {listing.offer_expires_at && (
              <span className="text-xs opacity-75 flex-shrink-0 whitespace-nowrap">
                Ends {formatDate(String(listing.offer_expires_at))}
              </span>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pb-32 md:pb-20">
          {/* ── Left / Main column ──────────────────────────────────────────── */}
          <div className="lg:col-span-2 space-y-5">

            {/* About */}
            {listing.description && (
              <div className="bg-white rounded-2xl border border-gray-100 p-6">
                <h2 className="text-base font-bold text-gray-900 mb-3 flex items-center gap-2">
                  <span className="w-1 h-4 bg-warli-terra rounded-full inline-block" />
                  About
                </h2>
                <p className="text-gray-600 text-sm leading-relaxed whitespace-pre-line">
                  {String(listing.description)}
                </p>
              </div>
            )}

            {/* Photo Gallery */}
            {photos.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-100 p-6">
                <h2 className="text-base font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <span className="w-1 h-4 bg-warli-terra rounded-full inline-block" />
                  Gallery
                </h2>
                <PhotoGalleryDeferred photos={photos} />
              </div>
            )}

            {/* Before/After */}
            {beforeAfter?.before && beforeAfter?.after && (
              <div className="bg-white rounded-2xl border border-gray-100 p-6">
                <h2 className="text-base font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <span className="w-1 h-4 bg-warli-terra rounded-full inline-block" />
                  Before & After
                </h2>
                <BeforeAfterToggleDeferred before={beforeAfter.before} after={beforeAfter.after} />
              </div>
            )}

            {/* YouTube Video */}
            {videoEmbedId && (
              <div className="bg-white rounded-2xl border border-gray-100 p-6">
                <h2 className="text-base font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <span className="w-1 h-4 bg-warli-terra rounded-full inline-block" />
                  <Video size={15} className="text-warli-terra" />
                  Watch
                </h2>
                <div className="relative w-full rounded-xl overflow-hidden bg-black" style={{ aspectRatio: '16/9' }}>
                  <iframe
                    src={`https://www.youtube.com/embed/${videoEmbedId}`}
                    title="Business video"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    className="absolute inset-0 w-full h-full"
                  />
                </div>
              </div>
            )}

            {/* Highlights */}
            {highlights.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-100 p-6">
                <h2 className="text-base font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <span className="w-1 h-4 bg-warli-terra rounded-full inline-block" />
                  <Sparkles size={14} className="text-warli-terra" />
                  Why Choose Us
                </h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {highlights.map((h, i) => (
                    <div key={i} className="bg-warli-light border border-warli-sand rounded-xl p-4 text-center">
                      <div className="text-xl font-bold text-warli-terra">{h.value}</div>
                      <div className="text-xs text-gray-600 mt-0.5">{h.label}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Services & Products */}
            {services.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-100 p-6">
                <h2 className="text-base font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <span className="w-1 h-4 bg-warli-terra rounded-full inline-block" />
                  Services & Products
                </h2>
                <ServicesSection
                  services={services}
                  listing={{
                    id:       listingId,
                    name:     String(listing.name),
                    upi_id:   listing.upi_id ?? null,
                    whatsapp: listing.whatsapp ?? null,
                  }}
                  whatsappNum={whatsappNum}
                  businessUrl={businessUrl}
                  userName={currentUserName ?? ''}
                  userEmail={currentUser?.email ?? ''}
                />
              </div>
            )}

            {/* Marketplace — shoppable products & services */}
            {marketplaceReady && marketplaceProducts.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-100 p-6">
                <div className="flex items-center justify-between mb-4 gap-2">
                  <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
                    <span className="w-1 h-4 bg-warli-terra rounded-full inline-block" />
                    Shop
                  </h2>
                  <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2.5 py-1 text-[11px] font-semibold text-green-700">
                    <CheckCircle size={11} />
                    Direct payment to {String(listing.name)}
                  </span>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  {marketplaceProducts.map((product) => (
                    <ProductCard
                      key={product.id}
                      product={product}
                      buySlot={
                        <BuyButton
                          product={{
                            id: product.id,
                            name: product.name,
                            pricePaise: product.price_paise,
                            quantityInStock: product.quantity_in_stock,
                            listingName: String(listing.name),
                            type: product.type,
                          }}
                          isSignedIn={!!currentUser}
                          loginHref={platformLoginUrl}
                          userName={currentUserName ?? ''}
                          userPhone={currentUserPhone ?? ''}
                          userEmail={currentUser?.email ?? ''}
                        />
                      }
                    />
                  ))}
                </div>
              </div>
            )}

            {appointmentsEnabled && appointmentSettings && (
              <AppointmentBooking
                listingId={listingId}
                listingName={String(listing.name)}
                bookingFee={appointmentBookingFee}
                appointmentSettings={appointmentSettings}
                isLoggedIn={!!currentUser}
                userName={currentUserName ?? ''}
                userPhone={currentUserPhone ?? ''}
                userEmail={currentUser?.email ?? ''}
              />
            )}

            {/* Recommend + Quote CTA */}
            <div className="bg-white rounded-2xl border border-gray-100 p-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
                    <ThumbsUp size={15} className="text-amber-500" />
                    Recommend this business
                  </h2>
                  <p className="text-xs text-gray-400 mt-0.5">Let locals know this business is trustworthy!</p>
                </div>
                <RecommendButton
                  listingId={listingId}
                  subdomain={subdomain}
                  initialRecommended={isRecommended}
                  initialCount={recommendCount}
                  isLoggedIn={!!currentUser}
                />
              </div>

              {enquiryLink && (
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <p className="text-sm font-semibold text-gray-800 mb-2 flex items-center gap-1.5">
                    <MessageSquare size={14} className="text-green-600" />
                    Get a Quote or Ask a Question
                  </p>
                  <a href={enquiryLink} target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white font-semibold px-5 py-2.5 rounded-xl transition-colors text-sm">
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                    WhatsApp Enquiry
                  </a>
                </div>
              )}
            </div>

            {/* Reviews */}
            <div className="bg-white rounded-2xl border border-gray-100 p-6">
              <h2 className="text-base font-bold text-gray-900 mb-5 flex items-center gap-2">
                <span className="w-1 h-4 bg-warli-terra rounded-full inline-block" />
                <MessageSquare size={16} className="text-warli-terra" />
                Customer Reviews
                <span className="text-sm font-normal text-gray-400">({reviews.length})</span>
              </h2>

              {reviews.length === 0 ? (
                <p className="text-gray-400 text-sm text-center py-8">No reviews yet. Be the first!</p>
              ) : (
                <div className="space-y-5">
                  {reviews.map(review => {
                    const reviewerName: string = (review.reviewer_name as string) || 'Anonymous'
                    const initial = reviewerName.slice(0, 1).toUpperCase()
                    const reviewId = review.id as string
                    const ownerReply = (review.owner_reply as string | null) || null
                    const ownerRepliedAt = (review.owner_replied_at as string | null) || null
                    const ownerDisplayName =
                      (listing.name as string | undefined) || 'Owner'
                    return (
                      <div
                        key={reviewId}
                        id={`review-${reviewId}`}
                        className="border-b border-gray-50 pb-5 last:border-0 last:pb-0 scroll-mt-24"
                      >
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 bg-warli-light text-warli-terra rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">
                              {initial}
                            </div>
                            <div>
                              <p className="text-xs font-semibold text-gray-700">{reviewerName}</p>
                              <StarDisplay rating={review.rating as number} size={12} />
                            </div>
                          </div>
                          <span className="text-xs text-gray-400">{formatDate(review.created_at as string)}</span>
                        </div>
                        {review.comment && (
                          <p className="text-sm text-gray-600 mt-2 ml-10">{String(review.comment)}</p>
                        )}

                        {ownerReply && (
                          <div className="mt-3 ml-10 rounded-xl border-l-4 border-warli-terra bg-warli-light/30 px-3 py-2.5">
                            <div className="flex items-center justify-between gap-2 mb-1">
                              <p className="text-[11px] font-semibold uppercase tracking-wide text-warli-terra flex items-center gap-1">
                                <MessageCircle size={12} />
                                Reply from {ownerDisplayName}
                              </p>
                              {ownerRepliedAt && (
                                <span className="text-[11px] text-gray-400">
                                  {formatDate(ownerRepliedAt)}
                                </span>
                              )}
                            </div>
                            <p className="text-sm text-gray-700 whitespace-pre-wrap break-words">
                              {ownerReply}
                            </p>
                          </div>
                        )}

                        {!ownerReply && isOwner && (
                          <div className="ml-10">
                            <OwnerReplyForm reviewId={reviewId} compact />
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Review form */}
            <div className="bg-white rounded-2xl border border-gray-100 p-6">
              <h2 className="text-base font-bold text-gray-900 mb-2">Leave a Review</h2>
              <p className="text-sm text-gray-500 mb-4">
                Reviews help locals decide which businesses to trust.
              </p>
              {currentUser ? (
                <ReviewForm listingId={listingId} userName={currentUserName} />
              ) : (
                <div className="rounded-2xl border border-warli-sand/60 bg-warli-light/60 px-4 py-5 text-center text-gray-600">
                  <p className="mb-3 text-sm">Sign in to leave a review and help other Dahanu locals.</p>
                  <Link
                    href={platformLoginUrl}
                    className="inline-block bg-warli-terra hover:bg-warli-deep text-warli-cream font-semibold px-5 py-2.5 rounded-xl transition-colors text-sm"
                  >
                    Sign In to Review
                  </Link>
                </div>
              )}
            </div>

            {/* Q&A Section */}
            <div className="bg-white rounded-2xl border border-gray-100 p-6">
              <h2 className="text-base font-bold text-gray-900 mb-4 flex items-center gap-2">
                <span className="w-1 h-4 bg-warli-terra rounded-full inline-block" />
                <MessageCircleQuestion size={15} className="text-warli-terra" />
                Questions & Answers
                {questions.length > 0 && (
                  <span className="text-sm font-normal text-gray-400">({questions.length})</span>
                )}
              </h2>
              <QASection
                listingId={listingId}
                subdomain={subdomain}
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                questions={questions as any}
                isOwner={isOwner}
                isLoggedIn={!!currentUser}
              />
            </div>

            {/* Similar Businesses */}
            {similarListings.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-100 p-6">
                <h2 className="text-base font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <span className="w-1 h-4 bg-warli-terra rounded-full inline-block" />
                  Similar in {String(listing.category)}
                </h2>
                <div className="grid grid-cols-2 gap-3">
                  {similarListings.map(s => (
                    <Link key={s.id} href={getListingHref(s.id, s.subdomain)}
                      className="flex items-center gap-3 p-3 rounded-xl border border-gray-100 hover:border-warli-sand hover:bg-warli-light/40 transition-all">
                      <div className="w-10 h-10 rounded-lg bg-warli-light flex-shrink-0 overflow-hidden flex items-center justify-center">
                        {s.image_url ? (
                          <Image src={s.image_url} alt={s.name} width={40} height={40} className="object-cover w-full h-full" />
                        ) : (
                          <span className="text-lg">🏪</span>
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-gray-800 truncate">{s.name}</p>
                        {s.rating > 0 && (
                          <div className="flex items-center gap-1 mt-0.5">
                            <Star size={10} className="text-yellow-400 fill-yellow-400" />
                            <span className="text-xs text-gray-500">{s.rating.toFixed(1)}</span>
                          </div>
                        )}
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* ── Sidebar ──────────────────────────────────────────────────────── */}
          <div className="space-y-4">

            {/* Contact card */}
            <div className="bg-white rounded-2xl border border-gray-100 p-5">
              <h3 className="font-bold text-sm uppercase tracking-wide text-gray-500 mb-4">Contact & Location</h3>
              <div className="space-y-3">
                {phoneHref && (
                  <a href={`tel:${phoneHref}`}
                    className="flex items-center gap-3 text-sm text-gray-700 hover:text-warli-terra transition-colors group">
                    <div className="w-9 h-9 bg-warli-light group-hover:bg-warli-sand rounded-xl flex items-center justify-center flex-shrink-0 transition-colors">
                      <Phone size={15} className="text-warli-terra" />
                    </div>
                    <div>
                      <div className="text-xs text-gray-400">Phone</div>
                      <div className="font-medium">{phoneLabel}</div>
                    </div>
                  </a>
                )}
                {displayAddress ? (
                  <div className="flex items-start gap-3 text-sm text-gray-700">
                    <div className="w-9 h-9 bg-warli-light rounded-xl flex items-center justify-center flex-shrink-0">
                      <MapPin size={15} className="text-warli-terra" />
                    </div>
                    <div>
                      <div className="text-xs text-gray-400">Address</div>
                      <div className="font-medium">{displayAddress}</div>
                    </div>
                  </div>
                ) : null}
                {directionsUrl && (
                  <a href={directionsUrl} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-3 text-sm text-gray-700 hover:text-warli-terra transition-colors group">
                    <div className="w-9 h-9 bg-blue-50 group-hover:bg-blue-100 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors">
                      <Navigation size={15} className="text-blue-600" />
                    </div>
                    <div>
                      <div className="text-xs text-gray-400">Directions</div>
                      <div className="font-medium flex items-center gap-1">Get Directions <ExternalLink size={11} /></div>
                    </div>
                  </a>
                )}
                {listing.website && (
                  <a href={String(listing.website)} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-3 text-sm text-gray-700 hover:text-warli-terra transition-colors group">
                    <div className="w-9 h-9 bg-warli-light group-hover:bg-warli-sand rounded-xl flex items-center justify-center flex-shrink-0 transition-colors">
                      <Globe size={15} className="text-warli-terra" />
                    </div>
                    <div>
                      <div className="text-xs text-gray-400">Website</div>
                      <div className="font-medium flex items-center gap-1">Visit Site <ExternalLink size={11} /></div>
                    </div>
                  </a>
                )}
              </div>
            </div>

            {/* Hours */}
            {listing.hours && (
              <div className="bg-white rounded-2xl border border-gray-100 p-5">
                <h3 className="font-bold text-sm uppercase tracking-wide text-gray-500 mb-3 flex items-center gap-2">
                  <Clock size={14} className="text-warli-terra" /> Opening Hours
                </h3>
                <pre className="text-xs text-gray-700 whitespace-pre-wrap font-sans leading-relaxed">
                  {String(listing.hours)}
                </pre>
              </div>
            )}

            {/* Certifications */}
            {certifications.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-100 p-5">
                <h3 className="font-bold text-sm uppercase tracking-wide text-gray-500 mb-3 flex items-center gap-2">
                  <Award size={14} className="text-amber-500" /> Certifications & Awards
                </h3>
                <div className="flex flex-wrap gap-2">
                  {certifications.map((c, i) => (
                    <span key={i} className="inline-flex items-center gap-1 text-xs bg-amber-50 border border-amber-200 text-amber-700 px-2.5 py-1 rounded-full">
                      🏆 {c}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Payment Methods */}
            {paymentMethods.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-100 p-5">
                <h3 className="font-bold text-sm uppercase tracking-wide text-gray-500 mb-3 flex items-center gap-2">
                  <CreditCard size={14} className="text-warli-terra" /> Payment Accepted
                </h3>
                <div className="flex flex-wrap gap-2">
                  {paymentMethods.map((m, i) => (
                    <span key={i} className="text-xs bg-gray-100 text-gray-600 px-2.5 py-1 rounded-full">{m}</span>
                  ))}
                </div>
              </div>
            )}

            {/* Delivery / Service Area */}
            {(deliveryInfo?.areas || deliveryInfo?.note) && (
              <div className="bg-white rounded-2xl border border-gray-100 p-5">
                <h3 className="font-bold text-sm uppercase tracking-wide text-gray-500 mb-3 flex items-center gap-2">
                  <Truck size={14} className="text-warli-terra" /> Delivery / Service Area
                </h3>
                {deliveryInfo.areas && (
                  <p className="text-sm text-gray-700 font-medium">{deliveryInfo.areas}</p>
                )}
                {deliveryInfo.note && (
                  <p className="text-xs text-gray-500 mt-1">{deliveryInfo.note}</p>
                )}
              </div>
            )}

            {/* UPI */}
            {listing.upi_id && (
              <div className="bg-white rounded-2xl border border-gray-100 p-5">
                <h3 className="font-bold text-sm uppercase tracking-wide text-gray-500 mb-3 flex items-center gap-2">
                  <IndianRupee size={14} className="text-warli-terra" /> Pay Directly
                </h3>
                <div className="bg-warli-light border border-warli-sand rounded-xl px-4 py-3">
                  <p className="text-xs text-gray-400 mb-0.5">UPI ID</p>
                  <p className="font-mono font-bold text-sm text-chikoo-bark">{String(listing.upi_id)}</p>
                </div>
              </div>
            )}

            {/* Social */}
            {(listing.instagram || listing.facebook) && (
              <div className="bg-white rounded-2xl border border-gray-100 p-5">
                <h3 className="font-bold text-sm uppercase tracking-wide text-gray-500 mb-3">Follow</h3>
                <div className="space-y-2">
                  {listing.instagram && (
                    <a href={`https://instagram.com/${String(listing.instagram).replace('@', '')}`}
                      target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-2.5 text-sm text-gray-700 hover:text-pink-600 transition-colors p-2 rounded-xl hover:bg-pink-50">
                      <AtSign size={16} className="text-pink-500" />
                      @{String(listing.instagram).replace('@', '')}
                    </a>
                  )}
                  {listing.facebook && (
                    <a href={String(listing.facebook)} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-2.5 text-sm text-gray-700 hover:text-blue-600 transition-colors p-2 rounded-xl hover:bg-blue-50">
                      <Share2 size={16} className="text-blue-600" />
                      Facebook Page
                    </a>
                  )}
                </div>
              </div>
            )}

            {/* "Verified by OurDahanu" info */}
            {Boolean(listing.verified) && (
              <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4">
                <div className="flex items-start gap-2">
                  <CheckCircle size={16} className="text-blue-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-bold text-blue-700">Verified by OurDahanu</p>
                    <p className="text-xs text-blue-600 mt-0.5">
                      Our team has verified this business's contact details, location, and basic info.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Favourites count */}
            {favouriteCount > 0 && (
              <div className="bg-red-50 border border-red-100 rounded-2xl p-4 flex items-center gap-2.5">
                <Heart size={16} className="text-red-500 fill-red-500 flex-shrink-0" />
                <p className="text-sm text-red-600">
                  <span className="font-bold">{favouriteCount}</span> {favouriteCount === 1 ? 'person has' : 'people have'} saved this listing
                </p>
              </div>
            )}

            {/* Owner edit shortcut */}
            {isOwner && (
              <Link href={platformEditUrl}
                className="flex items-center justify-center gap-2 w-full border-2 border-dashed border-warli-sand text-warli-terra hover:bg-warli-light font-semibold py-3 rounded-2xl transition-colors text-sm">
                <Edit2 size={14} /> Edit Your Profile
              </Link>
            )}
          </div>
        </div>
      </div>

      {(phoneHref || enquiryLink || directionsUrl) && (
        <div className="fixed inset-x-0 bottom-16 z-40 px-3 md:hidden">
          <div className="mx-auto grid max-w-md grid-cols-3 gap-2 rounded-2xl border border-warli-sand/70 bg-white/95 p-2 shadow-warm-lg backdrop-blur-sm">
            {phoneHref ? (
              <a
                href={`tel:${phoneHref}`}
                className="flex items-center justify-center rounded-xl bg-warli-terra px-3 py-3 text-sm font-semibold text-warli-cream"
              >
                Call
              </a>
            ) : (
              <div />
            )}
            {enquiryLink ? (
              <a
                href={enquiryLink}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center rounded-xl bg-green-600 px-3 py-3 text-sm font-semibold text-white"
              >
                WhatsApp
              </a>
            ) : (
              <div />
            )}
            {directionsUrl ? (
              <a
                href={directionsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center rounded-xl border border-gray-200 px-3 py-3 text-sm font-semibold text-gray-700"
              >
                Directions
              </a>
            ) : (
              <div />
            )}
          </div>
        </div>
      )}
    </div>
  )
}
