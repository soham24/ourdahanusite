import { test } from 'node:test'
import assert from 'node:assert/strict'

import { generateAvailableSlots, resolveWindowsForDate } from './appointment-slots'
import { DEFAULT_APPOINTMENT_SETTINGS, type AppointmentSettings } from './listing-content'

// 2026-09-14 is a Monday. Every test uses a date far in the future so the
// "today" branch (minimum notice) never fires unless a test opts into it.
const MONDAY = '2026-09-14'
const TUESDAY = '2026-09-15'

function settings(over: Partial<AppointmentSettings> = {}): AppointmentSettings {
  return {
    ...DEFAULT_APPOINTMENT_SETTINGS,
    availability: {
      ...DEFAULT_APPOINTMENT_SETTINGS.availability,
      mon: [{ start: '09:00', end: '11:00' }],
    },
    ...over,
  }
}

test('returns nothing when settings are null', () => {
  assert.deepEqual(generateAvailableSlots(null, MONDAY, {}), [])
})

test('returns nothing on a day with no windows', () => {
  assert.deepEqual(generateAvailableSlots(settings(), TUESDAY, {}), [])
})

test('generates slots across one window', () => {
  const slots = generateAvailableSlots(settings({ slot_duration: 60 }), MONDAY, {})
  assert.deepEqual(slots.map((s) => s.start), ['09:00', '10:00'])
  assert.deepEqual(slots.map((s) => s.end), ['10:00', '11:00'])
})

test('generates slots across two windows in order', () => {
  const config = settings({
    slot_duration: 60,
    availability: {
      ...DEFAULT_APPOINTMENT_SETTINGS.availability,
      mon: [{ start: '09:00', end: '11:00' }, { start: '16:00', end: '18:00' }],
    },
  })
  const slots = generateAvailableSlots(config, MONDAY, {})
  assert.deepEqual(slots.map((s) => s.start), ['09:00', '10:00', '16:00', '17:00'])
})

test('never emits a slot that would run past its window end', () => {
  const config = settings({
    slot_duration: 45,
    availability: {
      ...DEFAULT_APPOINTMENT_SETTINGS.availability,
      mon: [{ start: '09:00', end: '10:00' }],
    },
  })
  assert.deepEqual(generateAvailableSlots(config, MONDAY, {}).map((s) => s.start), ['09:00'])
})

test('adds buffer between slots but not to slot length', () => {
  const config = settings({ slot_duration: 30, buffer_minutes: 15 })
  const slots = generateAvailableSlots(config, MONDAY, {})
  assert.deepEqual(slots.map((s) => s.start), ['09:00', '09:45', '10:30'])
  assert.equal(slots[0].end, '09:30')
})

test('marks a full slot unavailable but still returns it', () => {
  const config = settings({ slot_duration: 60, capacity: 1 })
  const slots = generateAvailableSlots(config, MONDAY, { '09:00': 1 })
  assert.equal(slots[0].available, false)
  assert.equal(slots[0].reason, 'full')
  assert.equal(slots[0].remaining, 0)
  assert.equal(slots[1].available, true)
  assert.equal(slots[1].reason, 'open')
})

test('reports remaining seats for multi-capacity slots', () => {
  const config = settings({ slot_duration: 60, capacity: 3 })
  const slots = generateAvailableSlots(config, MONDAY, { '09:00': 2 })
  assert.equal(slots[0].remaining, 1)
  assert.equal(slots[0].available, true)
})

test('never reports negative remaining', () => {
  const config = settings({ slot_duration: 60, capacity: 1 })
  const slots = generateAvailableSlots(config, MONDAY, { '09:00': 5 })
  assert.equal(slots[0].remaining, 0)
})

test('a closed override yields no slots', () => {
  const slots = generateAvailableSlots(settings({ slot_duration: 60 }), MONDAY, {}, {
    override_date: MONDAY,
    closed: true,
    windows: null,
  })
  assert.deepEqual(slots, [])
})

test('an open override replaces the weekday windows entirely', () => {
  const slots = generateAvailableSlots(settings({ slot_duration: 60 }), MONDAY, {}, {
    override_date: MONDAY,
    closed: false,
    windows: [{ start: '14:00', end: '16:00' }],
  })
  assert.deepEqual(slots.map((s) => s.start), ['14:00', '15:00'])
})

test('an open override with no windows yields no slots', () => {
  const slots = generateAvailableSlots(settings({ slot_duration: 60 }), MONDAY, {}, {
    override_date: MONDAY,
    closed: false,
    windows: null,
  })
  assert.deepEqual(slots, [])
})

