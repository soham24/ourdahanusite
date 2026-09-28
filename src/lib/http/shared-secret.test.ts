import { test } from 'node:test'
import assert from 'node:assert/strict'
import { secretMatches, isConfigured, bearerToken } from './shared-secret'

test('accepts the exact secret', () => {
  assert.equal(secretMatches('s3cret-value', 's3cret-value'), true)
})

test('rejects a wrong secret of the same length', () => {
  assert.equal(secretMatches('s3cret-valuX', 's3cret-value'), false)
})

test('rejects a correct prefix', () => {
  assert.equal(secretMatches('s3cret', 's3cret-value'), false)
})

test('rejects a longer string that starts with the secret', () => {
  assert.equal(secretMatches('s3cret-value-and-more', 's3cret-value'), false)
})

test('rejects missing, empty and non-string candidates', () => {
  assert.equal(secretMatches(null, 's3cret'), false)
  assert.equal(secretMatches(undefined, 's3cret'), false)
  assert.equal(secretMatches('', 's3cret'), false)
})

test('never matches when no secret is configured, even against an empty candidate', () => {
  assert.equal(secretMatches('', ''), false)
  assert.equal(secretMatches('anything', ''), false)
  assert.equal(secretMatches(null, ''), false)
})

test('treats blank configuration as not configured', () => {
  assert.equal(isConfigured(undefined), false)
  assert.equal(isConfigured(''), false)
  assert.equal(isConfigured('   '), false)
  assert.equal(isConfigured('x'), true)
})

test('reads a bearer token, case-insensitively on the scheme', () => {
  assert.equal(bearerToken('Bearer abc123'), 'abc123')
  assert.equal(bearerToken('bearer abc123'), 'abc123')
})

test('returns null for a missing or non-bearer authorization header', () => {
  assert.equal(bearerToken(null), null)
  assert.equal(bearerToken('abc123'), null)
  assert.equal(bearerToken('Basic abc123'), null)
  assert.equal(bearerToken('Bearer'), null)
  assert.equal(bearerToken('Bearer    '), null)
})
