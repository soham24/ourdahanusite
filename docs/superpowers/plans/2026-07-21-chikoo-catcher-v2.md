# Chikoo Catcher v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade the existing `/play` Chikoo Catcher prototype into a fast, polished Sunlit Orchard arcade game with progressive difficulty, combos, animation, adaptive sound, optional haptics, fullscreen/focus mode, robust interruption handling, and the existing leaderboard flow.

**Architecture:** Keep `page.tsx` and leaderboard fetching server-rendered, with one focused client boundary for the game. Move gameplay into a deterministic fixed-step engine; render it with high-DPI Canvas 2D; connect input, audio, haptics, fullscreen, persistence, and accessibility through small browser adapters. React owns coarse UI and submission states, never per-frame simulation state.

**Tech Stack:** Next.js 16.2.1 App Router, React 19.2.4, TypeScript 5, Canvas 2D, Web Audio, Fullscreen API, Vibration API, Tailwind CSS v4, `lucide-react`, Supabase, Node test runner through `tsx --test`. No new runtime dependency.

## Global Constraints

- Preserve the current public leaderboard, `chikoo_catcher` game identifier, authentication behavior, submission cooldown, and existing stored scores.
- Anyone may play; only signed-in users may save a score.
- Persisted score is ripe catches plus integer combo bonuses; total combo bonus is capped at 20% of ripe catches, rounded down.
- Three ripe misses or three rotten catches ends a round.
- No new game modes, missions, achievements, power-ups, inventory, meta-progression, game engine, animation library, or runtime audio library.
- Audio must begin only after a direct user gesture.
- Fullscreen must fall back to an in-page focus mode and must not be required to play.
- No forced orientation lock.
- Optional browser APIs must fail safely and never prevent a round from starting.
- Reduced quality may affect decoration only; it must never affect input, collisions, spawn timing, difficulty, or scoring.
- Follow the bundled Next.js 16 guidance in `node_modules/next/dist/docs/`; keep browser APIs below a narrow `'use client'` boundary and pass only serializable props from `page.tsx`.
- Preserve unrelated worktree changes. In particular, do not stage `.superpowers/` or `docs/superpowers/plans/2026-07-12-findourdahanu-admin-telegram-notifications.md`.

## File Structure

| File | Responsibility |
|---|---|
| `src/app/play/game/types.ts` | Shared engine, UI, event, settings, and capability types. |
| `src/app/play/game/config.ts` | Logical dimensions, scoring, phase thresholds, difficulty curve, and hard caps. |
| `src/app/play/game/random.ts` | Seeded deterministic random-number source for repeatable tests. |
| `src/app/play/game/engine.ts` | Pure fixed-step simulation and event generation. |
| `src/app/play/game/engine.test.ts` | Difficulty, spawning, collisions, combo, pause, and game-over tests. |
| `src/app/play/game/storage.ts` | Guarded, versioned game preferences. |
| `src/app/play/game/storage.test.ts` | Defaults, persistence, and corrupt-value tests. |
| `src/app/play/game/haptics.ts` | Named vibration patterns behind a safe adapter. |
| `src/app/play/game/haptics.test.ts` | Unsupported, disabled, hidden, and enabled behavior. |
| `src/app/play/game/fullscreen.ts` | Fullscreen request/exit and focus-mode fallback. |
| `src/app/play/game/fullscreen.test.ts` | Native success, native rejection, fallback, and exit behavior. |
| `src/app/play/game/audio.ts` | Lazy Web Audio effects and adaptive rhythm. |
| `src/app/play/game/renderer.ts` | Orchard, fruit, basket, particles, effects, DPR scaling, and quality levels. |
| `src/app/play/game/renderer.test.ts` | Quality-controller hysteresis and render-scale caps. |
| `src/app/play/GameHud.tsx` | Accessible playing-state HUD and controls. |
| `src/app/play/GameOverlay.tsx` | Ready, countdown, paused, and game-over UI. |
| `src/app/play/ChikooCatcherGame.tsx` | Engine lifecycle, browser adapters, RAF loop, announcements, and submission. |
| `src/app/play/Leaderboard.tsx` | Existing leaderboard with Sunlit Orchard presentation polish. |
| `src/app/play/page.tsx` | Existing server data flow and updated page shell/copy. |
| `src/app/play/game.css` | Game-only responsive, fullscreen, focus-mode, overlay, and reduced-motion styles. |
| `src/app/actions/game.ts` | Shared v2 maximum-score validation only; retain all other behavior. |
| `package.json` | Add game tests to the repeatable test command. |

---

### Task 1: Establish the deterministic game contract and difficulty curve

**Files:**
- Create: `src/app/play/game/types.ts`
- Create: `src/app/play/game/config.ts`
- Create: `src/app/play/game/random.ts`
- Create: `src/app/play/game/engine.test.ts`
- Modify: `package.json:5-11`

**Interfaces:**
- Produces: `GameEngineState`, `GameSnapshot`, `GameEvent`, `InputState`, `GamePhase`, `GameSettings`, `Difficulty`, `GAME_CONFIG`, `getDifficulty(activeMs)`, `scoreFor(catches, rawBonus)`, `mulberry32(seed)`.
- Consumes: no new application interfaces.

- [ ] **Step 1: Add a dedicated repeatable test command**

Change the scripts block to keep the existing suite intact and add game tests:

```json
"scripts": {
  "dev": "next dev",
  "build": "next build",
  "start": "next start",
  "lint": "eslint",
  "test": "npm run test:existing && npm run test:game",
  "test:existing": "tsx --test src/app/actions/find-notifications.test.ts src/lib/find/safe-submission.test.ts src/lib/supabase/auth-regression.test.ts",
  "test:game": "tsx --test src/app/play/game/*.test.ts"
}
```

- [ ] **Step 2: Define the shared types before implementation**

Create `types.ts` with these exact public contracts:

```ts
export type GamePhase = 'warmup' | 'flow' | 'rush' | 'harvestRush'
export type PlayState = 'ready' | 'countdown' | 'playing' | 'paused' | 'gameOver'
export type SubmitState = 'idle' | 'saving' | 'saved' | 'best' | 'error'
export type ItemKind = 'ripe' | 'rotten'
export type QualityLevel = 'high' | 'reduced'

export interface FallingItem {
  id: number
  kind: ItemKind
  x: number
  y: number
  vx: number
  rotation: number
  spin: number
}

export interface InputState {
  targetX: number | null
  left: boolean
  right: boolean
}

export interface Difficulty {
  phase: GamePhase
  fallSpeed: number
  spawnIntervalMs: number
  maxItems: number
  driftChance: number
  maxDriftSpeed: number
}

export interface GameEngineState {
  activeMs: number
  spawnElapsedMs: number
  basketX: number
  basketVelocity: number
  items: FallingItem[]
  catches: number
  combo: number
  rawComboBonus: number
  bonus: number
  score: number
  misses: number
  badCatches: number
  phase: GamePhase
  nextItemId: number
  gameOver: boolean
}

export interface GameSnapshot extends Readonly<GameEngineState> {}

export type GameEvent =
  | { type: 'ripeCaught'; x: number; y: number; combo: number; bonusAwarded: number }
  | { type: 'rottenCaught'; x: number; y: number }
  | { type: 'ripeMissed'; x: number }
  | { type: 'phaseChanged'; phase: GamePhase }
  | { type: 'gameOver'; score: number }

export interface GameSettings {
  sound: boolean
  haptics: boolean
  reducedEffects: boolean
}
```

