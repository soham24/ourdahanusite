import Link from 'next/link'
import { connection } from 'next/server'
import { ArrowLeft } from 'lucide-react'

import { requireAdminOrMod } from '@/app/actions/admin'
import JobPostForm from '@/app/jobs/post/JobPostForm'
import { getIndiaToday } from '@/lib/india-time'
import { formatIndianPhone } from '@/lib/jobs/phone'
import { createAdminClient } from '@/lib/supabase/admin-client'
import { createClient } from '@/lib/supabase/server'
import AdminJobActions from './AdminJobActions'
import { siteConfig } from '@/lib/site'

type Tab = 'pending' | 'live' | 'all'

interface AdminJobRow {
  id: string
  kind: 'hiring' | 'seeking'
  status: string
  title: string
  category: string
  area: string
  description: string | null
  employer_name: string | null
  display_name: string | null
  collected_source: string | null
  listing_id: string | null
  review_flags: string[]
  reviewed_at: string | null
  posted_by: string
  created_at: string
  expires_at: string | null
}

const FLAG_LABEL: Record<string, string> = {
  scam_words: 'Fee words',
  link_or_phone: 'Link or number in text',
  reports: 'Reported',
}

const ROW_COLUMNS =
  'id, kind, status, title, category, area, description, employer_name, display_name, collected_source, listing_id, review_flags, reviewed_at, posted_by, created_at, expires_at'

