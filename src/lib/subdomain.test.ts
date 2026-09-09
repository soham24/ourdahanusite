import { test } from 'node:test'
import assert from 'node:assert/strict'

import { getBusinessSubdomain } from './subdomain'

test('reads a real business subdomain', () => {
  assert.equal(getBusinessSubdomain('dradidx.ourdahanu.in'), 'dradidx')
  assert.equal(getBusinessSubdomain('dradidx.localhost:3000'), 'dradidx')
})

test('never treats a reserved prefix as a business', () => {
  for (const reserved of ['find', 'appointments', 'www', 'admin', 'shop']) {
    assert.equal(getBusinessSubdomain(`${reserved}.ourdahanu.in`), null, reserved)
    assert.equal(getBusinessSubdomain(`${reserved}.localhost:3000`), null, reserved)
  }
})

test('returns null for the bare domain', () => {
  assert.equal(getBusinessSubdomain('ourdahanu.in'), null)
  assert.equal(getBusinessSubdomain('localhost:3000'), null)
  assert.equal(getBusinessSubdomain(''), null)
  assert.equal(getBusinessSubdomain(null), null)
})