- [ ] **Step 3: Write failing curve, scoring, and RNG tests**

Add these cases to `engine.test.ts`:

```ts
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
```

- [ ] **Step 4: Add compile-only sentinels, then verify genuine test failures**

Because a missing-module error does not prove an assertion, add only these sentinel exports after the tests exist:

```ts
// config.ts — RED-only scaffold, replaced in Step 5
export const GAME_CONFIG = { maxFallSpeed: 0, minSpawnIntervalMs: 0, maxItems: 0 }
export function getDifficulty(): never { throw new Error('getDifficulty not implemented') }
export function scoreFor(): never { throw new Error('scoreFor not implemented') }
```

```ts
// random.ts — RED-only scaffold, replaced in Step 5
export type RandomSource = () => number
export function mulberry32(): never { throw new Error('mulberry32 not implemented') }
```

Run: `npm run test:game`

Expected: three failing tests whose output names the deliberately unimplemented function each test exercises. This one-time scaffold exception is approved so RED is an actual test failure rather than a loader error.

- [ ] **Step 5: Replace the sentinels with constants, curve, scoring, and seeded random**

Create `config.ts`:

```ts
import type { Difficulty, GamePhase } from './types'

export const GAME_CONFIG = {
  width: 360,
  height: 640,
  basketWidth: 76,
  basketHeight: 34,
  basketY: 574,
  itemRadius: 17,
  maxMisses: 3,
  maxBadCatches: 3,
  badItemChance: 0.22,
  keyboardSpeed: 330,
  basketFollowRate: 18,
  baseFallSpeed: 120,
  maxFallSpeed: 380,
  baseSpawnIntervalMs: 900,
  minSpawnIntervalMs: 380,
  baseMaxItems: 5,
  maxItems: 10,
  maxDriftSpeed: 42,
  comboMilestone: 5,
  fixedStepMs: 1000 / 120,
  maxCatchUpSteps: 8,
  maxScore: 500,
} as const

function phaseFor(activeMs: number): GamePhase {
  if (activeMs < 15_000) return 'warmup'
  if (activeMs < 40_000) return 'flow'
  if (activeMs < 75_000) return 'rush'
  return 'harvestRush'
}

export function getDifficulty(activeMs: number): Difficulty {
  const progress = Math.min(1, Math.max(0, activeMs) / 120_000)
  const eased = 1 - Math.pow(1 - progress, 2)
  const phase = phaseFor(activeMs)
  return {
    phase,
    fallSpeed: Math.min(
      GAME_CONFIG.maxFallSpeed,
      GAME_CONFIG.baseFallSpeed + (GAME_CONFIG.maxFallSpeed - GAME_CONFIG.baseFallSpeed) * eased,
    ),
    spawnIntervalMs: Math.max(
      GAME_CONFIG.minSpawnIntervalMs,
      GAME_CONFIG.baseSpawnIntervalMs -
        (GAME_CONFIG.baseSpawnIntervalMs - GAME_CONFIG.minSpawnIntervalMs) * eased,
    ),
    maxItems: Math.min(
      GAME_CONFIG.maxItems,
      Math.floor(GAME_CONFIG.baseMaxItems + (GAME_CONFIG.maxItems - GAME_CONFIG.baseMaxItems) * eased),
    ),
    driftChance: phase === 'warmup' ? 0 : phase === 'flow' ? 0.12 : phase === 'rush' ? 0.25 : 0.35,
    maxDriftSpeed: GAME_CONFIG.maxDriftSpeed * eased,
  }
}

export function scoreFor(catches: number, rawBonus: number): { bonus: number; score: number } {
  const bonus = Math.min(Math.max(0, rawBonus), Math.floor(Math.max(0, catches) * 0.2))
  return { bonus, score: Math.max(0, catches) + bonus }
}
```

Create `random.ts`:

```ts
export type RandomSource = () => number

export function mulberry32(seed: number): RandomSource {
  let value = seed >>> 0
  return () => {
    value += 0x6d2b79f5
    let next = value
    next = Math.imul(next ^ (next >>> 15), next | 1)
    next ^= next + Math.imul(next ^ (next >>> 7), next | 61)
    return ((next ^ (next >>> 14)) >>> 0) / 4294967296
  }
}
```

- [ ] **Step 6: Run tests and static checks**

Run: `npm run test:game && npx tsc --noEmit && npx eslint src/app/play/game/types.ts src/app/play/game/config.ts src/app/play/game/random.ts src/app/play/game/engine.test.ts`

Expected: all three tests pass; TypeScript and ESLint produce no errors.

- [ ] **Step 7: Commit**

```bash
git add package.json src/app/play/game/types.ts src/app/play/game/config.ts src/app/play/game/random.ts src/app/play/game/engine.test.ts
git commit -m "test(game): define v2 engine contract and difficulty"
```

---

### Task 2: Build the pure fixed-step game engine

**Files:**
- Create: `src/app/play/game/engine.ts`
- Modify: `src/app/play/game/engine.test.ts`

**Interfaces:**
- Consumes: `GAME_CONFIG`, `getDifficulty`, `scoreFor`, `RandomSource`, and types from Task 1.
- Produces: `createGameEngine(random?)` returning `GameEngine` with `reset()`, `setInput(input)`, `step(dtMs)`, and `snapshot()`.

- [ ] **Step 1: Add failing public-behavior tests**

Append tests that use only this interface:

```ts
import { createGameEngine } from './engine'
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
```

Every test drives only the same public input and time-advance API used by the browser. No test-only production method is permitted.

- [ ] **Step 2: Run tests and confirm engine cases fail**

Run: `npm run test:game`

Expected: FAIL because `createGameEngine` does not exist.

- [ ] **Step 3: Implement the engine with a single authoritative state**

Create `engine.ts` with this public API and rules:

