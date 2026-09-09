import { test } from 'node:test'
import assert from 'node:assert/strict'

import {
  DEFAULT_APPOINTMENT_SETTINGS,
  MAX_WINDOWS_PER_DAY,
  normalizeAppointmentSettings,
} from './listing-content'

test('returns null for non-object input', () => {
  assert.equal(normalizeAppointmentSettings(null), null)
  assert.equal(normalizeAppointmentSettings('nope'), null)
})

test('reads the new array shape', () => {
  const out = normalizeAppointmentSettings({
    availability: { mon: [{ start: '09:00', end: '13:00' }, { start: '16:00', end: '19:00' }] },
  })
  assert.deepEqual(out?.availability.mon, [
    { start: '09:00', end: '13:00' },
    { start: '16:00', end: '19:00' },
  ])
  assert.deepEqual(out?.availability.tue, [])
})

test('upgrades the legacy single-window shape to a one-element array', () => {
  const out = normalizeAppointmentSettings({
    availability: { mon: { start: '09:00', end: '18:00' }, tue: null },
  })
  assert.deepEqual(out?.availability.mon, [{ start: '09:00', end: '18:00' }])
  assert.deepEqual(out?.availability.tue, [])
})

test('drops windows whose end is not after start', () => {
  const out = normalizeAppointmentSettings({
    availability: { mon: [{ start: '10:00', end: '10:00' }, { start: '12:00', end: '11:00' }] },
  })
  assert.deepEqual(out?.availability.mon, [])
})

test('drops malformed times', () => {
  const out = normalizeAppointmentSettings({
    availability: { mon: [{ start: '9am', end: '18:00' }, { start: '25:00', end: '26:00' }] },
  })
  assert.deepEqual(out?.availability.mon, [])
})

test('sorts windows by start time', () => {
  const out = normalizeAppointmentSettings({
    availability: { mon: [{ start: '16:00', end: '19:00' }, { start: '09:00', end: '13:00' }] },
  })
  assert.deepEqual(out?.availability.mon, [
    { start: '09:00', end: '13:00' },
    { start: '16:00', end: '19:00' },
  ])
})

test('drops a window that overlaps the one before it', () => {
  const out = normalizeAppointmentSettings({
    availability: { mon: [{ start: '09:00', end: '13:00' }, { start: '12:00', end: '15:00' }] },
  })
  assert.deepEqual(out?.availability.mon, [{ start: '09:00', end: '13:00' }])
})

test('caps windows per day', () => {
  const out = normalizeAppointmentSettings({
    availability: {
      mon: [
        { start: '07:00', end: '08:00' },
        { start: '09:00', end: '10:00' },
        { start: '11:00', end: '12:00' },
        { start: '13:00', end: '14:00' },
      ],
    },
  })
  assert.equal(out?.availability.mon.length, MAX_WINDOWS_PER_DAY)
})

test('defaults min_notice_minutes to 0 when absent', () => {
  const out = normalizeAppointmentSettings({ availability: {} })
  assert.equal(out?.min_notice_minutes, 0)
})

test('clamps min_notice_minutes into range', () => {
  assert.equal(normalizeAppointmentSettings({ min_notice_minutes: -5 })?.min_notice_minutes, 0)
  assert.equal(normalizeAppointmentSettings({ min_notice_minutes: 99999 })?.min_notice_minutes, 1440)
  assert.equal(normalizeAppointmentSettings({ min_notice_minutes: 120 })?.min_notice_minutes, 120)
})

test('keeps existing numeric clamps', () => {
  const out = normalizeAppointmentSettings({ slot_duration: 5, capacity: 999, advance_days: 0 })
  assert.equal(out?.slot_duration, 15)
  assert.equal(out?.capacity, 20)
  assert.equal(out?.advance_days, 1)
})

test('default settings have every day closed and no notice', () => {
  assert.equal(DEFAULT_APPOINTMENT_SETTINGS.min_notice_minutes, 0)
  for (const day of ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const) {
    assert.deepEqual(DEFAULT_APPOINTMENT_SETTINGS.availability[day], [])
  }
})
