'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { PointerEvent } from 'react'
import { useRouter } from 'next/navigation'
import { submitGameScore } from '@/app/actions/game'
import { buildAbsoluteUrl } from '@/lib/site'

const CANVAS_WIDTH = 360
const CANVAS_HEIGHT = 520
const BASKET_WIDTH = 70
const BASKET_HEIGHT = 36
const BASKET_Y = CANVAS_HEIGHT - 50
const ITEM_RADIUS = 16
const BAD_ITEM_CHANCE = 0.25
const BASE_FALL_SPEED = 110 // px/sec
const MAX_FALL_SPEED = 340
const BASE_SPAWN_INTERVAL = 950 // ms
const MIN_SPAWN_INTERVAL = 380
const RAMP_INTERVAL_MS = 10_000
const RAMP_SPEED_FACTOR = 1.08
const RAMP_SPAWN_FACTOR = 0.93
const MAX_MISSES = 3
const MAX_BAD_CATCHES = 3
const KEY_SPEED = 260 // px/sec

interface FallingItem {
  id: number
  x: number
  y: number
  isBad: boolean
}

type GameState = 'idle' | 'playing' | 'over'
type SubmitState = 'idle' | 'saving' | 'saved' | 'best' | 'error'

export default function ChikooCatcherGame({ isSignedIn }: { isSignedIn: boolean }) {
  const router = useRouter()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [gameState, setGameState] = useState<GameState>('idle')
  const [score, setScore] = useState(0)
  const [misses, setMisses] = useState(0)
  const [badCatches, setBadCatches] = useState(0)
  const [submitState, setSubmitState] = useState<SubmitState>('idle')
  const [submitError, setSubmitError] = useState('')

  // Mutable game state that must not trigger a re-render every frame.
  const basketXRef = useRef(CANVAS_WIDTH / 2)
  const itemsRef = useRef<FallingItem[]>([])
  const nextIdRef = useRef(0)
  const lastSpawnRef = useRef(0)
  const lastFrameRef = useRef(0)
  const elapsedRef = useRef(0)
  const rafRef = useRef<number | null>(null)
  const scoreRef = useRef(0)
  const missesRef = useRef(0)
  const badCatchesRef = useRef(0)

  const draw = useCallback((ctx: CanvasRenderingContext2D) => {
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)

    ctx.fillStyle = '#FBF0DC'
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)

    for (const item of itemsRef.current) {
      ctx.beginPath()
      ctx.arc(item.x, item.y, ITEM_RADIUS, 0, Math.PI * 2)
      ctx.fillStyle = item.isBad ? '#6b7280' : '#C0582E'
      ctx.fill()
      if (item.isBad) {
        ctx.beginPath()
        ctx.arc(item.x - 5, item.y - 4, 3, 0, Math.PI * 2)
        ctx.fillStyle = '#374151'
        ctx.fill()
      }
    }

    const basketX = basketXRef.current
    ctx.fillStyle = '#7A4520'
    ctx.fillRect(basketX - BASKET_WIDTH / 2, BASKET_Y, BASKET_WIDTH, BASKET_HEIGHT)
    ctx.strokeStyle = '#3D1A08'
    ctx.lineWidth = 2
    ctx.strokeRect(basketX - BASKET_WIDTH / 2, BASKET_Y, BASKET_WIDTH, BASKET_HEIGHT)
  }, [])

  const endGame = useCallback((finalScore: number) => {
    setGameState('over')
    if (rafRef.current) cancelAnimationFrame(rafRef.current)

    if (!isSignedIn) return

    setSubmitState('saving')
    submitGameScore(finalScore).then((res) => {
      if (res.error) {
        setSubmitError(res.error)
        setSubmitState('error')
        return
      }
      setSubmitState(res.isNewBest ? 'best' : 'saved')
      router.refresh()
    })
  }, [isSignedIn, router])

  /* eslint-disable react-hooks/immutability -- intentional self-referential
     recursive rAF loop; `tick` is fully assigned before this async callback ever runs. */
  const tick = useCallback((time: number) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    if (!lastFrameRef.current) lastFrameRef.current = time
    const dt = Math.min(time - lastFrameRef.current, 50)
    lastFrameRef.current = time
    elapsedRef.current += dt

    const ramps = Math.floor(elapsedRef.current / RAMP_INTERVAL_MS)
    const fallSpeed = Math.min(BASE_FALL_SPEED * Math.pow(RAMP_SPEED_FACTOR, ramps), MAX_FALL_SPEED)
    const spawnInterval = Math.max(BASE_SPAWN_INTERVAL * Math.pow(RAMP_SPAWN_FACTOR, ramps), MIN_SPAWN_INTERVAL)

    if (time - lastSpawnRef.current > spawnInterval) {
      lastSpawnRef.current = time
      itemsRef.current.push({
        id: nextIdRef.current++,
        x: ITEM_RADIUS + Math.random() * (CANVAS_WIDTH - ITEM_RADIUS * 2),
        y: -ITEM_RADIUS,
        isBad: Math.random() < BAD_ITEM_CHANCE,
      })
    }

    const remaining: FallingItem[] = []
    for (const item of itemsRef.current) {
      const newY = item.y + fallSpeed * (dt / 1000)
      const caught =
        newY + ITEM_RADIUS >= BASKET_Y &&
        newY - ITEM_RADIUS <= BASKET_Y + BASKET_HEIGHT &&
        item.x >= basketXRef.current - BASKET_WIDTH / 2 &&
        item.x <= basketXRef.current + BASKET_WIDTH / 2

      if (caught) {
        if (item.isBad) {
          badCatchesRef.current += 1
          setBadCatches(badCatchesRef.current)
        } else {
          scoreRef.current += 1
          setScore(scoreRef.current)
        }
        continue
      }

      if (newY - ITEM_RADIUS > CANVAS_HEIGHT) {
        if (!item.isBad) {
          missesRef.current += 1
          setMisses(missesRef.current)
        }
        continue
      }

      remaining.push({ ...item, y: newY })
    }
    itemsRef.current = remaining

    draw(ctx)

    if (missesRef.current >= MAX_MISSES || badCatchesRef.current >= MAX_BAD_CATCHES) {
      endGame(scoreRef.current)
      return
    }

    rafRef.current = requestAnimationFrame(tick)
  }, [draw, endGame])
  /* eslint-enable react-hooks/immutability */

  const startGame = useCallback(() => {
    scoreRef.current = 0
    missesRef.current = 0
    badCatchesRef.current = 0
    itemsRef.current = []
    nextIdRef.current = 0
    lastSpawnRef.current = 0
    lastFrameRef.current = 0
    elapsedRef.current = 0
    basketXRef.current = CANVAS_WIDTH / 2
    setScore(0)
    setMisses(0)
    setBadCatches(0)
    setSubmitState('idle')
    setSubmitError('')
    setGameState('playing')
    rafRef.current = requestAnimationFrame(tick)
  }, [tick])

  // Initial paint so the canvas isn't blank-white before the first round starts.
  useEffect(() => {
    const ctx = canvasRef.current?.getContext('2d')
    if (ctx) draw(ctx)
  }, [draw])

  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [])

  useEffect(() => {
    if (gameState !== 'playing') return
    const held = new Set<string>()
    let keyFrame: number
    let lastKeyTime = 0

    const moveLoop = (time: number) => {
      if (!lastKeyTime) lastKeyTime = time
      const dt = (time - lastKeyTime) / 1000
      lastKeyTime = time
      if (held.has('ArrowLeft')) {
        basketXRef.current = Math.max(BASKET_WIDTH / 2, basketXRef.current - KEY_SPEED * dt)
      }
      if (held.has('ArrowRight')) {
        basketXRef.current = Math.min(CANVAS_WIDTH - BASKET_WIDTH / 2, basketXRef.current + KEY_SPEED * dt)
      }
      keyFrame = requestAnimationFrame(moveLoop)
    }
    keyFrame = requestAnimationFrame(moveLoop)

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault()
        held.add(e.key)
      }
    }
    const onKeyUp = (e: KeyboardEvent) => {
      held.delete(e.key)
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    return () => {
      cancelAnimationFrame(keyFrame)
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
    }
  }, [gameState])

  const handlePointerMove = (e: PointerEvent<HTMLCanvasElement>) => {
    if (gameState !== 'playing') return
    const rect = e.currentTarget.getBoundingClientRect()
    const scaleX = CANVAS_WIDTH / rect.width
    const x = (e.clientX - rect.left) * scaleX
    basketXRef.current = Math.max(BASKET_WIDTH / 2, Math.min(CANVAS_WIDTH - BASKET_WIDTH / 2, x))
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex w-full max-w-[360px] items-center justify-between text-sm font-semibold text-[var(--od-ink)]">
        <span>Score: {score}</span>
        <span>Misses: {misses}/{MAX_MISSES} · Bad catches: {badCatches}/{MAX_BAD_CATCHES}</span>
      </div>

      <div className="relative w-full max-w-[360px]">
        <canvas
          ref={canvasRef}
          width={CANVAS_WIDTH}
          height={CANVAS_HEIGHT}
          onPointerMove={handlePointerMove}
          className="w-full touch-none rounded-2xl border border-[var(--od-border)] shadow-sm"
          style={{ aspectRatio: `${CANVAS_WIDTH} / ${CANVAS_HEIGHT}` }}
        />

        {gameState !== 'playing' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 rounded-2xl bg-[rgba(61,26,8,0.75)] px-6 text-center text-white">
            {gameState === 'idle' && (
              <>
                <p className="text-lg font-bold">🧺 Chikoo Catcher</p>
                <p className="text-sm text-white/80">
                  Catch the good chikoos, dodge the rotten ones. 3 misses or 3 bad
                  catches ends the round.
                </p>
                <button type="button" onClick={startGame} className="od-button-primary px-5 py-2.5">
                  Start
                </button>
              </>
            )}

            {gameState === 'over' && (
              <>
                <p className="text-lg font-bold">Game over — score {score}</p>
                {isSignedIn ? (
                  <p className="text-sm text-white/80">
                    {submitState === 'saving' && 'Saving your score…'}
                    {submitState === 'best' && '🎉 New personal best!'}
                    {submitState === 'saved' && 'Score saved.'}
                    {submitState === 'error' && submitError}
                  </p>
                ) : (
                  <a
                    href={buildAbsoluteUrl(`/login?next=${encodeURIComponent('/play')}`)}
                    className="text-sm font-semibold text-[var(--od-brand)] underline"
                  >
                    Sign in to save your score →
                  </a>
                )}
                <button type="button" onClick={startGame} className="od-button-primary px-5 py-2.5">
                  Play again
                </button>
              </>
            )}
          </div>
        )}
      </div>

      <p className="text-xs text-[var(--od-muted)]">
        Desktop: arrow keys or mouse. Mobile: drag on the board.
      </p>
    </div>
  )
}