```ts
import { GAME_CONFIG, getDifficulty, scoreFor } from './config'
import type { RandomSource } from './random'
import type { FallingItem, GameEngineState, GameEvent, GameSnapshot, InputState } from './types'

export interface GameEngine {
  reset(): void
  setInput(input: InputState): void
  step(dtMs: number): GameEvent[]
  snapshot(): GameSnapshot
}

const initialState = (): GameEngineState => ({
  activeMs: 0,
  spawnElapsedMs: 0,
  basketX: GAME_CONFIG.width / 2,
  basketVelocity: 0,
  items: [],
  catches: 0,
  combo: 0,
  rawComboBonus: 0,
  bonus: 0,
  score: 0,
  misses: 0,
  badCatches: 0,
  phase: 'warmup',
  nextItemId: 0,
  gameOver: false,
})

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

export function createGameEngine(random: RandomSource = Math.random): GameEngine {
  let state = initialState()
  let input: InputState = { targetX: null, left: false, right: false }

  const snapshot = (): GameSnapshot => ({ ...state, items: state.items.map((item) => ({ ...item })) })

  const reset = () => {
    state = initialState()
    input = { targetX: null, left: false, right: false }
  }

  const setInput = (next: InputState) => {
    input = { ...next }
  }

  const spawn = () => {
    const difficulty = getDifficulty(state.activeMs)
    if (state.items.length >= difficulty.maxItems) return
    const drift = random() < difficulty.driftChance
    state.items.push({
      id: state.nextItemId++,
      kind: random() < GAME_CONFIG.badItemChance ? 'rotten' : 'ripe',
      x: GAME_CONFIG.itemRadius + random() * (GAME_CONFIG.width - GAME_CONFIG.itemRadius * 2),
      y: -GAME_CONFIG.itemRadius,
      vx: drift ? (random() * 2 - 1) * difficulty.maxDriftSpeed : 0,
      rotation: random() * Math.PI * 2,
      spin: (random() * 2 - 1) * 1.8,
    })
  }

  const step = (dtMs: number): GameEvent[] => {
    if (state.gameOver || dtMs <= 0) return []
    const events: GameEvent[] = []
    const dt = Math.min(dtMs, 250)
    const seconds = dt / 1000
    const previousPhase = state.phase
    state.activeMs += dt
    const difficulty = getDifficulty(state.activeMs)
    state.phase = difficulty.phase
    if (previousPhase !== state.phase) events.push({ type: 'phaseChanged', phase: state.phase })

    const minX = GAME_CONFIG.basketWidth / 2
    const maxX = GAME_CONFIG.width - minX
    const previousX = state.basketX
    if (input.targetX !== null) {
      const blend = 1 - Math.exp(-GAME_CONFIG.basketFollowRate * seconds)
      state.basketX += (clamp(input.targetX, minX, maxX) - state.basketX) * blend
    } else {
      const direction = Number(input.right) - Number(input.left)
      state.basketX = clamp(state.basketX + direction * GAME_CONFIG.keyboardSpeed * seconds, minX, maxX)
    }
    state.basketVelocity = (state.basketX - previousX) / Math.max(seconds, 0.0001)

    state.spawnElapsedMs += dt
    while (state.spawnElapsedMs >= difficulty.spawnIntervalMs) {
      state.spawnElapsedMs -= difficulty.spawnIntervalMs
      spawn()
    }

    const remaining: FallingItem[] = []
    for (const item of state.items) {
      const moved = {
        ...item,
        x: clamp(item.x + item.vx * seconds, GAME_CONFIG.itemRadius, GAME_CONFIG.width - GAME_CONFIG.itemRadius),
        y: item.y + difficulty.fallSpeed * seconds,
        rotation: item.rotation + item.spin * seconds,
      }
      const caught =
        moved.y + GAME_CONFIG.itemRadius >= GAME_CONFIG.basketY &&
        moved.y - GAME_CONFIG.itemRadius <= GAME_CONFIG.basketY + GAME_CONFIG.basketHeight &&
        Math.abs(moved.x - state.basketX) <= GAME_CONFIG.basketWidth * 0.54

      if (caught && item.kind === 'ripe') {
        state.catches += 1
        state.combo += 1
        const milestone = state.combo % GAME_CONFIG.comboMilestone === 0
        if (milestone) state.rawComboBonus += 1
        const nextScore = scoreFor(state.catches, state.rawComboBonus)
        const bonusAwarded = nextScore.bonus - state.bonus
        state.bonus = nextScore.bonus
        state.score = nextScore.score
        events.push({ type: 'ripeCaught', x: moved.x, y: moved.y, combo: state.combo, bonusAwarded })
        continue
      }
      if (caught && item.kind === 'rotten') {
        state.badCatches += 1
        state.combo = 0
        events.push({ type: 'rottenCaught', x: moved.x, y: moved.y })
        continue
      }
      if (moved.y - GAME_CONFIG.itemRadius > GAME_CONFIG.height) {
        if (item.kind === 'ripe') {
          state.misses += 1
          state.combo = 0
          events.push({ type: 'ripeMissed', x: moved.x })
        }
        continue
      }
      remaining.push(moved)
    }
    state.items = remaining

    if (state.misses >= GAME_CONFIG.maxMisses || state.badCatches >= GAME_CONFIG.maxBadCatches) {
      state.gameOver = true
      events.push({ type: 'gameOver', score: state.score })
    }
    return events
  }

  return {
    reset,
    setInput,
    step,
    snapshot,
  }
}
```

- [ ] **Step 4: Run the focused tests and adjust only proven edge cases**

Run: `npm run test:game`

Expected: every Task 1 and Task 2 test passes. If a test exposes a boundary error, correct the engine and keep the regression test; do not change the approved rules to make the test pass.

- [ ] **Step 5: Run static checks and commit**

Run: `npx tsc --noEmit && npx eslint src/app/play/game/engine.ts src/app/play/game/engine.test.ts`

Expected: no errors or warnings.

```bash
git add src/app/play/game/engine.ts src/app/play/game/engine.test.ts
git commit -m "feat(game): add deterministic v2 simulation engine"
```

---

### Task 3: Add preferences, haptics, fullscreen, and focus-mode adapters

**Files:**
- Create: `src/app/play/game/storage.ts`
- Create: `src/app/play/game/storage.test.ts`
- Create: `src/app/play/game/haptics.ts`
- Create: `src/app/play/game/haptics.test.ts`
- Create: `src/app/play/game/fullscreen.ts`
- Create: `src/app/play/game/fullscreen.test.ts`

**Interfaces:**
- Consumes: `GameSettings` from Task 1.
- Produces: `loadSettings(storage?, prefersReducedMotion?)`, `saveSettings(settings, storage?)`, `createHaptics(vibrate?, isVisible?)`, `enterImmersive(element, documentLike)`, and `exitImmersive(documentLike)`.

- [ ] **Step 1: Write failing adapter tests**

Cover these exact behaviors with Node fakes:

```ts
// storage.test.ts
import assert from 'node:assert/strict'
import test from 'node:test'
import { DEFAULT_SETTINGS, loadSettings, saveSettings } from './storage'

test('settings use safe defaults without storage', () => {
  assert.deepEqual(loadSettings(null), DEFAULT_SETTINGS)
})

test('settings recover from corrupt JSON', () => {
  const storage = { getItem: () => '{bad', setItem: () => undefined }
  assert.deepEqual(loadSettings(storage), DEFAULT_SETTINGS)
})

test('reduced-motion preference becomes the default until the player saves a choice', () => {
  const storage = { getItem: () => null, setItem: () => undefined }
  assert.equal(loadSettings(storage, true).reducedEffects, true)
})

test('settings round-trip through the versioned key', () => {
  const values = new Map<string, string>()
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => void values.set(key, value),
  }
  const settings = { sound: false, haptics: true, reducedEffects: true }
  saveSettings(settings, storage)
  assert.deepEqual(loadSettings(storage), settings)
})
```

```ts
// haptics.test.ts
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

test('unsupported haptics never throw', () => {
  assert.doesNotThrow(() => createHaptics(undefined, () => true).play('gameOver', true))
})
```

```ts
// fullscreen.test.ts
import assert from 'node:assert/strict'
import test from 'node:test'
import { enterImmersive, exitImmersive } from './fullscreen'

test('native fullscreen is preferred', async () => {
  let requested = false
  const result = await enterImmersive({ requestFullscreen: async () => { requested = true } }, {})
  assert.equal(requested, true)
  assert.equal(result, 'fullscreen')
})

test('rejected fullscreen falls back to focus mode', async () => {
  const result = await enterImmersive({ requestFullscreen: async () => { throw new Error('denied') } }, {})
  assert.equal(result, 'focus')
})

test('exit uses document exit only when native fullscreen is active', async () => {
  let exited = false
  await exitImmersive({ fullscreenElement: {}, exitFullscreen: async () => { exited = true } })
  assert.equal(exited, true)
})
```

- [ ] **Step 2: Run and verify the tests fail**

Run: `npm run test:game`

Expected: FAIL because the three adapter modules do not exist.

- [ ] **Step 3: Implement guarded adapters**

Use these exact exports:

