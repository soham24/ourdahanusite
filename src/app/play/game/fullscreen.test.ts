import assert from 'node:assert/strict'
import test from 'node:test'
import { enterImmersive, exitImmersive } from './fullscreen'

test('native fullscreen is preferred', async () => {
  let requested = false
  const result = await enterImmersive({ requestFullscreen: async () => { requested = true } }, {})
  assert.equal(requested, true)
  assert.equal(result, 'fullscreen')
})

test('rejected fullscreen falls back to focus mode', async () => {
  const result = await enterImmersive({ requestFullscreen: async () => { throw new Error('denied') } }, {})
  assert.equal(result, 'focus')
})

test('exit uses document exit only when native fullscreen is active', async () => {
  let exited = false
  await exitImmersive({ fullscreenElement: {}, exitFullscreen: async () => { exited = true } })
  assert.equal(exited, true)
})
