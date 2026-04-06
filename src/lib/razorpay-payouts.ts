/**
 * Razorpay Payouts API (Razorpay X)
 *
 * Required env vars:
 *   RAZORPAY_KEY_ID        — same key used for payment gateway
 *   RAZORPAY_KEY_SECRET    — same secret used for payment gateway
 *   RAZORPAY_X_ACCOUNT_NUMBER — Razorpay X current account number (e.g. "4564563087654321")
 *
 * Flow per payout:
 *   1. Create a Contact (beneficiary / seller)
 *   2. Create a Fund Account (UPI VPA for that contact)
 *   3. Create a Payout (transfer money to the fund account)
 */

const BASE = 'https://api.razorpay.com/v1'

function authHeader(): string {
  const keyId     = process.env.RAZORPAY_KEY_ID?.trim()
  const keySecret = process.env.RAZORPAY_KEY_SECRET?.trim()
  if (!keyId || !keySecret) throw new Error('Razorpay keys not configured.')
  return `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString('base64')}`
}

function accountNumber(): string {
  const acct = process.env.RAZORPAY_X_ACCOUNT_NUMBER?.trim()
  if (!acct) throw new Error('RAZORPAY_X_ACCOUNT_NUMBER not configured.')
  return acct
}

async function rp(path: string, body: object): Promise<{ ok: boolean; data: unknown }> {
  const res = await fetch(`${BASE}${path}`, {
    method:  'POST',
    headers: { Authorization: authHeader(), 'Content-Type': 'application/json' },
    body:    JSON.stringify(body),
  })
  const data = await res.json()
  return { ok: res.ok, data }
}

export async function payoutToUpi(params: {
  orderId:       string   // our internal order UUID (used as idempotency reference)
  recipientUpi:  string   // seller's UPI VPA, e.g. "name@upi"
  recipientName: string   // seller's business name
  amountPaise:   number   // 97% of order total in paise (integer)
}): Promise<{ payoutId: string } | { error: string }> {
  const { orderId, recipientUpi, recipientName, amountPaise } = params

  try {
    // ── Step 1: Create Contact ───────────────────────────────────────────────
    const contactRes = await rp('/contacts', {
      name:         recipientName,
      type:         'vendor',
      reference_id: `seller_${orderId}`,
    }) as { ok: boolean; data: { id?: string; error?: { description?: string } } }

    if (!contactRes.ok) {
      const err = (contactRes.data as { error?: { description?: string } }).error
      return { error: `Contact creation failed: ${err?.description ?? 'unknown error'}` }
    }
    const contactId = (contactRes.data as { id: string }).id

    // ── Step 2: Create Fund Account (UPI VPA) ────────────────────────────────
    const faRes = await rp('/fund_accounts', {
      contact_id:   contactId,
      account_type: 'vpa',
      vpa: { address: recipientUpi },
    }) as { ok: boolean; data: { id?: string; error?: { description?: string } } }

    if (!faRes.ok) {
      const err = (faRes.data as { error?: { description?: string } }).error
      return { error: `Fund account creation failed: ${err?.description ?? 'unknown error'}` }
    }
    const fundAccountId = (faRes.data as { id: string }).id

    // ── Step 3: Create Payout ────────────────────────────────────────────────
    const payoutRes = await rp('/payouts', {
      account_number:  accountNumber(),
      fund_account_id: fundAccountId,
      amount:          amountPaise,
      currency:        'INR',
      mode:            'UPI',
      purpose:         'payout',
      queue_if_low_balance: true,
      reference_id:    `payout_${orderId}`,
      narration:       `OurDahanu order ${orderId.slice(0, 8)}`,
    }) as { ok: boolean; data: { id?: string; error?: { description?: string } } }

    if (!payoutRes.ok) {
      const err = (payoutRes.data as { error?: { description?: string } }).error
      return { error: `Payout failed: ${err?.description ?? 'unknown error'}` }
    }

    return { payoutId: (payoutRes.data as { id: string }).id }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Payout error' }
  }
}