```ts
// storage.ts
import type { GameSettings } from './types'

export const SETTINGS_KEY = 'ourdahanu:chikoo-catcher:v2'
export const DEFAULT_SETTINGS: GameSettings = {
  sound: true,
  haptics: true,
  reducedEffects: false,
}

export interface StorageLike {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

export function loadSettings(
  storage: StorageLike | null = typeof localStorage === 'undefined' ? null : localStorage,
  prefersReducedMotion = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches,
): GameSettings {
  if (!storage) return { ...DEFAULT_SETTINGS, reducedEffects: prefersReducedMotion }
  try {
    const value = JSON.parse(storage.getItem(SETTINGS_KEY) ?? 'null') as Partial<GameSettings> | null
    return {
      sound: typeof value?.sound === 'boolean' ? value.sound : DEFAULT_SETTINGS.sound,
      haptics: typeof value?.haptics === 'boolean' ? value.haptics : DEFAULT_SETTINGS.haptics,
      reducedEffects: typeof value?.reducedEffects === 'boolean' ? value.reducedEffects : prefersReducedMotion,
    }
  } catch {
    return { ...DEFAULT_SETTINGS, reducedEffects: prefersReducedMotion }
  }
}

export function saveSettings(settings: GameSettings, storage: StorageLike | null = typeof localStorage === 'undefined' ? null : localStorage): void {
  if (!storage) return
  try {
    storage.setItem(SETTINGS_KEY, JSON.stringify(settings))
  } catch {
    // Storage is optional; private browsing and quotas may reject writes.
  }
}
```

```ts
// haptics.ts
export type HapticCue = 'catch' | 'combo' | 'damage' | 'gameOver'
const PATTERNS: Record<HapticCue, number[]> = {
  catch: [12],
  combo: [18, 24, 18],
  damage: [45],
  gameOver: [35, 35, 70],
}

export function createHaptics(
  vibrate: ((pattern: number[]) => boolean) | undefined =
    typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function'
      ? undefined
      : navigator.vibrate.bind(navigator),
  isVisible: () => boolean = () => typeof document === 'undefined' || document.visibilityState === 'visible',
) {
  return {
    play(cue: HapticCue, enabled: boolean) {
      if (!enabled || !vibrate || !isVisible()) return
      try { vibrate(PATTERNS[cue]) } catch { /* Optional capability. */ }
    },
    stop() {
      try { vibrate?.([]) } catch { /* Optional capability. */ }
    },
  }
}
```

```ts
// fullscreen.ts
export type ImmersiveMode = 'none' | 'fullscreen' | 'focus'
type ElementLike = { requestFullscreen?: () => Promise<void> }
type DocumentLike = { fullscreenElement?: unknown; exitFullscreen?: () => Promise<void> }

export async function enterImmersive(element: ElementLike, _document: DocumentLike): Promise<ImmersiveMode> {
  if (!element.requestFullscreen) return 'focus'
  try {
    await element.requestFullscreen()
    return 'fullscreen'
  } catch {
    return 'focus'
  }
}

export async function exitImmersive(documentLike: DocumentLike): Promise<ImmersiveMode> {
  if (documentLike.fullscreenElement && documentLike.exitFullscreen) {
    try { await documentLike.exitFullscreen() } catch { /* State still returns to normal UI. */ }
  }
  return 'none'
}
```

- [ ] **Step 4: Run tests, type-check, lint, and commit**

Run: `npm run test:game && npx tsc --noEmit && npx eslint src/app/play/game/storage.ts src/app/play/game/storage.test.ts src/app/play/game/haptics.ts src/app/play/game/haptics.test.ts src/app/play/game/fullscreen.ts src/app/play/game/fullscreen.test.ts`

Expected: all tests and checks pass.

```bash
git add src/app/play/game/storage.ts src/app/play/game/storage.test.ts src/app/play/game/haptics.ts src/app/play/game/haptics.test.ts src/app/play/game/fullscreen.ts src/app/play/game/fullscreen.test.ts
git commit -m "feat(game): add immersive and feedback capability adapters"
```

---

### Task 4: Add lazy adaptive Web Audio

**Files:**
- Create: `src/app/play/game/audio.ts`
- Create: `src/app/play/game/audio.test.ts`

**Interfaces:**
- Consumes: `GamePhase` and engine events.
- Produces: `createGameAudio(factory?)` returning `unlock()`, `setEnabled()`, `setPhase()`, `play()`, `suspend()`, `resume()`, and `destroy()`.

- [ ] **Step 1: Write a failing lifecycle test with an injected fake context**

```ts
import assert from 'node:assert/strict'
import test from 'node:test'
import { createGameAudio } from './audio'

test('audio is lazy, respects mute, suspends, and closes', async () => {
  const calls: string[] = []
  const fake = {
    currentTime: 0,
    state: 'running',
    destination: {},
    createGain: () => ({ gain: { value: 1, setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {} }),
    createOscillator: () => ({ type: 'sine', frequency: { setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {}, start() { calls.push('start') }, stop() {} }),
    resume: async () => { calls.push('resume') },
    suspend: async () => { calls.push('suspend') },
    close: async () => { calls.push('close') },
  }
  const audio = createGameAudio(() => fake)
  assert.deepEqual(calls, [])
  await audio.unlock()
  audio.setEnabled(false)
  audio.play('catch')
  await audio.suspend()
  await audio.destroy()
  assert.equal(calls.includes('start'), false)
  assert.equal(calls.includes('suspend'), true)
  assert.equal(calls.includes('close'), true)
})
```

- [ ] **Step 2: Run and verify failure**

Run: `npm run test:game`

Expected: FAIL because `audio.ts` does not exist.

- [ ] **Step 3: Implement the injected audio controller**

`audio.ts` must:

```ts
import type { GamePhase } from './types'

export type AudioCue = 'countdown' | 'catch' | 'combo' | 'miss' | 'damage' | 'pause' | 'resume' | 'gameOver' | 'select'
export interface AudioController {
  unlock(): Promise<void>
  setEnabled(enabled: boolean): void
  setPhase(phase: GamePhase): void
  play(cue: AudioCue): void
  suspend(): Promise<void>
  resume(): Promise<void>
  destroy(): Promise<void>
}
```

Implement a private `tone(frequency, duration, volume, endFrequency)` helper with oscillator and gain nodes. Use this cue map:

```ts
const CUES: Record<AudioCue, readonly [number, number, number, number]> = {
  countdown: [440, 0.08, 0.05, 520],
  catch: [520, 0.07, 0.045, 680],
  combo: [660, 0.14, 0.06, 990],
  miss: [180, 0.12, 0.045, 130],
  damage: [120, 0.18, 0.07, 70],
  pause: [330, 0.08, 0.04, 260],
  resume: [330, 0.08, 0.04, 440],
  gameOver: [220, 0.4, 0.07, 90],
  select: [420, 0.05, 0.035, 500],
}
```

The controller must create its context only inside `unlock()`, catch construction/resume errors, schedule a quiet two-note rhythm with `window.setInterval` only while enabled and in `playing`, use phase intervals `{ warmup: 900, flow: 720, rush: 560, harvestRush: 420 }`, clear that interval on suspension/disable/destroy, and close the context on destroy. Keep the context factory injectable so the Node test never requires browser globals.

- [ ] **Step 4: Verify and commit**

Run: `npm run test:game && npx tsc --noEmit && npx eslint src/app/play/game/audio.ts src/app/play/game/audio.test.ts`

Expected: all tests and checks pass.

```bash
git add src/app/play/game/audio.ts src/app/play/game/audio.test.ts
git commit -m "feat(game): add adaptive Web Audio feedback"
```

---

