import assert from 'node:assert/strict'
import test from 'node:test'

import { MIN_HOME_REVIEW_LENGTH, pickHomeReviews, type HomeReviewRow } from './home-shape'

const LONG = 'A'.repeat(MIN_HOME_REVIEW_LENGTH)

function row(id: string, listingId: string, fields: Partial<HomeReviewRow> = {}): HomeReviewRow {
  return {
    id,
    listing_id: listingId,
    user_id: `u-${id}`,
    rating: 5,
    comment: LONG,
    created_at: `2026-11-21T00:00:0${id.length}Z`,
    listings: { name: `Shop ${listingId}`, subdomain: listingId, owner_id: 'owner' },
    ...fields,
  }
}

test('keeps the newest review per business, with names', () => {
  const picked = pickHomeReviews(
    [row('1', 'a'), row('2', 'a'), row('3', 'b')],
    new Map([['u-1', 'Asha']]),
  )
  assert.deepEqual(picked.map((r) => r.id), ['1', '3'])
  assert.equal(picked[0].reviewer_name, 'Asha')
  assert.equal(picked[0].listing_name, 'Shop a')
  assert.equal(picked[1].reviewer_name, null)
})

test('skips short reviews and owners reviewing themselves, without hiding the business', () => {
  const picked = pickHomeReviews(
    [
      row('1', 'a', { comment: 'Nice' }),
      row('2', 'a', { user_id: 'owner' }),
      row('3', 'a'),
      row('4', 'b', { comment: null }),
    ],
    new Map(),
  )
  assert.deepEqual(picked.map((r) => r.id), ['3'])
})

test('stops at the limit and survives a missing listing', () => {
  const rows = Array.from({ length: 10 }, (_, i) => row(String(i), `l${i}`, { listings: null }))
  const picked = pickHomeReviews(rows, new Map())
  assert.equal(picked.length, 6)
  assert.equal(picked[0].listing_name, 'Unknown listing')
  assert.equal(picked[0].listing_subdomain, null)
})
