import { test } from 'node:test'
import assert from 'node:assert/strict'

import { isLocalSupabaseUrl } from './local-supabase'

test('the local stack counts as local', () => {
  assert.equal(isLocalSupabaseUrl('http://127.0.0.1:54321'), true)
  assert.equal(isLocalSupabaseUrl('http://localhost:54321'), true)
})

test('hosted projects, lookalikes and junk do not', () => {
  for (const url of [
    'https://abcd.supabase.co',
    'https://127.0.0.1:54321',
    'http://127.0.0.1.evil.example',
    'http://localhost.evil.example:54321',
    'not a url',
    '',
    undefined,
    null,
  ]) {
    assert.equal(isLocalSupabaseUrl(url), false, String(url))
  }
})
