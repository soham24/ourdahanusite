import { test } from 'node:test'
import assert from 'node:assert/strict'

import {
  JOB_CATEGORIES,
  jobCategoryFromSlug,
  jobCategoryMarathi,
  jobCategorySlug,
} from './categories'
import {
  formatIndianPhone,
  isIndianMobile,
  normalizeIndianPhone,
  telHrefIndia,
  waHrefIndia,
} from './phone'
import { validateJobPostInput, type JobPostInput } from './validation'

test('every category has a unique slug that round-trips', () => {
  const slugs = JOB_CATEGORIES.map(jobCategorySlug)
  assert.equal(new Set(slugs).size, JOB_CATEGORIES.length)
  for (const category of JOB_CATEGORIES) {
    assert.equal(jobCategoryFromSlug(jobCategorySlug(category)), category)
  }
  assert.equal(jobCategorySlug('Hotel, Restaurant & Catering'), 'hotel-restaurant-catering')
  assert.equal(jobCategoryFromSlug('not-a-category'), null)
})

test('every category has a Marathi label', () => {
  for (const category of JOB_CATEGORIES) assert.ok(jobCategoryMarathi(category), category)
  assert.equal(jobCategoryMarathi('Unknown'), null)
})

test('phone numbers normalise to 10 digits whatever the formatting', () => {
  for (const raw of ['+91 98765 43210', '098765 43210', '9876543210', '91-98765-43210', '(987) 654-3210']) {
    assert.equal(normalizeIndianPhone(raw), '9876543210', raw)
  }
})

test('landlines with an STD code are valid but are not mobiles', () => {
  assert.equal(normalizeIndianPhone('02528 222333'), '2528222333')
  assert.equal(isIndianMobile('2528222333'), false)
  assert.equal(isIndianMobile('9876543210'), true)
})

test('invalid phone numbers are rejected', () => {
  for (const raw of ['', '12345', '0000000000', '98765432101234', 'call me']) {
    assert.equal(normalizeIndianPhone(raw), null, raw)
  }
})

test('phone links and display', () => {
  assert.equal(telHrefIndia('9876543210'), 'tel:+919876543210')
  assert.equal(waHrefIndia('9876543210'), 'https://wa.me/919876543210')
  assert.equal(formatIndianPhone('9876543210'), '98765 43210')
  assert.equal(formatIndianPhone('2528222333'), '02528222333')
})

function hiring(overrides: Partial<JobPostInput> = {}): JobPostInput {
  return {
    kind: 'hiring',
    title: 'Cook',
    category: 'Hotel, Restaurant & Catering',
    workTypes: ['Full-time'],
    area: 'Dahanu Road',
    description: 'Morning shift, lunch included.',
    employerName: 'Sai Hotel',
    openings: 2,
    payMin: 12000,
    payMax: 15000,
    payPeriod: 'month',
    timings: '9am–6pm',
    phone: '+91 98765 43210',
    whatsapp: true,
    ...overrides,
  }
}

function seeking(overrides: Partial<JobPostInput> = {}): JobPostInput {
  return {
    kind: 'seeking',
    title: 'Driver',
    category: 'Driver & Delivery',
    workTypes: ['Full-time', 'Daily wage'],
    area: 'Bordi',
    description: 'Heavy licence, 5 years with a transport company.',
    displayName: 'Ramesh',
    experienceYears: 5,
    phone: '9876543210',
    whatsapp: true,
    ...overrides,
  }
}

test('a valid hiring post normalises into column values', () => {
  const result = validateJobPostInput(hiring({ title: '  Cook  ', workTypes: ['Full-time', 'Full-time'] }))
  assert.equal(result.ok, true)
  if (!result.ok) return
  assert.deepEqual(result.fields, {
    kind: 'hiring',
    title: 'Cook',
    category: 'Hotel, Restaurant & Catering',
    work_types: ['Full-time'],
    area: 'Dahanu Road',
    description: 'Morning shift, lunch included.',
    employer_name: 'Sai Hotel',
    openings: 2,
    pay_min: 12000,
    pay_max: 15000,
    pay_period: 'month',
    timings: '9am–6pm',
    display_name: null,
    experience_years: null,
    listing_id: null,
    collected_source: null,
  })
  assert.deepEqual(result.contact, { phone: '9876543210', whatsapp: true })
})

test('a valid seeking post drops every hiring-only field', () => {
  const result = validateJobPostInput(
    seeking({
      employerName: 'Should vanish',
      payMin: 500,
      payPeriod: 'day',
      listingId: '11111111-1111-4111-8111-111111111111',
      collectedSource: 'Lokmat',
    }),
  )
  assert.equal(result.ok, true)
  if (!result.ok) return
  assert.equal(result.fields.display_name, 'Ramesh')
  assert.equal(result.fields.experience_years, 5)
  assert.deepEqual(result.fields.work_types, ['Full-time', 'Daily wage'])
  for (const key of ['employer_name', 'openings', 'pay_min', 'pay_max', 'pay_period', 'timings', 'listing_id', 'collected_source'] as const) {
    assert.equal(result.fields[key], null, key)
  }
})

test('pay is optional', () => {
  const result = validateJobPostInput(hiring({ payMin: null, payMax: null, payPeriod: null }))
  assert.equal(result.ok, true)
  if (!result.ok) return
  assert.equal(result.fields.pay_min, null)
  assert.equal(result.fields.pay_max, null)
  assert.equal(result.fields.pay_period, null)
})

test('a landline is accepted when WhatsApp is off', () => {
  const result = validateJobPostInput(hiring({ phone: '02528 222333', whatsapp: false }))
  assert.equal(result.ok, true)
  if (!result.ok) return
  assert.deepEqual(result.contact, { phone: '2528222333', whatsapp: false })
})

const REJECTIONS: Array<[string, JobPostInput, RegExp]> = [
  ['a missing title', hiring({ title: '   ' }), /job title/],
  ['a long title', hiring({ title: 'x'.repeat(81) }), /title under 80/],
  ['an unknown category', hiring({ category: 'Astronaut' }), /category/],
  ['no work type', hiring({ workTypes: [] }), /work type/],
  ['an unknown work type', hiring({ workTypes: ['Gig'] }), /work type/],
  ['a missing area', hiring({ area: '' }), /area/],
  ['a long description', hiring({ description: 'x'.repeat(1001) }), /description under 1000/],
  ['a bad phone number', hiring({ phone: '12345' }), /10-digit/],
  ['WhatsApp on a landline', hiring({ phone: '02528 222333', whatsapp: true }), /mobile/],
  ['a missing employer', hiring({ employerName: '' }), /employer/],
  ['zero openings', hiring({ openings: 0 }), /Openings/],
  ['fractional pay', hiring({ payMin: 12000.5 }), /whole number of rupees/],
  ['zero pay', hiring({ payMin: 0, payMax: 0 }), /Leave it empty/],
  ['negative pay', hiring({ payMin: -500 }), /at least ₹1/],
  ['maximum pay below minimum', hiring({ payMin: 15000, payMax: 12000 }), /less than minimum/],
  ['pay without a period', hiring({ payPeriod: null }), /per month, day or hour/],
  ['a malformed business id', hiring({ listingId: 'not-a-uuid' }), /business/],
  ['a missing first name', seeking({ displayName: ' ' }), /first name/],
  ['impossible experience', seeking({ experienceYears: 61 }), /Experience/],
]

for (const [name, input, expected] of REJECTIONS) {
  test(`rejects ${name}`, () => {
    const result = validateJobPostInput(input)
    assert.equal(result.ok, false)
    if (result.ok) return
    assert.match(result.error, expected)
  })
}
