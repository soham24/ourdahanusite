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

export function saveSettings(
  settings: GameSettings,
  storage: StorageLike | null = typeof localStorage === 'undefined' ? null : localStorage,
): void {
  if (!storage) return

  try {
    storage.setItem(SETTINGS_KEY, JSON.stringify(settings))
  } catch {
    // Storage is optional; private browsing and quotas may reject writes.
  }
}

export const BEST_KEY = 'ourdahanu:chikoo-catcher:best'

/** This device's best score, so a run can celebrate passing it. 0 when none. */
export function loadBest(
  storage: StorageLike | null = typeof localStorage === 'undefined' ? null : localStorage,
): number {
  if (!storage) return 0
  try {
    const value = Number(storage.getItem(BEST_KEY))
    return Number.isInteger(value) && value > 0 ? value : 0
  } catch {
    return 0
  }
}

export function saveBest(
  score: number,
  storage: StorageLike | null = typeof localStorage === 'undefined' ? null : localStorage,
): void {
  if (!storage || !Number.isInteger(score) || score <= loadBest(storage)) return
  try {
    storage.setItem(BEST_KEY, String(score))
  } catch {
    // Storage is optional.
  }
}
