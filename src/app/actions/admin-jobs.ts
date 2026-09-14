'use server'

import { after } from 'next/server'

import { requireAdminOrMod } from '@/app/actions/admin'
import { revalidateJobsCache } from '@/lib/cache-tags'
import { publishWindow } from '@/lib/jobs/lifecycle'
import { sendNotification } from '@/lib/notifications'
import { createAdminClient } from '@/lib/supabase/admin-client'
import { createClient } from '@/lib/supabase/server'

type Result = { ok: true } | { error: string }

interface ModeratedPost {
  id: string
  kind: 'hiring' | 'seeking'
  title: string
  posted_by: string
  status: string
}

async function staffContext() {
  const supabase = await createClient()
  const { user } = await requireAdminOrMod(supabase) // redirects anyone else
  const db = createAdminClient()
  if (!db) throw new Error('Service role not configured')
  return { db, userId: user.id }
}

async function loadPost(
  db: NonNullable<ReturnType<typeof createAdminClient>>,
  postId: string,
): Promise<ModeratedPost | null> {
  const { data } = await db.from('job_posts').select('id, kind, title, posted_by, status').eq('id', postId).maybeSingle()
  return (data ?? null) as ModeratedPost | null
}

export async function approveJobPost(postId: string): Promise<Result> {
  const { db, userId } = await staffContext()
  const post = await loadPost(db, postId)
  if (!post) return { error: 'Post not found.' }
  if (post.status === 'closed' || post.status === 'removed') {
    return { error: 'Closed or removed posts cannot be approved.' }
  }

  // Every approval restarts the 30 days and clears flags, including a
  // re-approval after an edit or a report hide.
  const now = new Date()
  const { error } = await db
    .from('job_posts')
    .update({
      status: 'approved',
      ...publishWindow(now),
      review_flags: [],
      reminder_sent_at: null,
      reject_reason: null,
      reviewed_by: userId,
      reviewed_at: now.toISOString(),
      updated_at: now.toISOString(),
    })
    .eq('id', postId)
  if (error) return { error: error.message }

  revalidateJobsCache()
  after(() =>
    sendNotification(post.posted_by, 'job.approved', { postId: post.id, title: post.title, kind: post.kind }, { awaitDelivery: true }),
  )
  return { ok: true }
}

export async function rejectJobPost(postId: string, reason: string): Promise<Result> {
  const cleanReason = reason.trim().slice(0, 300)
  if (!cleanReason) return { error: 'Give the poster a reason.' }

  const { db, userId } = await staffContext()
  const post = await loadPost(db, postId)
  if (!post) return { error: 'Post not found.' }
  if (post.status !== 'pending' && post.status !== 'approved') {
    return { error: 'Only pending or live posts can be rejected.' }
  }

  const now = new Date()
  const { error } = await db
    .from('job_posts')
    .update({
      status: 'rejected',
      reject_reason: cleanReason,
      reviewed_by: userId,
      reviewed_at: now.toISOString(),
      updated_at: now.toISOString(),
    })
    .eq('id', postId)
  if (error) return { error: error.message }

  revalidateJobsCache()
  after(() =>
    sendNotification(
      post.posted_by,
      'job.rejected',
      { postId: post.id, title: post.title, kind: post.kind, reason: cleanReason },
      { awaitDelivery: true },
    ),
  )
  return { ok: true }
}

export async function removeJobPost(postId: string): Promise<Result> {
  const { db, userId } = await staffContext()
  const post = await loadPost(db, postId)
  if (!post) return { error: 'Post not found.' }

  const now = new Date()
  const { error } = await db
    .from('job_posts')
    .update({ status: 'removed', reviewed_by: userId, reviewed_at: now.toISOString(), updated_at: now.toISOString() })
    .eq('id', postId)
  if (error) return { error: error.message }

  revalidateJobsCache()
  return { ok: true }
}
