/**
 * Remembers the competition code a player joined with, per India day, so a
 * reload keeps them in today's competition. Storage can be missing or throw
 * (private mode, blocked site data), so every access is guarded.
 */

function keyFor(day: string): string {
  return `ourdahanu:chikoo-competition:${day}`
}

export function browserStorage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    return null
  }
}

export function loadCompetitionCode(storage: Pick<Storage, 'getItem'> | null, day: string): string | null {
  if (!storage) return null
  try {
    const value = storage.getItem(keyFor(day))
    return value && value.trim() ? value : null
  } catch {
    return null
  }
}

export function saveCompetitionCode(storage: Pick<Storage, 'setItem'> | null, day: string, code: string): void {
  if (!storage) return
  try {
    storage.setItem(keyFor(day), code)
  } catch {
    // Storage full or blocked: the player just re-enters the code next time.
  }
}

export function clearCompetitionCode(storage: Pick<Storage, 'removeItem'> | null, day: string): void {
  if (!storage) return
  try {
    storage.removeItem(keyFor(day))
  } catch {
    // Nothing to do.
  }
}
