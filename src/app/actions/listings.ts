'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin-client'
import {
  revalidatePublicListingCollections,
  revalidatePublicListingContent,
} from '@/lib/cache-tags'
import {
  sendNotification,
  sendNotificationToAdmins,
} from '@/lib/notifications'
import {
  normalizeAppointmentSettings,
  normalizeBeforeAfter,
  normalizeDeliveryInfo,
  normalizeHighlightItems,
  normalizeInlineText,
  normalizeMultilineText,
  normalizePhoneOrNull,
  normalizeServiceItems,
  normalizeStringArray,
  normalizeUrlArray,
} from '@/lib/listing-content'
import {
  fetchRazorpayOrder,
  getListingSubmissionCharge,
  validateRazorpayOrder,
} from '@/lib/payment-security'
import { normalizeOptionalUrlOrNull } from '@/lib/url'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

export async function submitPaidListing(formData: FormData): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Please sign in first.' }

  // 1. Verify payment signature
  const paymentId = (formData.get('razorpay_payment_id') as string)?.trim()
  const orderId   = (formData.get('razorpay_order_id')   as string)?.trim()
  const signature = (formData.get('razorpay_signature')  as string)?.trim()

  // Free coupon - skip payment verification
  const isFree = paymentId === 'free' && orderId === 'free' && signature === 'free'

  if (!isFree) {
    if (!paymentId || !orderId || !signature) {
      return { error: 'Payment details are missing. Please try again.' }
    }

    const keySecret = process.env.RAZORPAY_KEY_SECRET?.trim()
    if (!keySecret) return { error: 'Payment gateway not configured.' }

    const { createHmac } = await import('crypto')
    const expected = createHmac('sha256', keySecret)
      .update(`${orderId}|${paymentId}`)
      .digest('hex')

    if (expected !== signature) {
      return { error: 'Payment verification failed. Please contact support.' }
    }
  }

  // 2. Extract listing fields
  const name        = normalizeInlineText(formData.get('name') as string, 80)
  const description = normalizeMultilineText(formData.get('description') as string, 900)
  const category    = normalizeInlineText(formData.get('category') as string, 60)
  const phone       = normalizePhoneOrNull(formData.get('phone') as string)
  const whatsapp    = normalizePhoneOrNull(formData.get('whatsapp') as string)
  const address     = normalizeInlineText(formData.get('address') as string, 180)
  const website     = normalizeOptionalUrlOrNull(formData.get('website') as string)
  const image_url   = normalizeOptionalUrlOrNull(formData.get('image_url') as string)
  const coupon_used = (formData.get('coupon')      as string)?.trim() || null
  const map_url     = normalizeOptionalUrlOrNull(formData.get('map_url') as string)
  const upi_id      = normalizeInlineText(formData.get('upi_id') as string, 80)
  const rawSubdomain = ((formData.get('subdomain') as string) || '').trim().toLowerCase()

  if (!name || !category) return { error: 'Business name and category are required.' }
  if (!upi_id || !upi_id.includes('@')) return { error: 'A valid UPI ID is required to accept customer payments.' }

  const charge = await getListingSubmissionCharge(coupon_used)
  if (coupon_used && !charge.couponValid) {
    return { error: 'Coupon code is invalid or inactive.' }
  }
  if (isFree) {
    if (!charge.couponValid || !charge.isFree) {
      return { error: 'A valid free coupon is required to skip payment.' }
    }
  } else {
    if (charge.isFree) {
      return { error: 'This coupon makes the listing free. Please retry without payment.' }
    }

    const razorpayOrder = await fetchRazorpayOrder(orderId)
    const paymentOrderError = validateRazorpayOrder({
      order: razorpayOrder,
      flow: 'listing',
      userId: user.id,
      expectedAmountPaise: charge.finalPrice * 100,
      expectedNotes: { flow: 'listing', buyer_id: user.id },
    })
    if (paymentOrderError) {
      return { error: paymentOrderError }
    }
  }

  // 3. Validate subdomain
  const RESERVED = new Set([
    'www', 'admin', 'api', 'app', 'mail', 'shop', 'news', 'events',
    'jobs', 'forum', 'classifieds', 'emergency', 'dashboard', 'login',
    'profile', 'search', 'about', 'listings', 'my-business', 'offline',
    'auth', 'static', 'assets', 'media', 'cdn',
  ])

  if (!rawSubdomain) {
    return { error: 'Subdomain is required.' }
  }
  if (!/^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$/.test(rawSubdomain)) {
    return { error: 'Invalid subdomain format. Use 3-30 lowercase letters, numbers, or hyphens.' }
  }
  if (RESERVED.has(rawSubdomain)) {
    return { error: `"${rawSubdomain}" is a reserved subdomain.` }
  }
  const { data: existing } = await supabase
    .from('listings')
    .select('id')
    .eq('subdomain', rawSubdomain)
    .maybeSingle()
  if (existing) {
    return { error: `The subdomain "${rawSubdomain}.ourdahanu.in" is already taken.` }
  }
  const subdomain = rawSubdomain

  // 4. Insert listing
  const expiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()

  const { error } = await supabase.from('listings').insert({
    owner_id:       user.id,
    name,
    description,
    category,
    phone,
    whatsapp,
    address,
    website,
    plan:           'standard',
    image_url,
    subdomain,
    approved:       false,
    verified:       false,
    rating:         0,
    review_count:   0,
    upi_id,
    payment_id:     isFree ? null : paymentId,
    payment_status: charge.paymentStatus,
    coupon_used: charge.couponValid ? charge.couponCode : null,
    amount_paid: charge.finalPrice,
    map_url,
    expires_at:     expiresAt,
  })

  if (error) return { error: error.message }

  void sendNotificationToAdmins('admin.new_submission', {
    kind: 'listing',
    title: name,
    submitterName: user.email ?? null,
    reviewPath: '/admin/listings',
  }).catch(err => console.error('[notify:new-listing-paid]', err))

  revalidatePublicListingCollections()
  revalidatePath('/listings')
  return {}
}

