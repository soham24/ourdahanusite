'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { useRouter } from 'next/navigation'
import { submitGameScore } from '@/app/actions/game'
import GameHud from './GameHud'
import GameOverlay from './GameOverlay'
import { createGameAudio } from './game/audio'
import type { AudioController } from './game/audio'
import { GAME_CONFIG } from './game/config'
import { createGameEngine } from './game/engine'
import type { GameEngine } from './game/engine'
import { enterImmersive, exitImmersive } from './game/fullscreen'
import type { ImmersiveMode } from './game/fullscreen'
import { createHaptics } from './game/haptics'
import { createRenderer } from './game/renderer'
import type { GameRenderer } from './game/renderer'
import { DEFAULT_SETTINGS, loadSettings, saveSettings } from './game/storage'
import type {
  GameEvent,
  GameSettings,
  GameSnapshot,
  InputState,
  PlayState,
  SubmitState,
} from './game/types'
import './game.css'

const COUNTDOWN_BEAT_MS = 550
const SNAPSHOT_INTERVAL_MS = 1000 / 12

type HeldDirections = Pick<InputState, 'left' | 'right'>
type PointerRect = Pick<DOMRect, 'left' | 'width'>

interface ChikooCatcherGameProps {
  isSignedIn: boolean
  initialBestScore: number | null
}

export function normalizePointerX(clientX: number, rect: PointerRect): number | null {
  if (!Number.isFinite(clientX) || !Number.isFinite(rect.left) || rect.width <= 0) return null
  const logicalX = ((clientX - rect.left) / rect.width) * GAME_CONFIG.width
  return Math.min(GAME_CONFIG.width, Math.max(0, logicalX))
}

export function inputForHeldDirections(directions: HeldDirections): InputState {
  return { targetX: null, left: directions.left, right: directions.right }
}

export function isActivePlayState(state: PlayState): boolean {
  return state === 'playing' || state === 'countdown'
}

export function shouldPublishSnapshot(
  previousPublishTime: number,
  currentTime: number,
  hasEvents: boolean,
): boolean {
  return hasEvents || currentTime - previousPublishTime >= SNAPSHOT_INTERVAL_MS
}

const phaseAnnouncement = (snapshot: GameSnapshot) => {
  switch (snapshot.phase) {
    case 'warmup':
      return 'Warm-up harvest'
    case 'flow':
      return 'Flow phase'
    case 'rush':
      return 'Rush phase'
    case 'harvestRush':
      return 'Harvest rush'
  }
}

