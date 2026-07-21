import assert from 'node:assert/strict'
import test from 'node:test'
import { DEFAULT_SETTINGS, loadSettings, saveSettings } from './storage'

test('settings use safe defaults without storage', () => {
  assert.deepEqual(loadSettings(null), DEFAULT_SETTINGS)
})

test('settings recover from corrupt JSON', () => {
  const storage = { getItem: () => '{bad', setItem: () => undefined }
  assert.deepEqual(loadSettings(storage), DEFAULT_SETTINGS)
})

test('reduced-motion preference becomes the default until the player saves a choice', () => {
  const storage = { getItem: () => null, setItem: () => undefined }
  assert.equal(loadSettings(storage, true).reducedEffects, true)
})

test('settings round-trip through the versioned key', () => {
  const values = new Map<string, string>()
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => void values.set(key, value),
  }
  const settings = { sound: false, haptics: true, reducedEffects: true }
  saveSettings(settings, storage)
  assert.deepEqual(loadSettings(storage), settings)
})