### Task 5: Build the Sunlit Orchard renderer and adaptive quality controller

**Files:**
- Create: `src/app/play/game/renderer.ts`
- Create: `src/app/play/game/renderer.test.ts`

**Interfaces:**
- Consumes: `GameSnapshot`, `GameEvent`, `GameSettings`, `QualityLevel`, and `GAME_CONFIG`.
- Produces: `createRenderer(canvas)`, `getBackingScale(devicePixelRatio)`, and `createQualityController()`.

- [ ] **Step 1: Write failing pure performance-policy tests**

```ts
import assert from 'node:assert/strict'
import test from 'node:test'
import { createQualityController, getBackingScale } from './renderer'

test('canvas backing scale is capped at two', () => {
  assert.equal(getBackingScale(1), 1)
  assert.equal(getBackingScale(3), 2)
})

test('quality reduces after sustained slow frames and recovers slowly', () => {
  const quality = createQualityController()
  for (let index = 0; index < 90; index += 1) quality.observe(24)
  assert.equal(quality.current(), 'reduced')
  for (let index = 0; index < 240; index += 1) quality.observe(16)
  assert.equal(quality.current(), 'high')
})
```

- [ ] **Step 2: Run and verify failure**

Run: `npm run test:game`

Expected: FAIL because `renderer.ts` does not exist.

- [ ] **Step 3: Implement render scale and hysteresis exactly**

```ts
import { GAME_CONFIG } from './config'
import type { GameEvent, GameSettings, GameSnapshot, QualityLevel } from './types'

export const getBackingScale = (devicePixelRatio: number) => Math.min(2, Math.max(1, devicePixelRatio || 1))

export function createQualityController() {
  let level: QualityLevel = 'high'
  let slowFrames = 0
  let healthyFrames = 0
  return {
    observe(frameMs: number) {
      if (frameMs > 20) {
        slowFrames += 1
        healthyFrames = 0
      } else if (frameMs < 18) {
        healthyFrames += 1
        slowFrames = Math.max(0, slowFrames - 1)
      }
      if (level === 'high' && slowFrames >= 90) level = 'reduced'
      if (level === 'reduced' && healthyFrames >= 240) {
        level = 'high'
        slowFrames = 0
      }
    },
    current: () => level,
  }
}
```

- [ ] **Step 4: Implement the renderer behind a small contract**

Add this API in the same file:

```ts
export interface GameRenderer {
  resize(cssWidth: number, cssHeight: number, devicePixelRatio: number): void
  emit(events: readonly GameEvent[]): void
  render(snapshot: GameSnapshot, settings: GameSettings, frameMs: number): void
  clear(): void
  destroy(): void
}

export function createRenderer(canvas: HTMLCanvasElement): GameRenderer
```

Implementation requirements are exact:

- Keep the logical drawing space at `360 × 640`; scale the context from the CSS box into that space.
- Draw a sky gradient `#77C9E8 → #DDF3C7`, distant hills `#89A867`, two orchard canopy layers `#315C35` and `#21452D`, warm ground `#75502E → #3D2A19`, and a subtle sun glow `#FFD86A`.
- Apply pointer-driven parallax of at most 6 logical pixels only when quality is high and reduced effects is false.
- Draw ripe fruit as warm brown circles with highlight, stem, and leaf; draw rotten fruit with a desaturated irregular outline, dark spots, and a small visible pest mark.
- Draw the basket from rounded woven bands and a handle; lean it by `clamp(basketVelocity / 900, -0.12, 0.12)` radians.
- On `ripeCaught`, create at most 10 particles in high quality and 4 in reduced quality; on combo create a gold ring and `+1 COMBO` burst when `bonusAwarded > 0`.
- On damage, create a maximum 110ms camera shake of at most 5 logical pixels; skip shake for reduced effects.
- Keep at most 96 particles and 12 score bursts; reuse expired records rather than allowing arrays to grow.
- Render a danger-edge pulse for misses without covering incoming fruit.
- `destroy()` and `clear()` must empty all pools and remove any renderer-owned state.

Do not put score, buttons, or accessible status text in Canvas; those remain semantic DOM in Tasks 6 and 7.

- [ ] **Step 5: Verify renderer policy and commit**

Run: `npm run test:game && npx tsc --noEmit && npx eslint src/app/play/game/renderer.ts src/app/play/game/renderer.test.ts`

Expected: all tests and checks pass.

```bash
git add src/app/play/game/renderer.ts src/app/play/game/renderer.test.ts
git commit -m "feat(game): render the Sunlit Orchard experience"
```

---

### Task 6: Build the accessible HUD, overlays, and immersive CSS

**Files:**
- Create: `src/app/play/GameHud.tsx`
- Create: `src/app/play/GameOverlay.tsx`
- Create: `src/app/play/game.css`

**Interfaces:**
- Consumes: `GameSnapshot`, `GameSettings`, `PlayState`, `SubmitState`, `ImmersiveMode`, and callback props.
- Produces: presentational components with no engine or browser API ownership.

- [ ] **Step 1: Implement `GameHud` as a semantic, callback-only component**

Use this exact prop contract:

```tsx
import { Expand, Minimize, Pause, Volume2, VolumeX } from 'lucide-react'
import type { GameSnapshot } from './game/types'
import type { ImmersiveMode } from './game/fullscreen'

interface GameHudProps {
  snapshot: GameSnapshot
  soundEnabled: boolean
  immersiveMode: ImmersiveMode
  onPause(): void
  onToggleSound(): void
  onToggleImmersive(): void
}

export default function GameHud(props: GameHudProps) {
  const { snapshot } = props
  return (
    <div className="chikoo-hud" aria-label="Game status and controls">
      <div className="chikoo-hud__score"><span>Score</span><strong>{snapshot.score}</strong></div>
      <div className="chikoo-hud__combo" data-active={snapshot.combo >= 2}><span>Combo</span><strong>×{snapshot.combo}</strong></div>
      <div className="chikoo-hud__lives" aria-label={`${3 - snapshot.misses} misses and ${3 - snapshot.badCatches} bad catches remaining`}>
        <span aria-hidden="true">🟤 {3 - snapshot.misses}</span>
        <span aria-hidden="true">⚠ {3 - snapshot.badCatches}</span>
      </div>
      <div className="chikoo-hud__actions">
        <button type="button" onClick={props.onToggleSound} aria-label={props.soundEnabled ? 'Mute game sound' : 'Enable game sound'}>
          {props.soundEnabled ? <Volume2 aria-hidden="true" /> : <VolumeX aria-hidden="true" />}
        </button>
        <button type="button" onClick={props.onPause} aria-label="Pause game"><Pause aria-hidden="true" /></button>
        <button type="button" onClick={props.onToggleImmersive} aria-label={props.immersiveMode === 'none' ? 'Enter fullscreen' : 'Exit fullscreen'}>
          {props.immersiveMode === 'none' ? <Expand aria-hidden="true" /> : <Minimize aria-hidden="true" />}
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Implement `GameOverlay` with all explicit states**

Use a discriminated prop contract so impossible combinations cannot render:

```ts
type OverlayProps =
  | { state: 'ready'; settings: GameSettings; onPlay(): void; onToggleSound(): void; onToggleHaptics(): void; onToggleReducedEffects(): void; onToggleImmersive(): void }
  | { state: 'countdown'; count: 3 | 2 | 1 }
  | { state: 'paused'; settings: GameSettings; immersiveMode: ImmersiveMode; onResume(): void; onRestart(): void; onExit(): void; onToggleSound(): void; onToggleHaptics(): void; onToggleReducedEffects(): void }
  | { state: 'gameOver'; score: number; bestScore: number | null; submitState: SubmitState; submitError: string; isSignedIn: boolean; onPlayAgain(): void; onRetrySave(): void; onExit(): void }
