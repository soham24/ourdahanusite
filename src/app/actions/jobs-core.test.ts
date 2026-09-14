import assert from 'node:assert/strict'
import test from 'node:test'
import type { User } from '@supabase/supabase-js'

import {
  createJobActions,
  DAILY_POST_LIMIT,
  DAILY_REVEAL_LIMIT,
  type JobActionDependencies,
  type StoredJobPost,
} from './jobs-core'
import type { JobPostInput } from '../../lib/jobs/validation'

const NOW = new Date('2026-09-14T06:30:00.000Z')
const DAY = 86_400_000
const inDays = (days: number) => new Date(NOW.getTime() + days * DAY).toISOString()
const LISTING_ID = '11111111-1111-4111-8111-111111111111'

const user = { id: 'user-1', email: 'asha@example.com', user_metadata: { full_name: 'Asha' } } as unknown as User

function hiringInput(overrides: Partial<JobPostInput> = {}): JobPostInput {
  return {
    kind: 'hiring',
    title: 'Cook',
    category: 'Hotel, Restaurant & Catering',
    workTypes: ['Full-time'],
    area: 'Dahanu Road',
    description: 'Morning shift.',
    employerName: 'Sai Hotel',
    openings: 1,
    payMin: 12000,
    payMax: 15000,
    payPeriod: 'month',
    timings: null,
    phone: '9876543210',
    whatsapp: true,
    ...overrides,
  }
}

function storedPost(overrides: Partial<StoredJobPost> = {}): StoredJobPost {
  return {
    id: 'post-1',
    kind: 'hiring',
    status: 'approved',
    posted_by: 'owner-9',
    listing_id: null,
    collected_source: null,
    title: 'Cook',
    expires_at: inDays(10),
    reviewed_at: null,
    review_flags: [],
    ...overrides,
  }
}