export default async function AdminJobsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const supabase = await createClient()
  await requireAdminOrMod(supabase)
  await connection()

  const db = createAdminClient()
  if (!db) return <p className="p-6 text-red-600">Service role key not configured.</p>

  const { tab: rawTab } = await searchParams
  const nowIso = new Date().toISOString()
  // The success measure is per calendar month in IST.
  const monthStart = `${getIndiaToday().slice(0, 7)}-01T00:00:00+05:30`

  const [pendingResult, liveResult, revealsResult] = await Promise.all([
    db.from('job_posts').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    db.from('job_posts').select('id', { count: 'exact', head: true }).eq('status', 'approved').gt('expires_at', nowIso),
    db.from('job_contact_reveals').select('post_id', { count: 'exact', head: true }).gte('created_at', monthStart),
  ])
  const pendingCount = pendingResult.count ?? 0
  const liveCount = liveResult.count ?? 0
  const revealsThisMonth = revealsResult.count ?? 0

  const tab: Tab =
    rawTab === 'pending' || rawTab === 'live' || rawTab === 'all' ? rawTab : pendingCount > 0 ? 'pending' : 'live'

  let query = db.from('job_posts').select(ROW_COLUMNS)
  if (tab === 'pending') query = query.eq('status', 'pending')
  if (tab === 'live') query = query.eq('status', 'approved').gt('expires_at', nowIso)
  const { data } = await query.order('created_at', { ascending: false }).limit(100)
  const rows = (data ?? []) as AdminJobRow[]

  const phoneById = new Map<string, string>()
  const reportsById = new Map<string, number>()
  const nameById = new Map<string, string>()

  if (rows.length > 0) {
    const ids = rows.map((row) => row.id)
    const [contacts, reports, profiles] = await Promise.all([
      db.from('job_post_contacts').select('post_id, phone').in('post_id', ids),
      db.from('job_post_reports').select('post_id, created_at').in('post_id', ids),
      db.from('profiles').select('id, full_name, email').in('id', Array.from(new Set(rows.map((row) => row.posted_by)))),
    ])

    for (const contact of (contacts.data ?? []) as { post_id: string; phone: string }[]) {
      phoneById.set(contact.post_id, contact.phone)
    }

    // Count reports since each post's last review — the same rule that hides posts.
    const reviewedAt = new Map(rows.map((row) => [row.id, row.reviewed_at]))
    for (const report of (reports.data ?? []) as { post_id: string; created_at: string }[]) {
      const since = reviewedAt.get(report.post_id)
      if (!since || Date.parse(report.created_at) > Date.parse(since)) {
        reportsById.set(report.post_id, (reportsById.get(report.post_id) ?? 0) + 1)
      }
    }

    for (const profile of (profiles.data ?? []) as { id: string; full_name: string | null; email: string | null }[]) {
      nameById.set(profile.id, profile.full_name || profile.email || 'Unknown user')
    }
  }

  const tabCls = (value: Tab) =>
    `rounded-md px-3 py-1.5 text-sm font-semibold ${tab === value ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-700'}`

  return (
    <div className="mx-auto max-w-4xl p-4">
      <Link href="/admin" className="mb-3 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800">
        <ArrowLeft size={14} /> Admin
      </Link>
      <h1 className="mb-4 text-2xl font-bold">Jobs</h1>

      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Waiting for review</p>
          <p className="mt-1 text-2xl font-bold tabular-nums">{pendingCount}</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Live posts</p>
          <p className="mt-1 text-2xl font-bold tabular-nums">{liveCount}</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Numbers viewed this month</p>
          <p className="mt-1 text-2xl font-bold tabular-nums">{revealsThisMonth}</p>
        </div>
      </div>

      <div className="mb-4 flex gap-2">
        <Link href="/admin/jobs?tab=pending" className={tabCls('pending')}>
          Waiting{pendingCount ? ` (${pendingCount})` : ''}
        </Link>
        <Link href="/admin/jobs?tab=live" className={tabCls('live')}>
          Live
        </Link>
        <Link href="/admin/jobs?tab=all" className={tabCls('all')}>
          All
        </Link>
      </div>

      {rows.length === 0 ? (
        <p className="rounded-lg border border-dashed border-gray-300 p-6 text-center text-sm text-gray-500">Nothing here.</p>
      ) : (
        <ul className="space-y-3">
          {rows.map((row) => {
            const reports = reportsById.get(row.id) ?? 0
            const phone = phoneById.get(row.id)
            return (
              <li key={row.id} className="rounded-lg border border-gray-200 bg-white p-4">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="rounded bg-gray-100 px-2 py-0.5 font-semibold">
                    {row.kind === 'hiring' ? 'Hiring' : 'Looking for work'}
                  </span>
                  <span className="rounded bg-gray-100 px-2 py-0.5">{row.status}</span>
                  {row.collected_source && (
                    <span className="rounded bg-amber-50 px-2 py-0.5 text-amber-800">Collected · {row.collected_source}</span>
                  )}
                  {row.listing_id && <span className="rounded bg-emerald-50 px-2 py-0.5 text-emerald-800">Business post</span>}
                  {row.review_flags.map((flag) => (
                    <span key={flag} className="rounded bg-red-50 px-2 py-0.5 font-semibold text-red-700">
                      {FLAG_LABEL[flag] ?? flag}
                    </span>
                  ))}
                  {reports > 0 && (
                    <span className="rounded bg-red-50 px-2 py-0.5 font-semibold text-red-700">
                      {reports} {reports === 1 ? 'report' : 'reports'}
                    </span>
                  )}
                </div>
                <h2 className="mt-2 font-semibold text-gray-900">
                  {row.title}{' '}
                  <span className="font-normal text-gray-500">
                    · {row.kind === 'hiring' ? row.employer_name : row.display_name} · {row.area}
                  </span>
                </h2>
                <p className="text-xs text-gray-500">
                  {row.category} · by {nameById.get(row.posted_by) ?? 'Unknown user'}
                  {phone ? ` · ${formatIndianPhone(phone)}` : ''}
                </p>
                {row.description && <p className="mt-2 whitespace-pre-line text-sm text-gray-700">{row.description}</p>}
                <div className="mt-2 flex flex-wrap gap-3 text-xs">
                  <Link href={`/jobs/my-posts/${row.id}/edit`} className="font-semibold text-blue-700 hover:underline">
                    Edit
                  </Link>
                  {row.status === 'approved' && (
                    <Link href={`/jobs/j/${row.id}`} className="font-semibold text-blue-700 hover:underline">
                      View on the board
                    </Link>
                  )}
                </div>
                <AdminJobActions postId={row.id} status={row.status} />
              </li>
            )
          })}
        </ul>
      )}

      <section className="mt-10 rounded-lg border border-gray-200 bg-white p-4">
        <h2 className="text-lg font-bold">Post a collected job</h2>
        <p className="mb-4 text-sm text-gray-500">
          For jobs gathered from WhatsApp groups, newspapers and shop notices. It goes live instantly, labelled
          &ldquo;Collected by {siteConfig.name}&rdquo; with the source you enter.
        </p>
        <JobPostForm mode="collected" businesses={[]} />
      </section>
    </div>
  )
}
