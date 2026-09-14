import type { Metadata } from 'next'
import { BadgeCheck, LogIn, PencilLine, ShieldCheck } from 'lucide-react'

import { createAdminClient } from '@/lib/supabase/admin-client'
import { createClient } from '@/lib/supabase/server'
import { jobsLoginHref } from '../jobs-server'
import JobPostForm, { type OwnedBusiness } from './JobPostForm'

export const metadata: Metadata = {
  title: 'Post on OurDahanu Jobs',
  robots: { index: false, follow: false },
}

const STEPS = [
  { icon: PencilLine, label: 'You post it' },
  { icon: ShieldCheck, label: 'A moderator checks it' },
  { icon: BadgeCheck, label: 'It stays live for 30 days' },
]

export default async function PostJobPage({
  searchParams,
}: {
  searchParams: Promise<{ kind?: string; listing?: string }>
}) {
  const { kind, listing } = await searchParams
  const initialKind = kind === 'seeking' ? 'seeking' : 'hiring'

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    const query = new URLSearchParams()
    if (kind) query.set('kind', initialKind)
    if (listing) query.set('listing', listing)
    const qs = query.toString()
    const loginHref = await jobsLoginHref(`/post${qs ? `?${qs}` : ''}`)

    return (
      <div className="mx-auto max-w-lg">
        <div className="od-card flex flex-col items-center px-6 py-8 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-[14px] bg-[var(--color-surface-soft)] text-[var(--od-brand)]">
            <LogIn size={22} aria-hidden />
          </span>
          <h1 className="mt-3 font-display text-2xl">Log in to post</h1>
          <p className="mt-1 max-w-sm text-sm text-[var(--od-muted)]">
            We ask for a login so every post can be traced to a real neighbour.
          </p>
          <a href={loginHref} className="od-button-primary mt-4 px-5 py-2 text-sm">
            Log in with Google
          </a>
        </div>
      </div>
    )
  }

  // Approved listings this user owns, for "Posting as". The service role reads
  // the owner's own phone and WhatsApp numbers to prefill the form.
  let businesses: OwnedBusiness[] = []
  const db = createAdminClient()
  if (db) {
    const { data } = await db
      .from('listings')
      .select('id, name, phone, whatsapp, address')
      .eq('owner_id', user.id)
      .eq('approved', true)
      .order('name', { ascending: true })
    businesses = (data ?? []) as OwnedBusiness[]
  }
  const initialListingId = listing && businesses.some((business) => business.id === listing) ? listing : ''

  return (
    <div className="mx-auto max-w-lg">
      <h1 className="text-balance font-display text-3xl sm:text-4xl">
        {initialKind === 'hiring' ? 'Post a job' : 'Say you are looking for work'}
      </h1>
      <p className="mt-2 text-sm leading-relaxed text-[var(--od-muted)]">
        Free, and seen by people across Dahanu. You can switch between hiring and looking for work below.
      </p>

      <ol className="mt-5 grid grid-cols-3 gap-2">
        {STEPS.map(({ icon: Icon, label }, index) => (
          <li
            key={label}
            className="flex flex-col items-center gap-1.5 rounded-[14px] border border-[var(--od-border)] bg-[var(--color-surface-2)] px-2 py-3 text-center"
          >
            <Icon size={16} className="text-[var(--od-brand)]" aria-hidden />
            <span className="text-[11px] font-bold leading-tight text-[var(--od-ink-2)]">
              <span className="sr-only">Step {index + 1}: </span>
              {label}
            </span>
          </li>
        ))}
      </ol>
      <p className="mt-2 text-xs text-[var(--od-muted)]">
        Posts from an approved OurDahanu business skip the check and go live instantly.
      </p>

      <div className="mt-6">
        <JobPostForm mode="create" businesses={businesses} initial={{ kind: initialKind, listingId: initialListingId }} />
      </div>
    </div>
  )
}
