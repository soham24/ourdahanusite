'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin-client'
import {
  revalidateAppointmentsCache,
  revalidatePublicListingContent,
  revalidatePublicListingDetail,
} from '@/lib/cache-tags'
import {
  sendNotification,
  sendNotificationToAdmins,
} from '@/lib/notifications'
import {
  normalizeBeforeAfter,
  normalizeDeliveryInfo,
  normalizeHighlightItems,
  normalizeInlineText,
  normalizeMultilineText,
  normalizePhoneOrNull,
  normalizeStringArray,
  normalizeUrlArray,
} from '@/lib/listing-content'
import { recordCouponRedemption } from '@/lib/coupon-redemptions'
import {
  claimIntentForFinalization,
  findFinalizedIntentByPaymentId,
  getIntentByOrderId,
  markIntentCaptured,
  markIntentFinalized,
  recordIntentError,
  releaseIntentClaim,
} from '@/lib/payment-intents'
import {
  fetchRazorpayOrder,
  getListingSubmissionCharge,
  validateRazorpayOrder,
} from '@/lib/payment-security'
import { normalizeOptionalUrlOrNull } from '@/lib/url'
import { RESERVED_SUBDOMAINS } from '@/lib/subdomain'
import { redirect } from 'next/navigation'
import { siteConfig } from '@/lib/site'
import { fetchProfileNames } from '@/lib/data/profile-names'

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

    // Idempotency: a successful retry must not create a duplicate
    // listing for the same Razorpay payment.
    const finalized = await findFinalizedIntentByPaymentId(paymentId)
    if (finalized && finalized.user_id === user.id && finalized.entity_table === 'listings') {
      return {}
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
  const image_url       = normalizeOptionalUrlOrNull(formData.get('image_url') as string)
  const image_thumb_url = normalizeOptionalUrlOrNull(formData.get('image_thumb_url') as string)
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
      await recordIntentError({ razorpayOrderId: orderId, message: paymentOrderError })
      return { error: paymentOrderError }
    }

    await markIntentCaptured({
      razorpayOrderId: orderId,
      razorpayPaymentId: paymentId,
      razorpaySignature: signature,
    })
  }

  // 3. Validate subdomain
  const RESERVED = RESERVED_SUBDOMAINS

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
    if (!isFree) {
      await recordIntentError({
        razorpayOrderId: orderId,
        message: `Subdomain ${rawSubdomain} taken — buyer needs to pick another`,
      })
    }
    return { error: `The subdomain "${rawSubdomain}.${siteConfig.domain}" is already taken.` }
  }
  const subdomain = rawSubdomain

  // 4. Insert listing
  const expiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()

  const { data: insertedListing, error } = await supabase.from('listings').insert({
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
    image_thumb_url: image_thumb_url || image_url,
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
  }).select('id').single()

  if (error) {
    if (!isFree) {
      await recordIntentError({ razorpayOrderId: orderId, message: error.message })
    }
    return { error: error.message }
  }

  if (!isFree && insertedListing?.id) {
    await markIntentFinalized({
      razorpayOrderId: orderId,
      entityId: insertedListing.id as string,
      entityTable: 'listings',
    })
  }

  // Ledger row only on a verified success — abandoned checkouts write nothing.
  if (charge.couponValid && charge.couponCode) {
    await recordCouponRedemption({
      couponCode: charge.couponCode,
      userId: user.id,
      listingId: (insertedListing?.id as string) ?? null,
      kind: 'new',
      paymentStatus: charge.paymentStatus,
      amountPaid: charge.finalPrice,
      paymentId: isFree ? null : paymentId,
    })
  }

  await sendNotificationToAdmins('admin.new_submission', {
    kind: 'listing',
    title: name,
    submitterName: user.email ?? null,
    reviewPath: '/admin/listings',
  }).catch(err => console.error('[notify:new-listing-paid]', err))

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
  const image_url_new        = normalizeOptionalUrlOrNull(formData.get('image_url') as string)
  const image_thumb_url_new  = normalizeOptionalUrlOrNull(formData.get('image_thumb_url') as string)
  const cover_image_new      = normalizeOptionalUrlOrNull(formData.get('cover_image') as string)
  const cover_image_thumb_url_new = normalizeOptionalUrlOrNull(formData.get('cover_image_thumb_url') as string)
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

  if (!name || !category) return { error: 'Business name and category are required.' }

  let tags = []
  let photos = []
  let highlights = []
  let certifications = []
  let payment_methods = []
  let delivery_info = null
  let before_after = null
  try { tags = JSON.parse(tagsRaw) } catch { /* ignore */ }
  try { photos = JSON.parse(photosRaw) } catch { /* ignore */ }
  try { highlights = JSON.parse(highlightsRaw) } catch { /* ignore */ }
  try { certifications = JSON.parse(certificationsRaw) } catch { /* ignore */ }
  try { payment_methods = JSON.parse(payment_methodsRaw) } catch { /* ignore */ }
  try { delivery_info = JSON.parse(delivery_infoRaw) } catch { /* ignore */ }
  try { before_after = JSON.parse(before_afterRaw) } catch { /* ignore */ }

  tags = normalizeStringArray(tags, 12, 30)
  photos = normalizeUrlArray(photos, 12)
  highlights = normalizeHighlightItems(highlights)
  certifications = normalizeStringArray(certifications, 10, 50)
  payment_methods = normalizeStringArray(payment_methods, 8, 30)
  delivery_info = normalizeDeliveryInfo(delivery_info)
  before_after = normalizeBeforeAfter(before_after)

  // Only overwrite images if a new file was actually uploaded
  // (empty string means no new upload - keep existing DB value)
  const imageFields: Record<string, string> = {}
  if (image_url_new) {
    imageFields.image_url       = image_url_new
    imageFields.image_thumb_url = image_thumb_url_new || image_url_new
  }
  if (cover_image_new) {
    imageFields.cover_image            = cover_image_new
    imageFields.cover_image_thumb_url  = cover_image_thumb_url_new || cover_image_new
  }

  const updateQuery = db.from('listings').update({
    name, tagline, description, category, phone, address, website,
    whatsapp, instagram, facebook, upi_id, hours,
    ...imageFields,
    tags,
    map_url,
    offer_text, offer_expires_at, pinned_announcement, established_year,
    response_time, video_url, photos, highlights, certifications,
    payment_methods, delivery_info, before_after,
    updated_at: new Date().toISOString(),
  }).eq('id', id)

  // Non-admins: also scope to owner
  const { error } = isAdmin
    ? await updateQuery
    : await updateQuery.eq('owner_id', user.id)

  if (error) return { error: error.message }

  revalidatePublicListingContent(id)
  // The appointments directory caches each listing's name, category and photo
  // under its own tag, so an ordinary listing edit has to bust it too — or the
  // booking directory shows the old name for up to a day.
  revalidateAppointmentsCache(id)
  return {}
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
  const { data: listingMeta } = await dbClient
    .from('listings')
    .select('name, subdomain')
    .eq('id', listingId)
    .single()
  const reviewer =
    (user.user_metadata?.full_name as string | undefined)?.trim() ||
    user.email ||
    'Anonymous'

  if (listingMeta?.name) {
    await (async () => {
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

/**
 * Listing owner posts a single reply to a review.
 *   - Auth: must be signed in.
 *   - Authorization: must own the listing the review is attached to.
 *   - Invariant: a review may receive at most one owner reply (enforced by
 *     the existing-reply guard + RLS policy in add_review_replies.sql).
 *   - Notifies the reviewer + all admins via the unified notification engine.
 */
export async function replyToReview(
  reviewId: string,
  formData: FormData,
): Promise<{ error?: string; ok?: true }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Please sign in first.' }

  const raw = (formData.get('reply') as string | null) ?? ''
  const replyText = normalizeMultilineText(raw, 1000)
  if (!replyText || replyText.trim().length < 2) {
    return { error: 'Please write a reply (at least 2 characters).' }
  }

  if (!reviewId || typeof reviewId !== 'string') {
    return { error: 'Invalid review.' }
  }

  // Use admin client to bypass RLS on listings lookups and the reviews
  // UPDATE, mirroring the pattern used in submitReview.
  const adminClient = createAdminClient()
  const dbClient = adminClient ?? supabase

  // 1. Load the review with its listing + owner + reviewer so we can
  //    verify ownership and compose notification payloads.
  const { data: reviewRow, error: reviewErr } = await dbClient
    .from('reviews')
    .select(
      'id, listing_id, user_id, rating, comment, owner_reply, listings(id, name, subdomain, owner_id)',
    )
    .eq('id', reviewId)
    .maybeSingle()

  if (reviewErr) {
    console.error('[replyToReview:fetch]', reviewErr)
    return { error: 'Could not load the review.' }
  }
  if (!reviewRow) return { error: 'Review not found.' }

  // Supabase typing returns `listings` as an array when using the nested
  // selector from the relationship side; normalise here.
  const listingRel = reviewRow.listings as unknown
  const listing = Array.isArray(listingRel)
    ? (listingRel[0] as {
        id: string
        name: string
        subdomain: string | null
        owner_id: string | null
      } | undefined)
    : (listingRel as
        | { id: string; name: string; subdomain: string | null; owner_id: string | null }
        | null)

  if (!listing) return { error: 'Listing not found for this review.' }
  if (listing.owner_id !== user.id) {
    return { error: 'Only the listing owner can reply to this review.' }
  }
  if (reviewRow.owner_reply) {
    return { error: 'You have already replied to this review.' }
  }

  // 2. Persist the reply.
  const repliedAt = new Date().toISOString()
  const { error: updateErr } = await dbClient
    .from('reviews')
    .update({ owner_reply: replyText, owner_replied_at: repliedAt })
    .eq('id', reviewId)
    .is('owner_reply', null)

  if (updateErr) {
    console.error('[replyToReview:update]', updateErr)
    return { error: 'Could not save your reply.' }
  }

  // 3. Revalidate cached views.
  revalidatePublicListingDetail(listing.id)

  // 4. Fire notifications (awaited delivery; never break the UX).
  const ownerName =
    (user.user_metadata?.full_name as string | undefined)?.trim() ||
    (listing.name as string | undefined)?.trim() ||
    null

  const reviewerName = reviewRow.user_id
    ? ((await fetchProfileNames(dbClient, [reviewRow.user_id])).get(reviewRow.user_id) ?? null)
    : null

  const payloadBase = {
    reviewId,
    listingId: listing.id,
    listingName: listing.name,
    subdomain: listing.subdomain ?? null,
    ownerName,
    reviewerName,
    rating: reviewRow.rating as number,
    reviewComment: (reviewRow.comment as string | null) || null,
    replyText,
  }

  await (async () => {
    try {
      await Promise.allSettled([
        reviewRow.user_id
          ? sendNotification(reviewRow.user_id as string, 'review.reply_posted', {
              ...payloadBase,
              recipient: 'reviewer',
            })
          : Promise.resolve(),
        sendNotificationToAdmins('review.reply_posted', {
          ...payloadBase,
          recipient: 'admin',
        }),
      ])
    } catch (err) {
      console.error('[replyToReview:notify]', err)
    }
  })()

  return { ok: true }
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

    const finalized = await findFinalizedIntentByPaymentId(paymentId)
    if (finalized) {
      // Already applied to this listing: a retry, answer as success.
      if (
        finalized.user_id === user.id &&
        finalized.entity_table === 'listings' &&
        finalized.entity_id === listingId
      ) {
        return {}
      }
      // Spent on something else. Without this, one payment could renew
      // listing after listing, a year each time.
      return { error: 'This payment has already been used.' }
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
    .select('id, owner_id, expires_at, approved')
    .eq('id', listingId)
    .eq('owner_id', user.id)
    .single()

  if (!listing) return { error: 'Listing not found or access denied.' }

  // The order must have been created to renew this listing, by this user.
  if (!isFree) {
    const intent = await getIntentByOrderId(orderId)
    if (!intent || intent.user_id !== user.id || intent.flow !== 'renew' || intent.listing_id !== listingId) {
      return { error: 'This payment was not made for renewing this listing.' }
    }
  }

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
      await recordIntentError({ razorpayOrderId: orderId, message: paymentOrderError })
      return { error: paymentOrderError }
    }

    await markIntentCaptured({
      razorpayOrderId: orderId,
      razorpayPaymentId: paymentId,
      razorpaySignature: signature,
    })
  }

  // 3. Compute new expiry
  // If current expiry is still in the future, extend from there (no gap).
  // If already expired (or no expiry), extend from today.
  const currentExpiry = listing.expires_at ? new Date(listing.expires_at as string) : null
  const base      = currentExpiry && currentExpiry > new Date() ? currentExpiry : new Date()
  const newExpiry = new Date(base.getTime() + 365 * 24 * 60 * 60 * 1000)

  // Renewing brings back a listing that went offline because it expired --
  // the expiry cron only ever sets approved=false on listings past
  // expires_at. It must not approve one still awaiting review, or one an
  // admin took down before its expiry: that would skip moderation.
  const wasAutoExpired = !listing.approved && currentExpiry !== null && currentExpiry <= new Date()
  const approved = Boolean(listing.approved) || wasAutoExpired

  // Claim the payment before applying it, so two concurrent calls with the
  // same payment cannot both extend the listing.
  if (!isFree) {
    const claimed = await claimIntentForFinalization({
      razorpayOrderId: orderId,
      entityId: listingId,
      entityTable: 'listings',
    })
    if (!claimed) return { error: 'This payment has already been used.' }
  }

  // Use admin client to bypass RLS (owner might have approved=false if expired)
  const adminClient = createAdminClient()
  const db = adminClient ?? supabase

  const { error } = await db
    .from('listings')
    .update({
      expires_at:     newExpiry.toISOString(),
      approved,
      reminders_sent: [],            // reset reminder tracking
      payment_id:     isFree ? null : paymentId,
      payment_status: charge.paymentStatus,
      coupon_used: charge.couponValid ? charge.couponCode : null,
      amount_paid: charge.finalPrice,
    })
    .eq('id', listingId)

  if (error) {
    if (!isFree) {
      // Give the claim back so the paid renewal can still be recovered.
      await releaseIntentClaim({ razorpayOrderId: orderId, message: error.message })
    }
    return { error: error.message }
  }

  if (charge.couponValid && charge.couponCode) {
    await recordCouponRedemption({
      couponCode: charge.couponCode,
      userId: user.id,
      listingId,
      kind: 'renewal',
      paymentStatus: charge.paymentStatus,
      amountPaid: charge.finalPrice,
      paymentId: isFree ? null : paymentId,
    })
  }

  revalidatePublicListingContent(listingId)
  return {}
}
