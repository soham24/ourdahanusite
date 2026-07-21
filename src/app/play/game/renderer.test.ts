import assert from 'node:assert/strict'
import test from 'node:test'
import { createQualityController, getBackingScale } from './renderer'

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
