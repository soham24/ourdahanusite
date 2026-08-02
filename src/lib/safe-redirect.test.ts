import assert from 'node:assert/strict'
import test from 'node:test'
import { resolveSafeRedirect } from './safe-redirect'

const ORIGIN = 'https://ourdahanu.in'

test('relative paths resolve against the origin', () => {
  assert.equal(resolveSafeRedirect('/account/orders', ORIGIN), 'https://ourdahanu.in/account/orders')
})

test('null and empty fall back to the origin root', () => {
  assert.equal(resolveSafeRedirect(null, ORIGIN), 'https://ourdahanu.in/')
  assert.equal(resolveSafeRedirect('', ORIGIN), 'https://ourdahanu.in/')
})

test('apex and business subdomains are allowed', () => {
  assert.equal(
    resolveSafeRedirect('https://organic.ourdahanu.in/checkout/abc', ORIGIN),
    'https://organic.ourdahanu.in/checkout/abc',
  )
  assert.equal(resolveSafeRedirect('https://ourdahanu.in/shop', ORIGIN), 'https://ourdahanu.in/shop')
})

test('foreign hosts are rejected', () => {
  assert.equal(resolveSafeRedirect('https://evil.com', ORIGIN), 'https://ourdahanu.in/')
  assert.equal(resolveSafeRedirect('https://evil.com/x', ORIGIN), 'https://ourdahanu.in/')
})

test('lookalike hosts that merely end in the brand are rejected', () => {
  assert.equal(resolveSafeRedirect('https://notourdahanu.in', ORIGIN), 'https://ourdahanu.in/')
  assert.equal(resolveSafeRedirect('https://ourdahanu.in.evil.com', ORIGIN), 'https://ourdahanu.in/')
})

test('protocol-relative URLs are rejected', () => {
  assert.equal(resolveSafeRedirect('//evil.com', ORIGIN), 'https://ourdahanu.in/')
  assert.equal(resolveSafeRedirect('//evil.com/path', ORIGIN), 'https://ourdahanu.in/')
})

test('non-https schemes are rejected', () => {
  assert.equal(resolveSafeRedirect('javascript:alert(1)', ORIGIN), 'https://ourdahanu.in/')
  assert.equal(resolveSafeRedirect('http://ourdahanu.in/x', ORIGIN), 'https://ourdahanu.in/')
})

test('unparseable input falls back to the origin root', () => {
  assert.equal(resolveSafeRedirect('http://[', ORIGIN), 'https://ourdahanu.in/')
})

test('localhost subdomains are allowed so dev sign-in works', () => {
  const devOrigin = 'http://localhost:3000'
  assert.equal(
    resolveSafeRedirect('http://organic.localhost:3000/checkout/abc', devOrigin),
    'http://organic.localhost:3000/checkout/abc',
  )
})
