import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'

import { getUserRole } from '@/app/actions/admin'
import { createAdminClient } from '@/lib/supabase/admin-client'
import { createClient } from '@/lib/supabase/server'
import { jobsLoginHref } from '../../../jobs-server'
import JobPostForm, { type JobPostFormValues, type OwnedBusiness } from '../../../post/JobPostForm'

export const metadata: Metadata = {
  title: { absolute: 'Edit post — OurDahanu Jobs' },
  robots: { index: false, follow: false },
}

interface EditablePost {
  id: string
  kind: 'hiring' | 'seeking'
  status: string
  posted_by: string
  listing_id: string | null
  collected_source: string | null
  title: string
  category: string
  work_types: string[]
  area: string
  description: string | null
  employer_name: string | null
  openings: number | null
  pay_min: number | null
  pay_max: number | null
  pay_period: string | null
  timings: string | null
  display_name: string | null
  experience_years: number | null
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function asText(value: number | null): string {
  return value === null ? '' : String(value)
}

export default async function EditJobPostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!UUID.test(id)) notFound()

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect(await jobsLoginHref(`/my-posts/${id}/edit`))

  const db = createAdminClient()
  if (!db) notFound()

  const { role } = await getUserRole(supabase)
  const staff = role === 'admin' || role === 'moderator'

  const { data } = await db
    .from('job_posts')
    .select(
      'id, kind, status, posted_by, listing_id, collected_source, title, category, work_types, area, description, employer_name, openings, pay_min, pay_max, pay_period, timings, display_name, experience_years',
    )
    .eq('id', id)
    .maybeSingle()
  const post = (data ?? null) as EditablePost | null
  // Staff can edit any post; everyone else only their own. A stranger gets the
  // same 404 as a missing post, so post ids cannot be probed.
  if (!post || (post.posted_by !== user.id && !staff)) notFound()

  const backLink = (
    <Link
      href={staff && post.posted_by !== user.id ? '/admin/jobs' : '/jobs/my-posts'}
      className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-[var(--od-ink-2)] hover:text-[var(--od-brand-strong)]"
    >
      <ArrowLeft size={13} aria-hidden /> Back
    </Link>
  )

  if (post.status === 'closed' || post.status === 'removed') {
    return (
      <div className="mx-auto max-w-lg">
        {backLink}
        <div className="od-card mt-3 p-6 text-center">
          <h1 className="font-display text-2xl">This post is closed</h1>
          <p className="mt-1 text-sm text-[var(--od-muted)]">Closed posts cannot be edited. Post again instead.</p>
        </div>
      </div>
    )
  }

  const { data: contactRow } = await db.from('job_post_contacts').select('phone, whatsapp').eq('post_id', id).maybeSingle()
  const contact = (contactRow ?? null) as { phone: string; whatsapp: boolean } | null

  // "Posting as" lists the poster's own approved businesses, even when staff edit.
  let businesses: OwnedBusiness[] = []
  if (post.kind === 'hiring') {
    const { data: listings } = await db
      .from('listings')
      .select('id, name, phone, whatsapp, address')
      .eq('owner_id', post.posted_by)
      .eq('approved', true)
      .order('name', { ascending: true })
    businesses = (listings ?? []) as OwnedBusiness[]
  }

  const initial: Partial<JobPostFormValues> = {
    kind: post.kind,
    listingId: post.listing_id ?? '',
    title: post.title,
    category: post.category,
    workTypes: post.work_types,
    area: post.area,
    description: post.description ?? '',
    employerName: post.employer_name ?? '',
    openings: asText(post.openings),
    payMin: asText(post.pay_min),
    payMax: asText(post.pay_max),
    payPeriod: post.pay_period ?? 'month',
    timings: post.timings ?? '',
    displayName: post.display_name ?? '',
    experienceYears: asText(post.experience_years),
    phone: contact?.phone ?? '',
    whatsapp: contact?.whatsapp ?? false,
    collectedSource: post.collected_source ?? '',
  }

  return (
    <div className="mx-auto max-w-lg">
      {backLink}
      <h1 className="mt-3 font-display text-3xl">Edit post</h1>
      <p className="mt-2 text-sm leading-relaxed text-[var(--od-muted)]">
        {post.listing_id || post.collected_source
          ? 'Changes to a business post stay live unless they need a check.'
          : 'Changes to a live post are checked by a moderator before it goes live again.'}
      </p>
      <div className="mt-6">
        <JobPostForm
          mode="edit"
          postId={post.id}
          initial={initial}
          businesses={businesses}
          lockKind
          showCollectedSource={staff && post.collected_source !== null}
        />
      </div>
    </div>
  )
}
