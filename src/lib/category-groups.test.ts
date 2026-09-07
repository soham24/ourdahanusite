import { test } from 'node:test'
import assert from 'node:assert/strict'

import { buildCategoryGroups, type GroupThumbSource } from './category-groups'

function listing(over: Partial<GroupThumbSource> = {}): GroupThumbSource {
  return {
    id: 'l1',
    name: 'Test Business',
    category: 'Restaurants',
    image_thumb_url: 'https://img/thumb.jpg',
    image_url: null,
    rating: 5,
    review_count: 3,
    ...over,
  }
}

test('rolls granular categories up into their group', () => {
  const out = buildCategoryGroups({ Restaurants: 4, Cafe: 2, 'Homemade Food': 4 }, [])
  assert.equal(out.length, 1)
  assert.equal(out[0].label, 'Food & Dining')
  assert.equal(out[0].count, 10)
  assert.equal(out[0].icon, '🍽️')
})

test('excludes groups with a zero count', () => {
  // Hotels & Stay is the only member of Hospitality & Stay.
  const out = buildCategoryGroups({ Restaurants: 4, 'Hotels & Stay': 0 }, [])
  assert.deepEqual(out.map(g => g.label), ['Food & Dining'])
})

test('orders by count descending', () => {
  const out = buildCategoryGroups({ Restaurants: 2, 'Arts & Crafts': 9 }, [])
  assert.deepEqual(out.map(g => g.label), ['Arts & Crafts', 'Food & Dining'])
})

test('breaks count ties by label ascending', () => {
  const out = buildCategoryGroups(
    { 'Arts & Crafts': 5, 'Event Services': 5, 'Repair Services': 5 },
    [],
  )
  assert.deepEqual(out.map(g => g.label), [
    'Arts & Crafts',
    'Events & Entertainment',
    'Home Services',
  ])
})

test('respects the limit', () => {
  const out = buildCategoryGroups(
    { Restaurants: 9, 'Arts & Crafts': 8, 'Repair Services': 7, 'Event Services': 6 },
    [],
    2,
  )
  assert.equal(out.length, 2)
  assert.deepEqual(out.map(g => g.label), ['Food & Dining', 'Arts & Crafts'])
})

test('attaches up to three thumbnails, best rated first', () => {
  const out = buildCategoryGroups({ Restaurants: 4 }, [
    listing({ id: 'a', rating: 3, review_count: 1 }),
    listing({ id: 'b', rating: 5, review_count: 9 }),
    listing({ id: 'c', rating: 5, review_count: 2 }),
    listing({ id: 'd', rating: 4, review_count: 1 }),
  ])
  assert.deepEqual(out[0].thumbs.map(t => t.id), ['b', 'c', 'd'])
})

test('falls back to image_url when image_thumb_url is missing', () => {
  const out = buildCategoryGroups({ Restaurants: 1 }, [
    listing({ id: 'a', image_thumb_url: null, image_url: 'https://img/full.jpg' }),
  ])
  assert.equal(out[0].thumbs[0].imageUrl, 'https://img/full.jpg')
})

test('never selects a listing with no image at all', () => {
  const out = buildCategoryGroups({ Restaurants: 2 }, [
    listing({ id: 'a', image_thumb_url: null, image_url: null }),
    listing({ id: 'b' }),
  ])
  assert.deepEqual(out[0].thumbs.map(t => t.id), ['b'])
})

test('ignores listings whose category is outside the group', () => {
  const out = buildCategoryGroups({ Restaurants: 1 }, [
    listing({ id: 'x', category: 'Arts & Crafts' }),
  ])
  assert.deepEqual(out[0].thumbs, [])
})

test('lists only live member categories, with links', () => {
  const out = buildCategoryGroups({ Restaurants: 4, Cafe: 2, 'Dairy & Milk': 0 }, [])
  assert.deepEqual(out[0].members.map(m => m.label), ['Restaurants', 'Cafe'])
  assert.equal(out[0].members[0].count, 4)
  assert.equal(out[0].members[0].href, '/listings/category/restaurants')
})

test('empty input produces empty output', () => {
  assert.deepEqual(buildCategoryGroups({}, []), [])
})
