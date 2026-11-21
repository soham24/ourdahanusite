import { test } from 'node:test'
import assert from 'node:assert/strict'

import { fetchWithTimeout } from './fetch-timeout'

// A fetch that never answers on its own: it settles only when its signal aborts.
const hangingFetch: typeof fetch = (_input, init) =>
  new Promise((_resolve, reject) => {
    init?.signal?.addEventListener('abort', () => reject(init.signal?.reason))
  })

test('gives up on a request that never answers', async () => {
  const started = Date.now()
  await assert.rejects(fetchWithTimeout(50, hangingFetch)('https://example.test'), { name: 'TimeoutError' })
  assert.ok(Date.now() - started < 2_000)
})

test("still honours the caller's own abort signal", async () => {
  const controller = new AbortController()
  const pending = fetchWithTimeout(60_000, hangingFetch)('https://example.test', { signal: controller.signal })
  controller.abort(new Error('caller cancelled'))
  await assert.rejects(pending, /caller cancelled/)
})

test('passes the request through untouched otherwise', async () => {
  let seen: RequestInit | undefined
  const echo: typeof fetch = async (_input, init) => {
    seen = init
    return new Response('ok')
  }
  const res = await fetchWithTimeout(1_000, echo)('https://example.test', { method: 'POST', body: 'x' })
  assert.equal(await res.text(), 'ok')
  assert.equal(seen?.method, 'POST')
  assert.equal(seen?.body, 'x')
  assert.ok(seen?.signal instanceof AbortSignal)
})
