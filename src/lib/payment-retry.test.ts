import { test } from 'node:test'
import assert from 'node:assert/strict'

import { attemptWithRetry } from './payment-retry'

// These run after Razorpay has already taken the customer's money, so the
// cost of a wrong decision is asymmetric: retrying something that can never
// succeed just makes a paying customer wait, while giving up on something
// transient strands them on the recovery screen for no reason.

function counter(results: Array<{ error?: string } | Error>) {
  let calls = 0
  const fn = async () => {
    const next = results[Math.min(calls, results.length - 1)]
    calls += 1
    if (next instanceof Error) throw next
    return next
  }
  return { fn, calls: () => calls }
}

test('returns immediately on success without retrying', async () => {
  const { fn, calls } = counter([{}])
  const result = await attemptWithRetry(fn, { baseDelayMs: 1 })
  assert.deepEqual(result, {})
  assert.equal(calls(), 1)
})

test('retries a transient error and returns the eventual success', async () => {
  const { fn, calls } = counter([{ error: 'fetch failed' }, { error: 'fetch failed' }, {}])
  const result = await attemptWithRetry(fn, { baseDelayMs: 1 })
  assert.deepEqual(result, {})
  assert.equal(calls(), 3)
})

test('gives up immediately on a signature failure', async () => {
  const { fn, calls } = counter([{ error: 'Payment verification failed. Please contact support.' }])
  const result = await attemptWithRetry(fn, { baseDelayMs: 1 })
  assert.equal(result.error, 'Payment verification failed. Please contact support.')
  assert.equal(calls(), 1)
})

// A slot cannot un-fill itself. Retrying burns roughly five seconds of
// backoff after the card has been charged, and every attempt fails the same
// way — so the customer waits, then sees the recovery screen regardless.
test('gives up immediately when the slot is already full', async () => {
  const { fn, calls } = counter([
    { error: 'Selected slot is already full. Please choose another time.' },
  ])
  const result = await attemptWithRetry(fn, { baseDelayMs: 1 })
  assert.equal(result.error, 'Selected slot is already full. Please choose another time.')
  assert.equal(calls(), 1)
})

test('gives up immediately when the slot is no longer available', async () => {
  const { fn, calls } = counter([
    { error: 'Appointments are not available for this listing.' },
  ])
  const result = await attemptWithRetry(fn, { baseDelayMs: 1 })
  assert.equal(calls(), 1)
  assert.ok(result.error)
})

test('stops after the configured number of attempts on a persistent transient error', async () => {
  const { fn, calls } = counter([{ error: 'network timeout' }])
  const result = await attemptWithRetry(fn, { attempts: 3, baseDelayMs: 1 })
  assert.equal(result.error, 'network timeout')
  assert.equal(calls(), 3)
})
