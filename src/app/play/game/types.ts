export type GamePhase = 'warmup' | 'flow' | 'rush' | 'harvestRush'
export type PlayState = 'ready' | 'countdown' | 'playing' | 'paused' | 'gameOver'
export type SubmitState = 'idle' | 'saving' | 'saved' | 'best' | 'error'
/** Top-ups that fall like fruit: three last a few seconds, the heart is instant. */
export type PowerUpKind = 'bigBasket' | 'slowFall' | 'doubleHarvest' | 'extraLife'
export type TimedPowerUpKind = Exclude<PowerUpKind, 'extraLife'>
/** golden: rare, worth more. The rest are top-ups. */
export type ItemKind = 'ripe' | 'rotten' | 'golden' | PowerUpKind
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
  /** Golden chikoos caught. */
  goldens: number
  /** Points beyond one per catch: golden chikoos and double harvest. */
  extraPoints: number
  /** Time left on each timed top-up, 0 when inactive. */
  bigBasketMs: number
  slowFallMs: number
  doubleHarvestMs: number
  /** Index into GAME_CONFIG.scoreMilestones of the next one to reach. */
  nextMilestone: number
  phase: GamePhase
  nextItemId: number
  gameOver: boolean
}

// The intentionally empty extension preserves the public snapshot contract.
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface GameSnapshot extends Readonly<GameEngineState> {}

export type GameEvent =
  | { type: 'ripeCaught'; x: number; y: number; combo: number; bonusAwarded: number; points?: number }
  | { type: 'goldenCaught'; x: number; y: number; combo: number; points: number }
  | { type: 'powerUp'; kind: PowerUpKind; x: number; y: number; durationMs: number }
  | { type: 'powerUpEnded'; kind: TimedPowerUpKind }
  | { type: 'lifeRestored'; source: 'powerUp' | 'milestone' }
  | { type: 'milestone'; score: number }
  | { type: 'rottenCaught'; x: number; y: number }
  | { type: 'ripeMissed'; x: number }
  | { type: 'phaseChanged'; phase: GamePhase }
  | { type: 'gameOver'; score: number }

export interface GameSettings {
  sound: boolean
  haptics: boolean
  reducedEffects: boolean
}
