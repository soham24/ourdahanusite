import assert from 'node:assert/strict'
import test from 'node:test'
import { safelySubmit } from './safe-submission'

test('safe submission returns action results unchanged', async () => {
  const result = { ok: true as const }

  assert.equal(await safelySubmit(async () => result), result)
})

test('safe submission converts an action rejection into a friendly settled result', async () => {
  assert.deepEqual(
    await safelySubmit(async () => {
      throw new Error('server action digest')
    }),
    { error: 'Something went wrong while submitting. Please try again.' },
  )
})
