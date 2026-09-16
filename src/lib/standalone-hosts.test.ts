import { test } from 'node:test'
import assert from 'node:assert/strict'

import { buildStandaloneLoginHref, buildStandaloneUrl, getStandaloneSubdomain } from './standalone-hosts'

test('recognises the standalone products on production and local hosts', () => {
  assert.equal(getStandaloneSubdomain('find.ourdahanu.in'), 'find')
  assert.equal(getStandaloneSubdomain('appointments.ourdahanu.in'), 'appointments')
  assert.equal(getStandaloneSubdomain('jobs.ourdahanu.in'), 'jobs')
  assert.equal(getStandaloneSubdomain('JOBS.localhost:3000'), 'jobs')
  assert.equal(getStandaloneSubdomain('jobs.ourdahanu.in, proxy.example'), 'jobs')
})

test('business subdomains, the apex and junk are not standalone', () => {
  for (const host of ['ourdahanu.in', 'www.ourdahanu.in', 'jigarchheda.ourdahanu.in', 'localhost:3000', 'jobs.evil.com', '', null, undefined]) {
    assert.equal(getStandaloneSubdomain(host), null, String(host))
  }
})

test('login from a standalone host runs on the main domain and returns to the same page', () => {
  assert.equal(
    buildStandaloneLoginHref('find.ourdahanu.in', '/submit'),
    `https://ourdahanu.in/login?next=${encodeURIComponent('https://find.ourdahanu.in/submit')}`,
  )
  assert.equal(
    buildStandaloneLoginHref('jobs.ourdahanu.in', '/j/abc'),
    `https://ourdahanu.in/login?next=${encodeURIComponent('https://jobs.ourdahanu.in/j/abc')}`,
  )
  assert.equal(
    buildStandaloneLoginHref('jobs.localhost:3000', '/post'),
    `http://localhost:3000/login?next=${encodeURIComponent('http://jobs.localhost:3000/post')}`,
  )
})

test('login from the main domain stays on the main domain', () => {
  assert.equal(
    buildStandaloneLoginHref('ourdahanu.in', '/jobs/post'),
    `https://ourdahanu.in/login?next=${encodeURIComponent('https://ourdahanu.in/jobs/post')}`,
  )
})

test('buildStandaloneUrl points at the product\'s own host, not the apex', () => {
  assert.equal(buildStandaloneUrl('jobs'), 'https://jobs.ourdahanu.in/')
  assert.equal(buildStandaloneUrl('appointments', '/'), 'https://appointments.ourdahanu.in/')
  assert.equal(buildStandaloneUrl('find', '/submit'), 'https://find.ourdahanu.in/submit')
})