function harness(overrides: Partial<JobActionDependencies> = {}) {
  const calls = {
    inserted: [] as Array<{ row: Record<string, unknown>; contact: unknown }>,
    updated: [] as Array<{ postId: string; fields: Record<string, unknown>; contact?: unknown }>,
    reveals: [] as string[],
    reports: [] as unknown[],
    notified: [] as unknown[],
    revalidated: 0,
  }
  const deps: JobActionDependencies = {
    now: () => NOW,
    async getUser() { return user },
    async isStaff() { return false },
    async checkListing() { return { accessible: true, approved: true } },
    async countPostsSince() { return 0 },
    async insertPost(row, contact) { calls.inserted.push({ row, contact }); return { id: 'new-post', error: null } },
    async getPost() { return storedPost() },
    async updatePost(postId, fields, contact) { calls.updated.push({ postId, fields, contact }); return { error: null } },
    async getContact() { return { phone: '9876543210', whatsapp: true } },
    async hasRevealed() { return false },
    async countRevealsSince() { return 0 },
    async recordReveal(postId, userId) { calls.reveals.push(`${postId}:${userId}`); return { error: null } },
    async insertReport(row) { calls.reports.push(row); return { error: null } },
    async countReportsSince() { return 1 },
    async loginUrl(path) { return `https://ourdahanu.in/login?next=${encodeURIComponent(`https://jobs.ourdahanu.in${path}`)}` },
    notifyAdmins(payload) { calls.notified.push(payload) },
    revalidate() { calls.revalidated += 1 },
    ...overrides,
  }
  return { actions: createJobActions(deps), calls }
}

function silenceErrors() {
  const original = console.error
  const logged: unknown[][] = []
  console.error = (...args: unknown[]) => {
    logged.push(args)
  }
  return { logged, restore: () => { console.error = original } }
}

test('an individual post waits for review and tells the admins', async () => {
  const { actions, calls } = harness()
  assert.deepEqual(await actions.createPost(hiringInput()), { ok: true, id: 'new-post', status: 'pending' })
  const { row, contact } = calls.inserted[0]
  assert.equal(row.status, 'pending')
  assert.equal(row.posted_by, 'user-1')
  assert.equal('expires_at' in row, false)
  assert.deepEqual(contact, { phone: '9876543210', whatsapp: true })
  assert.deepEqual(calls.notified, [{ kind: 'job', title: 'Cook', submitterName: 'Asha', reviewPath: '/admin/jobs' }])
  assert.equal(calls.revalidated, 0)
})

test('the owner of an approved listing goes live instantly, with no admin notification', async () => {
  const { actions, calls } = harness()
  assert.deepEqual(await actions.createPost(hiringInput({ listingId: LISTING_ID })), { ok: true, id: 'new-post', status: 'approved' })
  const { row } = calls.inserted[0]
  assert.equal(row.published_at, NOW.toISOString())
  assert.equal(row.expires_at, inDays(30))
  assert.equal(row.listing_id, LISTING_ID)
  assert.deepEqual(calls.notified, [])
  assert.equal(calls.revalidated, 1)
})

test('a lapsed listing, or a flagged post from an approved one, waits for review', async () => {
  const lapsed = harness({ async checkListing() { return { accessible: true, approved: false } } })
  assert.deepEqual(await lapsed.actions.createPost(hiringInput({ listingId: LISTING_ID })), { ok: true, id: 'new-post', status: 'pending' })

  const flagged = harness()
  assert.deepEqual(
    await flagged.actions.createPost(hiringInput({ listingId: LISTING_ID, description: 'Registration fee ₹500.' })),
    { ok: true, id: 'new-post', status: 'pending' },
  )
  assert.deepEqual(flagged.calls.inserted[0].row.review_flags, ['scam_words'])
})

test('posting for a business you do not own is refused before anything is written', async () => {
  const { actions, calls } = harness({ async checkListing() { return { accessible: false, approved: true } } })
  assert.deepEqual(await actions.createPost(hiringInput({ listingId: LISTING_ID })), { error: 'You can only post for a business you own.' })
  assert.equal(calls.inserted.length, 0)
})

test('collected posts are staff-only, and go live regardless of flags', async () => {
  const outsider = harness()
  assert.deepEqual(
    await outsider.actions.createPost(hiringInput({ collectedSource: 'Lokmat, 12 Sep' })),
    { error: 'Only OurDahanu staff can post collected jobs.' },
  )

  const staff = harness({ async isStaff() { return true } })
  assert.deepEqual(
    await staff.actions.createPost(hiringInput({ collectedSource: 'Lokmat, 12 Sep', description: 'Call 9876543210' })),
    { ok: true, id: 'new-post', status: 'approved' },
  )
  assert.deepEqual(staff.calls.inserted[0].row.review_flags, [])
})

test('the daily post limit applies to everyone but staff', async () => {
  const busy = harness({ async countPostsSince() { return DAILY_POST_LIMIT } })
  assert.deepEqual(await busy.actions.createPost(hiringInput()), {
    error: `You can post ${DAILY_POST_LIMIT} times a day. Please try again tomorrow.`,
  })

  const staff = harness({ async countPostsSince() { return DAILY_POST_LIMIT }, async isStaff() { return true } })
  assert.equal('ok' in (await staff.actions.createPost(hiringInput())), true)
})

test('a second live profile is refused with a helpful message', async () => {
  const { actions } = harness({ async insertPost() { return { id: null, error: { code: '23505', message: 'duplicate key' } } } })
  const result = await actions.createPost({
    kind: 'seeking',
    title: 'Driver',
    category: 'Driver & Delivery',
    workTypes: ['Full-time'],
    area: 'Bordi',
    displayName: 'Ramesh',
    phone: '9876543210',
    whatsapp: true,
  })
  assert.deepEqual(result, { error: 'You already have a "Looking for work" profile. Edit or renew it from My posts.' })
})

test('logged-out posting is refused', async () => {
  const { actions } = harness({ async getUser() { return null } })
  assert.deepEqual(await actions.createPost(hiringInput()), { error: 'Please log in to post.' })
})

test('editing an approved individual post sends it back to review; a business post stays live', async () => {
  const individual = harness({ async getPost() { return storedPost({ posted_by: 'user-1' }) } })
  assert.deepEqual(await individual.actions.updatePost('post-1', hiringInput()), { ok: true, status: 'pending' })
  assert.equal(individual.calls.updated[0].fields.status, 'pending')
  assert.equal(individual.calls.notified.length, 1)

  const business = harness({ async getPost() { return storedPost({ posted_by: 'user-1', listing_id: LISTING_ID }) } })
  assert.deepEqual(await business.actions.updatePost('post-1', hiringInput({ listingId: LISTING_ID })), { ok: true, status: 'approved' })
  assert.equal(business.calls.notified.length, 0)
})

test('nobody else can edit a post, and closed posts cannot be edited', async () => {
  const stranger = harness()
  assert.deepEqual(await stranger.actions.updatePost('post-1', hiringInput()), { error: 'Post not found.' })

  const closed = harness({ async getPost() { return storedPost({ posted_by: 'user-1', status: 'closed' }) } })
  assert.deepEqual(await closed.actions.updatePost('post-1', hiringInput()), { error: 'This post is closed and can no longer be edited.' })
})

test('renew opens in the last 3 days and restarts the 30 days', async () => {
  const early = harness({ async getPost() { return storedPost({ posted_by: 'user-1', expires_at: inDays(4) }) } })
  assert.deepEqual(await early.actions.renewPost('post-1'), { error: 'You can renew a post in its last 3 days, or once it has expired.' })

  const lapsed = harness({ async getPost() { return storedPost({ posted_by: 'user-1', expires_at: inDays(-40) }) } })
  assert.deepEqual(await lapsed.actions.renewPost('post-1'), { ok: true })
  assert.deepEqual(lapsed.calls.updated[0].fields, {
    published_at: NOW.toISOString(),
    expires_at: inDays(30),
    reminder_sent_at: null,
    updated_at: NOW.toISOString(),
  })
})

test('revealing a number needs a login, and returns to the post afterwards', async () => {
  const { actions } = harness({ async getUser() { return null } })
  assert.deepEqual(await actions.revealContact('post-1'), {
    loginUrl: `https://ourdahanu.in/login?next=${encodeURIComponent('https://jobs.ourdahanu.in/j/post-1')}`,
  })
})

test('a first reveal is recorded; a repeat is free even over the limit', async () => {
  const first = harness()
  assert.deepEqual(await first.actions.revealContact('post-1'), { ok: true, phone: '9876543210', whatsapp: true })
  assert.deepEqual(first.calls.reveals, ['post-1:user-1'])

  const repeat = harness({ async hasRevealed() { return true }, async countRevealsSince() { return DAILY_REVEAL_LIMIT } })
  assert.deepEqual(await repeat.actions.revealContact('post-1'), { ok: true, phone: '9876543210', whatsapp: true })
  assert.deepEqual(repeat.calls.reveals, [])
})

test('the daily reveal limit stops a new reveal', async () => {
  const { actions, calls } = harness({ async countRevealsSince() { return DAILY_REVEAL_LIMIT } })
  assert.deepEqual(await actions.revealContact('post-1'), {
    error: `You have viewed ${DAILY_REVEAL_LIMIT} numbers today — that is the daily limit. Please try again tomorrow.`,
  })
  assert.deepEqual(calls.reveals, [])
})

test('posters revealing their own number are not counted, and expired posts stay hidden from others', async () => {
  const own = harness({ async getPost() { return storedPost({ posted_by: 'user-1', expires_at: inDays(-1) }) } })
  assert.equal('ok' in (await own.actions.revealContact('post-1')), true)
  assert.deepEqual(own.calls.reveals, [])

  const expired = harness({ async getPost() { return storedPost({ expires_at: inDays(-1) }) } })
  assert.deepEqual(await expired.actions.revealContact('post-1'), { error: 'This post is no longer live.' })
})

test('the third report since review hides an approved post; earlier ones do not', async () => {
  const second = harness({ async countReportsSince() { return 2 } })
  assert.deepEqual(await second.actions.reportPost('post-1', 'asks_for_money', null), { ok: true })
  assert.equal(second.calls.updated.length, 0)
  assert.equal(second.calls.notified.length, 1)

  const sinceArgs: Array<string | null> = []
  const third = harness({
    async getPost() { return storedPost({ reviewed_at: inDays(-5) }) },
    async countReportsSince(_postId, since) { sinceArgs.push(since); return 3 },
  })
  assert.deepEqual(await third.actions.reportPost('post-1', 'fake', ' looks fake '), { ok: true })
  assert.deepEqual(sinceArgs, [inDays(-5)])
  assert.deepEqual(third.calls.reports, [{ post_id: 'post-1', user_id: 'user-1', reason: 'fake', note: 'looks fake' }])
  assert.equal(third.calls.updated[0].fields.status, 'pending')
  assert.deepEqual(third.calls.updated[0].fields.review_flags, ['reports'])
  assert.equal(third.calls.revalidated, 1)
})

test('reports are refused for your own post, for an unknown reason, and twice', async () => {
  const own = harness({ async getPost() { return storedPost({ posted_by: 'user-1' }) } })
  assert.deepEqual(await own.actions.reportPost('post-1', 'fake', null), { error: 'You cannot report your own post.' })

  const unknownReason = harness()
  assert.deepEqual(await unknownReason.actions.reportPost('post-1', 'boring', null), { error: 'Choose a reason.' })

  const twice = harness({ async insertReport() { return { error: { code: '23505', message: 'duplicate' } } } })
  assert.deepEqual(await twice.actions.reportPost('post-1', 'fake', null), { error: 'You have already reported this post.' })
})

test('a failing admin notification never turns a saved post into an error', async () => {
  const errors = silenceErrors()
  try {
    const { actions, calls } = harness({ notifyAdmins() { throw new Error('telegram down') } })
    assert.deepEqual(await actions.createPost(hiringInput()), { ok: true, id: 'new-post', status: 'pending' })
    assert.equal(calls.inserted.length, 1)
    assert.equal(errors.logged.length, 1)
  } finally {
    errors.restore()
  }
})

test('a failing cache refresh never turns a saved post into an error', async () => {
  const errors = silenceErrors()
  try {
    const { actions } = harness({ revalidate() { throw new Error('cache down') } })
    assert.deepEqual(await actions.createPost(hiringInput({ listingId: LISTING_ID })), { ok: true, id: 'new-post', status: 'approved' })
    assert.equal(errors.logged.length, 1)
  } finally {
    errors.restore()
  }
})

test('the third report still hides the post when the admin notification throws', async () => {
  const errors = silenceErrors()
  try {
    const { actions, calls } = harness({
      async countReportsSince() { return 3 },
      notifyAdmins() { throw new Error('telegram down') },
    })
    assert.deepEqual(await actions.reportPost('post-1', 'asks_for_money', null), { ok: true })
    assert.equal(calls.updated[0].fields.status, 'pending')
    assert.equal(calls.revalidated, 1)
  } finally {
    errors.restore()
  }
})

test('a failed hide write is logged, the report still succeeds, and the board is not refreshed', async () => {
  const errors = silenceErrors()
  try {
    const { actions, calls } = harness({
      async countReportsSince() { return 3 },
      async updatePost() { return { error: { message: 'db down' } } },
    })
    assert.deepEqual(await actions.reportPost('post-1', 'asks_for_money', null), { ok: true })
    assert.equal(calls.revalidated, 0)
    assert.equal(calls.notified.length, 1)
    assert.ok(errors.logged.some((args) => String(args[0]).includes('auto-hide')))
  } finally {
    errors.restore()
  }
})
