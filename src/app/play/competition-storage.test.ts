import assert from 'node:assert/strict'
import test from 'node:test'
import {
  clearCompetitionCode,
  indiaTodayInBrowser,
  loadCompetitionCode,
  saveCompetitionCode,
  savedCodeNoLongerValid,
} from './competition-storage'

function memoryStorage() {
  const values = new Map<string, string>()
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => void values.set(key, value),
    removeItem: (key: string) => void values.delete(key),
    values,
  }
}

test('a saved code loads back for the same day', () => {
  const storage = memoryStorage()
  saveCompetitionCode(storage, '2026-11-21', 'SAPOTA21')
  assert.equal(loadCompetitionCode(storage, '2026-11-21'), 'SAPOTA21')
  assert.equal(storage.values.get('ourdahanu:chikoo-competition:2026-11-21'), 'SAPOTA21')
})

test('a code saved for another day does not load', () => {
  const storage = memoryStorage()
  saveCompetitionCode(storage, '2026-11-20', 'SAPOTA20')
  assert.equal(loadCompetitionCode(storage, '2026-11-21'), null)
})

test('a storage whose getItem throws loads nothing', () => {
  const storage = {
    getItem: () => {
      throw new Error('blocked')
    },
  }
  assert.equal(loadCompetitionCode(storage, '2026-11-21'), null)
})

test('no storage loads nothing and saving or clearing does not throw', () => {
  assert.equal(loadCompetitionCode(null, '2026-11-21'), null)
  assert.doesNotThrow(() => saveCompetitionCode(null, '2026-11-21', 'SAPOTA21'))
  assert.doesNotThrow(() => clearCompetitionCode(null, '2026-11-21'))
})

test('clearing removes the saved code, and throwing writes are swallowed', () => {
  const storage = memoryStorage()
  saveCompetitionCode(storage, '2026-11-21', 'SAPOTA21')
  clearCompetitionCode(storage, '2026-11-21')
  assert.equal(loadCompetitionCode(storage, '2026-11-21'), null)

  const broken = {
    setItem: () => {
      throw new Error('quota')
    },
    removeItem: () => {
      throw new Error('blocked')
    },
  }
  assert.doesNotThrow(() => saveCompetitionCode(broken, '2026-11-21', 'SAPOTA21'))
  assert.doesNotThrow(() => clearCompetitionCode(broken, '2026-11-21'))
})

test('indiaTodayInBrowser rolls over at India midnight', () => {
  assert.equal(indiaTodayInBrowser(new Date('2026-11-21T18:31:00Z')), '2026-11-22')
  assert.equal(indiaTodayInBrowser(new Date('2026-11-21T18:29:00Z')), '2026-11-21')
})

test('a saved code is dropped only when the server says it is wrong or the competition ended', () => {
  assert.equal(savedCodeNoLongerValid('wrong_code'), true)
  assert.equal(savedCodeNoLongerValid('no_competition'), true)
  for (const reason of ['need_name', 'too_many', 'signed_out', 'unavailable', undefined]) {
    assert.equal(savedCodeNoLongerValid(reason), false, String(reason))
  }
})
