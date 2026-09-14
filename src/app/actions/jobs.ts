'use server'

import { after } from 'next/server'

import { getUserRole } from '@/app/actions/admin'
import { jobsLoginHref } from '@/app/jobs/jobs-server'
import { requireListingAccess } from '@/lib/appointment-access'
import { revalidateJobsCache } from '@/lib/cache-tags'
import type { ContactFields, JobPostInput } from '@/lib/jobs/validation'
import { sendNotificationToAdmins } from '@/lib/notifications'
import { createAdminClient } from '@/lib/supabase/admin-client'
import { createClient } from '@/lib/supabase/server'
import { createJobActions, type DbError, type JobActionDependencies, type StoredJobPost } from './jobs-core'

// NOTE: this is a 'use server' module — it may export ONLY async functions.
// Import result and input types from './jobs-core' and '@/lib/jobs/validation'.
// Re-exporting a type from here makes Next's server-action transform emit a
// runtime reference to it, and every action then 500s at module evaluation.

const UNAVAILABLE = { error: 'Jobs are temporarily unavailable. Please try again later.' }

function toDbError(error: { code?: string; message: string } | null): DbError {
  return error ? { code: error.code, message: error.message } : null
}

/** Builds the core with production dependencies, once per action invocation. */
async function buildJobActions() {
  const supabase = await createClient()
  const adminClient = createAdminClient()
  if (!adminClient) return null
  const db = adminClient

  const deps: JobActionDependencies = {
    now: () => new Date(),

    async getUser() {
      return (await supabase.auth.getUser()).data.user
    },

    async isStaff() {
      const { role } = await getUserRole(supabase)
      return role === 'admin' || role === 'moderator'
    },

    async checkListing(listingId) {
      const { data } = await db.from('listings').select('approved').eq('id', listingId).maybeSingle()
      if (!data) return null
      // Owner or staff — the same check that guards appointment settings. It
      // does not look at approval, which is why `approved` is read separately.
      const access = await requireListingAccess(listingId)
      return {
        accessible: 'userId' in access,
        approved: (data as { approved: boolean | null }).approved === true,
      }
    },

    async countPostsSince(userId, since) {
      const { count } = await db
        .from('job_posts')
        .select('id', { count: 'exact', head: true })
        .eq('posted_by', userId)
        .gte('created_at', since)
      return count ?? 0
    },

    async insertPost(row, contact) {
      const { data, error } = await db.from('job_posts').insert(row).select('id').single()
      if (error || !data) return { id: null, error: toDbError(error) ?? { message: 'Insert returned no row.' } }
      const id = (data as { id: string }).id

      const { error: contactError } = await db
        .from('job_post_contacts')
        .insert({ post_id: id, phone: contact.phone, whatsapp: contact.whatsapp })
      if (contactError) {
        // Never leave a post without its number: remove the row created just above.
        await db.from('job_posts').delete().eq('id', id)
        return { id: null, error: toDbError(contactError) }
      }
      return { id, error: null }
    },

    async getPost(postId) {
      const { data } = await db
        .from('job_posts')
        .select('id, kind, status, posted_by, listing_id, collected_source, title, expires_at, reviewed_at, review_flags')
        .eq('id', postId)
        .maybeSingle()
      return (data ?? null) as StoredJobPost | null
    },

    async updatePost(postId, fields, contact) {
      const { error } = await db.from('job_posts').update(fields).eq('id', postId)
      if (error) return { error: toDbError(error) }
      if (contact) {
        const { error: contactError } = await db
          .from('job_post_contacts')
          .upsert(
            { post_id: postId, phone: contact.phone, whatsapp: contact.whatsapp, updated_at: new Date().toISOString() },
            { onConflict: 'post_id' },
          )
        if (contactError) return { error: toDbError(contactError) }
      }
      return { error: null }
    },

    async getContact(postId) {
      const { data } = await db.from('job_post_contacts').select('phone, whatsapp').eq('post_id', postId).maybeSingle()
      return (data ?? null) as ContactFields | null
    },

    async hasRevealed(postId, userId) {
      const { data } = await db
        .from('job_contact_reveals')
        .select('post_id')
        .eq('post_id', postId)
        .eq('user_id', userId)
        .maybeSingle()
      return data !== null
    },

    async countRevealsSince(userId, since) {
      const { count } = await db
        .from('job_contact_reveals')
        .select('post_id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .gte('created_at', since)
      return count ?? 0
    },

    async recordReveal(postId, userId) {
      const { error } = await db.from('job_contact_reveals').insert({ post_id: postId, user_id: userId })
      return { error: toDbError(error) }
    },

    async insertReport(row) {
      const { error } = await db.from('job_post_reports').insert(row)
      return { error: toDbError(error) }
    },

    async countReportsSince(postId, since) {
      let query = db.from('job_post_reports').select('id', { count: 'exact', head: true }).eq('post_id', postId)
      if (since) query = query.gt('created_at', since)
      const { count } = await query
      return count ?? 0
    },

    loginUrl: (returnPath) => jobsLoginHref(returnPath),

    notifyAdmins(payload) {
      // Deliver after the response, awaiting every channel so the serverless
      // function stays alive until delivery completes (see actions/find.ts).
      after(() => sendNotificationToAdmins('admin.new_submission', payload, { awaitDelivery: true }))
    },

    revalidate: () => revalidateJobsCache(),
  }

  return createJobActions(deps)
}

export async function createJobPost(input: JobPostInput) {
  const actions = await buildJobActions()
  return actions ? actions.createPost(input) : UNAVAILABLE
}

export async function updateJobPost(postId: string, input: JobPostInput) {
  const actions = await buildJobActions()
  return actions ? actions.updatePost(postId, input) : UNAVAILABLE
}

export async function renewJobPost(postId: string) {
  const actions = await buildJobActions()
  return actions ? actions.renewPost(postId) : UNAVAILABLE
}

export async function closeJobPost(postId: string) {
  const actions = await buildJobActions()
  return actions ? actions.closePost(postId) : UNAVAILABLE
}

export async function revealJobContact(postId: string) {
  const actions = await buildJobActions()
  return actions ? actions.revealContact(postId) : UNAVAILABLE
}

export async function reportJobPost(postId: string, reason: string, note: string | null) {
  const actions = await buildJobActions()
  return actions ? actions.reportPost(postId, reason, note) : UNAVAILABLE
}
