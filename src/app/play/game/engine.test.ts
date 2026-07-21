import assert from 'node:assert/strict'
import test from 'node:test'
import { GAME_CONFIG, getDifficulty, scoreFor } from './config'
import { mulberry32 } from './random'

test('difficulty is continuous, monotonic, phased, and capped', () => {
  const at0 = getDifficulty(0)
  const at14999 = getDifficulty(14_999)
  const at15000 = getDifficulty(15_000)
  const at40000 = getDifficulty(40_000)
  const at75000 = getDifficulty(75_000)
  const late = getDifficulty(600_000)

  assert.equal(at0.phase, 'warmup')
  assert.equal(at14999.phase, 'warmup')
  assert.equal(at15000.phase, 'flow')
  assert.equal(at40000.phase, 'rush')
  assert.equal(at75000.phase, 'harvestRush')
  assert.ok(at0.fallSpeed < at15000.fallSpeed)
  assert.ok(at15000.spawnIntervalMs > at40000.spawnIntervalMs)
  assert.equal(late.fallSpeed, GAME_CONFIG.maxFallSpeed)
  assert.equal(late.spawnIntervalMs, GAME_CONFIG.minSpawnIntervalMs)
  assert.ok(late.maxItems <= GAME_CONFIG.maxItems)
})

test('combo bonus never exceeds twenty percent of catches', () => {
  assert.deepEqual(scoreFor(4, 20), { bonus: 0, score: 4 })
  assert.deepEqual(scoreFor(5, 1), { bonus: 1, score: 6 })
  assert.deepEqual(scoreFor(10, 9), { bonus: 2, score: 12 })
})

test('seeded random sequence is repeatable', () => {
  const a = mulberry32(24)
  const b = mulberry32(24)
  assert.deepEqual([a(), a(), a()], [b(), b(), b()])
})
