'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { CheckCircle2, MessageCircle } from 'lucide-react'

import { createJobPost, updateJobPost } from '@/app/actions/jobs'
import { safelySubmit } from '@/lib/find/safe-submission'
import { JOB_CATEGORIES, jobCategoryMarathi } from '@/lib/jobs/categories'
import { AREA_SUGGESTIONS, PAY_PERIODS, WORK_TYPES } from '@/lib/jobs/options'
import { JOB_TEXT_LIMITS, type JobKind, type JobPostInput } from '@/lib/jobs/validation'
import { chipBase, chipOff, chipOn } from '../jobs-ui'

/** An approved listing the user owns, offered under "Posting as". */
export interface OwnedBusiness {
  id: string
  name: string
  phone: string | null
  whatsapp: string | null
  address: string | null
}

/** Form state. Numbers stay as text until submit. */
export interface JobPostFormValues {
  kind: JobKind
  listingId: string
  title: string
  category: string
  workTypes: string[]
  area: string
  description: string
  employerName: string
  openings: string
  payMin: string
  payMax: string
  payPeriod: string
  timings: string
  displayName: string
  experienceYears: string
  phone: string
  whatsapp: boolean
  collectedSource: string
}

const EMPTY_FORM: JobPostFormValues = {
  kind: 'hiring',
  listingId: '',
  title: '',
  category: '',
  workTypes: [],
  area: '',
  description: '',
  employerName: '',
  openings: '1',
  payMin: '',
  payMax: '',
  payPeriod: 'month',
  timings: '',
  displayName: '',
  experienceYears: '',
  phone: '',
  whatsapp: true,
  collectedSource: '',
}

const labelCls = 'mb-1 block text-[13px] font-bold text-[var(--od-ink-2)]'
const inputCls = 'od-input h-11 w-full px-3.5 text-[15px] disabled:opacity-60'
const hintCls = 'mt-1 block text-xs text-[var(--od-muted)]'

function Required() {
  return <span className="text-[var(--od-brand)]">*</span>
}

function toNumber(text: string): number | null {
  const trimmed = text.trim()
  return trimmed === '' ? null : Number(trimmed)
}

/** Choosing a business fills in its name and number; choosing none clears the link. */
function prefillFromBusiness(values: JobPostFormValues, business: OwnedBusiness | undefined): JobPostFormValues {
  if (!business) return { ...values, listingId: '' }
  return {
    ...values,
    listingId: business.id,
    employerName: business.name,
    phone: business.whatsapp || business.phone || '',
    whatsapp: Boolean(business.whatsapp),
    area: values.area || (business.address ?? '').slice(0, JOB_TEXT_LIMITS.area),
  }
}

function toInput(values: JobPostFormValues): JobPostInput {
  const hiring = values.kind === 'hiring'
  return {
    kind: values.kind,
    title: values.title,
    category: values.category,
    workTypes: values.workTypes,
    area: values.area,
    description: values.description,
    employerName: hiring ? values.employerName : null,
    openings: hiring ? toNumber(values.openings) : null,
    payMin: hiring ? toNumber(values.payMin) : null,
    payMax: hiring ? toNumber(values.payMax) : null,
    payPeriod: hiring ? values.payPeriod : null,
    timings: hiring ? values.timings : null,
    displayName: hiring ? null : values.displayName,
    experienceYears: hiring ? null : toNumber(values.experienceYears),
    phone: values.phone,
    whatsapp: values.whatsapp,
    listingId: hiring ? values.listingId || null : null,
    collectedSource: values.collectedSource || null,
  }
}

