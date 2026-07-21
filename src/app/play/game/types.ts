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

// The intentionally empty extension preserves the public snapshot contract.
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
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
