/**
 * Pure price/amount resolution for a marketplace order finalized after
 * Razorpay capture. Extracted out of `placeMarketplaceOrder` so the riskiest
 * part of that flow — never letting a captured payment end up with a
 * non-finite or non-positive price — can be unit tested directly.
 *
 * The governing rule: a payment Razorpay captured is always saved. This
 * function never throws and never returns a value that would make
 * `service_price` serialize as JSON `null`/`NaN`; the one case it can't
 * resolve (see `resolveOrderAmounts` returning `null`) is left to the caller,
 * which is expected to refuse only in that genuinely-impossible case.
 */

function toFinitePositive(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null
}

export interface ResolveOrderAmountsInput {
  /** Units purchased; always a positive integer (1-99) in this codebase. */
  quantity: number
  /** `intent.payload.product_price_paise` — untrusted, may be missing/NaN. */
  intentUnitPricePaise: unknown
  /** Live product/option `price_paise` — untrusted, may be NaN if the row was synthesized from a stale intent. */
  fallbackUnitPricePaise: unknown
  /** `intent.amount_paise` — untrusted. */
  intentAmountPaise: unknown
  /** Razorpay order's own `amount` field — untrusted (unvalidated API response). */
  razorpayAmountPaise: unknown
  /** Razorpay order's own `amount_paid` field — untrusted (unvalidated API response). */
  razorpayAmountPaidPaise: unknown
}

export interface ResolveOrderAmountsResult {
  /** Always a finite, positive integer (paise). */
  unitPricePaise: number
  /**
   * Always a finite, positive integer (paise) such that
   * `unitPricePaise * quantity === amountTotalPaise` exactly — the database's
   * `amount_total = service_price * quantity` constraint depends on this.
   */
  amountTotalPaise: number
  /**
   * The amount (paise) this resolution actually confirmed was paid, *before*
   * any rounding done to satisfy the exact-match constraint above — i.e. the
   * figure to compare against Razorpay's own `amount`/`amount_paid` fields.
   * Equal to `amountTotalPaise` unless `priceUnconfirmed` is true, in which
   * case `amountTotalPaise` is the (possibly slightly smaller, rounded)
   * figure actually saved and this is the true captured amount.
   */
  confirmedAmountPaise: number
  /**
   * True when neither the intent nor the live product/option carried a
   * usable per-unit price, so `unitPricePaise` was backed out of the
   * confirmed total instead. When true, `amountTotalPaise` may differ from
   * the amount Razorpay actually captured by up to `quantity - 1` paise
   * (rounding), because it is derived from the rounded `unitPricePaise` to
   * keep the database's exact-match constraint satisfied.
   */
  priceUnconfirmed: boolean
  /**
   * True when neither the intent nor a resolved unit price carried a usable
   * total, so the total itself was seeded from Razorpay's own report of this
   * order (`razorpayAmountPaise`, falling back to `razorpayAmountPaidPaise`
   * only if the order's own amount field was unusable).
   */
  amountUnconfirmed: boolean
}

/**
 * Resolves the unit price and total (both in paise) for a marketplace order,
 * preferring — in order — the payment intent's recorded price/amount, the
 * live product/option price, and finally Razorpay's own report of what was
 * captured for this order. Returns `null` only when none of those five
 * inputs carries a single usable (finite, positive) number: at that point
 * there is truly no figure left to save the order with.
 */
export function resolveOrderAmounts(input: ResolveOrderAmountsInput): ResolveOrderAmountsResult | null {
  const { quantity } = input
  const intentUnitPrice = toFinitePositive(input.intentUnitPricePaise)
  const fallbackUnitPrice = toFinitePositive(input.fallbackUnitPricePaise)
  let unitPricePaise = intentUnitPrice ?? fallbackUnitPrice

  const intentAmount = toFinitePositive(input.intentAmountPaise)
  let expectedAmountPaise: number | null =
    intentAmount ?? (unitPricePaise !== null ? unitPricePaise * quantity : null)
  let amountUnconfirmed = false

  if (expectedAmountPaise === null) {
    amountUnconfirmed = true
    // Seed from the order's own `amount`, not `amount_paid`: preferring
    // `amount_paid` and then separately checking it against `amount` turns
    // an ordinary partial-capture mismatch into a refusal that seeding from
    // `amount` would not produce, and the caller's own "is this fully paid"
    // check already compares `amount_paid` against the resolved total.
    const orderAmount = toFinitePositive(input.razorpayAmountPaise)
    const paidAmount = toFinitePositive(input.razorpayAmountPaidPaise)
    expectedAmountPaise = orderAmount ?? paidAmount
    if (expectedAmountPaise === null) {
      // Genuinely no usable number anywhere — the intent, the product/option,
      // and both of Razorpay's own amount fields are all missing or invalid.
      return null
    }
  }

  let priceUnconfirmed = false
  if (unitPricePaise === null) {
    // Back a per-unit price out of the confirmed total instead of refusing.
    unitPricePaise = Math.max(1, Math.round(expectedAmountPaise / quantity))
    priceUnconfirmed = true
  }

  // The database function requires amount_total === service_price * quantity
  // exactly. When the unit price was backed out of the total (priceUnconfirmed),
  // rounding can leave up to `quantity - 1` paise of slack against the true
  // captured amount, so the total sent must be derived from that same rounded
  // unit price rather than from expectedAmountPaise directly.
  const amountTotalPaise = priceUnconfirmed ? unitPricePaise * quantity : expectedAmountPaise

  return {
    unitPricePaise,
    amountTotalPaise,
    confirmedAmountPaise: expectedAmountPaise,
    priceUnconfirmed,
    amountUnconfirmed,
  }
}
