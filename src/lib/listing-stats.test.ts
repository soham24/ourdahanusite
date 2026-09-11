import { test } from 'node:test'
import assert from 'node:assert/strict'

import {
  EMPTY_LISTING_STATS,
  monthWindows,
  summariseListingEvents,
  type ListingEventRow,
} from './listing-stats'

test('month windows for a mid-month day', () => {
  assert.deepEqual(monthWindows('2026-09-10'), {
    currentStart: '2026-09-01',
    previousStart: '2026-08-01',
    previousEnd: '2026-08-31',
  })
})

test('month windows on the first of the month', () => {
  assert.deepEqual(monthWindows('2026-09-01'), {
    currentStart: '2026-09-01',
    previousStart: '2026-08-01',
    previousEnd: '2026-08-31',
  })
})

test('month windows roll back across a year boundary', () => {
  assert.deepEqual(monthWindows('2026-01-15'), {
    currentStart: '2026-01-01',
    previousStart: '2025-12-01',
    previousEnd: '2025-12-31',
  })
})

test('month windows handle a 30-day previous month', () => {
  assert.deepEqual(monthWindows('2026-05-04'), {
    currentStart: '2026-05-01',
    previousStart: '2026-04-01',
    previousEnd: '2026-04-30',
  })
})

test('month windows handle February in a non-leap year', () => {
  assert.deepEqual(monthWindows('2026-03-20'), {
    currentStart: '2026-03-01',
    previousStart: '2026-02-01',
    previousEnd: '2026-02-28',
  })
})

test('month windows handle February in a leap year', () => {
  assert.deepEqual(monthWindows('2028-03-20'), {
    currentStart: '2028-03-01',
    previousStart: '2028-02-01',
    previousEnd: '2028-02-29',
  })
})

const W = monthWindows('2026-09-10')

function row(over: Partial<ListingEventRow> = {}): ListingEventRow {
  return { listing_id: 'L1', kind: 'view', day: '2026-09-05', ...over }
}

test('counts each kind separately for the current month', () => {
  const out = summariseListingEvents(
    [
      row({ kind: 'view' }),
      row({ kind: 'view', day: '2026-09-06' }),
      row({ kind: 'phone' }),
      row({ kind: 'whatsapp' }),
      row({ kind: 'whatsapp', day: '2026-09-07' }),
    ],
    W,
  )
  assert.deepEqual(out.L1, { views: 2, phone: 1, whatsapp: 2, previousViews: 0 })
})

test('counts last month views separately and never mixes them in', () => {
  const out = summariseListingEvents(
    [
      row({ kind: 'view', day: '2026-09-02' }),
      row({ kind: 'view', day: '2026-08-15' }),
      row({ kind: 'view', day: '2026-08-16' }),
      row({ kind: 'phone', day: '2026-08-16' }),
    ],
    W,
  )
  assert.deepEqual(out.L1, { views: 1, phone: 0, whatsapp: 0, previousViews: 2 })
})

test('includes the first and last day of each window', () => {
  const out = summariseListingEvents(
    [
      row({ kind: 'view', day: '2026-09-01' }),
      row({ kind: 'view', day: '2026-08-01' }),
      row({ kind: 'view', day: '2026-08-31' }),
    ],
    W,
  )
  assert.equal(out.L1.views, 1)
  assert.equal(out.L1.previousViews, 2)
})

test('ignores events older than last month', () => {
  const out = summariseListingEvents([row({ kind: 'view', day: '2026-07-31' })], W)
  assert.equal(out.L1, undefined)
})

test('keeps listings separate', () => {
  const out = summariseListingEvents(
    [row({ listing_id: 'L1' }), row({ listing_id: 'L2' }), row({ listing_id: 'L2' , day: '2026-09-08' })],
    W,
  )
  assert.equal(out.L1.views, 1)
  assert.equal(out.L2.views, 2)
})

test('returns no listings for no rows', () => {
  // Compare the keys, not the object itself. The accumulator is built with
  // Object.create(null) — a deliberate guard, since it is keyed by values
  // coming out of the database — and node:assert/strict compares prototypes,
  // so deepEqual against a `{}` literal fails on the prototype alone.
  assert.deepEqual(Object.keys(summariseListingEvents([], W)), [])
})

test('EMPTY_LISTING_STATS is all zeroes', () => {
  assert.deepEqual(EMPTY_LISTING_STATS, {
    views: 0,
    phone: 0,
    whatsapp: 0,
    previousViews: 0,
  })
})
