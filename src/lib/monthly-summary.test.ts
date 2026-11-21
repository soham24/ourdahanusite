import { test } from 'node:test'
import assert from 'node:assert/strict'

import { monthTotals, summaryMonth } from './monthly-summary'
import type { ListingEventRow } from './listing-stats'

test('on the 1st it reports the month that just ended, against the one before', () => {
  assert.deepEqual(summaryMonth('2026-11-01'), {
    key: '2026-10',
    label: 'October 2026',
    start: '2026-10-01',
    end: '2026-10-31',
    priorStart: '2026-09-01',
    priorEnd: '2026-09-30',
  })
})

test('January reports December of the year before', () => {
  const month = summaryMonth('2027-01-01')
  assert.equal(month.key, '2026-12')
  assert.equal(month.label, 'December 2026')
  assert.equal(month.priorStart, '2026-11-01')
})

test('March compares with a 28 or 29 day February', () => {
  assert.equal(summaryMonth('2027-03-01').end, '2027-02-28')
  assert.equal(summaryMonth('2028-03-01').end, '2028-02-29')
})

test('a late run still reports the same month, so the claim stops a repeat', () => {
  assert.equal(summaryMonth('2026-11-01').key, summaryMonth('2026-11-17').key)
})

test('counts the reported month, takes only views from the month before, ignores the rest', () => {
  const month = summaryMonth('2026-11-01')
  const rows: ListingEventRow[] = [
    { listing_id: 'a', kind: 'view', day: '2026-10-01' },
    { listing_id: 'a', kind: 'view', day: '2026-10-31' },
    { listing_id: 'a', kind: 'phone', day: '2026-10-15' },
    { listing_id: 'a', kind: 'whatsapp', day: '2026-10-15' },
    { listing_id: 'a', kind: 'view', day: '2026-09-30' },
    { listing_id: 'a', kind: 'phone', day: '2026-09-30' },
    { listing_id: 'a', kind: 'view', day: '2026-11-01' },
    { listing_id: 'b', kind: 'view', day: '2026-08-31' },
  ]
  assert.deepEqual({ ...monthTotals(rows, month) }, {
    a: { views: 2, phone: 1, whatsapp: 1, priorViews: 1 },
  })
})
