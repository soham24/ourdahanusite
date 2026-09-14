import { isValidJobCategory } from './categories'
import { isPayPeriod, isValidWorkType, type PayPeriod, type WorkType } from './options'
import { isIndianMobile, normalizeIndianPhone } from './phone'

export type JobKind = 'hiring' | 'seeking'

/** What the post form sends. Numbers arrive already parsed; blanks are null. */
export interface JobPostInput {
  kind: JobKind
  title: string
  category: string
  workTypes: string[]
  area: string
  description?: string | null
  employerName?: string | null
  openings?: number | null
  payMin?: number | null
  payMax?: number | null
  payPeriod?: string | null
  timings?: string | null
  displayName?: string | null
  experienceYears?: number | null
  phone: string
  whatsapp: boolean
  listingId?: string | null
  collectedSource?: string | null
}

/** Column values for job_posts, minus the lifecycle fields the server sets. */
export interface JobPostFields {
  kind: JobKind
  title: string
  category: string
  work_types: WorkType[]
  area: string
  description: string | null
  employer_name: string | null
  openings: number | null
  pay_min: number | null
  pay_max: number | null
  pay_period: PayPeriod | null
  timings: string | null
  display_name: string | null
  experience_years: number | null
  listing_id: string | null
  collected_source: string | null
}

export interface ContactFields {
  phone: string
  whatsapp: boolean
}

export type ValidationResult =
  | { ok: true; fields: JobPostFields; contact: ContactFields }
  | { ok: false; error: string }

export const JOB_TEXT_LIMITS = {
  title: 80,
  employerName: 100,
  area: 80,
  timings: 80,
  description: 1000,
  displayName: 40,
  collectedSource: 80,
} as const

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function clean(value: string | null | undefined): string | null {
  const trimmed = (value ?? '').trim()
  return trimmed === '' ? null : trimmed
}

function lengthError(value: string | null, max: number, label: string): string | null {
  return value !== null && value.length > max ? `Keep the ${label} under ${max} characters.` : null
}

type IntResult = { ok: true; value: number | null } | { ok: false }

function readInt(value: number | null | undefined): IntResult {
  if (value === null || value === undefined) return { ok: true, value: null }
  return Number.isInteger(value) ? { ok: true, value } : { ok: false }
}

function fail(error: string): ValidationResult {
  return { ok: false, error }
}

export function validateJobPostInput(input: JobPostInput): ValidationResult {
  const { kind } = input
  if (kind !== 'hiring' && kind !== 'seeking') {
    return fail('Choose whether you are hiring or looking for work.')
  }

  const title = clean(input.title)
  if (!title) {
    return fail(kind === 'hiring' ? 'Enter the job title, e.g. "Cook".' : 'Enter your skill, e.g. "Driver".')
  }
  const titleError = lengthError(title, JOB_TEXT_LIMITS.title, 'title')
  if (titleError) return fail(titleError)

  if (!isValidJobCategory(input.category)) return fail('Choose a category.')

  const workTypes: WorkType[] = []
  for (const raw of input.workTypes ?? []) {
    const value = raw.trim()
    if (!isValidWorkType(value)) return fail('Choose at least one work type.')
    if (!workTypes.includes(value)) workTypes.push(value)
  }
  if (workTypes.length === 0) return fail('Choose at least one work type.')

  const area = clean(input.area)
  if (!area) return fail('Enter the area, e.g. "Dahanu Road".')
  const areaError = lengthError(area, JOB_TEXT_LIMITS.area, 'area')
  if (areaError) return fail(areaError)

  const description = clean(input.description)
  const descriptionError = lengthError(description, JOB_TEXT_LIMITS.description, 'description')
  if (descriptionError) return fail(descriptionError)

  const phone = normalizeIndianPhone(input.phone ?? '')
  if (!phone) return fail('Enter a valid 10-digit phone number.')
  const whatsapp = input.whatsapp === true
  if (whatsapp && !isIndianMobile(phone)) {
    return fail('WhatsApp needs a mobile number. Untick WhatsApp for a landline.')
  }
  const contact: ContactFields = { phone, whatsapp }

  if (kind === 'seeking') {
    const displayName = clean(input.displayName)
    if (!displayName) return fail('Enter your first name.')
    const nameError = lengthError(displayName, JOB_TEXT_LIMITS.displayName, 'first name')
    if (nameError) return fail(nameError)

    const experience = readInt(input.experienceYears)
    if (!experience.ok || (experience.value !== null && (experience.value < 0 || experience.value > 60))) {
      return fail('Experience must be between 0 and 60 years.')
    }

    return {
      ok: true,
      contact,
      fields: {
        kind,
        title,
        category: input.category,
        work_types: workTypes,
        area,
        description,
        employer_name: null,
        openings: null,
        pay_min: null,
        pay_max: null,
        pay_period: null,
        timings: null,
        display_name: displayName,
        experience_years: experience.value,
        listing_id: null,
        collected_source: null,
      },
    }
  }

  const employerName = clean(input.employerName)
  if (!employerName) return fail('Enter the employer or shop name.')
  const employerError = lengthError(employerName, JOB_TEXT_LIMITS.employerName, 'employer name')
  if (employerError) return fail(employerError)

  const openings = readInt(input.openings)
  if (!openings.ok || (openings.value !== null && (openings.value < 1 || openings.value > 500))) {
    return fail('Openings must be a whole number between 1 and 500.')
  }

  const payMin = readInt(input.payMin)
  const payMax = readInt(input.payMax)
  if (!payMin.ok || !payMax.ok) {
    return fail('Pay must be a whole number of rupees.')
  }
  // Zero would read as "₹0 / month" on the public board. An unknown amount is
  // left empty instead, which shows "Pay to be discussed".
  if ((payMin.value !== null && payMin.value < 1) || (payMax.value !== null && payMax.value < 1)) {
    return fail('Pay must be at least ₹1. Leave it empty if pay is to be discussed.')
  }
  if (payMin.value !== null && payMax.value !== null && payMax.value < payMin.value) {
    return fail('Maximum pay cannot be less than minimum pay.')
  }

  let payPeriod: PayPeriod | null = null
  if (payMin.value !== null || payMax.value !== null) {
    const period = clean(input.payPeriod)
    if (!period || !isPayPeriod(period)) return fail('Choose whether pay is per month, day or hour.')
    payPeriod = period
  }

  const timings = clean(input.timings)
  const timingsError = lengthError(timings, JOB_TEXT_LIMITS.timings, 'timings')
  if (timingsError) return fail(timingsError)

  const collectedSource = clean(input.collectedSource)
  const sourceError = lengthError(collectedSource, JOB_TEXT_LIMITS.collectedSource, 'source')
  if (sourceError) return fail(sourceError)

  const listingId = clean(input.listingId)
  if (listingId && !UUID.test(listingId)) return fail('Choose a valid business.')

  return {
    ok: true,
    contact,
    fields: {
      kind,
      title,
      category: input.category,
      work_types: workTypes,
      area,
      description,
      employer_name: employerName,
      openings: openings.value,
      pay_min: payMin.value,
      pay_max: payMax.value,
      pay_period: payPeriod,
      timings,
      display_name: null,
      experience_years: null,
      listing_id: listingId,
      collected_source: collectedSource,
    },
  }
}
