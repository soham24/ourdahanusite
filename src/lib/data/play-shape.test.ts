import assert from 'node:assert/strict'
import test from 'node:test'

import { EMPTY_PLAY_PUBLIC, toPlayMe, toPlayPublic } from './play-shape'

test('the public bundle is shaped into boards, today and past winners', () => {
  const shaped = toPlayPublic({
    weekly: [{ full_name: 'Asha', best_score: 120 }, { full_name: '  ', best_score: 90 }],
    all_time: [{ full_name: 'Ravi', best_score: 400 }],
    today: { id: 'c1', title: 'Launch Day', prize: 'Reel collab', day: '2026-11-21', board: [{ full_name: 'Asha', best_score: 120 }] },
    past: [{ id: 'c0', title: 'Old', prize: 'Box', day: '2026-11-20', top: [{ full_name: null, best_score: 50 }] }],
  })
  assert.deepEqual(shaped.weekly, [{ name: 'Asha', score: 120 }, { name: 'Anonymous Player', score: 90 }])
  assert.deepEqual(shaped.allTime, [{ name: 'Ravi', score: 400 }])
  assert.deepEqual(shaped.today, { id: 'c1', title: 'Launch Day', prize: 'Reel collab', day: '2026-11-21', board: [{ name: 'Asha', score: 120 }] })
  assert.deepEqual(shaped.past, [{ id: 'c0', title: 'Old', prize: 'Box', day: '2026-11-20', top: [{ name: 'Anonymous Player', score: 50 }] }])
})

test('no competition today, or a broken bundle, shapes to empty', () => {
  assert.equal(toPlayPublic({ weekly: [], all_time: [], today: null, past: [] }).today, null)
  assert.deepEqual(toPlayPublic(null), EMPTY_PLAY_PUBLIC)
  assert.deepEqual(toPlayPublic('nonsense'), EMPTY_PLAY_PUBLIC)
  assert.deepEqual(toPlayPublic({ today: { id: 'x' }, past: [{ title: 'no id' }] }).past, [])
})

test("the player's numbers: null means signed out", () => {
  assert.equal(toPlayMe(null), null)
  assert.deepEqual(
    toPlayMe({ best_week: null, best_all: 75, last_played_at: '2026-11-21T10:00:00Z', has_name: true }),
    { bestWeek: null, bestAll: 75, lastPlayedAt: '2026-11-21T10:00:00Z', hasName: true },
  )
  assert.equal(toPlayMe({ has_name: 'yes' })?.hasName, false)
})
