import { test } from 'node:test'
import assert from 'node:assert/strict'

import { codesMatch, normalizeCompetitionCode, rankStandings, validateCompetitionInput } from './competition'

test('normalizeCompetitionCode trims, upper-cases and enforces the DB pattern', () => {
  assert.equal(normalizeCompetitionCode(' sapota21 '), 'SAPOTA21')
  assert.equal(normalizeCompetitionCode('ab'), null)
  assert.equal(normalizeCompetitionCode('SAP-21'), null)
  assert.equal(normalizeCompetitionCode('A'.repeat(24)), 'A'.repeat(24))
  assert.equal(normalizeCompetitionCode('A'.repeat(25)), null)
})

test('codesMatch normalizes the entered code and rejects other lengths', () => {
  assert.equal(codesMatch('abc', 'ABC'), true, 'a short code saved before the 6-character rule still works')
  assert.equal(codesMatch(' sapota21', 'SAPOTA21'), true)
  assert.equal(codesMatch('SAPOTA2', 'SAPOTA21'), false)
  assert.equal(codesMatch('SAPOTA22', 'SAPOTA21'), false)
  assert.equal(codesMatch('!!', 'SAPOTA21'), false)
})

const TODAY = '2026-11-21'
const base = { day: '2026-11-21', title: 'Daily', prize: 'Sapota box', code: ' abc123 ', active: true }

test('validateCompetitionInput accepts a valid input and returns trimmed, normalized values', () => {
  const r = validateCompetitionInput({ ...base, title: '  Daily  ', prize: ' Sapota box ' }, TODAY)
  assert.deepEqual(r, {
    ok: true,
    value: { day: '2026-11-21', title: 'Daily', prize: 'Sapota box', code: 'ABC123', active: true },
  })
})

test('validateCompetitionInput rejects bad days, titles, prizes and codes', () => {
  assert.equal(validateCompetitionInput({ ...base, day: '2026-11-20', title: 'x', prize: 'y', code: 'ABC' }, TODAY).ok, false)
  assert.equal(validateCompetitionInput({ ...base, day: '2026-02-30' }, TODAY).ok, false)
  assert.equal(validateCompetitionInput({ ...base, day: '21-11-2026' }, TODAY).ok, false)
  assert.equal(validateCompetitionInput({ ...base, title: 'x'.repeat(81) }, TODAY).ok, false)
  assert.equal(validateCompetitionInput({ ...base, title: 'x'.repeat(80) }, TODAY).ok, true)
  assert.equal(validateCompetitionInput({ ...base, title: '   ' }, TODAY).ok, false)
  assert.equal(validateCompetitionInput({ ...base, prize: 'y'.repeat(201) }, TODAY).ok, false)
  assert.equal(validateCompetitionInput({ ...base, prize: '' }, TODAY).ok, false)
  assert.equal(validateCompetitionInput({ ...base, code: 'A-1' }, TODAY).ok, false)
  assert.equal(validateCompetitionInput({ ...base, code: 'ABCDE' }, TODAY).ok, false, 'new codes need 6+ characters')
  assert.equal(validateCompetitionInput({ ...base, code: 'ABCDEF' }, TODAY).ok, true)
  assert.equal(validateCompetitionInput({ ...base, code: 'A'.repeat(25) }, TODAY).ok, false)
  assert.equal(validateCompetitionInput({ ...base, day: '2026-12-01' }, TODAY).ok, true)
})

test('rankStandings orders by best, earliest reach, then excluded last', () => {
  const rows = [
    { userId: 'A', score: 50, playedAt: '2026-11-21T10:00:00Z' },
    { userId: 'A', score: 30, playedAt: '2026-11-21T08:00:00Z' },
    { userId: 'B', score: 50, playedAt: '2026-11-21T09:00:00Z' },
    { userId: 'C', score: 90, playedAt: '2026-11-21T07:00:00Z' },
  ]
  const out = rankStandings(rows, new Set(['C']))
  assert.deepEqual(out.map((r) => r.userId), ['B', 'A', 'C'])
  assert.equal(out.find((r) => r.userId === 'A')?.rounds, 2)
  assert.equal(out.find((r) => r.userId === 'A')?.reachedAt, '2026-11-21T10:00:00Z')
  assert.deepEqual(out.map((r) => r.excluded), [false, false, true])
})

test('rankStandings uses when the best was reached, not the first round', () => {
  // A played early with a low score; B reached 50 before A reached 50.
  const rows = [
    { userId: 'A', score: 10, playedAt: '2026-11-21T06:00:00Z' },
    { userId: 'A', score: 50, playedAt: '2026-11-21T12:00:00Z' },
    { userId: 'B', score: 50, playedAt: '2026-11-21T09:00:00Z' },
  ]
  assert.deepEqual(rankStandings(rows, new Set()).map((r) => r.userId), ['B', 'A'])
})

test('rankStandings keeps the earliest of repeated best scores and breaks full ties by userId', () => {
  const rows = [
    { userId: 'Z', score: 40, playedAt: '2026-11-21T09:00:00Z' },
    { userId: 'Y', score: 40, playedAt: '2026-11-21T09:00:00Z' },
    { userId: 'Z', score: 40, playedAt: '2026-11-21T05:00:00Z' },
  ]
  const out = rankStandings(rows, new Set())
  assert.deepEqual(out.map((r) => r.userId), ['Z', 'Y'])
  assert.equal(out[0].reachedAt, '2026-11-21T05:00:00Z')
  const tie = rankStandings(rows.slice(0, 2), new Set())
  assert.deepEqual(tie.map((r) => r.userId), ['Y', 'Z'])
})
