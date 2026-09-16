import assert from 'node:assert/strict'
import test from 'node:test'

import { resolveOrderAmounts } from './order-amounts'

const base = {
  quantity: 2,
  intentUnitPricePaise: 10000,
  fallbackUnitPricePaise: 9000,
  intentAmountPaise: 20000,
  razorpayAmountPaise: 20000,
  razorpayAmountPaidPaise: 20000,
}

test('a good intent price passes straight through', () => {
  const result = resolveOrderAmounts(base)
  assert.deepEqual(result, {
    unitPricePaise: 10000,
    amountTotalPaise: 20000,
    confirmedAmountPaise: 20000,
    priceUnconfirmed: false,
    amountUnconfirmed: false,
  })
})

test('falls back to the live product price when the intent price is unusable', () => {
  const result = resolveOrderAmounts({ ...base, intentUnitPricePaise: undefined, intentAmountPaise: undefined })
  assert.equal(result?.unitPricePaise, 9000)
  assert.equal(result?.priceUnconfirmed, false)
  assert.equal(result?.amountTotalPaise, 18000)
})

test('a NaN intent price is treated as absent, not as zero or a refusal', () => {
  const result = resolveOrderAmounts({ ...base, intentUnitPricePaise: NaN, fallbackUnitPricePaise: NaN })
  // Neither price source usable, but the intent amount is: unit price backs
  // out of it instead of the order being refused (this is the exact bug —
  // Number(undefined) === NaN surviving every null check — this guards against).
  assert.equal(result?.priceUnconfirmed, true)
  assert.ok(Number.isFinite(result?.unitPricePaise))
  assert.ok((result?.unitPricePaise ?? 0) > 0)
})

test('an absent price backs out of the confirmed amount instead of refusing', () => {
  const result = resolveOrderAmounts({
    ...base,
    intentUnitPricePaise: undefined,
    fallbackUnitPricePaise: null,
    intentAmountPaise: 20000,
  })
  assert.equal(result?.priceUnconfirmed, true)
  assert.equal(result?.unitPricePaise, 10000) // 20000 / 2
  assert.equal(result?.amountTotalPaise, 20000)
})

test('quantity that does not divide the amount evenly still satisfies unitPrice * quantity === amountTotal exactly', () => {
  // amount 1000 paise, quantity 3: 1000/3 = 333.33..., rounds to 333.
  // 333 * 3 = 999, not 1000 — the database's exact-match constraint is what
  // stops the order being rejected, so amountTotalPaise must be 999 (derived
  // from the rounded unit price), never 1000 (the true captured amount).
  const result = resolveOrderAmounts({
    quantity: 3,
    intentUnitPricePaise: undefined,
    fallbackUnitPricePaise: undefined,
    intentAmountPaise: 1000,
    razorpayAmountPaise: 1000,
    razorpayAmountPaidPaise: 1000,
  })
  assert.equal(result?.priceUnconfirmed, true)
  assert.equal(result?.unitPricePaise, 333)
  assert.equal(result?.amountTotalPaise, 999)
  assert.equal(result!.unitPricePaise * 3, result!.amountTotalPaise)
  // The amount actually captured (1000) is preserved separately for the
  // caller to validate against Razorpay's own fields, distinct from the
  // rounded 999 that gets saved to satisfy the database's exact-match check.
  assert.equal(result?.confirmedAmountPaise, 1000)
})

test('quantity 1 backs out the full amount as the unit price with no rounding slack', () => {
  const result = resolveOrderAmounts({
    quantity: 1,
    intentUnitPricePaise: undefined,
    fallbackUnitPricePaise: undefined,
    intentAmountPaise: 4999,
    razorpayAmountPaise: 4999,
    razorpayAmountPaidPaise: 4999,
  })
  assert.equal(result?.unitPricePaise, 4999)
  assert.equal(result?.amountTotalPaise, 4999)
  assert.equal(result!.unitPricePaise * 1, result!.amountTotalPaise)
})

test('quantity 99 keeps unitPrice * quantity exactly equal to amountTotal', () => {
  const result = resolveOrderAmounts({
    quantity: 99,
    intentUnitPricePaise: undefined,
    fallbackUnitPricePaise: undefined,
    intentAmountPaise: 10000,
    razorpayAmountPaise: 10000,
    razorpayAmountPaidPaise: 10000,
  })
  assert.ok(Number.isFinite(result?.unitPricePaise))
  assert.equal(result!.unitPricePaise * 99, result!.amountTotalPaise)
  // Never zero or negative, even though 10000/99 rounds down to 101.
  assert.ok(result!.unitPricePaise > 0)
})

test('when the intent carries no amount either, seeds the total from the order amount, not amount_paid', () => {
  const result = resolveOrderAmounts({
    ...base,
    intentUnitPricePaise: undefined,
    fallbackUnitPricePaise: undefined,
    intentAmountPaise: undefined,
    razorpayAmountPaise: 20000,
    razorpayAmountPaidPaise: 15000, // a mismatched/partial figure — must not be preferred
  })
  assert.equal(result?.amountUnconfirmed, true)
  assert.equal(result?.unitPricePaise, 10000)
  assert.equal(result?.amountTotalPaise, 20000)
})

test('falls back to amount_paid only when the order amount itself is unusable', () => {
  const result = resolveOrderAmounts({
    ...base,
    intentUnitPricePaise: undefined,
    fallbackUnitPricePaise: undefined,
    intentAmountPaise: undefined,
    razorpayAmountPaise: null,
    razorpayAmountPaidPaise: 15000,
  })
  assert.equal(result?.amountUnconfirmed, true)
  assert.equal(result?.unitPricePaise, 7500)
  assert.equal(result?.amountTotalPaise, 15000)
})

test('returns null only when genuinely no usable number exists anywhere', () => {
  const result = resolveOrderAmounts({
    quantity: 2,
    intentUnitPricePaise: undefined,
    fallbackUnitPricePaise: NaN,
    intentAmountPaise: undefined,
    razorpayAmountPaise: undefined,
    razorpayAmountPaidPaise: null,
  })
  assert.equal(result, null)
})
