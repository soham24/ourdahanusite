import assert from 'node:assert/strict'
import test from 'node:test'
import { createHaptics } from './haptics'

test('haptics vibrate only when enabled, supported, and visible', () => {
  const calls: number[][] = []
  const haptics = createHaptics((pattern) => { calls.push([...pattern]); return true }, () => true)
  haptics.play('catch', true)
  haptics.play('damage', false)
  assert.deepEqual(calls, [[12]])
})

test('haptics do not vibrate while the document is hidden', () => {
  const calls: number[][] = []
  const haptics = createHaptics((pattern) => { calls.push([...pattern]); return true }, () => false)

  haptics.play('catch', true)

  assert.deepEqual(calls, [])
})

test('unsupported haptics never throw', () => {
  assert.doesNotThrow(() => createHaptics(undefined, () => true).play('gameOver', true))
})
