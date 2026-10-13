import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

import { getBusinessSubdomain, RESERVED_SUBDOMAINS } from './subdomain'
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

test('every name the directory refuses is also refused by the availability check', async () => {
  // There used to be a third hand-maintained copy of this list in
  // src/app/api/check-subdomain/route.ts, and it had fallen a name behind:
  // "appointments" reported available and then failed at submit. Both the
  // route and the listing action now read this set, so the only way to
  // reintroduce the drift is to write out a new copy.
  const route = await readFile(
    new URL('../app/api/check-subdomain/route.ts', import.meta.url),
    'utf8',
  )
  assert.match(route, /RESERVED_SUBDOMAINS/, 'the route should use the shared set')
  assert.doesNotMatch(route, /new Set\(\[[^\]]*'www'/, 'the route should not keep its own copy')
  assert.ok(RESERVED_SUBDOMAINS.has('appointments'), 'appointments must be reserved')
})
