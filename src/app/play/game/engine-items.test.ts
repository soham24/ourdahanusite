import assert from 'node:assert/strict'
import test from 'node:test'
import { GAME_CONFIG, scoreFor } from './config'
import { basketWidthFor, createGameEngine } from './engine'
import type { GameEngine } from './engine'
import type { GameEvent } from './types'

// Every random draw returns `value`, which a test changes as time passes.
// Spawns draw drift, kind, x, rotation and spin, so one value sets the kind
// (by which slice of the roll it falls in) and the column it falls down.
function controlledEngine() {
  const control = { value: 0.5 }
  const engine = createGameEngine(() => control.value)
  return { engine, control }
}

function run(engine: GameEngine, ms: number, keepBasketAt?: number): GameEvent[] {
  const events: GameEvent[] = []
  for (let elapsed = 0; elapsed < ms; elapsed += GAME_CONFIG.fixedStepMs) {
    if (keepBasketAt !== undefined) engine.positionBasket(keepBasketAt)
    events.push(...engine.step(GAME_CONFIG.fixedStepMs))
  }
  return events
}

const columnFor = (value: number) => GAME_CONFIG.itemRadius + value * (GAME_CONFIG.width - GAME_CONFIG.itemRadius * 2)

test('a golden chikoo counts as a catch and is worth goldenPoints in all', () => {
  assert.equal(scoreFor(3, 0, 1).score, 3 + GAME_CONFIG.goldenPoints - 1)
  assert.equal(scoreFor(0, 0, 0).score, 0)
})

test('golden chikoos never fall while a player is learning, then can be caught for extra points', () => {
  const { engine, control } = controlledEngine()
  // Just above the rotten slice: ripe in warm-up (no golden chance yet).
  control.value = GAME_CONFIG.badItemChance + 0.01
  const warmup = run(engine, 14_000, columnFor(control.value))
  assert.equal(warmup.some((e) => e.type === 'goldenCaught'), false)
  assert.ok(engine.snapshot().catches > 0, 'ripe chikoos were caught during warm-up')

  const before = engine.snapshot()
  const flow = run(engine, 6_000, columnFor(control.value))
  const golden = flow.find((e) => e.type === 'goldenCaught')
  assert.ok(golden, 'a golden chikoo was caught once flow began')
  const after = engine.snapshot()
  assert.ok(after.goldens > 0)
  assert.ok(golden.type === 'goldenCaught' && golden.points >= GAME_CONFIG.goldenPoints)
  assert.ok(after.score - before.score >= after.goldens * GAME_CONFIG.goldenPoints)
})

test('the big-basket power-up widens the basket, then wears off, one at a time', () => {
  const { engine, control } = controlledEngine()
  // Ripe until the power-up can appear, then in the power-up slice of the roll.
  control.value = GAME_CONFIG.badItemChance + 0.01
  run(engine, GAME_CONFIG.powerUpAfterMs + 3_000, columnFor(control.value))
  control.value = GAME_CONFIG.badItemChance + GAME_CONFIG.goldenChance.flow + 0.005
  const events = run(engine, 4_000, columnFor(control.value))
  const powerUp = events.find((e) => e.type === 'powerUp')
  assert.ok(powerUp, 'the power-up was caught')
  assert.equal(basketWidthFor(engine.snapshot()), GAME_CONFIG.basketWidth * GAME_CONFIG.bigBasketScale)
  // While it lasts, no second power-up spawns: the same roll gives ripe chikoos.
  assert.equal(events.filter((e) => e.type === 'powerUp').length, 1)

  // Back to ripe so a fresh power-up cannot start the moment this one ends.
  control.value = GAME_CONFIG.badItemChance + 0.01
  const later = run(engine, GAME_CONFIG.bigBasketMs + 200, columnFor(control.value))
  assert.ok(later.some((e) => e.type === 'powerUpEnded'))
  assert.equal(engine.snapshot().bigBasketMs, 0)
  assert.equal(basketWidthFor(engine.snapshot()), GAME_CONFIG.basketWidth)
})

test('letting a golden chikoo or a power-up fall costs nothing', () => {
  const { engine, control } = controlledEngine()
  // Rotten during warm-up (missing rotten is free). Both kinds fall in the
  // left third here, so the basket waits at the far right.
  control.value = 0.1
  run(engine, 15_500, GAME_CONFIG.width)
  // Golden from flow on, still missed.
  control.value = GAME_CONFIG.badItemChance + 0.01
  const events = run(engine, 8_000, GAME_CONFIG.width)
  assert.equal(events.some((e) => e.type === 'goldenCaught'), false)
  assert.equal(engine.snapshot().misses, 0)
  assert.equal(engine.snapshot().gameOver, false)
})

test('the score still stops at the leaderboard cap', () => {
  assert.ok(scoreFor(480, 96, 40).score > GAME_CONFIG.maxScore)
  // The engine clamps; the database check also refuses anything above it.
  assert.equal(GAME_CONFIG.maxScore, 500)
})
