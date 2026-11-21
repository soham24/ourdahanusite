import assert from 'node:assert/strict'
import test from 'node:test'

import { checkCode, CODE_ATTEMPT_LIMIT, type CompetitionDeps } from './game-competition-core'

function makeDeps(overrides: Partial<CompetitionDeps> = {}) {
  const calls = { blocked: 0, wrong: 0, findActive: 0 }
  const deps: CompetitionDeps = {
    today: () => '2026-11-21',
    findActive: async () => {
      calls.findActive++
      return { id: 'c1', code: 'MANGO7' }
    },
    hasDisplayName: async () => true,
    attemptsBlocked: () => {
      calls.blocked++
      return false
    },
    recordWrongAttempt: () => {
      calls.wrong++
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
  assert.equal(calls.blocked, 0)
})

test('rate limited attempts do not look up the competition', async () => {
  const { deps, calls } = makeDeps({ attemptsBlocked: () => true })
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

test('wrong code is recorded, right code is not', async () => {
  const { deps, calls } = makeDeps()
  await checkCode('u1', 'MANGO7', deps)
  assert.equal(calls.wrong, 0)
  await checkCode('u1', 'WRONG1', deps)
  assert.equal(calls.wrong, 1)
})

function counterDeps() {
  const wrong = new Map<string, number>()
  const { deps } = makeDeps({
    attemptsBlocked: (u) => (wrong.get(u) ?? 0) >= CODE_ATTEMPT_LIMIT,
    recordWrongAttempt: (u) => wrong.set(u, (wrong.get(u) ?? 0) + 1),
  })
  return deps
}

test('20 consecutive correct-code checks are never refused', async () => {
  const deps = counterDeps()
  for (let i = 0; i < 20; i++) {
    assert.deepEqual(await checkCode('u1', 'MANGO7', deps), { ok: true, competitionId: 'c1' })
  }
})

test('after 10 wrong codes the 11th check, even with the right code, is too_many', async () => {
  const deps = counterDeps()
  for (let i = 0; i < CODE_ATTEMPT_LIMIT; i++) {
    const r = await checkCode('u1', 'WRONG1', deps)
    assert.equal(!r.ok && r.reason, 'wrong_code')
  }
  const r = await checkCode('u1', 'MANGO7', deps)
  assert.equal(!r.ok && r.reason, 'too_many')
})