export async function updateListing(
  id: string,
  formData: FormData,
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Please sign in.' }

  // Admins can edit any listing; others must own it
  const { createAdminClient } = await import('@/lib/supabase/admin-client')
  const { getUserRole } = await import('@/app/actions/admin')
  const { role } = await getUserRole(supabase)
  const isAdmin = role === 'admin' || role === 'moderator'

  const adminClient = createAdminClient()
  const db = (isAdmin && adminClient) ? adminClient : supabase

  if (!isAdmin) {
    const { data: existing } = await supabase
      .from('listings')
      .select('id, owner_id')
      .eq('id', id)
      .eq('owner_id', user.id)
      .single()
    if (!existing) return { error: 'Listing not found or access denied.' }
  }

  const name        = normalizeInlineText(formData.get('name') as string, 80)
  const tagline     = normalizeInlineText(formData.get('tagline') as string, 120)
  const description = normalizeMultilineText(formData.get('description') as string, 1500)
  const category    = normalizeInlineText(formData.get('category') as string, 60)
  const phone       = normalizePhoneOrNull(formData.get('phone') as string)
  const address     = normalizeInlineText(formData.get('address') as string, 180)
  const website     = normalizeOptionalUrlOrNull(formData.get('website') as string)
  const whatsapp    = normalizePhoneOrNull(formData.get('whatsapp') as string)
  const instagram   = normalizeInlineText(formData.get('instagram') as string, 40)
  const facebook    = normalizeOptionalUrlOrNull(formData.get('facebook') as string)
  const upi_id      = normalizeInlineText(formData.get('upi_id') as string, 80)
  const hours       = normalizeMultilineText(formData.get('hours') as string, 240)
  const image_url_new   = normalizeOptionalUrlOrNull(formData.get('image_url') as string)
  const cover_image_new = normalizeOptionalUrlOrNull(formData.get('cover_image') as string)
  const servicesRaw = (formData.get('services')      as string) || '[]'
  const tagsRaw     = (formData.get('tags')          as string) || '[]'
  const map_url     = normalizeOptionalUrlOrNull(formData.get('map_url') as string)

  // New fields
  const offer_text          = normalizeInlineText(formData.get('offer_text') as string, 160)
  const offer_expires_at    = (formData.get('offer_expires_at')   as string)?.trim() || null
  const pinned_announcement = normalizeMultilineText(formData.get('pinned_announcement') as string, 220)
  const established_year_raw = (formData.get('established_year')  as string)?.trim()
  const establishedYearValue = established_year_raw ? parseInt(established_year_raw) || null : null
  const currentYear = new Date().getFullYear()
  const established_year =
    establishedYearValue && establishedYearValue >= 1900 && establishedYearValue <= currentYear
      ? establishedYearValue
      : null
  const response_time       = normalizeInlineText(formData.get('response_time') as string, 50)
  const video_url           = normalizeOptionalUrlOrNull(formData.get('video_url') as string)
  const photosRaw           = (formData.get('photos')             as string) || '[]'
  const highlightsRaw       = (formData.get('highlights')         as string) || '[]'
  const certificationsRaw   = (formData.get('certifications')     as string) || '[]'
  const payment_methodsRaw  = (formData.get('payment_methods')    as string) || '[]'
  const delivery_infoRaw    = (formData.get('delivery_info')      as string) || 'null'
  const before_afterRaw     = (formData.get('before_after')       as string) || 'null'
  const appointment_settingsRaw = formData.has('appointment_settings')
    ? ((formData.get('appointment_settings') as string) || 'null')
    : null

  if (!name || !category) return { error: 'Business name and category are required.' }

  let services = []
  let tags = []
  let photos = []
  let highlights = []
  let certifications = []
  let payment_methods = []
  let delivery_info = null
  let before_after = null
  let appointment_settings = null
  try { services = JSON.parse(servicesRaw) } catch { /* ignore */ }
  try { tags = JSON.parse(tagsRaw) } catch { /* ignore */ }
  try { photos = JSON.parse(photosRaw) } catch { /* ignore */ }
  try { highlights = JSON.parse(highlightsRaw) } catch { /* ignore */ }
  try { certifications = JSON.parse(certificationsRaw) } catch { /* ignore */ }
  try { payment_methods = JSON.parse(payment_methodsRaw) } catch { /* ignore */ }
  try { delivery_info = JSON.parse(delivery_infoRaw) } catch { /* ignore */ }
  try { before_after = JSON.parse(before_afterRaw) } catch { /* ignore */ }
  if (appointment_settingsRaw !== null) {
    try { appointment_settings = JSON.parse(appointment_settingsRaw) } catch { /* ignore */ }
  }

  services = normalizeServiceItems(services)
  tags = normalizeStringArray(tags, 12, 30)
  photos = normalizeUrlArray(photos, 12)
  highlights = normalizeHighlightItems(highlights)
  certifications = normalizeStringArray(certifications, 10, 50)
  payment_methods = normalizeStringArray(payment_methods, 8, 30)
  delivery_info = normalizeDeliveryInfo(delivery_info)
  before_after = normalizeBeforeAfter(before_after)
  appointment_settings = appointment_settingsRaw !== null
    ? normalizeAppointmentSettings(appointment_settings)
    : null

  // Only overwrite images if a new file was actually uploaded
  // (empty string means no new upload - keep existing DB value)
  const imageFields: Record<string, string> = {}
  if (image_url_new)   imageFields.image_url   = image_url_new
  if (cover_image_new) imageFields.cover_image = cover_image_new

  const appointmentFields =
    appointment_settingsRaw !== null
      ? { appointment_settings }
      : {}

  const updateQuery = db.from('listings').update({
    name, tagline, description, category, phone, address, website,
    whatsapp, instagram, facebook, upi_id, hours,
    ...imageFields,
    services, tags,
    map_url,
    offer_text, offer_expires_at, pinned_announcement, established_year,
    response_time, video_url, photos, highlights, certifications,
    payment_methods, delivery_info, before_after,
    ...appointmentFields,
    updated_at: new Date().toISOString(),
  }).eq('id', id)

  // Non-admins: also scope to owner
  const { error } = isAdmin
    ? await updateQuery
    : await updateQuery.eq('owner_id', user.id)

  if (error) return { error: error.message }

  revalidatePublicListingContent(id)
  revalidatePath(`/listings/${id}`)
  revalidatePath('/my-business')
  revalidatePath('/admin/listings')
  return {}
}

