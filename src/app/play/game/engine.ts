import { GAME_CONFIG, getDifficulty, scoreFor } from './config'
import type { RandomSource } from './random'
import type { FallingItem, GameEngineState, GameEvent, GameSnapshot, InputState, ItemKind } from './types'

export interface GameEngine {
  reset(): void
  setInput(input: InputState): void
  positionBasket(targetX: number): void
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
  goldens: 0,
  bigBasketMs: 0,
  phase: 'warmup',
  nextItemId: 0,
  gameOver: false,
})

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

/** The basket's catching width, wider while the big-basket power-up lasts. */
export const basketWidthFor = (state: Pick<GameEngineState, 'bigBasketMs'>) =>
  GAME_CONFIG.basketWidth * (state.bigBasketMs > 0 ? GAME_CONFIG.bigBasketScale : 1)

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

  const positionBasket = (targetX: number) => {
    if (!Number.isFinite(targetX)) return
    const minX = basketWidthFor(state) / 2
    const maxX = GAME_CONFIG.width - minX
    state.basketX = clamp(targetX, minX, maxX)
    state.basketVelocity = 0
  }

  const spawn = () => {
    const difficulty = getDifficulty(state.activeMs)
    if (state.items.length >= difficulty.maxItems) return
    const drift = random() < difficulty.driftChance
    // One draw decides the kind, as before, so the order of random numbers
    // (and every seeded test) is unchanged: rotten, then golden, then the
    // power-up, then ripe, each taking a slice of the same roll.
    const roll = random()
    const goldenChance = GAME_CONFIG.goldenChance[difficulty.phase]
    const powerUpChance =
      state.activeMs >= GAME_CONFIG.powerUpAfterMs &&
      state.bigBasketMs === 0 &&
      !state.items.some((item) => item.kind === 'bigBasket')
        ? GAME_CONFIG.powerUpChance
        : 0
    let kind: ItemKind = 'ripe'
    if (roll < GAME_CONFIG.badItemChance) kind = 'rotten'
    else if (roll < GAME_CONFIG.badItemChance + goldenChance) kind = 'golden'
    else if (roll < GAME_CONFIG.badItemChance + goldenChance + powerUpChance) kind = 'bigBasket'
    state.items.push({
      id: state.nextItemId++,
      kind,
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

    if (state.bigBasketMs > 0) {
      state.bigBasketMs = Math.max(0, state.bigBasketMs - dt)
      if (state.bigBasketMs === 0) events.push({ type: 'powerUpEnded' })
    }
    const basketWidth = basketWidthFor(state)
    const minX = basketWidth / 2
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
        Math.abs(moved.x - state.basketX) <= basketWidth * 0.54

      if (caught && (item.kind === 'ripe' || item.kind === 'golden')) {
        const golden = item.kind === 'golden'
        state.catches += 1
        if (golden) state.goldens += 1
        state.combo += 1
        const milestone = state.combo % GAME_CONFIG.comboMilestone === 0
        if (milestone) state.rawComboBonus += 1
        const previousScore = state.score
        const nextScore = scoreFor(state.catches, state.rawComboBonus, state.goldens)
        const bonusAwarded = nextScore.bonus - state.bonus
        state.bonus = nextScore.bonus
        state.score = Math.min(nextScore.score, GAME_CONFIG.maxScore)
        events.push(
          golden
            ? { type: 'goldenCaught', x: moved.x, y: moved.y, combo: state.combo, points: state.score - previousScore }
            : { type: 'ripeCaught', x: moved.x, y: moved.y, combo: state.combo, bonusAwarded },
        )
        continue
      }
      if (caught && item.kind === 'bigBasket') {
        state.bigBasketMs = GAME_CONFIG.bigBasketMs
        events.push({ type: 'powerUp', x: moved.x, y: moved.y, durationMs: GAME_CONFIG.bigBasketMs })
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

    if (
      state.score >= GAME_CONFIG.maxScore ||
      state.misses >= GAME_CONFIG.maxMisses ||
      state.badCatches >= GAME_CONFIG.maxBadCatches
    ) {
      state.gameOver = true
      events.push({ type: 'gameOver', score: state.score })
    }
    return events
  }

  return {
    reset,
    setInput,
    positionBasket,
    step,
    snapshot,
  }
}
