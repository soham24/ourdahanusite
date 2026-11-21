import { test } from 'node:test'
import assert from 'node:assert/strict'

import { isUuid, readOrThrow } from './read'

test('returns the data of a successful read, including an empty one', () => {
  assert.deepEqual(readOrThrow({ data: [{ id: 1 }], error: null }, 'rows'), [{ id: 1 }])
  assert.equal(readOrThrow({ data: null, error: null }, 'one row'), null)
})

test('throws on a failed read instead of passing it off as no rows', () => {
  assert.throws(
    () => readOrThrow({ data: null, error: { message: 'fetch failed' } }, 'listings'),
    /Could not read listings: fetch failed/,
  )
})

test('recognises row ids and rejects anything else from a URL', () => {
  assert.equal(isUuid('9b41821d-bfa9-4cbd-b868-6a1bc5b213fe'), true)
  assert.equal(isUuid('9B41821D-BFA9-4CBD-B868-6A1BC5B213FE'), true)
  for (const bad of ['', 'garbage', '123', '9b41821d-bfa9-4cbd-b868-6a1bc5b213fe/extra', "' or 1=1 --"]) {
    assert.equal(isUuid(bad), false, bad)
  }
})

test('during next build a failed read stays empty, so builds without a database succeed', () => {
  const before = process.env.NEXT_PHASE
  process.env.NEXT_PHASE = 'phase-production-build'
  try {
    assert.equal(readOrThrow({ data: null, error: { message: 'fetch failed' } }, 'listings'), null)
  } finally {
    if (before === undefined) delete process.env.NEXT_PHASE
    else process.env.NEXT_PHASE = before
  }
})
