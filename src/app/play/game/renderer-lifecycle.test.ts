import assert from 'node:assert/strict'
import test from 'node:test'
import { initializeRenderer } from './renderer-lifecycle'

test('renderer initialization converts missing canvas context into an unavailable result', () => {
  const canvas = { getContext: () => null } as unknown as HTMLCanvasElement
  const result = initializeRenderer(canvas)

  assert.equal(result.renderer, null)
  assert.equal(result.error, 'This browser cannot start Chikoo Catcher because canvas rendering is unavailable.')
})
