import assert from 'node:assert/strict'
import test from 'node:test'
import { GAME_CONFIG, getDifficulty, scoreFor } from './config'
import { createGameEngine } from './engine'
import { mulberry32 } from './random'
import type { GameEngine } from './engine'
import type { GameEvent } from './types'

function advance(engine: GameEngine, totalMs: number): GameEvent[] {
  const events: GameEvent[] = []
  let remaining = totalMs
  while (remaining > 0) {
    const stepMs = Math.min(GAME_CONFIG.fixedStepMs, remaining)
    events.push(...engine.step(stepMs))
    remaining -= stepMs
  }
  return events
}

function advanceUntil(engine: GameEngine, predicate: () => boolean, maxMs = 120_000): GameEvent[] {
  const events: GameEvent[] = []
  for (let elapsed = 0; elapsed < maxMs && !predicate(); elapsed += GAME_CONFIG.fixedStepMs) {
    events.push(...engine.step(GAME_CONFIG.fixedStepMs))
  }
  assert.equal(predicate(), true, 'condition was not reached before the simulation deadline')
  return events
}

function sequenceRandom(values: readonly number[]): () => number {
  let index = 0
  return () => values[index++ % values.length]
}

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

test('engine follows clamped pointer input and advances active time', () => {
  const engine = createGameEngine(() => 0.5)
  engine.setInput({ targetX: 999, left: false, right: false })
  engine.step(100)
  const state = engine.snapshot()
  assert.equal(state.activeMs, 100)
  assert.ok(state.basketX <= GAME_CONFIG.width - GAME_CONFIG.basketWidth / 2)
})

test('five consecutive ripe catches earn one capped combo point', () => {
  const engine = createGameEngine(() => 0.5)
  engine.setInput({ targetX: GAME_CONFIG.width / 2, left: false, right: false })
  advanceUntil(engine, () => engine.snapshot().catches >= 5)
  const state = engine.snapshot()
  assert.equal(state.catches, 5)
  assert.equal(state.combo, 5)
  assert.equal(state.bonus, 1)
  assert.equal(state.score, 6)
})

test('a miss resets combo and three misses end the round once', () => {
  const engine = createGameEngine(() => 0.5)
  engine.setInput({ targetX: GAME_CONFIG.width, left: false, right: false })
  const events = advanceUntil(engine, () => engine.snapshot().gameOver)
  assert.equal(engine.snapshot().misses, 3)
  assert.equal(engine.snapshot().gameOver, true)
  assert.equal(events.filter((event) => event.type === 'gameOver').length, 1)
})

test('three rotten catches end the round without adding score', () => {
  const engine = createGameEngine(sequenceRandom([0.5, 0, 0.5, 0.5, 0.5]))
  engine.setInput({ targetX: GAME_CONFIG.width / 2, left: false, right: false })
  advanceUntil(engine, () => engine.snapshot().gameOver)
  assert.equal(engine.snapshot().badCatches, 3)
  assert.equal(engine.snapshot().score, 0)
  assert.equal(engine.snapshot().gameOver, true)
})

test('phase changes emit one transition event', () => {
  const engine = createGameEngine(() => 0.5)
  const before = advance(engine, 14_999)
  const after = advance(engine, 1)
  assert.equal(before.some((event) => event.type === 'phaseChanged'), false)
  assert.deepEqual(after.find((event) => event.type === 'phaseChanged'), {
    type: 'phaseChanged',
    phase: 'flow',
  })
})

test('reset clears a completed round and preserves no entity references', () => {
  const engine = createGameEngine(() => 0.5)
  advanceUntil(engine, () => engine.snapshot().items.length > 0)
  const before = engine.snapshot()
  engine.reset()
  const after = engine.snapshot()
  assert.equal(after.items.length, 0)
  assert.equal(after.score, 0)
  assert.notEqual(before.items, after.items)
})