export async function submitListing(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const name = normalizeInlineText(formData.get('name') as string, 80)
  const description = normalizeMultilineText(formData.get('description') as string, 900)
  const category = normalizeInlineText(formData.get('category') as string, 60)
  const phone = normalizePhoneOrNull(formData.get('phone') as string)
  const address = normalizeInlineText(formData.get('address') as string, 180)
  const website = normalizeOptionalUrlOrNull(formData.get('website') as string)
  const plan = normalizeInlineText(formData.get('plan') as string, 30) || 'basic'
  const image_url = normalizeOptionalUrlOrNull(formData.get('image_url') as string)
  const rawSubdomain = ((formData.get('subdomain') as string) || '').trim().toLowerCase()

  const RESERVED = new Set([
    'www', 'admin', 'api', 'app', 'mail', 'shop', 'news', 'events',
    'jobs', 'forum', 'classifieds', 'emergency', 'dashboard', 'login',
    'profile', 'search', 'about', 'listings', 'my-business', 'offline',
    'auth', 'static', 'assets', 'media', 'cdn',
  ])

  if (!name || !category) {
    throw new Error('Business name and category are required.')
  }
  if (!rawSubdomain) {
    throw new Error('Subdomain is required.')
  }
  if (!/^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$/.test(rawSubdomain)) {
    throw new Error('Invalid subdomain format. Use 3-30 lowercase letters, numbers, or hyphens.')
  }
  if (RESERVED.has(rawSubdomain)) {
    throw new Error(`"${rawSubdomain}" is a reserved subdomain.`)
  }
  // Check uniqueness
  const { data: existing } = await supabase
    .from('listings')
    .select('id')
    .eq('subdomain', rawSubdomain)
    .maybeSingle()
  if (existing) {
    throw new Error(`The subdomain "${rawSubdomain}.ourdahanu.in" is already taken.`)
  }
  const subdomain = rawSubdomain

  const { error } = await supabase.from('listings').insert({
    owner_id: user.id,
    name,
    description,
    category,
    phone,
    address,
    website,
    plan,
    image_url,
    subdomain,
    approved: false,
    verified: false,
    rating: 0,
    review_count: 0,
  })

  if (error) throw new Error(error.message)

  void sendNotificationToAdmins('admin.new_submission', {
    kind: 'listing',
    title: name,
    submitterName: user.email ?? null,
    reviewPath: '/admin/listings',
  }).catch(err => console.error('[notify:new-listing-free]', err))

  revalidatePublicListingCollections()
  revalidatePath('/listings')
  redirect('/listings?submitted=1')
}

