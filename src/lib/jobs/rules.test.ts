import { test } from 'node:test'
import assert from 'node:assert/strict'

import { detectReviewFlags } from './scam-signals'
import { AUTO_HIDE_REPORTS, decideCreateStatus, decideEditStatus, shouldAutoHide } from './rules'
import { canRenew, daysLeft, hoursAgoIso, isLive, isReminderDue, publishWindow } from './lifecycle'

const NOW = new Date('2026-09-14T06:30:00.000Z')
const DAY = 86_400_000
const inDays = (days: number) => new Date(NOW.getTime() + days * DAY).toISOString()

test('fee words in English, Marathi and Hindi flag a post', () => {
  for (const text of [
    'Registration fee ₹500 at joining',
    'Pay a security deposit first',
    'processing fees apply',
    'Advance payment required',
    'Refundable deposit to secure the job',
    'Advance fee ₹300',
    'Pay in advance to confirm',
    'नोंदणी शुल्क ५०० रुपये',
    'फी भरावी लागेल',
    'फीस जमा करें',
    'डिपॉझिट आवश्यक',
  ]) {
    assert.deepEqual(detectReviewFlags([text]), ['scam_words'], text)
  }
})

test('ordinary words that merely contain a fee word do not flag', () => {
  for (const text of [
    'Tea and coffee provided',
    'Free lunch every day',
    'Advanced Excel preferred',
    'B.Com or M.Com graduate',
    'No experience needed',
    'Apply in advance',
    'Book your interview slot in advance',
  ]) {
    assert.deepEqual(detectReviewFlags([text]), [], text)
  }
})

test('"No registration fee" still flags, deliberately', () => {
  assert.deepEqual(detectReviewFlags(['No registration fee, apply directly']), ['scam_words'])
})

test('links and phone numbers typed into the text flag for review', () => {
  for (const text of [
    'Apply at https://jobs-now.example/apply',
    'Join t.me/earnfast',
    'Visit www.quickjobs.in',
    'Details on jobs-now.in',
    'Call 98765 43210 now',
    'WhatsApp +91-98765-43210',
  ]) {
    assert.deepEqual(detectReviewFlags([text]), ['link_or_phone'], text)
  }
})

test('both flags can be raised at once, across fields', () => {
  assert.deepEqual(detectReviewFlags(['Cook', null, 'Registration fee. Call 9876543210']), ['scam_words', 'link_or_phone'])
})

const approvedListing = { accessible: true, approved: true }

test('create: the owner of an approved listing goes live instantly', () => {
  assert.equal(decideCreateStatus({ collectedByStaff: false, listing: approvedListing, flags: [] }), 'approved')
})

test('create: an individual, a lapsed or foreign listing, and any flagged post wait for review', () => {
  assert.equal(decideCreateStatus({ collectedByStaff: false, listing: null, flags: [] }), 'pending')
  assert.equal(decideCreateStatus({ collectedByStaff: false, listing: { accessible: true, approved: false }, flags: [] }), 'pending')
  assert.equal(decideCreateStatus({ collectedByStaff: false, listing: { accessible: false, approved: true }, flags: [] }), 'pending')
  assert.equal(decideCreateStatus({ collectedByStaff: false, listing: approvedListing, flags: ['scam_words'] }), 'pending')
})

test('create: staff collected posts go live, flags or not', () => {
  assert.equal(decideCreateStatus({ collectedByStaff: true, listing: null, flags: ['link_or_phone'] }), 'approved')
})

test('edit outcomes follow the table in the spec', () => {
  const cases: Array<[Parameters<typeof decideEditStatus>[0], 'approved' | 'pending' | null]> = [
    [{ current: 'pending', collectedByStaff: false, listing: approvedListing, flags: [] }, 'pending'],
    [{ current: 'rejected', collectedByStaff: false, listing: null, flags: [] }, 'pending'],
    [{ current: 'approved', collectedByStaff: false, listing: approvedListing, flags: [] }, 'approved'],
    [{ current: 'approved', collectedByStaff: false, listing: approvedListing, flags: ['scam_words'] }, 'pending'],
    [{ current: 'approved', collectedByStaff: false, listing: { accessible: true, approved: false }, flags: [] }, 'pending'],
    [{ current: 'approved', collectedByStaff: true, listing: null, flags: ['link_or_phone'] }, 'approved'],
    [{ current: 'approved', collectedByStaff: false, listing: null, flags: [] }, 'pending'],
    [{ current: 'closed', collectedByStaff: false, listing: null, flags: [] }, null],
    [{ current: 'removed', collectedByStaff: true, listing: null, flags: [] }, null],
  ]
  for (const [ctx, expected] of cases) {
    assert.equal(decideEditStatus(ctx), expected, JSON.stringify(ctx))
  }
})

test('reports hide an approved post at the third since review, not before', () => {
  assert.equal(AUTO_HIDE_REPORTS, 3)
  assert.equal(shouldAutoHide('approved', 2), false)
  assert.equal(shouldAutoHide('approved', 3), true)
  assert.equal(shouldAutoHide('pending', 5), false)
})

test('publishing sets a 30-day window', () => {
  assert.deepEqual(publishWindow(NOW), { published_at: NOW.toISOString(), expires_at: inDays(30) })
})

test('a post is live only while approved and unexpired', () => {
  assert.equal(isLive({ status: 'approved', expires_at: inDays(1) }, NOW), true)
  assert.equal(isLive({ status: 'approved', expires_at: inDays(-1) }, NOW), false)
  assert.equal(isLive({ status: 'pending', expires_at: inDays(10) }, NOW), false)
  assert.equal(isLive({ status: 'approved', expires_at: null }, NOW), false)
})

test('renew opens in the last 3 days and never closes after expiry', () => {
  assert.equal(canRenew({ status: 'approved', expires_at: inDays(4) }, NOW), false)
  assert.equal(canRenew({ status: 'approved', expires_at: inDays(3) }, NOW), true)
  assert.equal(canRenew({ status: 'approved', expires_at: inDays(-365) }, NOW), true)
  assert.equal(canRenew({ status: 'closed', expires_at: inDays(1) }, NOW), false)
  assert.equal(canRenew({ status: 'pending', expires_at: null }, NOW), false)
})

test('the reminder is due once, within 3 days of expiry', () => {
  assert.equal(isReminderDue({ status: 'approved', expires_at: inDays(2), reminder_sent_at: null }, NOW), true)
  assert.equal(isReminderDue({ status: 'approved', expires_at: inDays(3), reminder_sent_at: null }, NOW), true)
  assert.equal(isReminderDue({ status: 'approved', expires_at: inDays(4), reminder_sent_at: null }, NOW), false)
  assert.equal(isReminderDue({ status: 'approved', expires_at: inDays(2), reminder_sent_at: NOW.toISOString() }, NOW), false)
  assert.equal(isReminderDue({ status: 'approved', expires_at: inDays(-1), reminder_sent_at: null }, NOW), false)
})

test('days left rounds up and never goes negative', () => {
  assert.equal(daysLeft(inDays(2.5), NOW), 3)
  assert.equal(daysLeft(inDays(-2), NOW), 0)
})

test('hoursAgoIso steps back in whole hours', () => {
  assert.equal(hoursAgoIso(NOW, 24), new Date(NOW.getTime() - DAY).toISOString())
})
