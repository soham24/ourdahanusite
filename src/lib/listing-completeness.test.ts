import { test } from 'node:test'
import assert from 'node:assert/strict'

import { listingCompleteness, type CompletenessInput } from './listing-completeness'

const empty: CompletenessInput = {
  id: 'l1',
  image_url: null,
  cover_image: null,
  description: null,
  phone: null,
  whatsapp: null,
  address: null,
  map_url: null,
  photos: null,
  appointments_enabled: false,
  appointment_settings: null,
  itemCount: 0,
}

const complete: CompletenessInput = {
  ...empty,
  image_url: 'https://x/logo.jpg',
  cover_image: 'https://x/cover.jpg',
  description: 'Fresh bakes every morning: breads, cakes and cookies, made in Dahanu with local ingredients.',
  whatsapp: '9876543210',
  map_url: 'https://maps.app.goo.gl/x',
  photos: ['a', 'b', 'c'],
  itemCount: 2,
}

test('an empty listing is 0% with every step missing', () => {
  const result = listingCompleteness(empty)
  assert.equal(result.percent, 0)
  assert.equal(result.missing.length, result.steps.length)
})

test('a complete listing is 100% with nothing missing', () => {
  const result = listingCompleteness(complete)
  assert.equal(result.percent, 100)
  assert.deepEqual(result.missing, [])
})

test('either phone or WhatsApp counts as contact, and address or map as location', () => {
  const steps = listingCompleteness({ ...complete, whatsapp: null, phone: '022 1234', map_url: null, address: 'Main road' }).steps
  assert.equal(steps.find((s) => s.key === 'contact')?.done, true)
  assert.equal(steps.find((s) => s.key === 'location')?.done, true)
})

test('blank strings and a too-short description do not count', () => {
  const missing = listingCompleteness({ ...complete, image_url: '  ', description: 'Shop' }).missing.map((s) => s.key)
  assert.deepEqual(missing, ['logo', 'description'])
})

test('booking hours are a step only when online booking is on', () => {
  assert.equal(listingCompleteness(complete).steps.some((s) => s.key === 'booking-hours'), false)
  const on = listingCompleteness({ ...complete, appointments_enabled: true })
  assert.deepEqual(on.missing.map((s) => s.key), ['booking-hours'])
  assert.equal(on.missing[0].href, '/my-business/appointments')
  assert.equal(listingCompleteness({ ...complete, appointments_enabled: true, appointment_settings: {} }).percent, 100)
})

test('each step links to the page that fixes it', () => {
  const steps = listingCompleteness({ ...empty, appointments_enabled: true }).steps
  assert.equal(steps.find((s) => s.key === 'catalog')?.href, '/my-business/products/l1')
  assert.equal(steps.find((s) => s.key === 'logo')?.href, '/my-business/edit/l1')
})

test('missing booking hours come first, since customers are already turned away', () => {
  assert.equal(listingCompleteness({ ...empty, appointments_enabled: true }).missing[0].key, 'booking-hours')
})
