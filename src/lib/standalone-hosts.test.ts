import { test } from 'node:test'
import assert from 'node:assert/strict'

import { buildStandaloneLoginHref, buildStandaloneUrl, getStandaloneSubdomain } from './standalone-hosts'
import { ROOT_DOMAIN } from '@/lib/site-config'

test('recognises the standalone products on production and local hosts', () => {
  assert.equal(getStandaloneSubdomain(`find.${ROOT_DOMAIN}`), 'find')
  assert.equal(getStandaloneSubdomain(`appointments.${ROOT_DOMAIN}`), 'appointments')
  assert.equal(getStandaloneSubdomain(`jobs.${ROOT_DOMAIN}`), 'jobs')
  assert.equal(getStandaloneSubdomain('JOBS.localhost:3000'), 'jobs')
  assert.equal(getStandaloneSubdomain(`jobs.${ROOT_DOMAIN}, proxy.example`), 'jobs')
})

test('business subdomains, the apex and junk are not standalone', () => {
  for (const host of [`${ROOT_DOMAIN}`, `www.${ROOT_DOMAIN}`, `jigarchheda.${ROOT_DOMAIN}`, 'localhost:3000', 'jobs.evil.com', '', null, undefined]) {
    assert.equal(getStandaloneSubdomain(host), null, String(host))
  }
})

test('login from a standalone host runs on the main domain and returns to the same page', () => {
  assert.equal(
    buildStandaloneLoginHref(`find.${ROOT_DOMAIN}`, '/submit'),
    `https://${ROOT_DOMAIN}/login?next=${encodeURIComponent(`https://find.${ROOT_DOMAIN}/submit`)}`,
  )
  assert.equal(
    buildStandaloneLoginHref(`jobs.${ROOT_DOMAIN}`, '/j/abc'),
    `https://${ROOT_DOMAIN}/login?next=${encodeURIComponent(`https://jobs.${ROOT_DOMAIN}/j/abc`)}`,
  )
  assert.equal(
    buildStandaloneLoginHref('jobs.localhost:3000', '/post'),
    `http://localhost:3000/login?next=${encodeURIComponent('http://jobs.localhost:3000/post')}`,
  )
})

test('login from the main domain stays on the main domain', () => {
  assert.equal(
    buildStandaloneLoginHref(`${ROOT_DOMAIN}`, '/jobs/post'),
    `https://${ROOT_DOMAIN}/login?next=${encodeURIComponent(`https://${ROOT_DOMAIN}/jobs/post`)}`,
  )
})

test('buildStandaloneUrl points at the product\'s own host, not the apex', () => {
  assert.equal(buildStandaloneUrl('jobs'), `https://jobs.${ROOT_DOMAIN}/`)
  assert.equal(buildStandaloneUrl('appointments', '/'), `https://appointments.${ROOT_DOMAIN}/`)
  assert.equal(buildStandaloneUrl('find', '/submit'), `https://find.${ROOT_DOMAIN}/submit`)
})
