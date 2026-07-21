import assert from 'node:assert/strict'
import test from 'node:test'
import { createGameEngine } from './engine'
import {
  advanceEffectDuration,
  createQualityController,
  createRenderer,
  getBackingScale,
  getNextParallaxX,
  getParallaxTarget,
} from './renderer'
import type { GameEvent, GameSettings } from './types'

const settings: GameSettings = { sound: true, haptics: true, reducedEffects: false }

function createCanvasSpy() {
  let arcCalls = 0
  let clearCalls = 0
  let textCalls = 0
  const gradient = { addColorStop() {} }
  const context = new Proxy({} as CanvasRenderingContext2D, {
    get(_target, property) {
      if (property === 'arc') return () => { arcCalls += 1 }
      if (property === 'clearRect') return () => { clearCalls += 1 }
      if (property === 'fillText') return () => { textCalls += 1 }
      if (property === 'createLinearGradient' || property === 'createRadialGradient') {
        return () => gradient
      }
      return () => undefined
    },
    set() {
      return true
    },
  })
  const canvas = {
    width: 360,
    height: 640,
    style: {},
    getContext: () => context,
  } as unknown as HTMLCanvasElement

  return {
    canvas,
    arcCalls: () => arcCalls,
    clearCalls: () => clearCalls,
    textCalls: () => textCalls,
  }
}

test('canvas backing scale is capped at two', () => {
  assert.equal(getBackingScale(1), 1)
  assert.equal(getBackingScale(3), 2)
})

test('quality reduces after sustained slow frames and recovers slowly', () => {
  const quality = createQualityController()
  for (let index = 0; index < 90; index += 1) quality.observe(24)
  assert.equal(quality.current(), 'reduced')
  for (let index = 0; index < 240; index += 1) quality.observe(16)
  assert.equal(quality.current(), 'high')
})

test('parallax is disabled immediately for reduced quality or reduced effects', () => {
  assert.equal(getNextParallaxX(5, 360, 'reduced', false), 0)
  assert.equal(getNextParallaxX(-5, 0, 'high', true), 0)
})

test('parallax derives from the pointer and stays within six logical pixels', () => {
  assert.equal(getParallaxTarget(null, 'high', false), 0)
  assert.equal(getParallaxTarget(-100, 'high', false), -6)
  assert.equal(getParallaxTarget(180, 'high', false), 0)
  assert.equal(getParallaxTarget(999, 'high', false), 6)
})

test('a long frame exhausts the damage shake duration', () => {
  assert.equal(advanceEffectDuration(110, 200), 0)
  assert.equal(advanceEffectDuration(110, -20), 110)
})

test('clear is inert after destroy', () => {
  const spy = createCanvasSpy()
  const renderer = createRenderer(spy.canvas)
  renderer.destroy()
  const clearsAfterDestroy = spy.clearCalls()
  renderer.clear()
  assert.equal(spy.clearCalls(), clearsAfterDestroy)
})

test('particle rendering stays capped at ninety-six active records', () => {
  const spy = createCanvasSpy()
  const renderer = createRenderer(spy.canvas)
  const snapshot = createGameEngine(() => 0.5).snapshot()
  renderer.render(snapshot, settings, 16)
  const baselineArcs = spy.arcCalls()
  const catches: GameEvent[] = Array.from({ length: 20 }, () => ({
    type: 'ripeCaught',
    x: 180,
    y: 300,
    combo: 1,
    bonusAwarded: 0,
  }))
  renderer.emit(catches)
  renderer.render(snapshot, settings, 16)
  const secondFrameArcs = spy.arcCalls() - baselineArcs
  assert.equal(secondFrameArcs - baselineArcs, 96)
})

test('combo burst rendering stays capped at twelve active records', () => {
  const spy = createCanvasSpy()
  const renderer = createRenderer(spy.canvas)
  const snapshot = createGameEngine(() => 0.5).snapshot()
  const bonuses: GameEvent[] = Array.from({ length: 20 }, () => ({
    type: 'ripeCaught',
    x: 180,
    y: 300,
    combo: 5,
    bonusAwarded: 1,
  }))
  renderer.emit(bonuses)
  renderer.render(snapshot, settings, 16)
  assert.equal(spy.textCalls(), 12)
})
