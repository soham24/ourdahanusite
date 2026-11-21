import { GAME_CONFIG, getDifficulty, scoreFor } from './config'
import type { RandomSource } from './random'
import type {
  FallingItem,
  GameEngineState,
  GameEvent,
  GameSnapshot,
  InputState,
  ItemKind,
  PowerUpKind,
  TimedPowerUpKind,
} from './types'

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
  extraPoints: 0,
  bigBasketMs: 0,
  slowFallMs: 0,
  doubleHarvestMs: 0,
  nextMilestone: 0,
  phase: 'warmup',
  nextItemId: 0,
  gameOver: false,
})

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

/** The basket's catching width, wider while the big-basket power-up lasts. */
export const basketWidthFor = (state: Pick<GameEngineState, 'bigBasketMs'>) =>
  GAME_CONFIG.basketWidth * (state.bigBasketMs > 0 ? GAME_CONFIG.bigBasketScale : 1)

const TIMED: Record<TimedPowerUpKind, { field: 'bigBasketMs' | 'slowFallMs' | 'doubleHarvestMs'; durationMs: number }> = {
  bigBasket: { field: 'bigBasketMs', durationMs: GAME_CONFIG.bigBasketMs },
  slowFall: { field: 'slowFallMs', durationMs: GAME_CONFIG.slowFallMs },
  doubleHarvest: { field: 'doubleHarvestMs', durationMs: GAME_CONFIG.doubleHarvestMs },
}
const POWER_UP_ORDER: PowerUpKind[] = ['bigBasket', 'slowFall', 'doubleHarvest', 'extraLife']
const isPowerUp = (kind: ItemKind): kind is PowerUpKind => (POWER_UP_ORDER as ItemKind[]).includes(kind)

const livesLost = (state: GameEngineState) => state.misses + state.badCatches

/** Gives back the most recent kind of lost life. False when none was lost. */
function restoreLife(state: GameEngineState): boolean {
  if (state.misses > 0 && state.misses >= state.badCatches) state.misses -= 1
  else if (state.badCatches > 0) state.badCatches -= 1
  else return false
  return true
}

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

  /** Top-ups that may fall now: not already running or on screen; the heart only after a lost life. */
  const eligiblePowerUps = (): PowerUpKind[] => {
    if (state.activeMs < GAME_CONFIG.powerUpAfterMs) return []
    if (state.items.some((item) => isPowerUp(item.kind))) return []
    return POWER_UP_ORDER.filter((kind) =>
      kind === 'extraLife' ? livesLost(state) > 0 : state[TIMED[kind].field] === 0,
    )
  }

  const spawn = () => {
    const difficulty = getDifficulty(state.activeMs)
    if (state.items.length >= difficulty.maxItems) return
    const drift = random() < difficulty.driftChance
    // One draw decides the kind, so the order of random numbers (and every
    // seeded test) never changes: rotten, then golden, then the top-up slice,
    // then ripe. The top-up slice is split evenly between the kinds that may
    // fall right now, by where in the slice the roll landed.
    const roll = random()
    const goldenChance = GAME_CONFIG.goldenChance[difficulty.phase]
    const powerUps = eligiblePowerUps()
    const powerUpChance = powerUps.length > 0 ? GAME_CONFIG.powerUpChance : 0
    const powerUpStart = GAME_CONFIG.badItemChance + goldenChance
    let kind: ItemKind = 'ripe'
    if (roll < GAME_CONFIG.badItemChance) kind = 'rotten'
    else if (roll < powerUpStart) kind = 'golden'
    else if (roll < powerUpStart + powerUpChance) {
      const index = Math.min(powerUps.length - 1, Math.floor(((roll - powerUpStart) / powerUpChance) * powerUps.length))
      kind = powerUps[index]
    }
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

    for (const [kind, { field }] of Object.entries(TIMED) as [TimedPowerUpKind, (typeof TIMED)[TimedPowerUpKind]][]) {
      if (state[field] > 0) {
        state[field] = Math.max(0, state[field] - dt)
        if (state[field] === 0) events.push({ type: 'powerUpEnded', kind })
      }
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

    const fallSpeed = difficulty.fallSpeed * (state.slowFallMs > 0 ? GAME_CONFIG.slowFallFactor : 1)
    const remaining: FallingItem[] = []
    for (const item of state.items) {
      const moved = {
        ...item,
        x: clamp(item.x + item.vx * seconds, GAME_CONFIG.itemRadius, GAME_CONFIG.width - GAME_CONFIG.itemRadius),
        y: item.y + fallSpeed * seconds,
        rotation: item.rotation + item.spin * seconds,
      }
      const caught =
        moved.y + GAME_CONFIG.itemRadius >= GAME_CONFIG.basketY &&
        moved.y - GAME_CONFIG.itemRadius <= GAME_CONFIG.basketY + GAME_CONFIG.basketHeight &&
        Math.abs(moved.x - state.basketX) <= basketWidth * 0.54

      if (caught && (item.kind === 'ripe' || item.kind === 'golden')) {
        const golden = item.kind === 'golden'
        const points = (golden ? GAME_CONFIG.goldenPoints : 1) * (state.doubleHarvestMs > 0 ? 2 : 1)
        state.catches += 1
        if (golden) state.goldens += 1
        state.extraPoints += points - 1
        state.combo += 1
        const milestone = state.combo % GAME_CONFIG.comboMilestone === 0
        if (milestone) state.rawComboBonus += 1
        const previousScore = state.score
        const nextScore = scoreFor(state.catches, state.rawComboBonus, state.extraPoints)
        const bonusAwarded = nextScore.bonus - state.bonus
        state.bonus = nextScore.bonus
        state.score = Math.min(nextScore.score, GAME_CONFIG.maxScore)
        events.push(
          golden
            ? { type: 'goldenCaught', x: moved.x, y: moved.y, combo: state.combo, points: state.score - previousScore }
            : { type: 'ripeCaught', x: moved.x, y: moved.y, combo: state.combo, bonusAwarded, points: state.score - previousScore },
        )
        continue
      }
      if (caught && isPowerUp(item.kind)) {
        if (item.kind === 'extraLife') {
          events.push({ type: 'powerUp', kind: item.kind, x: moved.x, y: moved.y, durationMs: 0 })
          if (restoreLife(state)) events.push({ type: 'lifeRestored', source: 'powerUp' })
        } else {
          const { field, durationMs } = TIMED[item.kind]
          state[field] = durationMs
          events.push({ type: 'powerUp', kind: item.kind, x: moved.x, y: moved.y, durationMs })
        }
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

    // Score milestones: a banner each, and from milestoneRestoresFrom on a
    // lost life back, so a long run is rewarded with a longer run.
    const milestones = GAME_CONFIG.scoreMilestones
    while (state.nextMilestone < milestones.length && state.score >= milestones[state.nextMilestone]) {
      const reached = milestones[state.nextMilestone]
      state.nextMilestone += 1
      events.push({ type: 'milestone', score: reached })
      if (reached >= GAME_CONFIG.milestoneRestoresFrom && restoreLife(state)) {
        events.push({ type: 'lifeRestored', source: 'milestone' })
      }
    }

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
