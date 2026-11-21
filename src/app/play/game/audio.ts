import type { GamePhase } from './types'

export type AudioCue =
  | 'countdown' | 'catch' | 'combo' | 'miss' | 'damage' | 'pause' | 'resume' | 'gameOver' | 'select'
  | 'golden' | 'powerUp' | 'streak' | 'newBest' | 'milestone'

export interface AudioController {
  unlock(): Promise<void>
  setEnabled(enabled: boolean): void
  setPhase(phase: GamePhase): void
  setRhythmActive(active: boolean): void
  play(cue: AudioCue): void
  suspend(): Promise<void>
  resume(): Promise<void>
  destroy(): Promise<void>
}

interface AudioParamLike {
  setValueAtTime(value: number, startTime: number): void
  exponentialRampToValueAtTime(value: number, endTime: number): void
}

interface AudioContextLike {
  currentTime: number
  state: string
  destination: unknown
  createGain(): { gain: AudioParamLike; connect(destination: unknown): void }
  createOscillator(): {
    type: string
    frequency: AudioParamLike
    connect(destination: unknown): void
    start(when?: number): void
    stop(when?: number): void
  }
  resume(): Promise<void>
  suspend(): Promise<void>
  close(): Promise<void>
}

type AudioContextFactory = () => AudioContextLike

interface RhythmTimer {
  handle: number
  clear(handle: number): void
}

type Note = readonly [frequency: number, duration: number, volume: number, endFrequency: number, delay?: number]

// The moments worth celebrating get a few notes instead of one.
const PHRASES: Partial<Record<AudioCue, readonly Note[]>> = {
  // A rising major arpeggio: unmistakably "good".
  golden: [[784, 0.09, 0.05, 880], [988, 0.09, 0.05, 1100, 0.07], [1319, 0.18, 0.055, 1480, 0.14]],
  powerUp: [[330, 0.22, 0.05, 990], [495, 0.2, 0.035, 1320, 0.05]],
  streak: [[880, 0.08, 0.05, 990], [1175, 0.14, 0.05, 1320, 0.08]],
  // A short two-step fanfare for a score milestone.
  milestone: [[659, 0.09, 0.05, 659], [880, 0.09, 0.05, 880, 0.09], [1319, 0.24, 0.055, 1319, 0.18]],
  newBest: [[523, 0.1, 0.05, 523], [659, 0.1, 0.05, 659, 0.1], [784, 0.1, 0.05, 784, 0.2], [1047, 0.32, 0.06, 1047, 0.3]],
}

const CUES: Record<AudioCue, readonly [number, number, number, number]> = {
  countdown: [440, 0.08, 0.05, 520],
  catch: [520, 0.07, 0.045, 680],
  combo: [660, 0.14, 0.06, 990],
  miss: [180, 0.12, 0.045, 130],
  damage: [120, 0.18, 0.07, 70],
  pause: [330, 0.08, 0.04, 260],
  resume: [330, 0.08, 0.04, 440],
  gameOver: [220, 0.4, 0.07, 90],
  select: [420, 0.05, 0.035, 500],
  // Single-note fallbacks; PHRASES above is what plays.
  golden: [988, 0.12, 0.05, 1320],
  powerUp: [330, 0.22, 0.05, 990],
  streak: [880, 0.1, 0.05, 1175],
  newBest: [523, 0.3, 0.06, 1047],
  milestone: [880, 0.2, 0.05, 1319],
}

const PHASE_INTERVALS: Record<GamePhase, number> = {
  warmup: 900,
  flow: 720,
  rush: 560,
  harvestRush: 420,
}

function createBrowserAudioContext(): AudioContextLike {
  if (typeof window === 'undefined') throw new Error('Web Audio is unavailable')

  const browserWindow = window as Window & { webkitAudioContext?: typeof AudioContext }
  const Context = browserWindow.AudioContext ?? browserWindow.webkitAudioContext
  if (!Context) throw new Error('Web Audio is unavailable')
  return new Context()
}

export function createGameAudio(factory: AudioContextFactory = createBrowserAudioContext): AudioController {
  let context: AudioContextLike | undefined
  let enabled = true
  let phase: GamePhase = 'warmup'
  let rhythmActive = false
  let suspended = false
  let destroyed = false
  let rhythmTimer: RhythmTimer | undefined

  const clearRhythm = () => {
    const timer = rhythmTimer
    if (!timer) return
    rhythmTimer = undefined
    try {
      timer.clear(timer.handle)
    } catch {
      // Audio is an optional capability.
    }
  }

  const tone = (frequency: number, duration: number, volume: number, endFrequency: number, delay = 0) => {
    if (!context || !enabled || suspended || destroyed) return

    try {
      const oscillator = context.createOscillator()
      const gain = context.createGain()
      const startTime = context.currentTime + delay
      const endTime = startTime + duration

      oscillator.type = 'sine'
      oscillator.frequency.setValueAtTime(frequency, startTime)
      oscillator.frequency.exponentialRampToValueAtTime(endFrequency, endTime)
      gain.gain.setValueAtTime(volume, startTime)
      gain.gain.exponentialRampToValueAtTime(0.0001, endTime)
      oscillator.connect(gain)
      gain.connect(context.destination)
      oscillator.start(startTime)
      oscillator.stop(endTime)
    } catch {
      // Audio is an optional capability.
    }
  }

  const playRhythm = () => {
    tone(196, 0.06, 0.012, 247)
    tone(294, 0.06, 0.01, 370)
  }

  const startRhythm = () => {
    if (!context || !enabled || !rhythmActive || suspended || destroyed || rhythmTimer !== undefined || typeof window === 'undefined') return
    try {
      const scheduler = window
      rhythmTimer = {
        handle: scheduler.setInterval(playRhythm, PHASE_INTERVALS[phase]),
        clear: scheduler.clearInterval.bind(scheduler),
      }
    } catch {
      // Audio is an optional capability.
    }
  }

  return {
    async unlock() {
      if (destroyed) return

      if (!context) {
        try {
          context = factory()
        } catch {
          return
        }
      }

      try {
        await context.resume()
      } catch {
        // Audio is an optional capability.
      }
      startRhythm()
    },

    setEnabled(nextEnabled) {
      enabled = nextEnabled
      if (!enabled) clearRhythm()
      else startRhythm()
    },

    setPhase(nextPhase) {
      phase = nextPhase
      clearRhythm()
      startRhythm()
    },

    setRhythmActive(active) {
      rhythmActive = active
      if (!rhythmActive) clearRhythm()
      else startRhythm()
    },

    play(cue) {
      if (!enabled || destroyed) return
      const phrase = PHRASES[cue]
      if (phrase) for (const note of phrase) tone(...note)
      else tone(...CUES[cue])
    },

    async suspend() {
      suspended = true
      clearRhythm()
      try {
        await context?.suspend()
      } catch {
        // Audio is an optional capability.
      }
    },

    async resume() {
      if (destroyed) return
      suspended = false
      try {
        await context?.resume()
      } catch {
        // Audio is an optional capability.
      }
      startRhythm()
    },

    async destroy() {
      if (destroyed) return
      destroyed = true
      clearRhythm()
      try {
        await context?.close()
      } catch {
        // Audio is an optional capability.
      }
    },
  }
}
