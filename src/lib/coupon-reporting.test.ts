import { test } from 'node:test'
import assert from 'node:assert/strict'

import {
  summariseByCoupon,
  summariseByPerson,
  type RedemptionRow,
} from './coupon-reporting'

function row(over: Partial<RedemptionRow> = {}): RedemptionRow {
  return {
    coupon_code: 'ajay100',
    coupon_id: 'c1',
    kind: 'new',
    payment_status: 'paid',
    amount_paid: 400,
    redeemed_at: '2026-04-06T00:00:00Z',
    ...over,
  }
}

test('summariseByCoupon splits new and renewal and sums revenue', () => {
  const out = summariseByCoupon([
    row(),
    row(),
    row({ kind: 'renewal', amount_paid: 650 }),
  ])
  assert.equal(out.length, 1)
  assert.deepEqual(out[0], {
    code: 'ajay100',
    newCount: 2,
    renewalCount: 1,
    total: 3,
    revenue: 1450,
  })
})

test('summariseByCoupon counts free redemptions but adds no revenue', () => {
  const out = summariseByCoupon([
    row({ payment_status: 'free_coupon', amount_paid: 0 }),
  ])
  assert.equal(out[0].total, 1)
  assert.equal(out[0].revenue, 0)
})

test('summariseByCoupon orders by total descending', () => {
  const out = summariseByCoupon([
    row({ coupon_code: 'tanvi100' }),
    row({ coupon_code: 'ajay100' }),
    row({ coupon_code: 'ajay100' }),
  ])
  assert.deepEqual(out.map(r => r.code), ['ajay100', 'tanvi100'])
})

test('summariseByPerson groups multiple codes under one person', () => {
  const out = summariseByPerson(
    [
      row({ coupon_code: 'mukul100', amount_paid: 400 }),
      row({ coupon_code: 'mukul150', amount_paid: 600 }),
    ],
    { mukul100: 'Mukul', mukul150: 'Mukul' },
  )
  assert.equal(out.length, 1)
  assert.equal(out[0].person, 'Mukul')
  assert.equal(out[0].total, 2)
  assert.equal(out[0].revenue, 1000)
  assert.deepEqual(out[0].codes.slice().sort(), ['mukul100', 'mukul150'])
})

test('summariseByPerson keeps unassigned codes under their own code name', () => {
  // Deleted coupons have coupon_id null and no assigned_to entry.
  // They must still appear rather than being silently dropped.
  const out = summariseByPerson(
    [row({ coupon_code: 'ourdahanu', coupon_id: null, amount_paid: 150 })],
    {},
  )
  assert.equal(out.length, 1)
  assert.equal(out[0].person, 'ourdahanu')
  assert.equal(out[0].revenue, 150)
})

test('summariseByPerson treats a null assigned_to as unassigned', () => {
  const out = summariseByPerson([row({ coupon_code: 'ankit100' })], {
    ankit100: null,
  })
  assert.equal(out[0].person, 'ankit100')
})

test('empty input produces empty output', () => {
  assert.deepEqual(summariseByCoupon([]), [])
  assert.deepEqual(summariseByPerson([], {}), [])
})