```

The rendered copy must include:

- Ready: “Chikoo Catcher”, “Catch ripe chikoos. Dodge the rotten ones.”, a visual ripe/rotten legend, “Play”, and settings toggles.
- Countdown: only the current number and `aria-label="Game starting"`.
- Paused: “Orchard paused”, “Resume”, “Restart round”, “Exit fullscreen” or “Exit focus mode”, and settings toggles.
- Game over: “Harvest complete”, animated-score container, personal-best comparison, saving/saved/best/error copy, “Retry save” only on error while signed in, “Play again”, and the existing `/login?next=/play` link while signed out.

All interactive elements must be real buttons or links, carry visible focus styles, and meet a 44px minimum touch target.

- [ ] **Step 3: Add game-scoped CSS and import it from the client component in Task 7**

`game.css` must define:

```css
.chikoo-game-shell {
  --game-radius: 28px;
  position: relative;
  width: min(100%, 430px);
  aspect-ratio: 9 / 16;
  max-height: min(82svh, 760px);
  overflow: hidden;
  border: 1px solid color-mix(in srgb, var(--od-brand) 24%, white);
  border-radius: var(--game-radius);
  background: #21452d;
  box-shadow: 0 28px 80px rgba(46, 18, 5, 0.22);
  isolation: isolate;
}

.chikoo-game-shell[data-immersive='fullscreen'],
.chikoo-game-shell[data-immersive='focus'] {
  width: 100vw;
  height: 100svh;
  max-height: none;
  aspect-ratio: auto;
  border: 0;
  border-radius: 0;
  padding: env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left);
}

.chikoo-game-shell[data-immersive='focus'] {
  position: fixed;
  inset: 0;
  z-index: 1000;
}

