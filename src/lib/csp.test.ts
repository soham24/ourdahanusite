import { test } from 'node:test'
import assert from 'node:assert/strict'

import { buildContentSecurityPolicy } from './csp'

const directive = (policy: string, name: string) =>
  policy.split('; ').find((part) => part.startsWith(`${name} `))?.split(' ').slice(1) ?? []

test('allows the configured Supabase project over https and its websocket', () => {
  const policy = buildContentSecurityPolicy({ supabaseUrl: 'https://abcd.supabase.co', isDev: false })
  const connect = directive(policy, 'connect-src')
  assert.ok(connect.includes('https://abcd.supabase.co'))
  assert.ok(connect.includes('wss://abcd.supabase.co'))
  assert.ok(!connect.some((value) => value.includes('*.supabase.co')), 'no blanket *.supabase.co')
})

test('a local stack is allowed over http and ws', () => {
  const connect = directive(buildContentSecurityPolicy({ supabaseUrl: 'http://127.0.0.1:54321', isDev: true }), 'connect-src')
  assert.ok(connect.includes('http://127.0.0.1:54321'))
  assert.ok(connect.includes('ws://127.0.0.1:54321'))
})

test('unsafe-eval only in development', () => {
  assert.ok(!directive(buildContentSecurityPolicy({ supabaseUrl: undefined, isDev: false }), 'script-src').includes("'unsafe-eval'"))
  assert.ok(directive(buildContentSecurityPolicy({ supabaseUrl: undefined, isDev: true }), 'script-src').includes("'unsafe-eval'"))
})

test('covers Razorpay checkout, blocks plugins and framing, and reports', () => {
  const policy = buildContentSecurityPolicy({ supabaseUrl: undefined, isDev: false })
  assert.ok(directive(policy, 'script-src').includes('https://checkout.razorpay.com'))
  assert.ok(directive(policy, 'frame-src').includes('https://api.razorpay.com'))
  assert.deepEqual(directive(policy, 'object-src'), ["'none'"])
  assert.deepEqual(directive(policy, 'frame-ancestors'), ["'self'"])
  assert.deepEqual(directive(policy, 'report-uri'), ['/api/csp-report'])
})

test('a missing or invalid Supabase URL adds nothing', () => {
  for (const supabaseUrl of [undefined, '', 'not a url']) {
    const connect = directive(buildContentSecurityPolicy({ supabaseUrl, isDev: false }), 'connect-src')
    assert.ok(!connect.some((value) => /^wss?:|^http:/.test(value)), String(supabaseUrl))
  }
})
