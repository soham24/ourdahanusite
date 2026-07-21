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