.chikoo-game-canvas { width: 100%; height: 100%; display: block; touch-action: none; }
.chikoo-hud { position: absolute; inset: 12px 12px auto; z-index: 3; display: grid; grid-template-columns: auto auto 1fr auto; gap: 8px; align-items: center; pointer-events: none; }
.chikoo-hud > * { border: 1px solid rgba(255,255,255,.32); border-radius: 14px; background: rgba(255,248,220,.86); color: #3d1a08; box-shadow: 0 8px 24px rgba(46,18,5,.14); backdrop-filter: blur(12px); }
.chikoo-hud__score, .chikoo-hud__combo { min-width: 66px; padding: 6px 10px; line-height: 1; }
.chikoo-hud__score span, .chikoo-hud__combo span { display: block; margin-bottom: 4px; font-size: 10px; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; opacity: .7; }
.chikoo-hud__combo[data-active='true'] { color: #8a3618; box-shadow: 0 0 0 2px rgba(240,200,122,.42), 0 8px 24px rgba(46,18,5,.14); }
.chikoo-hud__lives { display: flex; gap: 8px; justify-self: end; padding: 8px 10px; font-weight: 800; }
.chikoo-hud__actions { display: flex; pointer-events: auto; }
.chikoo-hud button { display: grid; width: 44px; height: 44px; place-items: center; border-radius: 12px; }
.chikoo-hud svg { width: 18px; height: 18px; }
.chikoo-overlay { position: absolute; inset: 0; z-index: 4; display: grid; place-items: center; padding: 24px; color: white; text-align: center; background: linear-gradient(180deg, rgba(20,55,33,.36), rgba(35,21,12,.84)); backdrop-filter: blur(5px); }
.chikoo-overlay__card { width: min(100%, 340px); padding: 24px; border: 1px solid rgba(255,255,255,.25); border-radius: 24px; background: rgba(46,18,5,.78); box-shadow: 0 24px 70px rgba(0,0,0,.28); }
.chikoo-overlay button, .chikoo-overlay a { min-height: 44px; }
.chikoo-focus-lock { overflow: hidden !important; }

@media (max-width: 380px) {
  .chikoo-hud { inset: 8px 8px auto; gap: 5px; }
  .chikoo-hud__score, .chikoo-hud__combo { min-width: 54px; padding-inline: 7px; }
  .chikoo-hud__lives { display: none; }
}

@media (prefers-reduced-motion: reduce) {
  .chikoo-game-shell *, .chikoo-game-shell *::before, .chikoo-game-shell *::after {
    scroll-behavior: auto !important;
    animation-duration: .01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: .01ms !important;
  }
}
```

- [ ] **Step 4: Type-check, lint, and commit**

Run: `npx tsc --noEmit && npx eslint src/app/play/GameHud.tsx src/app/play/GameOverlay.tsx`

Expected: no errors or warnings.

```bash
git add src/app/play/GameHud.tsx src/app/play/GameOverlay.tsx src/app/play/game.css
git commit -m "feat(game): add accessible v2 HUD and overlays"
```

---

### Task 7: Replace the prototype orchestrator with the v2 lifecycle

**Files:**
- Modify: `src/app/play/ChikooCatcherGame.tsx:1-315`

**Interfaces:**
- Consumes: every Task 1–6 public interface plus existing `submitGameScore` and `buildAbsoluteUrl` behavior through `GameOverlay`.
- Produces: `<ChikooCatcherGame isSignedIn initialBestScore />`.

- [ ] **Step 1: Change the component prop contract**

```ts
interface ChikooCatcherGameProps {
  isSignedIn: boolean
  initialBestScore: number | null
}
```

The page passes `Math.max(yourBestWeek ?? 0, yourBestAllTime ?? 0) || null` in Task 8.

- [ ] **Step 2: Replace duplicated mutable gameplay fields with owned modules**

The component must own refs for exactly one engine, renderer, audio controller, haptics adapter, RAF id, timing accumulator, last frame timestamp, countdown timers, and frozen submitted score. Its React state must be limited to:

```ts
const [playState, setPlayState] = useState<PlayState>('ready')
const [snapshot, setSnapshot] = useState<GameSnapshot>(() => engineRef.current.snapshot())
const [settings, setSettings] = useState<GameSettings>(DEFAULT_SETTINGS)
const [immersiveMode, setImmersiveMode] = useState<ImmersiveMode>('none')
const [countdown, setCountdown] = useState<3 | 2 | 1>(3)
const [submitState, setSubmitState] = useState<SubmitState>('idle')
const [submitError, setSubmitError] = useState('')
const [announcement, setAnnouncement] = useState('Ready to play')
```

Do not restore per-frame `items`, basket position, elapsed time, or score refs in the component; those belong to the engine.

Load preferences after hydration, keep the loop-facing ref synchronized, and persist every explicit toggle:

```ts
useEffect(() => {
  const loaded = loadSettings()
  settingsRef.current = loaded
  setSettings(loaded)
}, [])

const updateSettings = (update: (current: GameSettings) => GameSettings) => {
  setSettings((current) => {
    const next = update(current)
    settingsRef.current = next
    saveSettings(next)
    audioRef.current?.setEnabled(next.sound)
    return next
  })
}
```

- [ ] **Step 3: Implement one fixed-step RAF loop**

Initialize the renderer once the canvas mounts and resize it from the canvas CSS box without putting dimensions in React state:

```ts
useEffect(() => {
  const canvas = canvasRef.current
  if (!canvas) return
  const renderer = createRenderer(canvas)
  rendererRef.current = renderer
  const resize = () => {
    const rect = canvas.getBoundingClientRect()
    renderer.resize(rect.width, rect.height, window.devicePixelRatio)
    renderer.render(engineRef.current.snapshot(), settingsRef.current, 16)
  }
  const observer = new ResizeObserver(resize)
  observer.observe(canvas)
  resize()
  return () => {
    observer.disconnect()
    renderer.destroy()
    rendererRef.current = null
  }
}, [])
```

Use this timing structure:

```ts
const frame = (time: number) => {
  const last = lastFrameRef.current || time
  const frameMs = Math.min(100, time - last)
  lastFrameRef.current = time
  accumulatorRef.current = Math.min(
    accumulatorRef.current + frameMs,
    GAME_CONFIG.fixedStepMs * GAME_CONFIG.maxCatchUpSteps,
  )
  const events: GameEvent[] = []
  let steps = 0
  while (accumulatorRef.current >= GAME_CONFIG.fixedStepMs && steps < GAME_CONFIG.maxCatchUpSteps) {
    events.push(...engineRef.current.step(GAME_CONFIG.fixedStepMs))
    accumulatorRef.current -= GAME_CONFIG.fixedStepMs
    steps += 1
  }
  const next = engineRef.current.snapshot()
  rendererRef.current?.emit(events)
  rendererRef.current?.render(next, settingsRef.current, frameMs)
  handleEvents(events, next)
  if (!next.gameOver) rafRef.current = requestAnimationFrame(frame)
}
```

`handleEvents` must update React snapshot once per meaningful event batch or at no more than 12 Hz, call audio/haptics for named events, update audio phase on `phaseChanged`, announce only phase/damage/game-over changes, and freeze `gameOver.score` before submission.

- [ ] **Step 4: Implement countdown, pause, resume, restart, and interruption rules**

- `startRound()` must be called by a user gesture, call `audio.unlock()`, reset the engine, reset submission state, begin a 3–2–1 countdown at 550ms per beat, then reset accumulator/timestamps and start RAF.
- `pauseRound(reason)` must cancel RAF, clear countdown timers, suspend audio, stop haptics, set `paused`, and announce the reason.
- `resumeRound()` must require a user gesture, call audio resume, reset accumulator and last timestamp to zero, set `playing`, and request a fresh frame.
- `restartRound()` must cancel and clear everything before calling the same countdown path as a new round.
- Add listeners for `visibilitychange`, `blur`, `fullscreenchange`, and `orientationchange`; each pauses only when state is `playing` or `countdown`.
- Remove all listeners and clear RAF/timers/audio/renderer/haptics/scroll lock on unmount.

- [ ] **Step 5: Implement normalized input and keyboard completeness**

- Pointer move maps the displayed canvas rect to `GAME_CONFIG.width` and calls `engine.setInput({ targetX, left: false, right: false })`.
- Pointer down captures the pointer and positions the basket immediately.
- Arrow keys set held-direction state and prevent scrolling only while playing.
- `Escape` pauses; `p` pauses/resumes; `m` toggles sound; `f` toggles immersive mode; `Enter` starts/resumes/replays when an overlay is active.
- `keyup`, window blur, pause, restart, and unmount clear all held directions.

- [ ] **Step 6: Implement immersive mode and scroll-lock ownership**

- `toggleImmersive()` calls `enterImmersive(shell, document)` when mode is `none`; it sets the returned mode.
- Focus mode adds `chikoo-focus-lock` to `document.documentElement` and `document.body`; every exit and unmount removes it.
- Native `fullscreenchange` synchronizes state. If the browser exits native fullscreen during active play, pause before setting mode to `none`.
- Exiting focus mode pauses before removing the fixed shell.

- [ ] **Step 7: Implement score saving with retry and one frozen score**

```ts
const saveScore = async (score: number) => {
  if (!isSignedIn) return
  frozenScoreRef.current = score
  setSubmitState('saving')
  setSubmitError('')
  const result = await submitGameScore(score)
  if (result.error) {
    setSubmitError(result.error)
    setSubmitState('error')
    return
  }
  setSubmitState(result.isNewBest ? 'best' : 'saved')
  router.refresh()
}

const retrySave = () => {
  if (frozenScoreRef.current !== null && submitState !== 'saving') {
    void saveScore(frozenScoreRef.current)
  }
}
```

Call `saveScore` exactly once from the first `gameOver` event. Never read a mutable live score during retry.

- [ ] **Step 8: Render the shell, canvas, HUD, overlays, and live region**

The root JSX structure must be:

```tsx
<div className="flex w-full flex-col items-center gap-4">
  <div ref={shellRef} className="chikoo-game-shell" data-immersive={immersiveMode}>
    <canvas
      ref={canvasRef}
      className="chikoo-game-canvas"
      role="img"
      aria-label="Chikoo Catcher orchard. Move the basket to catch ripe chikoos and avoid rotten ones."
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
    />
    {playState === 'playing' && (
      <GameHud
        snapshot={snapshot}
        soundEnabled={settings.sound}
        immersiveMode={immersiveMode}
        onPause={() => pauseRound('Game paused')}
        onToggleSound={toggleSound}
        onToggleImmersive={toggleImmersive}
      />
    )}
    {playState === 'ready' && (
      <GameOverlay
        state="ready"
        settings={settings}
        onPlay={startRound}
        onToggleSound={toggleSound}
        onToggleHaptics={toggleHaptics}
        onToggleReducedEffects={toggleReducedEffects}
        onToggleImmersive={toggleImmersive}
      />
    )}
    {playState === 'countdown' && <GameOverlay state="countdown" count={countdown} />}
    {playState === 'paused' && (
      <GameOverlay
        state="paused"
        settings={settings}
        immersiveMode={immersiveMode}
        onResume={resumeRound}
        onRestart={restartRound}
        onExit={exitImmersiveMode}
        onToggleSound={toggleSound}
        onToggleHaptics={toggleHaptics}
        onToggleReducedEffects={toggleReducedEffects}
      />
    )}
    {playState === 'gameOver' && (
      <GameOverlay
        state="gameOver"
        score={frozenScoreRef.current ?? snapshot.score}
        bestScore={initialBestScore}
        submitState={submitState}
        submitError={submitError}
        isSignedIn={isSignedIn}
        onPlayAgain={startRound}
        onRetrySave={retrySave}
        onExit={exitImmersiveMode}
      />
    )}
    <p className="sr-only" aria-live="polite" aria-atomic="true">{announcement}</p>
  </div>
  <p className="text-center text-xs text-[var(--od-muted)]">
    Drag or move your pointer · Arrow keys move · P pauses · F toggles fullscreen · M toggles sound
  </p>
</div>
```

Import `./game.css` directly from `ChikooCatcherGame.tsx`; it is inside the existing client boundary and contains no global site redesign.

- [ ] **Step 9: Run focused verification and commit**

Run: `npm run test:game && npx tsc --noEmit && npx eslint src/app/play/ChikooCatcherGame.tsx`

Expected: all tests pass; no TypeScript or ESLint findings.

```bash
git add src/app/play/ChikooCatcherGame.tsx
git commit -m "feat(game): orchestrate the v2 arcade lifecycle"
```

---

### Task 8: Integrate v2 presentation, leaderboard, and shared server score ceiling

**Files:**
- Modify: `src/app/play/page.tsx:7-43`
- Modify: `src/app/play/Leaderboard.tsx:19-86`
- Modify: `src/app/actions/game.ts:5-17`

**Interfaces:**
- Consumes: the new `initialBestScore` prop from Task 7 and `GAME_CONFIG.maxScore` imported into the server-only action.
- Produces: the final `/play` page composition and score validation that cannot drift from engine configuration.

- [ ] **Step 1: Pass personal best and update the page shell**

Change the game call to:

```tsx
<ChikooCatcherGame
  isSignedIn={Boolean(user)}
  initialBestScore={Math.max(yourBestWeek ?? 0, yourBestAllTime ?? 0) || null}
/>
```

Use this page wrapper and copy:

```tsx
<div className="od-page min-h-screen">
  <div className="od-shell flex flex-col items-center gap-10 py-8 sm:py-12">
    <header className="max-w-2xl text-center">
      <p className="od-eyebrow">OurDahanu Arcade</p>
      <h1 className="font-display mt-3 text-4xl font-semibold tracking-tight text-[var(--od-ink)] sm:text-5xl">
        Chikoo Catcher
      </h1>
      <p className="mx-auto mt-3 max-w-xl text-sm text-[var(--od-muted)] sm:text-base">
        Race through a sunlit Dahanu orchard. Catch the ripe harvest, avoid rotten fruit, and keep your combo alive.
      </p>
    </header>
    <ChikooCatcherGame
      isSignedIn={Boolean(user)}
      initialBestScore={Math.max(yourBestWeek ?? 0, yourBestAllTime ?? 0) || null}
    />
    <section className="w-full max-w-4xl" aria-labelledby="leaderboard-title">
      <div className="mb-4 text-center">
        <p className="od-eyebrow">Community challenge</p>
        <h2 id="leaderboard-title" className="font-display mt-2 text-3xl text-[var(--od-ink)]">Orchard champions</h2>
      </div>
      <Leaderboard
        weekly={weekly}
        allTime={allTime}
        yourBestWeek={yourBestWeek}
        yourBestAllTime={yourBestAllTime}
      />
    </section>
  </div>
</div>
```

Retain the existing server fetches and serializable leaderboard props exactly.

- [ ] **Step 2: Restyle the leaderboard without changing its data behavior**

- Keep mobile tabs and desktop two-column presentation.
- Change the outer width to `max-w-4xl`.
- Use `od-card`, warm gold rank discs for places 1–3, alternating transparent rows, and a warm personal-best footer.
- Add `aria-pressed={tab === 'week'}` / `aria-pressed={tab === 'all_time'}` to mobile tab buttons.
- Preserve `Anonymous Player`, empty state, names, scores, and personal-best values exactly as received.
- Do not make leaderboard rows clickable and do not expose user IDs.

- [ ] **Step 3: Share the existing 500-point ceiling with the server action**

Import the pure configuration module into the server action and remove its duplicated numeric constant:

```ts
import { GAME_CONFIG } from '@/app/play/game/config'

const MAX_SCORE = GAME_CONFIG.maxScore
```

Retain the deployed database constraint of `score <= 500`; no migration is needed. Do not change cooldown, authentication, best-score comparison, insertion, or error copy.

- [ ] **Step 4: Type-check, lint, run tests, and commit**

Run: `npm test && npx tsc --noEmit && npx eslint src/app/play/page.tsx src/app/play/Leaderboard.tsx src/app/actions/game.ts`

Expected: all tests and checks pass.

```bash
git add src/app/play/page.tsx src/app/play/Leaderboard.tsx src/app/actions/game.ts
git commit -m "feat(game): integrate v2 presentation and scoring"
```

---

### Task 9: Production verification and real-device playtest

**Files:**
- Modify only files proven defective by the checks below.

**Interfaces:**
- Consumes: the complete v2 feature.
- Produces: verified production-ready behavior and documented measured results in the implementation handoff.

- [ ] **Step 1: Run the full automated gate from a clean process**

Run:

```bash
npm test
npx tsc --noEmit
npm run lint
npm run build
```

Expected: every command exits 0; the Next.js route table includes `/play`; no touched file emits warnings.

- [ ] **Step 2: Verify signed-out play in desktop Chrome**

Run `npm run dev`, open `/play`, and verify:

1. Ready overlay, legend, toggles, and Play are readable.
2. Audio begins only after Play.
3. Mouse and arrow keys are responsive; arrows do not scroll the page.
4. Difficulty visibly ramps through the four phases.
5. Ripe catch, combo, miss, rotten catch, and game-over feedback are distinct.
6. Three misses or three rotten catches ends the round.
7. The sign-in prompt appears and links to `/login?next=/play`.
8. Replaying does not duplicate sound, timers, or input.

- [ ] **Step 3: Verify immersive and interruption behavior**

1. Enter native fullscreen from a direct click.
2. Exit with browser/Escape and confirm the game pauses.
3. Force or simulate fullscreen rejection and confirm focus mode fills the viewport.
4. Exit focus mode and confirm page scrolling is restored.
5. Switch tabs, blur the window, and rotate/resize; each active round pauses.
6. Resume and confirm fruit do not teleport and timing does not jump.

- [ ] **Step 4: Verify mobile and accessibility behavior**

At widths 320px, 375px, 430px, and tablet landscape:

1. No HUD action overlaps the playable catch area.
2. Touch/pointer drag stays aligned with the basket.
3. Safe-area padding works in immersive mode.
4. Haptics play only while enabled and supported.
5. Reduced-motion removes parallax, shake, and most particles.
6. Keyboard focus is visible and every action works without a pointer.
7. Screen-reader announcements cover state/phase/damage/save events but not every catch.

- [ ] **Step 5: Verify signed-in saving and leaderboard refresh**

1. Complete a signed-in round and confirm exactly one submission.
2. Confirm saved/new-best feedback and refreshed leaderboard content.
3. Force a submission failure and confirm the frozen score remains visible.
4. Use Retry Save and confirm it submits the same frozen score once.
5. Confirm cooldown errors remain legible and replay remains available.
6. Confirm no score above 500 is accepted by the server or database.

- [ ] **Step 6: Record performance evidence and fix only measured issues**

Use browser performance tools for one 120-second round on desktop and one mid-range mobile device or throttled equivalent. Record average FPS, lowest sustained FPS interval, maximum concurrent items, and whether quality stepped down. Acceptance:

- Desktop targets 60 FPS at high quality.
- Mobile remains responsive and simulation-correct even if decoration reduces.
- No growing item, particle, listener, interval, AudioContext, or RAF count across five rounds.

If a measured failure occurs, add a regression test where possible, implement the smallest correction, and rerun Steps 1–6.

- [ ] **Step 7: Commit verification fixes, if any**

Inspect `git status --short`, then stage only verified corrections within the v2 scope:

```bash
git add src/app/play src/app/actions/game.ts package.json
git commit -m "fix(game): address v2 playtest findings"
```

Skip this commit when verification requires no code changes. Never create an empty commit.

## Self-Review Checklist

- Every approved design requirement maps to a task: gameplay/difficulty/scoring (Tasks 1–2), browser capabilities (Task 3), sound (Task 4), visuals/performance (Task 5), UI/accessibility (Task 6), lifecycle/interruption/submission (Task 7), page/leaderboard/server integration (Task 8), and end-to-end verification (Task 9).
- The engine is authoritative for collision, lives, combo, score, phase, and game over; renderer, audio, haptics, and React consume events only.
- All cross-task method names and types match the File Structure and Interfaces blocks.
- No runtime dependency is added.
- The maximum score remains `500` in `GAME_CONFIG`, the server action imports that value, and the existing database constraint remains unchanged.
- Placeholder scan is clean and every fallback behavior has an explicit outcome.
- Existing unrelated untracked files remain outside every staging command.
