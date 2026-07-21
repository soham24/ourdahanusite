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