export default function ChikooCatcherGame({
  isSignedIn,
  initialBestScore,
}: ChikooCatcherGameProps) {
  const router = useRouter()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const shellRef = useRef<HTMLDivElement>(null)
  const engineRef = useRef<GameEngine>(createGameEngine())
  const rendererRef = useRef<GameRenderer | null>(null)
  const audioRef = useRef<AudioController | null>(null)
  const hapticsRef = useRef<ReturnType<typeof createHaptics> | null>(null)
  const rafRef = useRef<number | null>(null)
  const accumulatorRef = useRef(0)
  const lastFrameRef = useRef(0)
  const countdownTimersRef = useRef<number[]>([])
  const frozenScoreRef = useRef<number | null>(null)

  const settingsRef = useRef<GameSettings>(DEFAULT_SETTINGS)
  const playStateRef = useRef<PlayState>('ready')
  const immersiveModeRef = useRef<ImmersiveMode>('none')
  const heldDirectionsRef = useRef<HeldDirections>({ left: false, right: false })
  const lastSnapshotPublishRef = useRef(0)
  const submissionSequenceRef = useRef(0)
  const mountedRef = useRef(false)

  const [playState, setPlayState] = useState<PlayState>('ready')
  const [snapshot, setSnapshot] = useState<GameSnapshot>(() => engineRef.current.snapshot())
  const [settings, setSettings] = useState<GameSettings>(DEFAULT_SETTINGS)
  const [immersiveMode, setImmersiveMode] = useState<ImmersiveMode>('none')
  const [countdown, setCountdown] = useState<3 | 2 | 1>(3)
  const [submitState, setSubmitState] = useState<SubmitState>('idle')
  const [submitError, setSubmitError] = useState('')
  const [announcement, setAnnouncement] = useState('Ready to play')

  const transitionPlayState = useCallback((next: PlayState) => {
    playStateRef.current = next
    setPlayState(next)
  }, [])

  const transitionImmersiveMode = useCallback((next: ImmersiveMode) => {
    immersiveModeRef.current = next
    setImmersiveMode(next)
  }, [])

  const cancelFrame = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
  }, [])

  const clearCountdownTimers = useCallback(() => {
    for (const timer of countdownTimersRef.current) window.clearTimeout(timer)
    countdownTimersRef.current = []
  }, [])

  const clearHeldDirections = useCallback(() => {
    heldDirectionsRef.current = { left: false, right: false }
    engineRef.current.setInput(inputForHeldDirections(heldDirectionsRef.current))
  }, [])

  const removeFocusLock = useCallback(() => {
    document.documentElement.classList.remove('chikoo-focus-lock')
    document.body.classList.remove('chikoo-focus-lock')
  }, [])

  const updateSettings = useCallback(
    (update: (current: GameSettings) => GameSettings) => {
      setSettings((current) => {
        const next = update(current)
        settingsRef.current = next
        saveSettings(next)
        audioRef.current?.setEnabled(next.sound)
        return next
      })
    },
    [],
  )

  const toggleSound = useCallback(() => {
    updateSettings((current) => ({ ...current, sound: !current.sound }))
  }, [updateSettings])

  const toggleHaptics = useCallback(() => {
    updateSettings((current) => ({ ...current, haptics: !current.haptics }))
  }, [updateSettings])

  const toggleReducedEffects = useCallback(() => {
    updateSettings((current) => ({ ...current, reducedEffects: !current.reducedEffects }))
  }, [updateSettings])

  const saveScore = useCallback(
    async (score: number) => {
      if (!isSignedIn) return

      frozenScoreRef.current = score
      const requestSequence = ++submissionSequenceRef.current
      setSubmitState('saving')
      setSubmitError('')
      const result = await submitGameScore(score)

      if (
        !mountedRef.current ||
        requestSequence !== submissionSequenceRef.current ||
        playStateRef.current !== 'gameOver' ||
        frozenScoreRef.current !== score
      ) {
        return
      }

      if (result.error) {
        setSubmitError(result.error)
        setSubmitState('error')
        return
      }
      setSubmitState(result.isNewBest ? 'best' : 'saved')
      router.refresh()
    },
    [isSignedIn, router],
  )

  const handleEvents = useCallback(
    (events: readonly GameEvent[], next: GameSnapshot, frameTime: number) => {
      if (shouldPublishSnapshot(lastSnapshotPublishRef.current, frameTime, events.length > 0)) {
        lastSnapshotPublishRef.current = frameTime
        setSnapshot(next)
      }

      for (const event of events) {
        switch (event.type) {
          case 'ripeCaught': {
            const cue = event.bonusAwarded > 0 ? 'combo' : 'catch'
            audioRef.current?.play(cue)
            hapticsRef.current?.play(cue, settingsRef.current.haptics)
            break
          }
          case 'rottenCaught':
            audioRef.current?.play('damage')
            hapticsRef.current?.play('damage', settingsRef.current.haptics)
            setAnnouncement(
              `Rotten chikoo caught. ${Math.max(0, GAME_CONFIG.maxBadCatches - next.badCatches)} bad catches remaining`,
            )
            break
          case 'ripeMissed':
            audioRef.current?.play('miss')
            hapticsRef.current?.play('damage', settingsRef.current.haptics)
            setAnnouncement(
              `Ripe chikoo missed. ${Math.max(0, GAME_CONFIG.maxMisses - next.misses)} misses remaining`,
            )
            break
          case 'phaseChanged':
            audioRef.current?.setPhase(event.phase)
            setAnnouncement(phaseAnnouncement(next))
            break
          case 'gameOver':
            if (frozenScoreRef.current !== null) break
            frozenScoreRef.current = event.score
            transitionPlayState('gameOver')
            setSnapshot(next)
            clearHeldDirections()
            rendererRef.current?.setPointerX(null)
            const audio = audioRef.current
            audio?.play('gameOver')
            if (audio) {
              const suspendTimer = window.setTimeout(() => {
                if (playStateRef.current === 'gameOver') void audio.suspend()
              }, 450)
              countdownTimersRef.current.push(suspendTimer)
            }
            hapticsRef.current?.play('gameOver', settingsRef.current.haptics)
            setAnnouncement(`Game over. Final score ${event.score}`)
            void saveScore(event.score)
            break
        }
      }
    },
    [clearHeldDirections, saveScore, transitionPlayState],
  )

  const frame = useCallback(
    function runFrame(time: number) {
      rafRef.current = null
      if (playStateRef.current !== 'playing') return

      const last = lastFrameRef.current || time
      const frameMs = Math.min(100, Math.max(0, time - last))
      lastFrameRef.current = time
      accumulatorRef.current = Math.min(
        accumulatorRef.current + frameMs,
        GAME_CONFIG.fixedStepMs * GAME_CONFIG.maxCatchUpSteps,
      )

      const events: GameEvent[] = []
      let steps = 0
      while (
        accumulatorRef.current >= GAME_CONFIG.fixedStepMs &&
        steps < GAME_CONFIG.maxCatchUpSteps
      ) {
        events.push(...engineRef.current.step(GAME_CONFIG.fixedStepMs))
        accumulatorRef.current -= GAME_CONFIG.fixedStepMs
        steps += 1
      }

      const next = engineRef.current.snapshot()
      rendererRef.current?.emit(events)
      rendererRef.current?.render(next, settingsRef.current, frameMs)
      handleEvents(events, next, time)

      if (!next.gameOver && playStateRef.current === 'playing') {
        rafRef.current = requestAnimationFrame(runFrame)
      }
    },
    [handleEvents],
  )

  const startRound = useCallback(() => {
    cancelFrame()
    clearCountdownTimers()
    clearHeldDirections()
    rendererRef.current?.setPointerX(null)
    hapticsRef.current?.stop()
    submissionSequenceRef.current += 1
    frozenScoreRef.current = null

    engineRef.current.reset()
    const initialSnapshot = engineRef.current.snapshot()
    setSnapshot(initialSnapshot)
    setSubmitState('idle')
    setSubmitError('')
    setCountdown(3)
    accumulatorRef.current = 0
    lastFrameRef.current = 0
    lastSnapshotPublishRef.current = 0
    transitionPlayState('countdown')
    setAnnouncement('Round starts in 3')
    rendererRef.current?.render(initialSnapshot, settingsRef.current, 0)

    const audio = audioRef.current
    audio?.setEnabled(settingsRef.current.sound)
    void audio?.unlock()
    void audio?.resume()
    audio?.play('countdown')

    const scheduleBeat = (delay: number, value: 2 | 1) => {
      const timer = window.setTimeout(() => {
        if (playStateRef.current !== 'countdown') return
        setCountdown(value)
        setAnnouncement(`Round starts in ${value}`)
        audioRef.current?.play('countdown')
      }, delay)
      countdownTimersRef.current.push(timer)
    }

    scheduleBeat(COUNTDOWN_BEAT_MS, 2)
    scheduleBeat(COUNTDOWN_BEAT_MS * 2, 1)
    const startTimer = window.setTimeout(() => {
      if (playStateRef.current !== 'countdown') return
      countdownTimersRef.current = []
      accumulatorRef.current = 0
      lastFrameRef.current = 0
      lastSnapshotPublishRef.current = 0
      audioRef.current?.setPhase(engineRef.current.snapshot().phase)
      transitionPlayState('playing')
      setAnnouncement('Go')
      cancelFrame()
      rafRef.current = requestAnimationFrame(frame)
    }, COUNTDOWN_BEAT_MS * 3)
    countdownTimersRef.current.push(startTimer)
  }, [
    cancelFrame,
    clearCountdownTimers,
    clearHeldDirections,
    frame,
    transitionPlayState,
  ])

  const pauseRound = useCallback(
    (reason: string) => {
      if (!isActivePlayState(playStateRef.current)) return
      cancelFrame()
      clearCountdownTimers()
      clearHeldDirections()
      rendererRef.current?.setPointerX(null)
      audioRef.current?.play('pause')
      void audioRef.current?.suspend()
      hapticsRef.current?.stop()
      transitionPlayState('paused')
      setSnapshot(engineRef.current.snapshot())
      setAnnouncement(reason)
    },
    [cancelFrame, clearCountdownTimers, clearHeldDirections, transitionPlayState],
  )

  const resumeRound = useCallback(() => {
    if (playStateRef.current !== 'paused') return
    cancelFrame()
    clearCountdownTimers()
    clearHeldDirections()
    accumulatorRef.current = 0
    lastFrameRef.current = 0
    lastSnapshotPublishRef.current = 0
    audioRef.current?.setEnabled(settingsRef.current.sound)
    void audioRef.current?.resume()
    audioRef.current?.setPhase(engineRef.current.snapshot().phase)
    audioRef.current?.play('resume')
    transitionPlayState('playing')
    setAnnouncement('Game resumed')
    rafRef.current = requestAnimationFrame(frame)
  }, [
    cancelFrame,
    clearCountdownTimers,
    clearHeldDirections,
    frame,
    transitionPlayState,
  ])

  const restartRound = useCallback(() => {
    cancelFrame()
    clearCountdownTimers()
    clearHeldDirections()
    void audioRef.current?.suspend()
    hapticsRef.current?.stop()
    startRound()
  }, [cancelFrame, clearCountdownTimers, clearHeldDirections, startRound])

  const exitImmersiveMode = useCallback(async () => {
    if (isActivePlayState(playStateRef.current)) pauseRound('Game view exited. Game paused')
    const exitSequence = immersiveModeRef.current
    if (exitSequence === 'fullscreen') await exitImmersive(document)
    removeFocusLock()
    if (mountedRef.current) transitionImmersiveMode('none')
  }, [pauseRound, removeFocusLock, transitionImmersiveMode])

  const toggleImmersive = useCallback(async () => {
    if (immersiveModeRef.current !== 'none') {
      await exitImmersiveMode()
      return
    }

    const shell = shellRef.current
    if (!shell) return
    const next = await enterImmersive(shell, document)
    if (!mountedRef.current || immersiveModeRef.current !== 'none') return

    if (next === 'focus') {
      document.documentElement.classList.add('chikoo-focus-lock')
      document.body.classList.add('chikoo-focus-lock')
    } else {
      removeFocusLock()
    }
    transitionImmersiveMode(next)
  }, [exitImmersiveMode, removeFocusLock, transitionImmersiveMode])

  const retrySave = useCallback(() => {
    if (frozenScoreRef.current !== null && submitState !== 'saving') {
      void saveScore(frozenScoreRef.current)
    }
  }, [saveScore, submitState])

  const positionFromPointer = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect()
    const logicalX = normalizePointerX(event.clientX, rect)
    rendererRef.current?.setPointerX(logicalX)
    if (logicalX !== null && playStateRef.current === 'playing') {
      engineRef.current.setInput({ targetX: logicalX, left: false, right: false })
      heldDirectionsRef.current = { left: false, right: false }
    }
  }

  const handlePointerDown = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    try {
      event.currentTarget.setPointerCapture(event.pointerId)
    } catch {
      // Pointer capture is an optional browser capability.
    }
    positionFromPointer(event)
  }

  const handlePointerMove = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    positionFromPointer(event)
  }

  const clearPointer = () => {
    rendererRef.current?.setPointerX(null)
  }

  useEffect(() => {
    const loaded = loadSettings()
    settingsRef.current = loaded
    setSettings(loaded)
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const renderer = createRenderer(canvas)
    rendererRef.current = renderer
    const resize = () => {
      const rect = canvas.getBoundingClientRect()
      renderer.resize(rect.width, rect.height, window.devicePixelRatio)
      renderer.render(engineRef.current.snapshot(), settingsRef.current, 16)
    }
    const observer = new ResizeObserver(resize)
    observer.observe(canvas)
    resize()
    return () => {
      observer.disconnect()
      renderer.destroy()
      rendererRef.current = null
    }
  }, [])

  useEffect(() => {
    mountedRef.current = true
    const shell = shellRef.current
    const audio = createGameAudio()
    audio.setEnabled(settingsRef.current.sound)
    audioRef.current = audio
    hapticsRef.current = createHaptics()

    const onVisibilityChange = () => {
      if (document.visibilityState !== 'visible') pauseRound('Page hidden. Game paused')
    }
    const onWindowBlur = () => pauseRound('Window lost focus. Game paused')
    const onOrientationChange = () => pauseRound('Orientation changed. Game paused')
    const onFullscreenChange = () => {
      if (document.fullscreenElement === shell) {
        removeFocusLock()
        transitionImmersiveMode('fullscreen')
        return
      }
      if (immersiveModeRef.current === 'fullscreen') {
        pauseRound('Fullscreen exited. Game paused')
        removeFocusLock()
        transitionImmersiveMode('none')
      }
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        if (playStateRef.current !== 'playing') return
        event.preventDefault()
        heldDirectionsRef.current = {
          ...heldDirectionsRef.current,
          [event.key === 'ArrowLeft' ? 'left' : 'right']: true,
        }
        rendererRef.current?.setPointerX(null)
        engineRef.current.setInput(inputForHeldDirections(heldDirectionsRef.current))
        return
      }
      if (event.repeat) return

      switch (event.key.toLowerCase()) {
        case 'escape':
          pauseRound('Game paused')
          break
        case 'p':
          if (playStateRef.current === 'paused') resumeRound()
          else pauseRound('Game paused')
          break
        case 'm':
          toggleSound()
          break
        case 'f':
          void toggleImmersive()
          break
        case 'enter':
          if (playStateRef.current === 'paused') resumeRound()
          else if (playStateRef.current === 'ready' || playStateRef.current === 'gameOver') startRound()
          break
      }
    }
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
      heldDirectionsRef.current = {
        ...heldDirectionsRef.current,
        [event.key === 'ArrowLeft' ? 'left' : 'right']: false,
      }
      engineRef.current.setInput(inputForHeldDirections(heldDirectionsRef.current))
    }

    document.addEventListener('visibilitychange', onVisibilityChange)
    document.addEventListener('fullscreenchange', onFullscreenChange)
    window.addEventListener('blur', onWindowBlur)
    window.addEventListener('orientationchange', onOrientationChange)
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)

    return () => {
      mountedRef.current = false
      submissionSequenceRef.current += 1
      cancelFrame()
      clearCountdownTimers()
      clearHeldDirections()
      hapticsRef.current?.stop()
      hapticsRef.current = null
      void audio.destroy()
      audioRef.current = null
      removeFocusLock()
      if (document.fullscreenElement === shell) void exitImmersive(document)
      document.removeEventListener('visibilitychange', onVisibilityChange)
      document.removeEventListener('fullscreenchange', onFullscreenChange)
      window.removeEventListener('blur', onWindowBlur)
      window.removeEventListener('orientationchange', onOrientationChange)
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
    }
  }, [
    cancelFrame,
    clearCountdownTimers,
    clearHeldDirections,
    pauseRound,
    removeFocusLock,
    resumeRound,
    startRound,
    toggleImmersive,
    toggleSound,
    transitionImmersiveMode,
  ])

  return (
    <div className="flex w-full flex-col items-center gap-4">
      <div ref={shellRef} className="chikoo-game-shell" data-immersive={immersiveMode}>
        <canvas
          ref={canvasRef}
          className="chikoo-game-canvas"
          role="img"
          aria-label="Chikoo Catcher orchard. Move the basket to catch ripe chikoos and avoid rotten ones."
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerLeave={clearPointer}
          onPointerCancel={clearPointer}
        />
        {playState === 'playing' && (
          <GameHud
            snapshot={snapshot}
            soundEnabled={settings.sound}
            immersiveMode={immersiveMode}
            onPause={() => pauseRound('Game paused')}
            onToggleSound={toggleSound}
            onToggleImmersive={() => void toggleImmersive()}
          />
        )}
        {playState === 'ready' && (
          <GameOverlay
            state="ready"
            settings={settings}
            onPlay={startRound}
            onToggleSound={toggleSound}
            onToggleHaptics={toggleHaptics}
            onToggleReducedEffects={toggleReducedEffects}
            onToggleImmersive={() => void toggleImmersive()}
          />
        )}
        {playState === 'countdown' && <GameOverlay state="countdown" count={countdown} />}
        {playState === 'paused' && (
          <GameOverlay
            state="paused"
            settings={settings}
            immersiveMode={immersiveMode}
            onResume={resumeRound}
            onRestart={restartRound}
            onExit={() => void exitImmersiveMode()}
            onToggleSound={toggleSound}
            onToggleHaptics={toggleHaptics}
            onToggleReducedEffects={toggleReducedEffects}
          />
        )}
        {playState === 'gameOver' && (
          <GameOverlay
            state="gameOver"
            score={frozenScoreRef.current ?? snapshot.score}
            bestScore={initialBestScore}
            submitState={submitState}
            submitError={submitError}
            isSignedIn={isSignedIn}
            onPlayAgain={startRound}
            onRetrySave={retrySave}
            onExit={() => void exitImmersiveMode()}
          />
        )}
        <p className="sr-only" aria-live="polite" aria-atomic="true">
          {announcement}
        </p>
      </div>
      <p className="text-center text-xs text-[var(--od-muted)]">
        Drag or move your pointer · Arrow keys move · P pauses · F toggles fullscreen · M toggles sound
      </p>
    </div>
  )
}
