import { test } from 'node:test'
import assert from 'node:assert/strict'
import { loginHref, currentPathForLogin } from './login-redirect'

test('builds a sign-in url that returns to the given path', () => {
  assert.equal(loginHref('/listings/arth'), '/login?next=%2Flistings%2Farth')
})

test('encodes a next value so its own query string survives the round trip', () => {
  assert.equal(
    loginHref('/listings?q=bakery&sort=rating'),
    '/login?next=%2Flistings%3Fq%3Dbakery%26sort%3Drating',
  )
})

test('keeps the query string, which the hand-written call sites dropped', () => {
  assert.equal(
    currentPathForLogin({ pathname: '/listings', search: '?q=bakery&sort=rating' }),
    '/listings?q=bakery&sort=rating',
  )
})

test('a page with no query string is just its path', () => {
  assert.equal(currentPathForLogin({ pathname: '/listings/arth', search: '' }), '/listings/arth')
})

test('round trips a searched page through both halves', () => {
  const next = currentPathForLogin({ pathname: '/polls', search: '?page=2' })
  assert.equal(loginHref(next), '/login?next=%2Fpolls%3Fpage%3D2')
  assert.equal(decodeURIComponent(new URL(loginHref(next), 'https://x').searchParams.get('next')!), '/polls?page=2')
})