test('an override can open a normally closed day', () => {
  const slots = generateAvailableSlots(settings({ slot_duration: 60 }), TUESDAY, {}, {
    override_date: TUESDAY,
    closed: false,
    windows: [{ start: '10:00', end: '12:00' }],
  })
  assert.deepEqual(slots.map((s) => s.start), ['10:00', '11:00'])
})

test('resolveWindowsForDate prefers the override over the weekday', () => {
  const config = settings()
  assert.deepEqual(resolveWindowsForDate(config, MONDAY), [{ start: '09:00', end: '11:00' }])
  assert.deepEqual(
    resolveWindowsForDate(config, MONDAY, { override_date: MONDAY, closed: true, windows: null }),
    [],
  )
})

// Booking date is MONDAY itself, so these exercise the isToday / min-notice
// branch with an injected clock instead of the real one.
const NOW = { today: MONDAY, nowMinutes: 9 * 60 + 10 } // 09:10

test('a slot strictly before now is dropped entirely', () => {
  const config = settings({ slot_duration: 60 })
  const slots = generateAvailableSlots(config, MONDAY, {}, null, NOW)
  assert.ok(!slots.some((s) => s.start === '09:00'))
})

test('a slot exactly at now is also dropped', () => {
  const config = settings({ slot_duration: 10, buffer_minutes: 0 })
  const slots = generateAvailableSlots(config, MONDAY, {}, null, NOW)
  assert.ok(!slots.some((s) => s.start === '09:10'))
})

test('a future slot inside the notice window is too_soon', () => {
  const config = settings({ slot_duration: 15, buffer_minutes: 0, min_notice_minutes: 20 })
  const slots = generateAvailableSlots(config, MONDAY, {}, null, NOW)
  // 09:15 is after now (09:10) but before now + 20min notice (09:30)
  const slot = slots.find((s) => s.start === '09:15')
  assert.ok(slot)
  assert.equal(slot?.available, false)
  assert.equal(slot?.reason, 'too_soon')
})

test('a slot at or beyond the notice threshold is open', () => {
  const config = settings({ slot_duration: 15, buffer_minutes: 0, min_notice_minutes: 20 })
  const slots = generateAvailableSlots(config, MONDAY, {}, null, NOW)
  // now + min_notice_minutes = 09:30
  const slot = slots.find((s) => s.start === '09:30')
  assert.ok(slot)
  assert.equal(slot?.available, true)
  assert.equal(slot?.reason, 'open')
})

test('with zero min notice, every future slot today is open', () => {
  const config = settings({ slot_duration: 15, buffer_minutes: 0, min_notice_minutes: 0 })
  const slots = generateAvailableSlots(config, MONDAY, {}, null, NOW)
  assert.ok(slots.length > 0)
  assert.ok(slots.every((s) => s.reason !== 'too_soon'))
})

test('a full slot inside the notice window reports full, not too_soon', () => {
  const config = settings({ slot_duration: 15, buffer_minutes: 0, min_notice_minutes: 20, capacity: 1 })
  const slots = generateAvailableSlots(config, MONDAY, { '09:15': 1 }, null, NOW)
  const slot = slots.find((s) => s.start === '09:15')
  assert.ok(slot)
  assert.equal(slot?.available, false)
  assert.equal(slot?.reason, 'full')
})

test('a future booking date is unaffected by an injected now', () => {
  const config = settings({ slot_duration: 60, min_notice_minutes: 30 })
  const slots = generateAvailableSlots(config, TUESDAY, {}, {
    override_date: TUESDAY,
    closed: false,
    windows: [{ start: '09:00', end: '11:00' }],
  }, NOW)
  assert.deepEqual(slots.map((s) => s.start), ['09:00', '10:00'])
  assert.ok(slots.every((s) => s.reason === 'open'))
})

// Regression: the India-time formatter must use hourCycle 'h23' rather than
// hour12: false. During the midnight hour, hour12: false yields hour "24"
// (not "00"), which pushes nowMinutes past every slot in the day and drops
// them all as "past" — every business would render as closed 00:00-00:59 IST.
test('at 00:07 IST, a business open 09:00-18:00 still returns its slots', () => {
  const config = settings({ slot_duration: 60 })
  const midnight = { today: MONDAY, nowMinutes: 7 } // 00:07
  const slots = generateAvailableSlots(config, MONDAY, {}, null, midnight)
  assert.deepEqual(slots.map((s) => s.start), ['09:00', '10:00'])
  assert.ok(slots.every((s) => s.reason === 'open'))
})
