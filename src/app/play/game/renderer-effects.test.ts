import assert from 'node:assert/strict'
import test from 'node:test'
import { GAME_CONFIG } from './config'
import { createGameEngine } from './engine'
import { createRenderer, timerBars } from './renderer'
import type { GameEvent, GameSettings, GameSnapshot } from './types'

const settings: GameSettings = { sound: true, haptics: true, reducedEffects: false }

function spyCanvas() {
  const calls = { arc: 0, fillText: [] as string[], fillRect: 0 }
  const gradient = { addColorStop() {} }
  const context = new Proxy({} as CanvasRenderingContext2D, {
    get(_target, property) {
      if (property === 'arc') return () => { calls.arc += 1 }
      if (property === 'fillText') return (text: string) => { calls.fillText.push(text) }
      if (property === 'fillRect') return () => { calls.fillRect += 1 }
      if (property === 'createLinearGradient' || property === 'createRadialGradient') return () => gradient
      return () => undefined
    },
    set: () => true,
  })
  const canvas = { width: 360, height: 640, style: {}, getContext: () => context } as unknown as HTMLCanvasElement
  return { canvas, calls }
}

const baseSnapshot = (): GameSnapshot => createGameEngine(() => 0.5).snapshot()

test('golden chikoos and the power-up are drawn as their own items', () => {
  const { canvas, calls } = spyCanvas()
  const renderer = createRenderer(canvas)
  const empty = baseSnapshot()
  renderer.render(empty, settings, 16)
  const emptyArcs = calls.arc

  const withItems: GameSnapshot = {
    ...empty,
    items: [
      { id: 1, kind: 'golden', x: 100, y: 200, vx: 0, rotation: 0, spin: 0 },
      { id: 2, kind: 'bigBasket', x: 200, y: 200, vx: 0, rotation: 0, spin: 0 },
    ],
  }
  calls.arc = 0
  renderer.render(withItems, settings, 16)
  assert.equal(calls.arc - emptyArcs, 2, 'one body each')
})

test('a golden catch floats its points; a phase change and a streak announce themselves', () => {
  const { canvas, calls } = spyCanvas()
  const renderer = createRenderer(canvas)
  const snapshot = baseSnapshot()
  renderer.emit([
    { type: 'goldenCaught', x: 120, y: 560, combo: 3, points: 3 },
    { type: 'phaseChanged', phase: 'rush' },
  ])
  renderer.render(snapshot, settings, 16)
  assert.ok(calls.fillText.includes('+3'))
  assert.ok(calls.fillText.includes('Rush!'))

  calls.fillText.length = 0
  renderer.emit([{ type: 'ripeCaught', x: 120, y: 560, combo: 10, bonusAwarded: 1 }])
  renderer.render(snapshot, settings, 16)
  assert.ok(calls.fillText.includes('10 in a row!'))
})

test('banners still show with reduced effects; floating points do not', () => {
  const { canvas, calls } = spyCanvas()
  const renderer = createRenderer(canvas)
  renderer.emit([{ type: 'goldenCaught', x: 120, y: 560, combo: 3, points: 3 }])
  renderer.announce('New best!')
  renderer.render(baseSnapshot(), { ...settings, reducedEffects: true }, 16)
  assert.deepEqual(calls.fillText, ['New best!'])
})

test('a banner clears itself after a moment', () => {
  const { canvas, calls } = spyCanvas()
  const renderer = createRenderer(canvas)
  renderer.announce('Big basket!')
  for (let frame = 0; frame < 120; frame += 1) renderer.render(baseSnapshot(), settings, 16)
  calls.fillText.length = 0
  renderer.render(baseSnapshot(), settings, 16)
  assert.deepEqual(calls.fillText, [])
})

test('every top-up is drawn as its own token, never as a rotten chikoo', () => {
  const { canvas, calls } = spyCanvas()
  const renderer = createRenderer(canvas)
  const empty = baseSnapshot()
  renderer.render(empty, settings, 16)
  const emptyArcs = calls.arc
  calls.arc = 0
  renderer.render({
    ...empty,
    items: [
      { id: 1, kind: 'slowFall', x: 80, y: 200, vx: 0, rotation: 0, spin: 0 },
      { id: 2, kind: 'doubleHarvest', x: 180, y: 200, vx: 0, rotation: 0, spin: 0 },
      { id: 3, kind: 'extraLife', x: 280, y: 200, vx: 0, rotation: 0, spin: 0 },
    ],
  }, settings, 16)
  // Two ringed tokens; the heart is drawn with curves, not arcs.
  assert.equal(calls.arc - emptyArcs, 2)
})

test('each top-up names itself, and a milestone that gives a life back says so', () => {
  const { canvas, calls } = spyCanvas()
  const renderer = createRenderer(canvas)
  const snapshot = baseSnapshot()
  const said = (events: GameEvent[]) => {
    calls.fillText.length = 0
    renderer.emit(events)
    renderer.render(snapshot, settings, 16)
    return calls.fillText
  }
  assert.ok(said([{ type: 'powerUp', kind: 'slowFall', x: 100, y: 560, durationMs: 6000 }]).includes('Monsoon breeze'))
  assert.ok(said([{ type: 'powerUp', kind: 'doubleHarvest', x: 100, y: 560, durationMs: 8000 }]).includes('Double harvest ×2'))
  assert.ok(said([{ type: 'powerUp', kind: 'extraLife', x: 100, y: 560, durationMs: 0 }]).includes('Extra life!'))
  const fifty = said([{ type: 'milestone', score: 50 }])
  assert.ok(fifty.includes('50 points!'))
  assert.equal(fifty.includes('+1 life'), false)
  const thousand = said([{ type: 'milestone', score: 1000 }, { type: 'lifeRestored', source: 'milestone' }])
  assert.ok(thousand.includes('1,000 points!'))
  assert.ok(thousand.includes('+1 life'))
})

test('a double-harvest catch floats its real points', () => {
  const { canvas, calls } = spyCanvas()
  const renderer = createRenderer(canvas)
  renderer.emit([{ type: 'ripeCaught', x: 120, y: 560, combo: 2, bonusAwarded: 0, points: 2 }])
  renderer.render(baseSnapshot(), settings, 16)
  assert.ok(calls.fillText.includes('+2'))
})

test('timer bars: one per running top-up, in a fixed order', () => {
  assert.deepEqual(timerBars({ bigBasketMs: 0, slowFallMs: 0, doubleHarvestMs: 0 }), [])
  const bars = timerBars({ bigBasketMs: 0, slowFallMs: GAME_CONFIG.slowFallMs / 2, doubleHarvestMs: GAME_CONFIG.doubleHarvestMs })
  assert.deepEqual(bars.map((bar) => bar.fraction), [0.5, 1])
})

test('one mistake from game over tints the edges, and only then', () => {
  const { canvas, calls } = spyCanvas()
  const renderer = createRenderer(canvas)
  const safe = baseSnapshot()
  renderer.render(safe, settings, 16)
  const safeRects = calls.fillRect
  calls.fillRect = 0
  renderer.render({ ...safe, misses: GAME_CONFIG.maxMisses - 1 }, settings, 16)
  assert.equal(calls.fillRect - safeRects, 4, 'four edges')
})
