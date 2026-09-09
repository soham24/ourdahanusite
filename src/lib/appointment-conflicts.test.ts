import { test } from 'node:test'
import assert from 'node:assert/strict'

import { findOverrideConflicts, type ConflictCandidate } from './appointment-conflicts'

function appointment(over: Partial<ConflictCandidate> = {}): ConflictCandidate {
  return { id: 'a1', slot_start: '10:00', status: 'confirmed', ...over }
}

test('a closed override conflicts with every confirmed booking', () => {
  const ids = findOverrideConflicts(
    [appointment({ id: 'a1' }), appointment({ id: 'a2', slot_start: '15:00' })],
    { closed: true, windows: null },
  )
  assert.deepEqual(ids, ['a1', 'a2'])
})

test('ignores bookings that are already cancelled', () => {
  const ids = findOverrideConflicts(
    [appointment({ id: 'a1', status: 'cancelled' }), appointment({ id: 'a2' })],
    { closed: true, windows: null },
  )
  assert.deepEqual(ids, ['a2'])
})

test('ignores completed and no-show bookings', () => {
  const ids = findOverrideConflicts(
    [appointment({ id: 'a1', status: 'completed' }), appointment({ id: 'a2', status: 'no_show' })],
    { closed: true, windows: null },
  )
  assert.deepEqual(ids, [])
})

test('keeps bookings that still fall inside the new windows', () => {
  const ids = findOverrideConflicts([appointment({ slot_start: '10:00' })], {
    closed: false,
    windows: [{ start: '09:00', end: '12:00' }],
  })
  assert.deepEqual(ids, [])
})

test('flags bookings that fall outside the new windows', () => {
  const ids = findOverrideConflicts(
    [appointment({ id: 'a1', slot_start: '08:00' }), appointment({ id: 'a2', slot_start: '14:00' })],
    { closed: false, windows: [{ start: '09:00', end: '12:00' }] },
  )
  assert.deepEqual(ids, ['a1', 'a2'])
})

test('a booking exactly at a window end is outside it', () => {
  const ids = findOverrideConflicts([appointment({ slot_start: '12:00' })], {
    closed: false,
    windows: [{ start: '09:00', end: '12:00' }],
  })
  assert.deepEqual(ids, ['a1'])
})

test('a booking exactly at a window start is inside it', () => {
  const ids = findOverrideConflicts([appointment({ slot_start: '09:00' })], {
    closed: false,
    windows: [{ start: '09:00', end: '12:00' }],
  })
  assert.deepEqual(ids, [])
})

test('a booking inside any one of several windows is kept', () => {
  const ids = findOverrideConflicts([appointment({ slot_start: '17:00' })], {
    closed: false,
    windows: [{ start: '09:00', end: '12:00' }, { start: '16:00', end: '19:00' }],
  })
  assert.deepEqual(ids, [])
})

test('an open override with no windows conflicts with everything', () => {
  const ids = findOverrideConflicts([appointment()], { closed: false, windows: null })
  assert.deepEqual(ids, ['a1'])
})

test('tolerates seconds in slot_start as Postgres returns them', () => {
  const ids = findOverrideConflicts([appointment({ slot_start: '10:00:00' })], {
    closed: false,
    windows: [{ start: '09:00', end: '12:00' }],
  })
  assert.deepEqual(ids, [])
})