export async function submitReview(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const listingId = formData.get('listing_id') as string
  const rating = Number(formData.get('rating'))
  const comment = normalizeMultilineText(formData.get('comment') as string, 500)

  if (!listingId || !rating || rating < 1 || rating > 5) {
    throw new Error('Invalid review data')
  }

  const { error: reviewError } = await supabase.from('reviews').insert({
    listing_id: listingId,
    user_id: user.id,
    rating,
    comment,
  })

  if (reviewError) throw new Error(reviewError.message)

  // Recalculate average rating - use admin client to bypass RLS on listings UPDATE
  const adminClient = createAdminClient()
  const dbClient = adminClient ?? supabase

  const { data: reviews } = await dbClient
    .from('reviews')
    .select('rating')
    .eq('listing_id', listingId)

  if (reviews && reviews.length > 0) {
    const avg = reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
    await dbClient
      .from('listings')
      .update({ rating: Math.round(avg * 10) / 10, review_count: reviews.length })
      .eq('id', listingId)
  }

  revalidatePublicListingContent(listingId)
  // Revalidate both UUID path and subdomain path
  revalidatePath('/listings/' + listingId)
  const { data: listingMeta } = await dbClient
    .from('listings')
    .select('name, subdomain')
    .eq('id', listingId)
    .single()
  if (listingMeta?.subdomain) {
    revalidatePath('/listings/' + listingMeta.subdomain)
  }

  const reviewer =
    (user.user_metadata?.full_name as string | undefined)?.trim() ||
    user.email ||
    'Anonymous'

  if (listingMeta?.name) {
    void (async () => {
      try {
        const { data: ownerRow } = await dbClient
          .from('listings')
          .select('owner_id')
          .eq('id', listingId)
          .maybeSingle()

        const reviewPayload = {
          listingId,
          listingName: listingMeta.name as string,
          subdomain: (listingMeta.subdomain as string | null) || null,
          reviewerName: reviewer,
          rating,
          comment: comment?.trim() || null,
        }

        const ownerId = (ownerRow?.owner_id as string | null | undefined) ?? null
        await Promise.allSettled([
          ownerId
            ? sendNotification(ownerId, 'review.new', { ...reviewPayload, recipient: 'owner' })
            : Promise.resolve(),
          sendNotificationToAdmins('review.new', { ...reviewPayload, recipient: 'admin' }),
        ])
      } catch (err) {
        console.error('[submitReview:notify]', err)
      }
    })()
  }
}

