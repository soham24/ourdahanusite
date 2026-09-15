import assert from 'node:assert/strict'
import test from 'node:test'

import { deriveSellingChecklist, type ChecklistInput, type ChecklistStepState } from './checklist'
import {
  KEYS_REJECTED_MESSAGE,
  KEY_ID_INVALID_MESSAGE,
  RAZORPAY_UNREACHABLE_MESSAGE,
  classifyRazorpayKeyId,
  verifyFailureMessage,
} from './keys'
import {
  LISTING_NOT_LIVE_MESSAGE,
  SHOP_NOT_OPEN_MESSAGE,
  becameLive,
  canBuyFromShop,
  deriveSellingStatus,
  deriveShopMode,
  sellingPausedMessage,
  type ShopModeInput,
} from './shop-mode'

test('classifyRazorpayKeyId reads the mode from the prefix', () => {
  assert.equal(classifyRazorpayKeyId('rzp_test_AbC123'), 'test')
  assert.equal(classifyRazorpayKeyId('rzp_live_AbC123'), 'live')
  assert.equal(classifyRazorpayKeyId('  rzp_live_AbC123  '), 'live')
  assert.equal(classifyRazorpayKeyId(''), 'empty')
  assert.equal(classifyRazorpayKeyId('   '), 'empty')
  assert.equal(classifyRazorpayKeyId(null), 'empty')
  assert.equal(classifyRazorpayKeyId(undefined), 'empty')
  assert.equal(classifyRazorpayKeyId('rzp_test_'), 'invalid')
  assert.equal(classifyRazorpayKeyId('rzp_prod_AbC123'), 'invalid')
  assert.equal(classifyRazorpayKeyId('rzp_live_Ab-C'), 'invalid')
  assert.equal(classifyRazorpayKeyId('AbC123'), 'invalid')
})

test('save errors use the agreed copy', () => {
  assert.equal(KEY_ID_INVALID_MESSAGE, "That Key ID doesn't look right. It starts with rzp_test_ or rzp_live_.")
  assert.equal(
    KEYS_REJECTED_MESSAGE,
    "Razorpay didn't accept these keys. The secret is only shown once, so generate a new key and paste both again.",
  )
  assert.equal(
    RAZORPAY_UNREACHABLE_MESSAGE,
    "We couldn't reach Razorpay just now. Your keys weren't saved. Please try again.",
  )
  assert.equal(verifyFailureMessage(401), KEYS_REJECTED_MESSAGE)
  assert.equal(verifyFailureMessage(500), RAZORPAY_UNREACHABLE_MESSAGE)
  assert.equal(verifyFailureMessage(null), RAZORPAY_UNREACHABLE_MESSAGE)
})

const liveShop: ShopModeInput = {
  approved: true,
  paymentsEnabled: true,
  suspendedAt: null,
  verifiedAt: '2026-09-15T10:00:00Z',
  keyId: 'rzp_live_AbC123',
}

test('deriveShopMode is live only when every gate passes', () => {
  assert.equal(deriveShopMode(liveShop), 'live')
  assert.equal(deriveShopMode({ ...liveShop, keyId: 'rzp_test_AbC123' }), 'test')
  assert.equal(deriveShopMode({ ...liveShop, approved: false }), 'off')
  assert.equal(deriveShopMode({ ...liveShop, paymentsEnabled: false }), 'off')
  assert.equal(deriveShopMode({ ...liveShop, suspendedAt: '2026-09-15T11:00:00Z' }), 'off')
  assert.equal(deriveShopMode({ ...liveShop, verifiedAt: null }), 'off')
  assert.equal(deriveShopMode({ ...liveShop, keyId: null }), 'off')
  assert.equal(deriveShopMode({ ...liveShop, keyId: 'nonsense' }), 'off')
})

test('deriveSellingStatus puts suspension first', () => {
  assert.equal(deriveSellingStatus(liveShop), 'live')
  assert.equal(deriveSellingStatus({ ...liveShop, keyId: 'rzp_test_AbC123' }), 'test')
  assert.equal(deriveSellingStatus({ ...liveShop, suspendedAt: '2026-09-15T11:00:00Z' }), 'suspended')
  assert.equal(deriveSellingStatus({ ...liveShop, verifiedAt: null }), 'not_connected')
  assert.equal(deriveSellingStatus({ ...liveShop, approved: false }), 'not_connected')
})

test('canBuyFromShop: live for anyone, test for owner and admin only', () => {
  const stranger = { isOwner: false, isAdmin: false }
  assert.equal(canBuyFromShop('live', stranger), true)
  assert.equal(canBuyFromShop('test', stranger), false)
  assert.equal(canBuyFromShop('test', { isOwner: true, isAdmin: false }), true)
  assert.equal(canBuyFromShop('test', { isOwner: false, isAdmin: true }), true)
  assert.equal(canBuyFromShop('off', { isOwner: true, isAdmin: true }), false)
})