export default function JobPostForm({
  mode,
  postId,
  initial,
  businesses,
  lockKind = false,
  showCollectedSource = false,
}: {
  mode: 'create' | 'edit' | 'collected'
  postId?: string
  initial?: Partial<JobPostFormValues>
  businesses: OwnedBusiness[]
  lockKind?: boolean
  showCollectedSource?: boolean
}) {
  const router = useRouter()
  // Lazy initial state, not an effect: a business chosen up front (the My
  // Business link) prefills exactly once, at mount.
  const [values, setValues] = useState<JobPostFormValues>(() => {
    const start: JobPostFormValues = { ...EMPTY_FORM, ...initial, ...(mode === 'collected' ? { kind: 'hiring' as const } : {}) }
    return mode === 'create' && start.listingId
      ? prefillFromBusiness(start, businesses.find((business) => business.id === start.listingId))
      : start
  })
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [created, setCreated] = useState<{ id: string; status: 'approved' | 'pending' } | null>(null)

  function update<K extends keyof JobPostFormValues>(key: K, value: JobPostFormValues[K]) {
    setValues((current) => ({ ...current, [key]: value }))
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPending(true)
    setError(null)
    const input = toInput(values)

    if (mode === 'edit' && postId) {
      const result = await safelySubmit(() => updateJobPost(postId, input))
      setPending(false)
      if ('error' in result) {
        setError(result.error)
        return
      }
      router.push('/jobs/my-posts')
      router.refresh()
      return
    }

    const result = await safelySubmit(() => createJobPost(input))
    setPending(false)
    if ('error' in result) {
      setError(result.error)
      return
    }
    setCreated({ id: result.id, status: result.status })
  }

  if (created) {
    const live = created.status === 'approved'
    return (
      <div className="od-card flex flex-col items-center px-6 py-10 text-center">
        <CheckCircle2 size={32} className="text-[var(--od-success)]" aria-hidden />
        <h2 className="mt-3 font-display text-2xl">{live ? 'Your post is live' : 'Sent for review'}</h2>
        <p className="mt-1 max-w-sm text-sm leading-relaxed text-[var(--od-muted)]">
          {live
            ? 'It is on the board now and stays up for 30 days. We will remind you before it expires.'
            : 'A moderator will check it, usually within a day. We will let you know when it is live.'}
        </p>
        <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
          {live && (
            <Link href={`/jobs/j/${created.id}`} className="od-button-primary px-5 py-2 text-sm">
              View post
            </Link>
          )}
          {mode === 'collected' ? (
            <button
              type="button"
              onClick={() => {
                setValues({ ...EMPTY_FORM })
                setCreated(null)
              }}
              className="od-button-secondary px-5 py-2 text-sm"
            >
              Post another
            </button>
          ) : (
            <Link href="/jobs/my-posts" className="od-button-secondary px-5 py-2 text-sm">
              My posts
            </Link>
          )}
        </div>
      </div>
    )
  }

  const hiring = values.kind === 'hiring'
  const kindLocked = lockKind || mode === 'collected'

  return (
    <form onSubmit={onSubmit} className="od-card space-y-4 p-5">
      <p role="alert" aria-live="assertive">
        {error && (
          <span className="block rounded-[12px] border border-[rgba(180,35,24,0.25)] bg-[rgba(180,35,24,0.06)] px-3 py-2 text-sm font-semibold text-[var(--od-danger)]">
            {error}
          </span>
        )}
      </p>

      {!kindLocked && (
        <fieldset>
          <legend className={labelCls}>I am…</legend>
          <div className="grid grid-cols-2 gap-2">
            {(['hiring', 'seeking'] as const).map((kind) => (
              <button
                key={kind}
                type="button"
                aria-pressed={values.kind === kind}
                disabled={pending}
                onClick={() => update('kind', kind)}
                className={`${chipBase} disabled:opacity-60 ${values.kind === kind ? chipOn : chipOff}`}
              >
                {kind === 'hiring' ? 'Hiring' : 'Looking for work'}
              </button>
            ))}
          </div>
        </fieldset>
      )}

      {hiring && mode !== 'collected' && businesses.length > 0 && (
        <label className="block">
          <span className={labelCls}>Posting as</span>
          <select
            value={values.listingId}
            disabled={pending}
            onChange={(event) =>
              setValues((current) =>
                prefillFromBusiness(current, businesses.find((business) => business.id === event.target.value)),
              )
            }
            className={inputCls}
          >
            <option value="">Myself / another employer</option>
            {businesses.map((business) => (
              <option key={business.id} value={business.id}>
                {business.name}
              </option>
            ))}
          </select>
          <span className={hintCls}>Posts from your approved business go live instantly.</span>
        </label>
      )}

      {(showCollectedSource || mode === 'collected') && (
        <label className="block">
          <span className={labelCls}>
            Where was this job found? {mode === 'collected' && <Required />}
          </span>
          <input
            value={values.collectedSource}
            required={mode === 'collected'}
            disabled={pending}
            maxLength={JOB_TEXT_LIMITS.collectedSource}
            placeholder="e.g. Lokmat, 12 Sep"
            onChange={(event) => update('collectedSource', event.target.value)}
            className={inputCls}
          />
        </label>
      )}

      <label className="block">
        <span className={labelCls}>
          {hiring ? 'Job title' : 'Your skill, or the work you want'} <Required />
        </span>
        <input
          value={values.title}
          required
          disabled={pending}
          maxLength={JOB_TEXT_LIMITS.title}
          placeholder={hiring ? 'e.g. Cook, Sales staff' : 'e.g. Driver, Tuition teacher'}
          onChange={(event) => update('title', event.target.value)}
          className={inputCls}
        />
      </label>

      {hiring ? (
        <label className="block">
          <span className={labelCls}>
            Employer or shop name <Required />
          </span>
          <input
            value={values.employerName}
            required
            disabled={pending}
            maxLength={JOB_TEXT_LIMITS.employerName}
            onChange={(event) => update('employerName', event.target.value)}
            className={inputCls}
          />
        </label>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className={labelCls}>
              First name <Required />
            </span>
            <input
              value={values.displayName}
              required
              disabled={pending}
              autoComplete="given-name"
              maxLength={JOB_TEXT_LIMITS.displayName}
              onChange={(event) => update('displayName', event.target.value)}
              className={inputCls}
            />
            <span className={hintCls}>Only your first name is shown.</span>
          </label>
          <label className="block">
            <span className={labelCls}>Years of experience</span>
            <input
              type="number"
              inputMode="numeric"
              min={0}
              max={60}
              value={values.experienceYears}
              disabled={pending}
              onChange={(event) => update('experienceYears', event.target.value)}
              className={inputCls}
            />
          </label>
        </div>
      )}

      <label className="block">
        <span className={labelCls}>
          Category <Required />
        </span>
        <select
          value={values.category}
          required
          disabled={pending}
          onChange={(event) => update('category', event.target.value)}
          className={inputCls}
        >
          <option value="">Choose a category</option>
          {JOB_CATEGORIES.map((category) => (
            <option key={category} value={category}>
              {category} · {jobCategoryMarathi(category)}
            </option>
          ))}
        </select>
      </label>

      <fieldset>
        <legend className={labelCls}>
          Work type <Required /> <span className="font-normal text-[var(--od-muted)]">(pick one or more)</span>
        </legend>
        <div className="flex flex-wrap gap-2">
          {WORK_TYPES.map((workType) => {
            const on = values.workTypes.includes(workType)
            return (
              <button
                key={workType}
                type="button"
                aria-pressed={on}
                disabled={pending}
                onClick={() =>
                  update('workTypes', on ? values.workTypes.filter((value) => value !== workType) : [...values.workTypes, workType])
                }
                className={`${chipBase} disabled:opacity-60 ${on ? chipOn : chipOff}`}
              >
                {workType}
              </button>
            )
          })}
        </div>
      </fieldset>

      <label className="block">
        <span className={labelCls}>
          {hiring ? 'Where is the job?' : 'Areas you can work in'} <Required />
        </span>
        <input
          value={values.area}
          required
          disabled={pending}
          list="job-post-areas"
          maxLength={JOB_TEXT_LIMITS.area}
          placeholder={hiring ? 'e.g. Dahanu Road' : 'e.g. Dahanu, Bordi'}
          onChange={(event) => update('area', event.target.value)}
          className={inputCls}
        />
        <datalist id="job-post-areas">
          {AREA_SUGGESTIONS.map((area) => (
            <option key={area} value={area} />
          ))}
        </datalist>
      </label>

      {hiring && (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <label className="block">
              <span className={labelCls}>Pay from (₹)</span>
              <input
                type="number"
                inputMode="numeric"
                min={0}
                value={values.payMin}
                disabled={pending}
                onChange={(event) => update('payMin', event.target.value)}
                className={inputCls}
              />
            </label>
            <label className="block">
              <span className={labelCls}>Pay up to (₹)</span>
              <input
                type="number"
                inputMode="numeric"
                min={0}
                value={values.payMax}
                disabled={pending}
                onChange={(event) => update('payMax', event.target.value)}
                className={inputCls}
              />
            </label>
            <label className="block">
              <span className={labelCls}>Per</span>
              <select
                value={values.payPeriod}
                disabled={pending}
                onChange={(event) => update('payPeriod', event.target.value)}
                className={inputCls}
              >
                {PAY_PERIODS.map((period) => (
                  <option key={period} value={period}>
                    {period}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <p className={hintCls}>Leave pay empty if it is to be discussed.</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className={labelCls}>Openings</span>
              <input
                type="number"
                inputMode="numeric"
                min={1}
                max={500}
                value={values.openings}
                disabled={pending}
                onChange={(event) => update('openings', event.target.value)}
                className={inputCls}
              />
            </label>
            <label className="block">
              <span className={labelCls}>Timings</span>
              <input
                value={values.timings}
                disabled={pending}
                maxLength={JOB_TEXT_LIMITS.timings}
                placeholder="e.g. 9am–6pm, Sunday off"
                onChange={(event) => update('timings', event.target.value)}
                className={inputCls}
              />
            </label>
          </div>
        </>
      )}

      <label className="block">
        <span className={labelCls}>{hiring ? 'About the job' : 'About you'}</span>
        <textarea
          rows={4}
          value={values.description}
          disabled={pending}
          maxLength={JOB_TEXT_LIMITS.description}
          placeholder={
            hiring
              ? 'What the work involves, and who you are looking for.'
              : 'Your experience, licences, languages, and when you can start.'
          }
          onChange={(event) => update('description', event.target.value)}
          className="od-input w-full px-3.5 py-2.5 text-[15px] disabled:opacity-60"
        />
      </label>

      <label className="block">
        <span className={labelCls}>
          Phone number <Required />
        </span>
        <input
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          required
          value={values.phone}
          disabled={pending}
          placeholder="e.g. 98765 43210"
          onChange={(event) => update('phone', event.target.value)}
          className={inputCls}
        />
        <span className={hintCls}>Shown only to people who log in, never publicly.</span>
      </label>

      <label className="flex items-center gap-2.5 rounded-[12px] border border-[var(--od-border)] bg-[var(--color-surface-2)] px-3.5 py-3 text-sm text-[var(--od-ink-2)]">
        <input
          type="checkbox"
          checked={values.whatsapp}
          disabled={pending}
          onChange={(event) => update('whatsapp', event.target.checked)}
          className="h-4 w-4 accent-[var(--od-brand)]"
        />
        <MessageCircle size={15} className="text-[var(--od-success)]" aria-hidden />
        This number is on WhatsApp
      </label>

      <p className="rounded-[12px] bg-[var(--color-surface-soft)] px-3.5 py-3 text-[13px] leading-relaxed text-[var(--od-ink-2)]">
        Jobs must never ask applicants to pay. Posts that ask for money are removed.
      </p>

      <button
        disabled={pending}
        className="od-button-primary h-11 w-full text-[15px] active:scale-[0.99] disabled:opacity-60"
      >
        {pending ? 'Saving…' : mode === 'edit' ? 'Save changes' : mode === 'collected' ? 'Publish collected job' : 'Post'}
      </button>
    </form>
  )
}
