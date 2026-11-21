'use server'

import { isUuid } from '@/lib/data/read'
import { ENQUIRY_LIMITS, validateEnquiry, type EnquiryInput } from '@/lib/enquiry'
import { sendNotification } from '@/lib/notifications'
import { rateLimit } from '@/lib/rate-limit'
import { createAdminClient } from '@/lib/supabase/admin-client'
import { createClient } from '@/lib/supabase/server'

const DAY_MS = 86_400_000

/**
 * A signed-in visitor's private message to a business. The owner is notified
 * and replies by phone or WhatsApp; nothing is shown publicly.
 */
export async function sendEnquiry(listingId: string, input: EnquiryInput): Promise<{ error?: string }> {
  if (!isUuid(listingId)) return { error: 'This business could not be found.' }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Please sign in to send an enquiry.' }

  const validation = validateEnquiry(input)
  if ('error' in validation) return { error: validation.error }

  // A quick in-memory brake per instance, then the real limits from the
  // database, which hold across every server instance.
  if (!rateLimit(`enquiry:${user.id}`, 5, 10 * 60_000).ok) {
    return { error: 'You have sent several enquiries just now. Please wait a few minutes.' }
  }
  const since = new Date(Date.now() - DAY_MS).toISOString()
  const { data: recent, error: recentError } = await supabase
    .from('listing_enquiries')
    .select('listing_id')
    .eq('user_id', user.id)
    .gte('created_at', since)
  if (recentError) return { error: 'Could not send your enquiry right now. Please try again.' }
  const sentToday = recent ?? []
  if (sentToday.length >= ENQUIRY_LIMITS.perDay) {
    return { error: 'You have reached today’s limit for enquiries. Please try again tomorrow.' }
  }
  if (sentToday.filter((row) => row.listing_id === listingId).length >= ENQUIRY_LIMITS.perListingPerDay) {
    return { error: 'You have already sent this business a few enquiries today. They will be in touch.' }
  }

  // Row level security holds the insert to the sender's own id and an approved listing.
  const { data: created, error } = await supabase
    .from('listing_enquiries')
    .insert({ listing_id: listingId, user_id: user.id, ...validation.values })
    .select('id')
    .single()
  if (error || !created) {
    console.error('[enquiries] insert failed:', error?.message)
    return { error: 'Could not send your enquiry. Please try again.' }
  }

  const admin = createAdminClient()
  const { data: listing } = admin
    ? await admin.from('listings').select('name, owner_id').eq('id', listingId).maybeSingle()
    : { data: null }
  if (listing?.owner_id && listing.owner_id !== user.id) {
    // Awaited so a serverless function does not stop before the email is out.
    // sendNotification never throws.
    await sendNotification(
      listing.owner_id,
      'enquiry.new',
      {
        enquiryId: created.id,
        listingId,
        listingName: listing.name,
        customerName: validation.values.name,
        customerPhone: validation.values.phone,
        message: validation.values.message,
      },
      { awaitDelivery: true },
    )
  }

  return {}
}

export type OwnerEnquiry = {
  id: string
  listing_id: string
  listing_name: string
  name: string
  phone: string
  message: string
  created_at: string
}

/** Enquiries to the caller's own businesses, newest first. */
export async function getMyBusinessEnquiries(): Promise<{ enquiries: OwnerEnquiry[]; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { enquiries: [], error: 'Please sign in.' }

  const { data: owned, error: ownedError } = await supabase.from('listings').select('id, name').eq('owner_id', user.id)
  if (ownedError) return { enquiries: [], error: 'Could not load your enquiries.' }
  const names = new Map(((owned ?? []) as { id: string; name: string }[]).map((l) => [l.id, l.name]))
  if (names.size === 0) return { enquiries: [] }

  const { data, error } = await supabase
    .from('listing_enquiries')
    .select('id, listing_id, name, phone, message, created_at')
    .in('listing_id', [...names.keys()])
    .order('created_at', { ascending: false })
    .limit(200)
  if (error) return { enquiries: [], error: 'Could not load your enquiries.' }

  return {
    enquiries: ((data ?? []) as Omit<OwnerEnquiry, 'listing_name'>[]).map((row) => ({
      ...row,
      listing_name: names.get(row.listing_id) ?? '',
    })),
  }
}
