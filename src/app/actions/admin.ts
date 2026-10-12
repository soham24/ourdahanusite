'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin-client'
import {
  revalidateEmergencyCache,
  revalidatePublicListingContent,
} from '@/lib/cache-tags'
import { sendNotification } from '@/lib/notifications'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import type { SupabaseClient } from '@supabase/supabase-js'
import { siteConfig } from '@/lib/site'
import { recomputeListingRating } from '@/lib/listing-rating'

const ADMIN_EMAIL = process.env.ADMIN_EMAIL

export type UserRole = 'admin' | 'moderator' | 'business_owner' | 'user'

export async function getUserRole(supabase: SupabaseClient): Promise<{ user: import('@supabase/supabase-js').User | null; role: UserRole; verified: boolean }> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { user: null, role: 'user', verified: false }

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin, role, verified')
    .eq('id', user.id)
    .single()

  // Legacy is_admin or ADMIN_EMAIL env var = admin
  if ((ADMIN_EMAIL && user.email === ADMIN_EMAIL) || profile?.is_admin === true) {
    return { user, role: 'admin', verified: true }
  }

  const role = (profile?.role as UserRole) || 'user'
  const verified = profile?.verified === true
  return { user, role, verified }
}

/** Requires admin only */
export async function requireAdmin(supabase: SupabaseClient) {
  const { user, role } = await getUserRole(supabase)
  if (!user) redirect('/login')
  if (role !== 'admin') redirect('/')
  return user
}

/** Requires admin OR moderator */
export async function requireAdminOrMod(supabase: SupabaseClient) {
  const { user, role } = await getUserRole(supabase)
  if (!user) redirect('/login')
  if (role !== 'admin' && role !== 'moderator') redirect('/')
  return { user, role }
}

const TABLE_PATH_MAP: Record<string, string> = {
  events: '/events',
  listings: '/listings',
}

// Maps each table to the field that holds the submitter's user ID
const SUBMITTER_FIELD: Record<string, string> = {
  events: 'organizer_id',
  listings: 'owner_id',
}

// Maps each table to a human-readable content label
const CONTENT_LABEL: Record<string, string> = {
  events: 'event',
  listings: 'business listing',
}

/**
 * Send an approval notification to the submitter of non-listing content
 * (events).
 *
 * Listings go through the unified `sendNotification('listing.approved')` path
 * instead, since that also fires WhatsApp + Telegram + in-app in one shot.
 */
