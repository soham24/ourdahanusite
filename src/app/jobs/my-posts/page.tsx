import type { Metadata } from 'next'
import Link from 'next/link'
import { connection } from 'next/server'
import { LogIn, Phone, Plus } from 'lucide-react'

import { canRenew, daysLeft, isLive } from '@/lib/jobs/lifecycle'
import type { JobStatus } from '@/lib/jobs/rules'
import { createAdminClient } from '@/lib/supabase/admin-client'
import { createClient } from '@/lib/supabase/server'
import { jobsLoginHref } from '../jobs-server'
import { kindLabel, shortDate } from '../jobs-ui'
import MyPostActions from './MyPostActions'

export const metadata: Metadata = {
  title: { absolute: 'My posts — OurDahanu Jobs' },
  robots: { index: false, follow: false },
}

interface MyPost {
  id: string
  kind: 'hiring' | 'seeking'
  status: JobStatus
  title: string
  category: string
  reject_reason: string | null
  expires_at: string | null
  created_at: string
}

type Tone = 'live' | 'waiting' | 'muted' | 'bad'

const TONE_CLASS: Record<Tone, string> = {
  live: 'text-[var(--color-success-strong)]',
  waiting: 'text-[var(--od-gold)]',
  muted: 'text-[var(--od-muted)]',
  bad: 'text-[var(--od-danger)]',
}

// A post hidden by reports reads "Waiting for review" like any other pending
// post: telling a scammer what tripped the hide teaches them to avoid it.
function statusLine(post: MyPost, now: Date): { label: string; tone: Tone } {
  if (post.status === 'approved') {
    if (post.expires_at && isLive(post, now)) {
      const left = daysLeft(post.expires_at, now)
      return { label: `Live · ${left} ${left === 1 ? 'day' : 'days'} left`, tone: 'live' }
    }
    return { label: 'Expired — renew to put it back on the board', tone: 'muted' }
  }
  if (post.status === 'pending') return { label: 'Waiting for review', tone: 'waiting' }
  if (post.status === 'rejected') {
    return { label: `Not approved${post.reject_reason ? `: ${post.reject_reason}` : ''}`, tone: 'bad' }
  }
  if (post.status === 'closed') {
    return { label: post.kind === 'hiring' ? 'Closed — filled' : 'Closed — found work', tone: 'muted' }
  }
  return { label: 'Removed by a moderator', tone: 'bad' }
}

export default async function MyPostsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    const loginHref = await jobsLoginHref('/my-posts')
    return (
      <div className="mx-auto max-w-lg">
        <div className="od-card flex flex-col items-center px-6 py-8 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-[14px] bg-[var(--color-surface-soft)] text-[var(--od-brand)]">
            <LogIn size={22} aria-hidden />
          </span>
          <h1 className="mt-3 font-display text-2xl">Log in to see your posts</h1>
          <a href={loginHref} className="od-button-primary mt-4 px-5 py-2 text-sm">
            Log in with Google
          </a>
        </div>
      </div>
    )
  }

  // Reads the current time below; mark the render as request-time explicitly.
  await connection()
  const now = new Date()

  const db = createAdminClient()
  if (!db) {
    return <p className="text-sm font-semibold text-[var(--od-danger)]">Jobs are temporarily unavailable.</p>
  }

  const { data } = await db
    .from('job_posts')
    .select('id, kind, status, title, category, reject_reason, expires_at, created_at')
    .eq('posted_by', user.id)
    .order('created_at', { ascending: false })
    .limit(100)
  const posts = (data ?? []) as MyPost[]

  const revealCounts = new Map<string, number>()
  if (posts.length > 0) {
    const { data: reveals } = await db
      .from('job_contact_reveals')
      .select('post_id')
      .in('post_id', posts.map((post) => post.id))
    for (const row of (reveals ?? []) as { post_id: string }[]) {
      revealCounts.set(row.post_id, (revealCounts.get(row.post_id) ?? 0) + 1)
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="flex items-center justify-between gap-3">
        <h1 className="font-display text-3xl sm:text-4xl">My posts</h1>
        <Link href="/jobs/post" className="od-button-primary px-3.5 py-2 text-sm">
          <Plus size={15} aria-hidden /> New post
        </Link>
      </div>

      {posts.length === 0 ? (
        <div className="od-card mt-6 flex flex-col items-center px-6 py-12 text-center">
          <h2 className="font-display text-2xl">You have not posted yet</h2>
          <p className="mt-1 max-w-sm text-sm text-[var(--od-muted)]">
            Post a job, or tell Dahanu you are looking for work. It is free.
          </p>
          <Link href="/jobs/post" className="od-button-primary mt-5 px-5 py-2 text-sm">
            Post now
          </Link>
        </div>
      ) : (
        <ul className="mt-6 space-y-3">
          {posts.map((post) => {
            const status = statusLine(post, now)
            const reveals = revealCounts.get(post.id) ?? 0
            const editable = post.status !== 'closed' && post.status !== 'removed'
            return (
              <li key={post.id} className="od-card p-4 sm:p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="od-eyebrow">
                      {kindLabel(post.kind)} · {post.category}
                    </p>
                    <h2 className="mt-1 truncate text-[1.05rem] font-bold">
                      {isLive(post, now) ? (
                        <Link href={`/jobs/j/${post.id}`} className="hover:text-[var(--od-brand-strong)]">
                          {post.title}
                        </Link>
                      ) : (
                        post.title
                      )}
                    </h2>
                    <p className={`mt-1 text-sm font-semibold ${TONE_CLASS[status.tone]}`}>{status.label}</p>
                  </div>
                  <span className="shrink-0 text-[11px] text-[var(--od-muted)]">{shortDate(post.created_at)}</span>
                </div>
                <p className="mt-2 flex items-center gap-1.5 text-xs text-[var(--od-muted)]">
                  <Phone size={12} aria-hidden /> {reveals} {reveals === 1 ? 'person' : 'people'} viewed your number
                </p>
                <MyPostActions
                  postId={post.id}
                  kind={post.kind}
                  canRenew={canRenew(post, now)}
                  canClose={editable}
                  canEdit={editable}
                />
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
