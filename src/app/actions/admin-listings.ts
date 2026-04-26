'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin-client'
import { revalidatePublicListingCollections } from '@/lib/cache-tags'
import {
  normalizeInlineText,
  normalizeMultilineText,
  normalizePhoneOrNull,
} from '@/lib/listing-content'
import { normalizeOptionalUrlOrNull } from '@/lib/url'
import { revalidatePath } from 'next/cache'
import { getUserRole } from './admin'

async function checkAdmin() {
  const supabase = await createClient()
  const { role, user } = await getUserRole(supabase)
  if (!user || (role !== 'admin' && role !== 'moderator')) {
    throw new Error('Unauthorized')
  }
  const adminClient = createAdminClient()
  if (!adminClient) throw new Error('Admin client unavailable')
  return adminClient
}

export async function adminCreateListing(
  formData: FormData,
): Promise<{ error?: string; id?: string }> {
  try {
    const db = await checkAdmin()

    const name        = normalizeInlineText(formData.get('name') as string, 80)
    const category    = normalizeInlineText(formData.get('category') as string, 60)
    const description = normalizeMultilineText(formData.get('description') as string, 900)
    const phone       = normalizePhoneOrNull(formData.get('phone') as string)
    const whatsapp    = normalizePhoneOrNull(formData.get('whatsapp') as string)
    const address     = normalizeInlineText(formData.get('address') as string, 180)
    const website     = normalizeOptionalUrlOrNull(formData.get('website') as string)
    const map_url     = normalizeOptionalUrlOrNull(formData.get('map_url') as string)
    const tagline     = normalizeInlineText(formData.get('tagline') as string, 120)
    const plan        = normalizeInlineText(formData.get('plan') as string, 30) || 'standard'
    const approved    = formData.get('approved') === 'true'
    const owner_id    = normalizeInlineText(formData.get('owner_id') as string, 80)
    const rawSub      = ((formData.get('subdomain')  as string) || '').trim().toLowerCase()

    if (!name || !category) return { error: 'Name and category are required.' }

    let subdomain: string | null = null
    if (rawSub) {
      const { data: existing } = await db
        .from('listings')
        .select('id')
        .eq('subdomain', rawSub)
        .maybeSingle()
      if (existing) return { error: `Subdomain "${rawSub}.ourdahanu.in" is already taken.` }
      subdomain = rawSub
    }

    const { data, error } = await db.from('listings').insert({
      name, category, description, phone, whatsapp, address, website,
      map_url, tagline, plan, approved, subdomain,
      owner_id: owner_id || null,
      verified: false,
      rating: 0,
      review_count: 0,
      payment_status: 'manual',
      amount_paid: 0,
    }).select('id').single()

    if (error) return { error: error.message }

    revalidatePublicListingCollections()
    return { id: data.id }
  } catch (e: unknown) {
    return { error: e instanceof Error ? e.message : 'Failed to create listing.' }
  }
}

export async function adminAssignOwner(
  listingId: string,
  userId: string,
): Promise<{ error?: string }> {
  try {
    const db = await checkAdmin()

    const { error } = await db
      .from('listings')
      .update({ owner_id: userId })
      .eq('id', listingId)

    if (error) return { error: error.message }

    revalidatePath(`/admin/listings/${listingId}/edit`)
    revalidatePath('/admin/listings')
    return {}
  } catch (e: unknown) {
    return { error: e instanceof Error ? e.message : 'Failed to assign owner.' }
  }
}

export async function adminExtendListing(
  listingId: string,
): Promise<{ error?: string }> {
  try {
    const db = await checkAdmin()

    // Fetch current expiry to decide where to extend from
    const { data: listing } = await db
      .from('listings')
      .select('expires_at')
      .eq('id', listingId)
      .single()

    const currentExpiry = listing?.expires_at ? new Date(listing.expires_at as string) : null
    // Extend from current expiry if it's still in the future; otherwise from today
    const base      = currentExpiry && currentExpiry > new Date() ? currentExpiry : new Date()
    const newExpiry = new Date(base.getTime() + 365 * 24 * 60 * 60 * 1000)

    const { error } = await db
      .from('listings')
      .update({
        expires_at:     newExpiry.toISOString(),
        approved:       true,   // re-activate if it was auto-expired
        reminders_sent: [],     // reset so reminders fire again next cycle
      })
      .eq('id', listingId)

    if (error) return { error: error.message }

    revalidatePublicListingCollections()
    return {}
  } catch (e: unknown) {
    return { error: e instanceof Error ? e.message : 'Failed to extend listing.' }
  }
}

export async function adminSearchUsers(
  query: string,
): Promise<{ users: { id: string; email: string; name: string }[]; error?: string }> {
  try {
    const db = await checkAdmin()

    const { data, error } = await db.rpc
      ? await (async () => {
          // Query auth.users via raw SQL through the management API approach
          // Use profiles table which mirrors auth users
          const res = await db
            .from('profiles')
            .select('id, full_name, email')
            .or(`full_name.ilike.%${query}%,email.ilike.%${query}%`)
            .limit(10)
          return res
        })()
      : { data: null, error: { message: 'No RPC' } }

    if (error || !data) {
      // Fallback: search auth.users directly via admin
      const { data: { users }, error: authErr } = await db.auth.admin.listUsers()
      if (authErr) return { users: [], error: authErr.message }

      const q = query.toLowerCase()
      const filtered = users
        .filter(u =>
          u.email?.toLowerCase().includes(q) ||
          (u.user_metadata?.full_name as string)?.toLowerCase().includes(q),
        )
        .slice(0, 10)
        .map(u => ({
          id: u.id,
          email: u.email ?? '',
          name: (u.user_metadata?.full_name as string) || u.email?.split('@')[0] || '',
        }))
      return { users: filtered }
    }

    return {
      users: data.map((p: { id: string; full_name: string | null; email: string | null }) => ({
        id: p.id,
        email: p.email ?? '',
        name: p.full_name || p.email?.split('@')[0] || '',
      })),
    }
  } catch (e: unknown) {
    return { users: [], error: e instanceof Error ? e.message : 'Search failed.' }
  }
}