test('becameLive fires on the first verified live key only', () => {
  assert.equal(becameLive(null, 'rzp_live_AbC123'), true)
  assert.equal(becameLive({ keyId: 'rzp_test_AbC123', verifiedAt: '2026-09-15T10:00:00Z' }, 'rzp_live_AbC123'), true)
  assert.equal(becameLive({ keyId: 'rzp_live_Old999', verifiedAt: null }, 'rzp_live_AbC123'), true)
  assert.equal(becameLive({ keyId: 'rzp_live_Old999', verifiedAt: '2026-09-15T10:00:00Z' }, 'rzp_live_AbC123'), false)
  assert.equal(becameLive(null, 'rzp_test_AbC123'), false)
})

test('shared copy', () => {
  assert.equal(SHOP_NOT_OPEN_MESSAGE, "This shop isn't taking online payments yet.")
  assert.equal(LISTING_NOT_LIVE_MESSAGE, 'Your listing needs to be live before you can sell online.')
  assert.equal(
    sellingPausedMessage('Selling fake items'),
    'Selling is paused by OurDahanu: Selling fake items. Contact us to resume.',
  )
  assert.equal(sellingPausedMessage('  '), 'Selling is paused by OurDahanu: no reason given. Contact us to resume.')
  assert.equal(sellingPausedMessage(null), 'Selling is paused by OurDahanu: no reason given. Contact us to resume.')
})

const newOwner: ChecklistInput = {
  approved: true,
  suspendedAt: null,
  hasConfig: false,
  verifiedAt: null,
  keyId: null,
  activeItemCount: 0,
  orderCount: 0,
  testOrderCount: 0,
}

function states(input: ChecklistInput): Record<string, ChecklistStepState> {
  return Object.fromEntries(deriveSellingChecklist(input).steps.map((step) => [step.id, step.state]))
}

test('checklist for a new approved owner', () => {
  const checklist = deriveSellingChecklist(newOwner)
  assert.deepEqual(checklist.steps.map((step) => step.id), ['listing', 'connect', 'item', 'practice', 'live'])
  assert.deepEqual(states(newOwner), {
    listing: 'done',
    connect: 'todo',
    item: 'todo',
    practice: 'blocked',
    live: 'blocked',
  })
  assert.equal(checklist.status, 'setup')
})

test('checklist blocks everything until the listing is approved', () => {
  assert.deepEqual(states({ ...newOwner, approved: false }), {
    listing: 'todo',
    connect: 'blocked',
    item: 'blocked',
    practice: 'blocked',
    live: 'blocked',
  })
})

test('checklist accepts keys before items and items before keys', () => {
  const testKeys = { ...newOwner, hasConfig: true, verifiedAt: '2026-09-15T10:00:00Z', keyId: 'rzp_test_AbC123' }
  assert.deepEqual(states(testKeys), {
    listing: 'done',
    connect: 'done',
    item: 'todo',
    practice: 'todo',
    live: 'todo',
  })
  assert.deepEqual(states({ ...newOwner, activeItemCount: 2 }), {
    listing: 'done',
    connect: 'todo',
    item: 'done',
    practice: 'blocked',
    live: 'blocked',
  })
})

test('a practice order completes the practice step but not going live', () => {
  const practised = {
    ...newOwner,
    hasConfig: true,
    verifiedAt: '2026-09-15T10:00:00Z',
    keyId: 'rzp_test_AbC123',
    activeItemCount: 1,
    orderCount: 1,
    testOrderCount: 1,
  }
  assert.equal(states(practised).practice, 'done')
  assert.equal(states(practised).live, 'todo')
  assert.equal(deriveSellingChecklist(practised).status, 'setup')
})

test('connecting live keys directly skips the practice step and completes', () => {
  const live = {
    ...newOwner,
    hasConfig: true,
    verifiedAt: '2026-09-15T10:00:00Z',
    keyId: 'rzp_live_AbC123',
    activeItemCount: 1,
  }
  assert.equal(states(live).practice, 'skipped')
  assert.equal(states(live).live, 'done')
  assert.equal(deriveSellingChecklist(live).status, 'complete')
  assert.equal(states({ ...live, orderCount: 3 }).practice, 'done')
})

test('suspension and rejected keys override the status', () => {
  const live = {
    ...newOwner,
    hasConfig: true,
    verifiedAt: '2026-09-15T10:00:00Z',
    keyId: 'rzp_live_AbC123',
    activeItemCount: 1,
  }
  assert.equal(deriveSellingChecklist({ ...live, suspendedAt: '2026-09-15T11:00:00Z' }).status, 'suspended')
  const rejected = deriveSellingChecklist({ ...live, verifiedAt: null })
  assert.equal(rejected.status, 'keys_rejected')
  assert.equal(states({ ...live, verifiedAt: null }).connect, 'todo')
})
