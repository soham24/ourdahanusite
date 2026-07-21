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
      try {
        vibrate(PATTERNS[cue])
      } catch {
        // Optional capability.
      }
    },
    stop() {
      try {
        vibrate?.([])
      } catch {
        // Optional capability.
      }
    },
  }
}