async function notifyGenericApproval(table: string, id: string) {
  try {
    if (!process.env.RESEND_API_KEY) return
    if (table === 'listings') return // listings use sendNotification path

    const adminClient = createAdminClient()
    if (!adminClient) return

    const submitterField = SUBMITTER_FIELD[table]
    if (!submitterField) return

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: row } = await (adminClient as any)
      .from(table)
      .select('*')
      .eq('id', id)
      .single()

    if (!row) return

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const submitterId = (row as any)[submitterField] as string
    if (!submitterId) return

    const { data: { user } } = await adminClient.auth.admin.getUserById(submitterId)
    const email = user?.email
    if (!email) return

    const contentLabel = CONTENT_LABEL[table] || 'submission'
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const contentTitle = ((row as any).title || (row as any).name || 'Your submission') as string
    const siteUrl = `https://${siteConfig.domain}`
    const viewUrl = `${siteUrl}${TABLE_PATH_MAP[table] || '/'}/${id}`

    const { Resend } = await import('resend')
    const resend = new Resend(process.env.RESEND_API_KEY)

    await resend.emails.send({
      from: `${siteConfig.name} <hello@${siteConfig.domain}>`,
      to: email,
      subject: `✅ Your ${contentLabel} is now live on ${siteConfig.name}!`,
      html: `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/></head>
<body style="margin:0;padding:0;background:#FBF0DC;font-family:sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#FBF0DC;padding:32px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
        <tr>
          <td style="background:linear-gradient(135deg,#3D1A08,#C4663A);padding:32px 40px;text-align:center;">
            <div style="display:inline-flex;align-items:center;justify-content:center;width:44px;height:44px;background:rgba(251,240,220,0.2);border-radius:50%;margin-bottom:10px;">
              <span style="color:#FBF0DC;font-weight:900;font-size:16px;">OD</span>
            </div>
            <h1 style="color:#FBF0DC;font-size:22px;font-weight:800;margin:0;">You&apos;re Live on ${siteConfig.name}! 🎉</h1>
          </td>
        </tr>
        <tr>
          <td style="padding:36px 40px;">
            <p style="color:#3D1A08;font-size:15px;line-height:1.7;margin:0 0 16px;">
              Great news! Your <strong>${contentLabel}</strong> has been reviewed and approved by our team.
            </p>
            <div style="background:#FBF0DC;border-radius:12px;padding:16px 20px;margin:0 0 24px;">
              <p style="color:#7A4A25;font-size:13px;margin:0 0 4px;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;">Content</p>
              <p style="color:#3D1A08;font-size:16px;font-weight:700;margin:0;">${contentTitle}</p>
            </div>
            <p style="color:#5A3D2B;font-size:14px;line-height:1.6;margin:0 0 24px;">
              It is now visible to the 30,000+ members of the ${siteConfig.town} community. Thank you for contributing to ${siteConfig.name}! 🙏
            </p>
          </td>
        </tr>
        <tr>
          <td style="padding:0 40px 32px;text-align:center;">
            <a href="${viewUrl}" style="display:inline-block;background:#C4663A;color:#FBF0DC;font-weight:700;font-size:14px;text-decoration:none;padding:12px 28px;border-radius:10px;">
              View on ${siteConfig.name} →
            </a>
          </td>
        </tr>
        <tr>
          <td style="background:#FBF0DC;padding:18px 40px;text-align:center;border-top:1px solid #E8C99A;">
            <p style="color:#7A4A25;font-size:12px;margin:0;">
              ${siteConfig.name} · ${siteConfig.town}, ${siteConfig.region}
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
    })
  } catch {
    // Email notification is non-critical — never throw
  }
}

export async function approveContent(formData: FormData) {
  const supabase = await createClient()
  const table = formData.get('table') as string
  const id = formData.get('id') as string

  await requireAdmin(supabase)

  const update: Record<string, unknown> = { approved: true }

  const adminClient = createAdminClient()
  const db = adminClient ?? supabase
  const { error } = await db.from(table).update(update).eq('id', id)
  if (error) throw new Error(error.message)

  // Send approval notification (awaited delivery)
  // Listings go through the unified sendNotification('listing.approved') which
  // handles in-app + email + whatsapp + telegram in one shot. Other content
  // types fall back to the generic email-only notifier.
  if (table === 'listings') {
    await (async () => {
      try {
        const db = adminClient ?? supabase
        const { data: listing } = await db
          .from('listings')
          .select('name, subdomain, owner_id')
          .eq('id', id)
          .single()
        if (listing?.owner_id && listing?.name) {
          await sendNotification(listing.owner_id as string, 'listing.approved', {
            listingId: id,
            listingName: listing.name as string,
            subdomain: (listing.subdomain as string | null) ?? null,
          })
        }
      } catch (err) {
        console.error('[approveContent:listing-notify]', err)
      }
    })()
  } else {
    notifyGenericApproval(table, id)
  }

  if (table === 'listings') {
    revalidatePublicListingContent(id)
  } else {
    const basePath = TABLE_PATH_MAP[table] || '/'
    revalidatePath(basePath)
    revalidatePath('/admin')
  }
}

export async function rejectContent(formData: FormData) {
  const supabase = await createClient()
  const table = formData.get('table') as string
  const id = formData.get('id') as string
  const reason = (formData.get('reason') as string | null)?.trim() || null

  await requireAdmin(supabase)

  // Capture listing details BEFORE deleting so we can notify the owner
  let listingRejectionContext: {
    ownerId: string
    listingName: string
  } | null = null

  if (table === 'listings') {
    const adminClient = createAdminClient()
    const db = adminClient ?? supabase
    const { data: listing } = await db
      .from('listings')
      .select('name, owner_id')
      .eq('id', id)
      .single()
    if (listing?.owner_id && listing?.name) {
      listingRejectionContext = {
        ownerId: listing.owner_id as string,
        listingName: listing.name as string,
      }
    }
  }

  const { error } = await supabase
    .from(table)
    .delete()
    .eq('id', id)

  if (error) throw new Error(error.message)

  if (listingRejectionContext) {
    await sendNotification(listingRejectionContext.ownerId, 'listing.rejected', {
      listingId: id,
      listingName: listingRejectionContext.listingName,
      reason,
    }).catch((err) => console.error('[rejectContent:listing-notify]', err))
  }

  if (table === 'listings') {
    revalidatePublicListingContent(id)
  } else {
    const basePath = TABLE_PATH_MAP[table] || '/'
    revalidatePath(basePath)
    revalidatePath('/admin')
  }
}

export async function createAlert(formData: FormData) {
  const supabase = await createClient()
  const user = await requireAdmin(supabase)

  const title = formData.get('title') as string
  const description = formData.get('description') as string
  const severity = formData.get('severity') as string
  const category = formData.get('category') as string

  const { error } = await supabase.from('emergency_alerts').insert({
    title,
    description,
    severity,
    category,
    active: true,
    created_by: user.id,
  })

  if (error) throw new Error(error.message)

  revalidateEmergencyCache()
}

export async function unpublishContent(formData: FormData) {
  const supabase = await createClient()
  await requireAdmin(supabase)

  const table = formData.get('table') as string
  const id = formData.get('id') as string

  const adminClient = createAdminClient()
  const db = adminClient ?? supabase
  const { error } = await db.from(table).update({ approved: false }).eq('id', id)
  if (error) throw new Error(error.message)

  if (table === 'listings') {
    revalidatePublicListingContent(id)
  } else {
    const basePath = TABLE_PATH_MAP[table] || '/'
    revalidatePath(basePath)
    revalidatePath('/admin')
    revalidatePath('/admin/events')
  }
}

export async function deleteListing(formData: FormData) {
  // Auth check with regular client (respects RLS for auth)
  const supabase = await createClient()
  await requireAdmin(supabase)

  const id = formData.get('id') as string

  // Use service-role admin client to bypass RLS for the actual delete
  const adminClient = createAdminClient()
  if (!adminClient) throw new Error('Admin client not available — check SUPABASE_SERVICE_ROLE_KEY env var')
  const { error } = await adminClient.from('listings').delete().eq('id', id)
  if (error) throw new Error(error.message)

  revalidatePublicListingContent(id)
}

export async function updateListing(formData: FormData) {
  const supabase = await createClient()
  await requireAdmin(supabase)

  const id = formData.get('id') as string
  const name = formData.get('name') as string
  const description = formData.get('description') as string
  const category = formData.get('category') as string
  const phone = formData.get('phone') as string
  const address = formData.get('address') as string
  const website = formData.get('website') as string
  const plan = formData.get('plan') as string
  const approved = formData.get('approved') === 'true'

  const { error } = await supabase.from('listings').update({
    name, description, category, phone, address, website, plan, approved,
  }).eq('id', id)

  if (error) throw new Error(error.message)

  revalidatePublicListingContent(id)
  redirect('/admin/listings')
}

export async function deleteEvent(formData: FormData) {
  const supabase = await createClient()
  await requireAdmin(supabase)

  const id = formData.get('id') as string
  const { error } = await supabase.from('events').delete().eq('id', id)
  if (error) throw new Error(error.message)

  revalidatePath('/events')
  revalidatePath('/admin/events')
}

export async function resolveAlert(id: string) {
  const supabase = await createClient()
  await requireAdmin(supabase)

  const { error } = await supabase
    .from('emergency_alerts')
    .update({ active: false })
    .eq('id', id)

  if (error) throw new Error(error.message)

  revalidateEmergencyCache()
}

export async function deleteReview(formData: FormData) {
  const supabase = await createClient()
  await requireAdminOrMod(supabase)

  const id = formData.get('id') as string
  const listingId = formData.get('listing_id') as string

  const adminClient = createAdminClient()
  const db = adminClient ?? supabase
  const { error } = await db.from('reviews').delete().eq('id', id)
  if (error) throw new Error(error.message)

  if (listingId) {
    // The listing's stored rating still counted the deleted review.
    await recomputeListingRating(db, listingId)
    revalidatePublicListingContent(listingId)
  }
  revalidatePath('/admin/reviews')
}
