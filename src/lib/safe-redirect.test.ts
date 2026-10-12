import assert from 'node:assert/strict'
import test from 'node:test'
import { resolveSafeRedirect } from './safe-redirect'
import { ROOT_DOMAIN } from '@/lib/site-config'

const ORIGIN = `https://${ROOT_DOMAIN}`

test('relative paths resolve against the origin', () => {
  assert.equal(resolveSafeRedirect('/account/orders', ORIGIN), `https://${ROOT_DOMAIN}/account/orders`)
})

test('null and empty fall back to the origin root', () => {
  assert.equal(resolveSafeRedirect(null, ORIGIN), `https://${ROOT_DOMAIN}/`)
  assert.equal(resolveSafeRedirect('', ORIGIN), `https://${ROOT_DOMAIN}/`)
})

test('apex and business subdomains are allowed', () => {
  assert.equal(
    resolveSafeRedirect(`https://organic.${ROOT_DOMAIN}/checkout/abc`, ORIGIN),
    `https://organic.${ROOT_DOMAIN}/checkout/abc`,
  )
  assert.equal(resolveSafeRedirect(`https://${ROOT_DOMAIN}/shop`, ORIGIN), `https://${ROOT_DOMAIN}/shop`)
})

test('foreign hosts are rejected', () => {
  assert.equal(resolveSafeRedirect('https://evil.com', ORIGIN), `https://${ROOT_DOMAIN}/`)
  assert.equal(resolveSafeRedirect('https://evil.com/x', ORIGIN), `https://${ROOT_DOMAIN}/`)
})

test('lookalike hosts that merely end in the brand are rejected', () => {
  assert.equal(resolveSafeRedirect(`https://not${ROOT_DOMAIN}`, ORIGIN), `https://${ROOT_DOMAIN}/`)
  assert.equal(resolveSafeRedirect(`https://${ROOT_DOMAIN}.evil.com`, ORIGIN), `https://${ROOT_DOMAIN}/`)
})

test('protocol-relative URLs are rejected', () => {
  assert.equal(resolveSafeRedirect('//evil.com', ORIGIN), `https://${ROOT_DOMAIN}/`)
  assert.equal(resolveSafeRedirect('//evil.com/path', ORIGIN), `https://${ROOT_DOMAIN}/`)
})

test('non-https schemes are rejected', () => {
  assert.equal(resolveSafeRedirect('javascript:alert(1)', ORIGIN), `https://${ROOT_DOMAIN}/`)
  assert.equal(resolveSafeRedirect(`http://${ROOT_DOMAIN}/x`, ORIGIN), `https://${ROOT_DOMAIN}/`)
})

test('unparseable input falls back to the origin root', () => {
  assert.equal(resolveSafeRedirect('http://[', ORIGIN), `https://${ROOT_DOMAIN}/`)
})

test('localhost subdomains are allowed so dev sign-in works', () => {
  const devOrigin = 'http://localhost:3000'
  assert.equal(
    resolveSafeRedirect('http://organic.localhost:3000/checkout/abc', devOrigin),
    'http://organic.localhost:3000/checkout/abc',
  )
})

test('backslash-based host bypasses are rejected', () => {
  // WHATWG URL parsing treats '\' as '/' for special schemes, so a naive
  // "starts with a single '/'" check can be fooled into a foreign host.
  assert.equal(resolveSafeRedirect('/\\evil.com', ORIGIN), `https://${ROOT_DOMAIN}/`)
  assert.equal(resolveSafeRedirect('/\\/evil.com', ORIGIN), `https://${ROOT_DOMAIN}/`)
})

test('a relative path on a vercel.app preview origin keeps its path', () => {
  const previewOrigin = 'https://feat-checkout.vercel.app'
  assert.equal(
    resolveSafeRedirect('/checkout/abc', previewOrigin),
    'https://feat-checkout.vercel.app/checkout/abc',
  )
})

test('an absolute foreign host is still rejected when origin is vercel.app', () => {
  const previewOrigin = 'https://feat-checkout.vercel.app'
  assert.equal(resolveSafeRedirect('https://evil.com', previewOrigin), 'https://feat-checkout.vercel.app/')
  assert.equal(
    resolveSafeRedirect('https://evil.com/x', previewOrigin),
    'https://feat-checkout.vercel.app/',
  )
})

test('embedded tab/LF/CR host bypasses are rejected', () => {
  // The URL parser strips ASCII tab/LF/CR from anywhere in the input, so
  // these all normalize to protocol-relative '//evil.com' despite starting
  // with a single '/'.
  const tab = '/' + String.fromCharCode(9) + '/evil.com'
  const lf = '/' + String.fromCharCode(10) + '/evil.com'
  const cr = '/' + String.fromCharCode(13) + '/evil.com'
  assert.equal(resolveSafeRedirect(tab, ORIGIN), `https://${ROOT_DOMAIN}/`)
  assert.equal(resolveSafeRedirect(lf, ORIGIN), `https://${ROOT_DOMAIN}/`)
  assert.equal(resolveSafeRedirect(cr, ORIGIN), `https://${ROOT_DOMAIN}/`)
})
