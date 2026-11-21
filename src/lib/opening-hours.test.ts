import { test } from 'node:test'
import assert from 'node:assert/strict'

import { describeStatus, formatTime, indiaMoment, normalizeOpeningHours, openStatus, type OpeningHours } from './opening-hours'

const closed = { mon: [], tue: [], wed: [], thu: [], fri: [], sat: [], sun: [] }
const shop: OpeningHours = {
  ...closed,
  mon: [{ start: '09:00', end: '13:00' }, { start: '16:00', end: '20:00' }],
  tue: [{ start: '09:00', end: '20:00' }],
  sat: [{ start: '18:00', end: '02:00' }],
}

test('no hours, or every day closed, is "not set"', () => {
  assert.equal(normalizeOpeningHours(null), null)
  assert.equal(normalizeOpeningHours({ mon: [] }), null)
  assert.equal(normalizeOpeningHours('Mon-Sat 9 to 5'), null)
  assert.ok(normalizeOpeningHours({ mon: [{ start: '09:00', end: '17:00' }] }))
})

test('India time is UTC+5:30 regardless of the server', () => {
  // 2026-11-23 is a Monday. 03:30 UTC is 09:00 IST.
  assert.deepEqual(indiaMoment(new Date('2026-11-23T03:30:00Z')), { day: 'mon', minute: 540 })
  // 20:00 UTC Sunday is 01:30 IST Monday.
  assert.deepEqual(indiaMoment(new Date('2026-11-22T20:00:00Z')), { day: 'mon', minute: 90 })
})

test('open inside a window, closed in the lunch gap and at closing time', () => {
  assert.deepEqual(openStatus(shop, { day: 'mon', minute: 9 * 60 }), { open: true, closesAt: '13:00' })
  assert.deepEqual(openStatus(shop, { day: 'mon', minute: 14 * 60 }), { open: false, opensAt: { day: 'mon', time: '16:00' } })
  assert.equal(openStatus(shop, { day: 'tue', minute: 20 * 60 }).open, false)
})

test('a window past midnight stays open into the next day', () => {
  assert.deepEqual(openStatus(shop, { day: 'sat', minute: 23 * 60 }), { open: true, closesAt: '02:00' })
  assert.deepEqual(openStatus(shop, { day: 'sun', minute: 60 }), { open: true, closesAt: '02:00' })
  assert.equal(openStatus(shop, { day: 'sun', minute: 3 * 60 }).open, false)
})

test('the next opening can be days away, and wraps the week', () => {
  assert.deepEqual(openStatus(shop, { day: 'tue', minute: 21 * 60 }), { open: false, opensAt: { day: 'sat', time: '18:00' } })
  assert.deepEqual(openStatus(shop, { day: 'sun', minute: 12 * 60 }), { open: false, opensAt: { day: 'mon', time: '09:00' } })
})

test('wording', () => {
  assert.equal(formatTime('00:30'), '12:30 AM')
  assert.equal(formatTime('12:00'), '12:00 PM')
  assert.equal(formatTime('21:05'), '9:05 PM')
  assert.equal(describeStatus({ open: true, closesAt: '20:00' }, 'mon'), 'Open now · closes 8:00 PM')
  assert.equal(describeStatus({ open: false, opensAt: { day: 'mon', time: '16:00' } }, 'mon'), 'Closed · opens 4:00 PM')
  assert.equal(describeStatus({ open: false, opensAt: { day: 'mon', time: '09:00' } }, 'sun'), 'Closed · opens 9:00 AM tomorrow')
  assert.equal(describeStatus({ open: false, opensAt: { day: 'sat', time: '18:00' } }, 'tue'), 'Closed · opens 6:00 PM Saturday')
})

test('the normaliser keeps overnight windows and drops broken ones', () => {
  const hours = normalizeOpeningHours({
    sat: [{ start: '18:00', end: '02:00' }, { start: '09:00', end: '09:00' }, { start: '9am', end: '5pm' }],
    sun: 'closed',
  })
  assert.deepEqual(hours?.sat, [{ start: '18:00', end: '02:00' }])
  assert.deepEqual(hours?.sun, [])
})
