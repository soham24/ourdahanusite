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
  /** A ceiling no real run reaches, so a forged score cannot be absurd. */
  maxScore: 9_999,
  /** A golden chikoo counts as a catch and this many points in all. */
  goldenPoints: 3,
  /** Chance a spawn is golden, by phase: none while learning, rarer than rotten after. */
  goldenChance: { warmup: 0, flow: 0.035, rush: 0.05, harvestRush: 0.06 },
  /** Chance a spawn is a top-up, once they can appear; split between the kinds that can. */
  powerUpChance: 0.045,
  powerUpAfterMs: 12_000,
  bigBasketScale: 1.55,
  bigBasketMs: 6_500,
  slowFallMs: 6_000,
  /** Fall speed while the monsoon breeze lasts. */
  slowFallFactor: 0.55,
  doubleHarvestMs: 8_000,
  /** Scores that get a banner. From milestoneRestoresFrom on, each also gives back a lost life. */
  scoreMilestones: [50, 100, 200, 300, 500, 750, 1_000, 1_500, 2_000, 3_000, 5_000, 7_500],
  milestoneRestoresFrom: 100,
  /** Catches in a row that get a banner and their own sound. */
  streakMilestones: [10, 20, 30, 50, 75, 100],
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

/** One point a catch, the combo bonus (at most a fifth of catches), plus extra points from gold and double harvest. */
export function scoreFor(catches: number, rawBonus: number, extraPoints = 0): { bonus: number; score: number } {
  const bonus = Math.min(Math.max(0, rawBonus), Math.floor(Math.max(0, catches) * 0.2))
  return { bonus, score: Math.max(0, catches) + bonus + Math.max(0, extraPoints) }
}
