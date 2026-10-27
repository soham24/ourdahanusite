import { test } from 'node:test'
import assert from 'node:assert/strict'

import { latestPerBusiness } from './recent'

const row = (id: string, listing_id: string) => ({ id, listing_id })

test('keeps only the newest item from each business', () => {
  const rows = [row('a1', 'A'), row('a2', 'A'), row('b1', 'B'), row('a3', 'A'), row('c1', 'C')]
  assert.deepEqual(latestPerBusiness(rows, 5).map((r) => r.id), ['a1', 'b1', 'c1'])
})

test('stops at the limit', () => {
  const rows = ['A', 'B', 'C', 'D', 'E', 'F', 'G'].map((l) => row(`${l}1`, l))
  assert.deepEqual(latestPerBusiness(rows, 5).map((r) => r.listing_id), ['A', 'B', 'C', 'D', 'E'])
})

test('returns nothing for no rows or a zero limit', () => {
  assert.deepEqual(latestPerBusiness([], 5), [])
  assert.deepEqual(latestPerBusiness([row('a1', 'A')], 0), [])
})
