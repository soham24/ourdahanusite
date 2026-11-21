// Guards the fix for the homepage hammering the database: on Vercel a plain
// 'use cache' is a per-instance in-memory store, so public readers that run at
// request time must use the shared 'use cache: remote' handler.
import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import test from 'node:test'

const here = new URL('./', import.meta.url)
const plainUseCache = /^\s*['"]use cache['"]\s*;?\s*$/m

test('public data readers use the shared remote cache', () => {
  const offenders = readdirSync(here)
    .filter((name) => name.endsWith('.ts') && !name.endsWith('.test.ts'))
    .filter((name) => plainUseCache.test(readFileSync(new URL(name, here), 'utf8')))
  assert.deepEqual(offenders, [], `use 'use cache: remote' in: ${offenders.join(', ')}`)
})

test('directory data uses the shared remote cache too', () => {
  const source = readFileSync(new URL('../../app/listings/directory-data.ts', here), 'utf8')
  assert.ok(!plainUseCache.test(source))
})

test('a poll vote does not throw away the cached homepage', () => {
  const source = readFileSync(new URL('../cache-tags.ts', here), 'utf8')
  const pollsHelper = source.slice(source.indexOf('export function revalidatePollsCache'))
  const body = pollsHelper.slice(0, pollsHelper.indexOf('\n}'))
  assert.ok(!body.includes('CACHE_TAGS.home'), body)
})
