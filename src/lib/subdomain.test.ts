import { test } from 'node:test'
import assert from 'node:assert/strict'

import { getBusinessSubdomain } from './subdomain'
import { ROOT_DOMAIN } from '@/lib/site-config'

test('reads a real business subdomain', () => {
  assert.equal(getBusinessSubdomain(`dradidx.${ROOT_DOMAIN}`), 'dradidx')
  assert.equal(getBusinessSubdomain('dradidx.localhost:3000'), 'dradidx')
})

test('never treats a reserved prefix as a business', () => {
  for (const reserved of ['find', 'appointments', 'www', 'admin', 'shop']) {
    assert.equal(getBusinessSubdomain(`${reserved}.${ROOT_DOMAIN}`), null, reserved)
    assert.equal(getBusinessSubdomain(`${reserved}.localhost:3000`), null, reserved)
  }
})

test('returns null for the bare domain', () => {
  assert.equal(getBusinessSubdomain(`${ROOT_DOMAIN}`), null)
  assert.equal(getBusinessSubdomain('localhost:3000'), null)
  assert.equal(getBusinessSubdomain(''), null)
  assert.equal(getBusinessSubdomain(null), null)
})
