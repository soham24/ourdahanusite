import { test } from 'node:test'
import assert from 'node:assert/strict'

import { isLikelyBot, ipRateLimitKey } from './track-request'

test('isLikelyBot treats a missing User-Agent as a bot', () => {
  assert.equal(isLikelyBot(null), true)
  assert.equal(isLikelyBot(''), true)
})

test('isLikelyBot flags known crawler and headless UAs', () => {
  assert.equal(
    isLikelyBot('Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'),
    true,
  )
  assert.equal(
    isLikelyBot(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/119.0.6045.105 Safari/537.36',
    ),
    true,
  )
  assert.equal(
    isLikelyBot(
      'Mozilla/5.0 (Linux; Android 7.0; Moto G (4)) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/61.0.3116.0 Mobile Safari/537.36 Chrome-Lighthouse',
    ),
    true,
  )
})

test('isLikelyBot passes real mobile browser UAs', () => {
  assert.equal(
    isLikelyBot(
      'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Mobile Safari/537.36',
    ),
    false,
  )
  assert.equal(
    isLikelyBot(
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1',
    ),
    false,
  )
})

test('ipRateLimitKey uses an IPv4 address as-is', () => {
  assert.equal(ipRateLimitKey('203.0.113.7'), '203.0.113.7')
})

test('ipRateLimitKey unwraps an IPv4-mapped IPv6 address', () => {
  assert.equal(ipRateLimitKey('::ffff:203.0.113.7'), '203.0.113.7')
})

test('ipRateLimitKey cuts a full IPv6 address to its /64', () => {
  assert.equal(
    ipRateLimitKey('2001:db8:85a3:1234:aaaa:bbbb:cccc:dddd'),
    '2001:db8:85a3:1234::/64',
  )
})

test('ipRateLimitKey groups addresses in the same /64 and separates different ones', () => {
  const a = ipRateLimitKey('2001:db8:85a3:1234:0000:0000:0000:0001')
  const b = ipRateLimitKey('2001:db8:85a3:1234:ffff:ffff:ffff:ffff')
  const c = ipRateLimitKey('2001:db8:85a3:9999:0000:0000:0000:0001')
  assert.equal(a, b)
  assert.notEqual(a, c)
})

test('ipRateLimitKey expands :: shorthand', () => {
  assert.equal(ipRateLimitKey('2001:db8::1'), '2001:db8:0:0::/64')
})

test('ipRateLimitKey normalises case and leading zeros', () => {
  assert.equal(ipRateLimitKey('2001:0DB8:0000:0000::1'), ipRateLimitKey('2001:db8::1'))
})

test('ipRateLimitKey drops a zone id, and handles loopback', () => {
  assert.equal(ipRateLimitKey('fe80::1%eth0'), 'fe80:0:0:0::/64')
  assert.equal(ipRateLimitKey('::1'), '0:0:0:0::/64')
})
