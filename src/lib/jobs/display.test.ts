import { test } from 'node:test'
import assert from 'node:assert/strict'

import { formatPay } from './pay'
import { buildJobPostingLd, type JobPostingSource } from './job-posting-ld'

test('pay reads naturally', () => {
  assert.equal(formatPay({ pay_min: 12000, pay_max: 15000, pay_period: 'month' }), '₹12,000–15,000 / month')
  assert.equal(formatPay({ pay_min: 500, pay_max: 500, pay_period: 'day' }), '₹500 / day')
  assert.equal(formatPay({ pay_min: 500, pay_max: null, pay_period: 'day' }), 'From ₹500 / day')
  assert.equal(formatPay({ pay_min: null, pay_max: 90, pay_period: 'hour' }), 'Up to ₹90 / hour')
  assert.equal(formatPay({ pay_min: null, pay_max: null, pay_period: null }), 'Pay to be discussed')
})

const SOURCE: JobPostingSource = {
  id: 'post-1',
  title: 'Cook',
  description: 'Morning shift.',
  category: 'Hotel, Restaurant & Catering',
  work_types: ['Full-time', 'Daily wage'],
  area: 'Dahanu Road',
  employer_name: 'Sai Hotel',
  pay_min: 12000,
  pay_max: 15000,
  pay_period: 'month',
  published_at: '2026-09-14T06:30:00.000Z',
  expires_at: '2026-10-14T06:30:00.000Z',
}

test('JobPosting carries the fields Google for Jobs needs', () => {
  const ld = buildJobPostingLd(SOURCE, 'https://jobs.ourdahanu.in/j/post-1')
  assert.equal(ld['@type'], 'JobPosting')
  assert.equal(ld.title, 'Cook')
  assert.equal(ld.datePosted, SOURCE.published_at)
  assert.equal(ld.validThrough, SOURCE.expires_at)
  assert.deepEqual(ld.employmentType, ['FULL_TIME', 'PER_DIEM'])
  assert.deepEqual(ld.hiringOrganization, { '@type': 'Organization', name: 'Sai Hotel' })
  assert.deepEqual(ld.jobLocation, {
    '@type': 'Place',
    address: { '@type': 'PostalAddress', addressLocality: 'Dahanu Road', addressRegion: 'Maharashtra', addressCountry: 'IN' },
  })
  assert.deepEqual(ld.baseSalary, {
    '@type': 'MonetaryAmount',
    currency: 'INR',
    value: { '@type': 'QuantitativeValue', minValue: 12000, maxValue: 15000, unitText: 'MONTH' },
  })
})

test('JobPosting never contains a phone number', () => {
  const json = JSON.stringify(buildJobPostingLd(SOURCE, 'https://jobs.ourdahanu.in/j/post-1'))
  assert.equal(/telephone/i.test(json), false)
  assert.equal(/\d{10}/.test(json), false)
})

test('JobPosting omits salary when pay is to be discussed, and describes itself when no description is given', () => {
  const ld = buildJobPostingLd({ ...SOURCE, description: null, pay_min: null, pay_max: null, pay_period: null }, 'https://jobs.ourdahanu.in/j/post-1')
  assert.equal('baseSalary' in ld, false)
  assert.equal(ld.description, 'Cook — Hotel, Restaurant & Catering job in Dahanu Road, Dahanu.')
})
