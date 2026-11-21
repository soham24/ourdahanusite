import assert from 'node:assert/strict'
import test from 'node:test'

import { checkCode, type CompetitionDeps } from './game-competition-core'

function makeDeps(overrides: Partial<CompetitionDeps> = {}) {
  const calls = { allowAttempt: 0, findActive: 0 }
  const deps: CompetitionDeps = {
    today: () => '2026-11-21',
    findActive: async () => {
      calls.findActive++
      return { id: 'c1', code: 'MANGO7' }
    },
    hasDisplayName: async () => true,
    allowAttempt: () => {
      calls.allowAttempt++
      return true
    },
    ...overrides,
  }
  return { deps, calls }
}

test('right code in a different case is accepted', async () => {
  const { deps } = makeDeps()
  assert.deepEqual(await checkCode('u1', ' mango7 ', deps), { ok: true, competitionId: 'c1' })
})

test('wrong code is rejected', async () => {
  const { deps } = makeDeps()
  const r = await checkCode('u1', 'WRONG1', deps)
  assert.equal(r.ok, false)
  if (!r.ok) {
    assert.equal(r.reason, 'wrong_code')
    assert.equal(r.message, "That code didn't work. Check it and try again.")
  }
})

test('no active competition', async () => {
  const { deps } = makeDeps({ findActive: async () => null })
  const r = await checkCode('u1', 'MANGO7', deps)
  assert.equal(r.ok, false)
  if (!r.ok) {
    assert.equal(r.reason, 'no_competition')
    assert.equal(r.message, 'There is no competition running right now.')
  }
})

test('no display name stops before the rate limit', async () => {
  const { deps, calls } = makeDeps({ hasDisplayName: async () => false })
  const r = await checkCode('u1', 'MANGO7', deps)
  assert.equal(r.ok, false)
  if (!r.ok) {
    assert.equal(r.reason, 'need_name')
    assert.equal(r.message, 'Add a display name first so we can show you on the board.')
  }
  assert.equal(calls.allowAttempt, 0)
})

test('rate limited attempts do not look up the competition', async () => {
  const { deps, calls } = makeDeps({ allowAttempt: () => false })
  const r = await checkCode('u1', 'MANGO7', deps)
  assert.equal(r.ok, false)
  if (!r.ok) {
    assert.equal(r.reason, 'too_many')
    assert.equal(r.message, 'Too many tries. Please wait a few minutes.')
  }
  assert.equal(calls.findActive, 0)
})

test('code changed mid-day: old code no longer works', async () => {
  const { deps } = makeDeps({ findActive: async () => ({ id: 'c1', code: 'NEWCODE' }) })
  const r = await checkCode('u1', 'OLDCODE', deps)
  assert.equal(r.ok, false)
  if (!r.ok) assert.equal(r.reason, 'wrong_code')
})

test('findActive receives today from deps', async () => {
  let seen = ''
  const { deps } = makeDeps({ findActive: async (d) => { seen = d; return null } })
  await checkCode('u1', 'MANGO7', deps)
  assert.equal(seen, '2026-11-21')
})
