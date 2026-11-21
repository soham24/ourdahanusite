import assert from 'node:assert/strict'
import test from 'node:test'
import { GAME_CONFIG, getDifficulty } from './config'
import { createGameEngine } from './engine'
import type { GameEngine } from './engine'
import type { GameEvent } from './types'

// Every random draw returns `value`, so one number sets both the kind of the
// next spawn (which slice of the roll it lands in) and the column it falls in.
function controlledEngine() {
  const control = { value: 0.5 }
  return { engine: createGameEngine(() => control.value), control }
}

/** A perfect player: always under the lowest thing worth catching. */
function run(engine: GameEngine, ms: number): GameEvent[] {
  const events: GameEvent[] = []
  for (let elapsed = 0; elapsed < ms; elapsed += GAME_CONFIG.fixedStepMs) {
    const wanted = engine.snapshot().items.filter((item) => item.kind !== 'rotten')
    const lowest = wanted.sort((a, b) => b.y - a.y)[0]
    if (lowest) engine.positionBasket(lowest.x)
    events.push(...engine.step(GAME_CONFIG.fixedStepMs))
  }
  return events
}

const RIPE = 0.5
// In flow: rotten below 0.22, golden to 0.255, then the top-up slice to 0.30,
// split evenly between the kinds that may fall.
const flowSlice = (part: number) => GAME_CONFIG.badItemChance + GAME_CONFIG.goldenChance.flow + GAME_CONFIG.powerUpChance * part

/** Plays perfectly past warm-up so the next spawns are in flow. */
function intoFlow() {
  const { engine, control } = controlledEngine()
  control.value = RIPE
  run(engine, 15_500)
  return { engine, control }
}

/** Catches the next spawn at `value`, then returns to ripe chikoos. */
function catchNext(engine: GameEngine, control: { value: number }, value: number, ms = 4_000): GameEvent[] {
  control.value = value
  const events = run(engine, ms)
  control.value = RIPE
  return events
}

test('double harvest doubles the points of every catch while it lasts', () => {
  const { engine, control } = intoFlow()
  // With no life lost, three kinds share the slice: the last third is double harvest.
  const events = catchNext(engine, control, flowSlice(0.9))
  assert.ok(events.some((e) => e.type === 'powerUp' && e.kind === 'doubleHarvest'))
  assert.ok(engine.snapshot().doubleHarvestMs > 0)

  const during = run(engine, 2_000).filter((e) => e.type === 'ripeCaught')
  assert.ok(during.length > 0)
  for (const catchEvent of during) assert.ok(catchEvent.type === 'ripeCaught' && (catchEvent.points ?? 0) >= 2)

  const later = run(engine, GAME_CONFIG.doubleHarvestMs)
  assert.ok(later.some((e) => e.type === 'powerUpEnded' && e.kind === 'doubleHarvest'))
  const after = run(engine, 2_000).filter((e) => e.type === 'ripeCaught')
  assert.ok(after.some((e) => e.type === 'ripeCaught' && e.points === 1))
})

test('monsoon breeze slows everything that is falling', () => {
  const { engine, control } = intoFlow()
  catchNext(engine, control, flowSlice(0.5))
  const snap = engine.snapshot()
  assert.ok(snap.slowFallMs > 0, 'the breeze is blowing')
  const item = snap.items[0]
  assert.ok(item, 'something is falling')
  engine.step(100)
  const moved = engine.snapshot().items.find((i) => i.id === item.id)!
  const expected = getDifficulty(engine.snapshot().activeMs).fallSpeed * GAME_CONFIG.slowFallFactor * 0.1
  assert.ok(Math.abs(moved.y - item.y - expected) < 1.5)
})

test('the heart only falls once a life is lost, and gives one back', () => {
  const { engine, control } = intoFlow()
  // No life lost: the last part of the slice is still double harvest, not a heart.
  const before = catchNext(engine, control, flowSlice(0.95))
  assert.equal(before.some((e) => e.type === 'powerUp' && e.kind === 'extraLife'), false)
  run(engine, GAME_CONFIG.doubleHarvestMs + 500)

  // Lose one: park the basket away until a ripe chikoo is missed.
  for (let i = 0; i < 2_000 && engine.snapshot().misses === 0; i += 1) {
    engine.positionBasket(GAME_CONFIG.width)
    engine.step(GAME_CONFIG.fixedStepMs)
  }
  assert.equal(engine.snapshot().misses, 1)
  run(engine, 1_500)

  // Now four kinds share the slice and its last quarter is the heart.
  const events = catchNext(engine, control, flowSlice(0.95))
  assert.ok(events.some((e) => e.type === 'powerUp' && e.kind === 'extraLife'))
  assert.ok(events.some((e) => e.type === 'lifeRestored' && e.source === 'powerUp'))
  assert.equal(engine.snapshot().misses, 0)
})

test('milestones fire once each; from 100 on they give back a lost life', () => {
  const { engine, control } = controlledEngine()
  control.value = RIPE
  // Lose one life early, then play perfectly.
  for (let i = 0; i < 3_000 && engine.snapshot().misses === 0; i += 1) {
    engine.positionBasket(0)
    engine.step(GAME_CONFIG.fixedStepMs)
  }
  assert.equal(engine.snapshot().misses, 1)

  const events: GameEvent[] = []
  for (let i = 0; i < 200_000 && engine.snapshot().score < 100; i += 1) {
    events.push(...run(engine, GAME_CONFIG.fixedStepMs))
  }
  const milestones = events.filter((e) => e.type === 'milestone').map((e) => e.type === 'milestone' && e.score)
  assert.deepEqual(milestones, [50, 100])
  const restored = events.filter((e) => e.type === 'lifeRestored')
  assert.equal(restored.length, 1, 'only the 100 milestone restores')
  assert.equal(engine.snapshot().misses, 0)
  // Already-passed milestones never repeat.
  const more = run(engine, 2_000)
  assert.equal(more.some((e) => e.type === 'milestone' && (e.score === 50 || e.score === 100)), false)
})