export async function renewListing(
  listingId: string,
  formData: FormData,
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Please sign in first.' }

  // 1. Verify payment signature (same as submitPaidListing)
  const paymentId = (formData.get('razorpay_payment_id') as string)?.trim()
  const orderId   = (formData.get('razorpay_order_id')   as string)?.trim()
  const signature = (formData.get('razorpay_signature')  as string)?.trim()
  const isFree    = paymentId === 'free' && orderId === 'free' && signature === 'free'

  if (!isFree) {
    if (!paymentId || !orderId || !signature) {
      return { error: 'Payment details are missing. Please try again.' }
    }
    const keySecret = process.env.RAZORPAY_KEY_SECRET?.trim()
    if (!keySecret) return { error: 'Payment gateway not configured.' }

    const { createHmac } = await import('crypto')
    const expected = createHmac('sha256', keySecret)
      .update(`${orderId}|${paymentId}`)
      .digest('hex')

    if (expected !== signature) {
      return { error: 'Payment verification failed. Please contact support.' }
    }
  }

  // 2. Verify listing ownership
  const { data: listing } = await supabase
    .from('listings')
    .select('id, owner_id, expires_at')
    .eq('id', listingId)
    .eq('owner_id', user.id)
    .single()

  if (!listing) return { error: 'Listing not found or access denied.' }

  const coupon_used = (formData.get('coupon')      as string)?.trim() || null
  const charge = await getListingSubmissionCharge(coupon_used)

  if (coupon_used && !charge.couponValid) {
    return { error: 'Coupon code is invalid or inactive.' }
  }
  if (isFree) {
    if (!charge.couponValid || !charge.isFree) {
      return { error: 'A valid free coupon is required to renew without payment.' }
    }
  } else {
    if (charge.isFree) {
      return { error: 'This coupon makes the renewal free. Please retry without payment.' }
    }

    const razorpayOrder = await fetchRazorpayOrder(orderId)
    const paymentOrderError = validateRazorpayOrder({
      order: razorpayOrder,
      flow: 'listing',
      userId: user.id,
      expectedAmountPaise: charge.finalPrice * 100,
      expectedNotes: { flow: 'listing', buyer_id: user.id },
    })
    if (paymentOrderError) {
      return { error: paymentOrderError }
    }
  }

  // 3. Compute new expiry
  // If current expiry is still in the future, extend from there (no gap).
  // If already expired (or no expiry), extend from today.
  const currentExpiry = listing.expires_at ? new Date(listing.expires_at as string) : null
  const base      = currentExpiry && currentExpiry > new Date() ? currentExpiry : new Date()
  const newExpiry = new Date(base.getTime() + 365 * 24 * 60 * 60 * 1000)

  // Use admin client to bypass RLS (owner might have approved=false if expired)
  const adminClient = createAdminClient()
  const db = adminClient ?? supabase

  const { error } = await db
    .from('listings')
    .update({
      expires_at:     newExpiry.toISOString(),
      approved:       true,          // re-activate if auto-expired
      reminders_sent: [],            // reset reminder tracking
      payment_id:     isFree ? null : paymentId,
      payment_status: charge.paymentStatus,
      coupon_used: charge.couponValid ? charge.couponCode : null,
      amount_paid: charge.finalPrice,
    })
    .eq('id', listingId)

  if (error) return { error: error.message }

  revalidatePublicListingContent(listingId)
  revalidatePath('/my-business')
  revalidatePath(`/listings/${listingId}`)
  revalidatePath('/listings')
  return {}
}

export async function incrementListingView(listingId: string) {
  try {
    const adminClient = createAdminClient()
    if (!adminClient) return
    // Fetch current views, increment by 1
    const { data } = await adminClient
      .from('listings')
      .select('views')
      .eq('id', listingId)
      .single()
    const currentViews = (data?.views as number) || 0
    await adminClient
      .from('listings')
      .update({ views: currentViews + 1 })
      .eq('id', listingId)
  } catch { /* views column may not exist yet */ }
}
