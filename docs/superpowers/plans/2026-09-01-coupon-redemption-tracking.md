# Coupon Redemption Tracking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the permanently-broken `coupons.usage_count` counter with an append-only redemption ledger that records who used each coupon, when, on what, and for how much — written only after payment succeeds.

**Architecture:** A new `coupon_redemptions` table stores one immutable row per successful redemption, written from `submitListing` / `renewListing` after payment verification passes, using the service-role client so counts cannot be forged. The table stores both a coupon FK and a text snapshot of the code, so hard-deleting a coupon never destroys its history. Admin reporting reads exclusively from this table.

**Tech Stack:** Next.js 16.2.1 App Router (Cache Components), Supabase Postgres, TypeScript, `node:test` via `tsx --test`.

## Global Constraints

- **This is NOT the Next.js you know.** Read the relevant guide in `node_modules/next/dist/docs/` before writing routing/caching code. Heed deprecation notices. (from `AGENTS.md`)
- **Supabase is live production** with real user data. Never delete or overwrite rows you did not create. Migrations must be additive and idempotent.
- Migrations are applied with the Supabase MCP tool `mcp__563fcecc-ab5b-42a7-91c8-1f45fd6e27f4__apply_migration` (project_id `slmbqngmxketyxjauxxk`), **and** a copy of the SQL is committed to `supabase/<name>.sql` to match existing repo convention.
- Cache invalidation uses `updateTag()` (via the helpers in `src/lib/cache-tags.ts`), never `revalidateTag(tag, 'max')`.
- New pure-function tests must be added to the explicit file list in the `test:existing` script in `package.json` — the runner does not glob.
- FK convention: user references point at `profiles(id)`, not `auth.users(id)` (matches `payment_intents`).
- Table `id` default is `uuid_generate_v4()` (matches `payment_intents`), not `gen_random_uuid()`.
- `coupon_redemptions` gets **no user-facing INSERT policy**. All writes go through the service-role admin client only.
- A ledger write failure must **never** fail or roll back a paid registration.
- `coupons.usage_count` is **not** dropped in this plan. It is left in place deliberately; dropping it is a separate follow-up after the ledger is verified in production.
- Verification for non-pure code is: `npx tsc --noEmit`, `npx eslint <changed files>`, `npx next build`. There is no test framework for React components.

---

## File Structure

| File | Responsibility |
|---|---|
| `supabase/add_coupon_redemptions.sql` (create) | Table DDL, indexes, RLS, `coupons.assigned_to` column. Committed copy of the applied migration. |
| `supabase/backfill_coupon_redemptions.sql` (create) | Idempotent backfill of the 32 historical redemptions. |
| `src/lib/coupon-redemptions.ts` (create) | Server-only write helper `recordCouponRedemption()`. Single place that knows how a redemption is persisted. |
| `src/lib/coupon-reporting.ts` (create) | Pure aggregation functions (per-coupon totals, per-person roll-up). No I/O — this is the unit-tested surface. |
| `src/lib/coupon-reporting.test.ts` (create) | `node:test` coverage for the pure aggregation functions. |
| `src/lib/data/coupon-redemptions.ts` (create) | Server-only admin reads of the ledger. |
| `src/app/actions/listings.ts` (modify) | Call `recordCouponRedemption()` after listing insert (`submitListing`) and after renewal update (`renewListing`). |
| `src/app/api/razorpay/create-listing-order/route.ts` (modify) | Delete the RLS-blocked, fire-and-forget increment block. |
| `src/app/actions/pricing.ts` (modify) | Delete dead `incrementCouponUsage()`; add `assigned_to` to `createCoupon`; add `getCouponReport()`. |
| `src/lib/data/pricing.ts` (modify) | Add `assigned_to` to the `Coupon` type and selects. |
| `src/app/admin/pricing/PricingManager.tsx` (modify) | Replace `used {usage_count}×` with real totals; add `assigned_to` input. |
| `src/app/admin/coupons/page.tsx` (create) | Admin report page: per-coupon totals, per-person roll-up, drill-down. |
| `src/lib/database.types.ts` (modify) | Regenerated types including the new table and column. |

---

## Task 1: Database schema — ledger table and `assigned_to`

**Files:**
- Create: `supabase/add_coupon_redemptions.sql`
- Modify: `src/lib/database.types.ts` (regenerated)

**Interfaces:**
- Consumes: nothing (first task).
- Produces: table `public.coupon_redemptions` with columns `id, coupon_id, coupon_code, user_id, listing_id, kind, payment_status, amount_paid, payment_id, redeemed_at`; column `public.coupons.assigned_to text`.

- [ ] **Step 1: Write the migration SQL**

Create `supabase/add_coupon_redemptions.sql`:

```sql
-- ============================================================
-- Coupon Redemptions — append-only ledger
--
-- Replaces coupons.usage_count, which reads 0 for every coupon
-- because (a) the coupons table has no UPDATE RLS policy so the
-- write was silently rejected, (b) the increment was a dangling
-- promise in a serverless function, and (c) it fired at Razorpay
-- order-creation rather than on successful payment.
--
-- One row per SUCCESSFUL redemption. Never updated, never deleted
-- by application code.
--
-- Why both coupon_id AND coupon_code:
--   deleteCoupon() hard-deletes. Three already-deleted codes
--   (ourdahanu, coreourdahanu, manas) account for 18 of the 32
--   historical redemptions. The FK enables joins while the coupon
--   exists; the text snapshot preserves history after it is gone.
--   ON DELETE SET NULL (never CASCADE) for the same reason.
--
-- payment_status is CHECKed to ('paid','free_coupon') only.
--   listings.payment_status has a third value, 'manual', written by
--   admin-created listings (src/app/actions/admin-listings.ts:66).
--   Every 'manual' row has coupon_used IS NULL and that path never
--   applies a coupon, so it cannot reach this table. If admin-created
--   listings ever gain coupon support, widen this CHECK first.
-- ============================================================

CREATE TABLE IF NOT EXISTS coupon_redemptions (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Nullable + SET NULL so deleting a coupon never destroys history.
  coupon_id uuid REFERENCES coupons(id) ON DELETE SET NULL,
  -- Lowercase snapshot of the code at redemption time. Survives deletion.
  coupon_code text NOT NULL,

  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  -- SET NULL so deleting a listing does not erase that money came in.
  listing_id uuid REFERENCES listings(id) ON DELETE SET NULL,

  kind text NOT NULL CHECK (kind IN ('new', 'renewal')),
  payment_status text NOT NULL CHECK (payment_status IN ('paid', 'free_coupon')),

  -- Rupees, matching listings.amount_paid and SubmissionCharge.finalPrice.
  amount_paid integer NOT NULL DEFAULT 0 CHECK (amount_paid >= 0),
  -- Razorpay payment id. NULL for free-coupon redemptions.
  payment_id text,

  redeemed_at timestamptz NOT NULL DEFAULT now()
);

-- Idempotency: a retried or replayed payment cannot double-count.
-- Does not cover free redemptions (payment_id IS NULL) — accepted:
-- production has zero free_coupon listings, and the write happens once
-- in the same guarded code path that creates the listing.
CREATE UNIQUE INDEX IF NOT EXISTS idx_coupon_redemptions_payment_id
  ON coupon_redemptions (payment_id)
  WHERE payment_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_coupon_redemptions_code
  ON coupon_redemptions (coupon_code);

CREATE INDEX IF NOT EXISTS idx_coupon_redemptions_redeemed_at
  ON coupon_redemptions (redeemed_at DESC);

ALTER TABLE coupon_redemptions ENABLE ROW LEVEL SECURITY;

-- Admin/moderator read only. There is deliberately NO insert policy:
-- all writes go through the service-role client, so redemption counts
-- cannot be forged by a user crafting requests.
--
-- DELIBERATE DIVERGENCE from the neighbouring coupons table: its policy
-- is named "Admin read coupons" but its USING clause is literally `true`,
-- so anyone can read it. That is intentional there — the public listing
-- submit form resolves coupon codes through createPublicClient(). It is
-- NOT acceptable here: these rows tie a user id to a payment, so a
-- `true` qual would publish who bought what. Do not "make it consistent".
DROP POLICY IF EXISTS "Admin read coupon redemptions" ON coupon_redemptions;
CREATE POLICY "Admin read coupon redemptions" ON coupon_redemptions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role IN ('admin', 'moderator')
    )
  );

-- The person a coupon was handed to, e.g. 'Ajay Bari'. Groups
-- mukul100 + mukul150 under one person in the roll-up. Nullable:
-- existing coupons have no value.
ALTER TABLE coupons ADD COLUMN IF NOT EXISTS assigned_to text;
```

- [ ] **Step 2: Confirm the RLS dependency still holds**

The policy depends on `profiles.role`. This was verified to exist (`text`) on
2026-09-01 while writing this plan; re-confirm it has not changed:

Run (Supabase MCP `execute_sql`, project_id `slmbqngmxketyxjauxxk`):
```sql
select column_name, data_type from information_schema.columns
where table_schema='public' and table_name='profiles' and column_name='role';
```
Expected: one row — `role`, `text`. If it returns zero rows, **stop** and report; the policy must be rewritten against whatever the real role source is (see `getUserRole` in `src/app/actions/admin.ts`). `profiles.is_admin` (boolean) also exists as a fallback signal.

- [ ] **Step 3: Apply the migration**

Use the Supabase MCP tool `apply_migration` with project_id `slmbqngmxketyxjauxxk`, name `add_coupon_redemptions`, and the SQL from Step 1.

- [ ] **Step 4: Verify the table and column exist**

Run (`execute_sql`):
```sql
select
  (select count(*) from information_schema.tables
    where table_schema='public' and table_name='coupon_redemptions') as tbl,
  (select count(*) from information_schema.columns
    where table_schema='public' and table_name='coupons' and column_name='assigned_to') as col,
  (select count(*) from pg_policies
    where schemaname='public' and tablename='coupon_redemptions') as policies,
  (select count(*) from coupon_redemptions) as rows_now;
```
Expected: `tbl=1, col=1, policies=1, rows_now=0`.

- [ ] **Step 5: Verify the table is not user-writable**

This is the security boundary the whole design depends on. Confirm no INSERT policy exists:

Run (`execute_sql`):
```sql
select cmd, policyname from pg_policies
where schemaname='public' and tablename='coupon_redemptions';
```
Expected: exactly one row, `cmd = SELECT`. If any INSERT/UPDATE/DELETE policy appears, **stop** — counts would be forgeable.

- [ ] **Step 6: Regenerate database types**

Use the Supabase MCP tool `generate_typescript_types` (project_id `slmbqngmxketyxjauxxk`) and write the result to `src/lib/database.types.ts`.

Then confirm the project still compiles:

Run: `npx tsc --noEmit`
Expected: no output (success).

- [ ] **Step 7: Commit**

```bash
git add supabase/add_coupon_redemptions.sql src/lib/database.types.ts
git commit -m "feat(coupons): add coupon_redemptions ledger table and assigned_to"
```

---

## Task 2: Pure reporting functions

Built before the write path so the aggregation shapes are locked and tested first. These are pure — no I/O — which is the only layer this repo can unit-test.

**Files:**
- Create: `src/lib/coupon-reporting.ts`
- Create: `src/lib/coupon-reporting.test.ts`
- Modify: `package.json` (add the test file to `test:existing`)

**Interfaces:**
- Consumes: nothing from Task 1 at runtime (operates on plain objects).
- Produces:
  - `type RedemptionRow = { coupon_code: string; coupon_id: string | null; kind: 'new' | 'renewal'; payment_status: 'paid' | 'free_coupon'; amount_paid: number; redeemed_at: string }`
  - `type CouponTotals = { code: string; newCount: number; renewalCount: number; total: number; revenue: number }`
  - `type PersonTotals = { person: string; codes: string[]; total: number; revenue: number }`
  - `summariseByCoupon(rows: RedemptionRow[]): CouponTotals[]`
  - `summariseByPerson(rows: RedemptionRow[], assignedBy: Record<string, string | null>): PersonTotals[]`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/coupon-reporting.test.ts`:

```ts
import { test } from 'node:test'
import assert from 'node:assert/strict'

import {
  summariseByCoupon,
  summariseByPerson,
  type RedemptionRow,
} from './coupon-reporting'

function row(over: Partial<RedemptionRow> = {}): RedemptionRow {
  return {
    coupon_code: 'ajay100',
    coupon_id: 'c1',
    kind: 'new',
    payment_status: 'paid',
    amount_paid: 400,
    redeemed_at: '2026-04-06T00:00:00Z',
    ...over,
  }
}

test('summariseByCoupon splits new and renewal and sums revenue', () => {
  const out = summariseByCoupon([
    row(),
    row(),
    row({ kind: 'renewal', amount_paid: 650 }),
  ])
  assert.equal(out.length, 1)
  assert.deepEqual(out[0], {
    code: 'ajay100',
    newCount: 2,
    renewalCount: 1,
    total: 3,
    revenue: 1450,
  })
})

test('summariseByCoupon counts free redemptions but adds no revenue', () => {
  const out = summariseByCoupon([
    row({ payment_status: 'free_coupon', amount_paid: 0 }),
  ])
  assert.equal(out[0].total, 1)
  assert.equal(out[0].revenue, 0)
})

test('summariseByCoupon orders by total descending', () => {
  const out = summariseByCoupon([
    row({ coupon_code: 'tanvi100' }),
    row({ coupon_code: 'ajay100' }),
    row({ coupon_code: 'ajay100' }),
  ])
  assert.deepEqual(out.map(r => r.code), ['ajay100', 'tanvi100'])
})

test('summariseByPerson groups multiple codes under one person', () => {
  const out = summariseByPerson(
    [
      row({ coupon_code: 'mukul100', amount_paid: 400 }),
      row({ coupon_code: 'mukul150', amount_paid: 600 }),
    ],
    { mukul100: 'Mukul', mukul150: 'Mukul' },
  )
  assert.equal(out.length, 1)
  assert.equal(out[0].person, 'Mukul')
  assert.equal(out[0].total, 2)
  assert.equal(out[0].revenue, 1000)
  assert.deepEqual(out[0].codes.slice().sort(), ['mukul100', 'mukul150'])
})

test('summariseByPerson keeps unassigned codes under their own code name', () => {
  // Deleted coupons have coupon_id null and no assigned_to entry.
  // They must still appear rather than being silently dropped.
  const out = summariseByPerson(
    [row({ coupon_code: 'ourdahanu', coupon_id: null, amount_paid: 150 })],
    {},
  )
  assert.equal(out.length, 1)
  assert.equal(out[0].person, 'ourdahanu')
  assert.equal(out[0].revenue, 150)
})

test('summariseByPerson treats a null assigned_to as unassigned', () => {
  const out = summariseByPerson([row({ coupon_code: 'ankit100' })], {
    ankit100: null,
  })
  assert.equal(out[0].person, 'ankit100')
})

test('empty input produces empty output', () => {
  assert.deepEqual(summariseByCoupon([]), [])
  assert.deepEqual(summariseByPerson([], {}), [])
})
```

- [ ] **Step 2: Register the test file**

In `package.json`, append the new file to the `test:existing` script (the runner takes an explicit list; it does not glob):

```json
"test:existing": "tsx --test src/app/actions/find-notifications.test.ts src/lib/find/safe-submission.test.ts src/lib/supabase/auth-regression.test.ts src/lib/safe-redirect.test.ts src/lib/coupon-reporting.test.ts"
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npx tsx --test src/lib/coupon-reporting.test.ts`
Expected: FAIL — cannot resolve module `./coupon-reporting`.

- [ ] **Step 4: Write the implementation**

Create `src/lib/coupon-reporting.ts`:

```ts
/**
 * Pure aggregation over coupon redemption rows.
 *
 * No I/O and no `server-only` import: keeping this pure is what makes it
 * unit-testable, which matters because the write path itself cannot be
 * tested without a live Razorpay payment.
 */

export type RedemptionRow = {
  coupon_code: string
  coupon_id: string | null
  kind: 'new' | 'renewal'
  payment_status: 'paid' | 'free_coupon'
  amount_paid: number
  redeemed_at: string
}

export type CouponTotals = {
  code: string
  newCount: number
  renewalCount: number
  total: number
  revenue: number
}

export type PersonTotals = {
  person: string
  codes: string[]
  total: number
  revenue: number
}

/** Per-coupon totals, most-used first. */
export function summariseByCoupon(rows: RedemptionRow[]): CouponTotals[] {
  const byCode = new Map<string, CouponTotals>()

  for (const r of rows) {
    let entry = byCode.get(r.coupon_code)
    if (!entry) {
      entry = { code: r.coupon_code, newCount: 0, renewalCount: 0, total: 0, revenue: 0 }
      byCode.set(r.coupon_code, entry)
    }
    if (r.kind === 'renewal') entry.renewalCount += 1
    else entry.newCount += 1
    entry.total += 1
    // Free redemptions count toward total but contribute no revenue.
    entry.revenue += r.amount_paid
  }

  return [...byCode.values()].sort((a, b) => b.total - a.total || a.code.localeCompare(b.code))
}

/**
 * Roll up by the person a coupon was assigned to.
 *
 * `assignedBy` maps coupon code -> assigned_to. A code with no entry, or a
 * null entry, falls back to the code itself so redemptions of deleted or
 * unassigned coupons still appear instead of vanishing from the report.
 */
export function summariseByPerson(
  rows: RedemptionRow[],
  assignedBy: Record<string, string | null>,
): PersonTotals[] {
  const byPerson = new Map<string, PersonTotals & { codeSet: Set<string> }>()

  for (const r of rows) {
    const person = assignedBy[r.coupon_code] || r.coupon_code
    let entry = byPerson.get(person)
    if (!entry) {
      entry = { person, codes: [], codeSet: new Set<string>(), total: 0, revenue: 0 }
      byPerson.set(person, entry)
    }
    entry.codeSet.add(r.coupon_code)
    entry.total += 1
    entry.revenue += r.amount_paid
  }

  return [...byPerson.values()]
    .map(({ codeSet, ...rest }) => ({ ...rest, codes: [...codeSet].sort() }))
    .sort((a, b) => b.total - a.total || a.person.localeCompare(b.person))
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx tsx --test src/lib/coupon-reporting.test.ts`
Expected: PASS, 7/7.

- [ ] **Step 6: Run the full suite and lint**

Run: `npm test`
Expected: all pass, including the pre-existing suites.

Run: `npx eslint src/lib/coupon-reporting.ts src/lib/coupon-reporting.test.ts`
Expected: no output.

- [ ] **Step 7: Commit**

```bash
git add src/lib/coupon-reporting.ts src/lib/coupon-reporting.test.ts package.json
git commit -m "feat(coupons): add pure redemption aggregation with tests"
```

---

## Task 3: Write path — record redemptions on success

**Files:**
- Create: `src/lib/coupon-redemptions.ts`
- Modify: `src/app/actions/listings.ts` (after listing insert in `submitListing`; after update in `renewListing`)
- Modify: `src/app/api/razorpay/create-listing-order/route.ts:36-50` (delete broken increment)
- Modify: `src/app/actions/pricing.ts:122-131` (delete dead function)

**Interfaces:**
- Consumes: `coupon_redemptions` table from Task 1.
- Produces: `recordCouponRedemption(input: RecordCouponRedemptionInput): Promise<void>` where
  `RecordCouponRedemptionInput = { couponCode: string; userId: string; listingId: string | null; kind: 'new' | 'renewal'; paymentStatus: 'paid' | 'free_coupon'; amountPaid: number; paymentId: string | null }`

- [ ] **Step 1: Write the redemption writer**

Create `src/lib/coupon-redemptions.ts`:

```ts
import 'server-only'

import { createAdminClient } from '@/lib/supabase/admin-client'

export type RecordCouponRedemptionInput = {
  couponCode: string
  userId: string
  listingId: string | null
  kind: 'new' | 'renewal'
  paymentStatus: 'paid' | 'free_coupon'
  amountPaid: number
  paymentId: string | null
}

/**
 * Append one row to the coupon redemption ledger.
 *
 * Call this ONLY after payment verification has passed and the listing row
 * is committed. The previous implementation incremented a counter when the
 * Razorpay order was created, so abandoned checkouts inflated the count.
 *
 * Uses the service-role client deliberately: coupon_redemptions has no
 * user-facing INSERT policy, so counts cannot be forged by a crafted request.
 *
 * Never throws. A ledger failure must not fail or roll back a paid
 * registration — under-counting is recoverable (listings.coupon_used still
 * holds the code), rejecting a paid signup is not.
 */
export async function recordCouponRedemption(
  input: RecordCouponRedemptionInput,
): Promise<void> {
  const code = input.couponCode.trim().toLowerCase()
  if (!code) return

  try {
    const db = createAdminClient()
    if (!db) {
      console.error('[coupon-redemption] admin client unavailable; not recorded', { code })
      return
    }

    // Resolve the current coupon id, if the coupon still exists. Nullable by
    // design: coupons are hard-deleted, and the code snapshot below is what
    // preserves the history.
    const { data: coupon } = await db
      .from('coupons')
      .select('id')
      .eq('code', code)
      .maybeSingle()

    const { error } = await db.from('coupon_redemptions').insert({
      coupon_id: (coupon as { id?: string } | null)?.id ?? null,
      coupon_code: code,
      user_id: input.userId,
      listing_id: input.listingId,
      kind: input.kind,
      payment_status: input.paymentStatus,
      amount_paid: input.amountPaid,
      payment_id: input.paymentId,
    })

    // 23505 = unique violation on payment_id: this payment was already
    // recorded. That is the idempotency guard doing its job, not a failure.
    if (error && error.code !== '23505') {
      console.error('[coupon-redemption] insert failed', { code, error: error.message })
    }
  } catch (err) {
    console.error('[coupon-redemption] unexpected failure', err)
  }
}
```

- [ ] **Step 2: Record on new registration**

In `src/app/actions/listings.ts`, add the import at the top alongside the other `@/lib` imports:

```ts
import { recordCouponRedemption } from '@/lib/coupon-redemptions'
```

In `submitListing`, immediately after the `markIntentFinalized` block that follows a successful insert (currently around line 199, after `if (!isFree && insertedListing?.id) { ... }` and before the `sendNotificationToAdmins` call), insert:

```ts
  // Ledger row only on a verified success — abandoned checkouts write nothing.
  if (charge.couponValid && charge.couponCode) {
    await recordCouponRedemption({
      couponCode: charge.couponCode,
      userId: user.id,
      listingId: (insertedListing?.id as string) ?? null,
      kind: 'new',
      paymentStatus: charge.paymentStatus,
      amountPaid: charge.finalPrice,
      paymentId: isFree ? null : paymentId,
    })
  }
```

- [ ] **Step 3: Record on renewal**

In `renewListing` in the same file, immediately after the `markIntentFinalized` block (currently around line 772) and before `revalidatePublicListingContent(listingId)`, insert:

```ts
  if (charge.couponValid && charge.couponCode) {
    await recordCouponRedemption({
      couponCode: charge.couponCode,
      userId: user.id,
      listingId,
      kind: 'renewal',
      paymentStatus: charge.paymentStatus,
      amountPaid: charge.finalPrice,
      paymentId: isFree ? null : paymentId,
    })
  }
```

- [ ] **Step 4: Delete the broken increment**

In `src/app/api/razorpay/create-listing-order/route.ts`, delete this entire block (currently lines 36-50). It is RLS-blocked, is a dangling promise, and fires at the wrong moment:

```ts
  // Increment usage count (non-blocking)
  if (couponValid && appliedCoupon) {
    supabase.from('coupons')
      .select('usage_count')
      .eq('code', appliedCoupon)
      .then(({ data }) => {
        ...
      })
  }
```

Leave everything else in the route unchanged — `appliedCoupon` and `couponValid` are still used below for the Razorpay `notes` and the response body.

- [ ] **Step 5: Delete the dead function**

In `src/app/actions/pricing.ts`, delete `incrementCouponUsage` (currently lines 122-131) in full. Confirm it has no callers first:

Run: `grep -rn "incrementCouponUsage" src/`
Expected after deletion: no output.

- [ ] **Step 6: Verify it compiles and lints**

Run: `npx tsc --noEmit`
Expected: no output.

Run: `npx eslint src/lib/coupon-redemptions.ts src/app/actions/listings.ts src/app/actions/pricing.ts src/app/api/razorpay/create-listing-order/route.ts`
Expected: no output.

Run: `npx next build`
Expected: build succeeds.

- [ ] **Step 7: Verify no ledger row is written for an abandoned checkout**

This is the behaviour the whole change exists to fix, so verify it directly rather than assuming.

Run (`execute_sql`) to confirm the ledger is still empty after a build that never completed a payment:
```sql
select count(*) as rows_now from coupon_redemptions;
```
Expected: `0` (the backfill has not run yet — that is Task 4).

Confirm by reading `src/app/api/razorpay/create-listing-order/route.ts` that no write to `coupons` or `coupon_redemptions` remains anywhere in the order-creation path.

- [ ] **Step 8: Commit**

```bash
git add src/lib/coupon-redemptions.ts src/app/actions/listings.ts src/app/actions/pricing.ts src/app/api/razorpay/create-listing-order/route.ts
git commit -m "fix(coupons): record redemptions on payment success, not checkout open"
```

---

## Task 4: Backfill the 32 historical redemptions

**Files:**
- Create: `supabase/backfill_coupon_redemptions.sql`

**Interfaces:**
- Consumes: `coupon_redemptions` from Task 1.
- Produces: 32 rows in `coupon_redemptions`, all `kind = 'new'`.

- [ ] **Step 1: Record the pre-state**

Run (`execute_sql`):
```sql
select coupon_used, count(*) n, sum(amount_paid) rupees
from listings where coupon_used is not null
group by coupon_used order by n desc;
```
Expected (verified 2026-09-01): 7 codes totalling 32 rows — ourdahanu 10/₹1500, ajay100 9/₹3600, coreourdahanu 7/₹200, mukul100 3/₹1200, mukul150 1/₹600, tanvi100 1/₹400, manas 1/₹25.

If the totals differ, the site has taken new coupon signups since — use the numbers you actually get as the expected values in Step 4.

- [ ] **Step 2: Write the backfill SQL**

Create `supabase/backfill_coupon_redemptions.sql`:

```sql
-- ============================================================
-- One-time backfill of historical coupon redemptions.
--
-- Idempotent: the NOT EXISTS guard means re-running inserts nothing.
--
-- KNOWN INACCURACY: every backfilled row is recorded as kind='new'.
-- renewListing overwrites listings.coupon_used on the same row, so past
-- renewals are unrecoverable from the database. Data from the deploy
-- forward is exact; this is a best-effort reconstruction of what the
-- column still holds.
--
-- The coupon_used IS NOT NULL filter also excludes the three 'manual'
-- admin-created listings automatically — all of them have a NULL coupon.
-- Every matching row is payment_status='paid', so the CHECK cannot fail.
-- ============================================================

INSERT INTO coupon_redemptions (
  coupon_id, coupon_code, user_id, listing_id,
  kind, payment_status, amount_paid, payment_id, redeemed_at
)
SELECT
  c.id,                                   -- NULL when the coupon was deleted
  lower(l.coupon_used),
  l.owner_id,
  l.id,
  'new',
  'paid',
  COALESCE(l.amount_paid, 0),
  l.payment_id,
  l.created_at
FROM listings l
LEFT JOIN coupons c ON c.code = lower(l.coupon_used)
WHERE l.coupon_used IS NOT NULL
  AND l.payment_status = 'paid'
  AND NOT EXISTS (
    SELECT 1 FROM coupon_redemptions r WHERE r.listing_id = l.id
  );
```

- [ ] **Step 3: Apply the backfill**

Use the Supabase MCP tool `apply_migration` with project_id `slmbqngmxketyxjauxxk`, name `backfill_coupon_redemptions`, and the SQL from Step 2.

- [ ] **Step 4: Verify the backfill matches the source exactly**

Run (`execute_sql`):
```sql
select
  (select count(*) from coupon_redemptions) as ledger_rows,
  (select count(*) from listings
     where coupon_used is not null and payment_status='paid') as source_rows,
  (select count(*) from coupon_redemptions where coupon_id is null) as orphaned,
  (select sum(amount_paid) from coupon_redemptions) as ledger_revenue,
  (select sum(amount_paid) from listings
     where coupon_used is not null and payment_status='paid') as source_revenue;
```
Expected: `ledger_rows = source_rows = 32`; `orphaned = 18` (the deleted ourdahanu/coreourdahanu/manas rows); `ledger_revenue = source_revenue = 7525`.

If `orphaned` is not 18, check whether a previously-deleted code has since been recreated — that is fine and changes the expected number.

- [ ] **Step 5: Verify deleted codes kept their history**

The core reason the schema stores a text snapshot. Run (`execute_sql`):
```sql
select coupon_code, count(*) n, bool_and(coupon_id is null) all_orphaned
from coupon_redemptions
where coupon_code in ('ourdahanu','coreourdahanu','manas')
group by coupon_code order by n desc;
```
Expected: ourdahanu 10, coreourdahanu 7, manas 1 — each with `all_orphaned = true` and a preserved `coupon_code`.

- [ ] **Step 6: Verify idempotency**

Re-apply the same SQL from Step 2 via `execute_sql`, then re-run the count:
```sql
select count(*) as ledger_rows from coupon_redemptions;
```
Expected: still `32` — no duplicates.

- [ ] **Step 7: Commit**

```bash
git add supabase/backfill_coupon_redemptions.sql
git commit -m "feat(coupons): backfill 32 historical redemptions, preserving deleted codes"
```

---

## Task 5: Admin reads and `assigned_to` management

**Files:**
- Create: `src/lib/data/coupon-redemptions.ts`
- Modify: `src/lib/data/pricing.ts` (add `assigned_to` to `Coupon` and both selects)
- Modify: `src/app/actions/pricing.ts` (`createCoupon` accepts `assigned_to`; add `getCouponReport`, `setCouponAssignedTo`)

**Interfaces:**
- Consumes: `summariseByCoupon`, `summariseByPerson`, `RedemptionRow`, `CouponTotals`, `PersonTotals` from Task 2; `coupon_redemptions` from Task 1.
- Produces:
  - `fetchAllRedemptions(): Promise<RedemptionRow[]>`
  - `fetchRedemptionsForCode(code: string): Promise<RedemptionDetail[]>` where
    `RedemptionDetail = { id: string; coupon_code: string; kind: 'new' | 'renewal'; payment_status: 'paid' | 'free_coupon'; amount_paid: number; redeemed_at: string; listing_id: string | null; listing_name: string | null }`
  - `getCouponReport(): Promise<{ byCoupon: CouponTotals[]; byPerson: PersonTotals[] }>`
  - `setCouponAssignedTo(id: string, assignedTo: string): Promise<{ error?: string }>`

- [ ] **Step 1: Write the ledger reads**

Create `src/lib/data/coupon-redemptions.ts`:

```ts
import 'server-only'

import { createAdminClient } from '@/lib/supabase/admin-client'
import type { RedemptionRow } from '@/lib/coupon-reporting'

export type RedemptionDetail = {
  id: string
  coupon_code: string
  kind: 'new' | 'renewal'
  payment_status: 'paid' | 'free_coupon'
  amount_paid: number
  redeemed_at: string
  listing_id: string | null
  listing_name: string | null
}

/**
 * Every redemption, for aggregation. Deliberately not cached: this is an
 * admin-only report and must reflect a payment taken seconds ago.
 */
export async function fetchAllRedemptions(): Promise<RedemptionRow[]> {
  const db = createAdminClient()
  if (!db) return []

  const { data } = await db
    .from('coupon_redemptions')
    .select('coupon_code, coupon_id, kind, payment_status, amount_paid, redeemed_at')
    .order('redeemed_at', { ascending: false })

  return (data ?? []) as unknown as RedemptionRow[]
}

/** Drill-down: the individual redemptions of one coupon code. */
export async function fetchRedemptionsForCode(code: string): Promise<RedemptionDetail[]> {
  const db = createAdminClient()
  if (!db) return []

  const { data } = await db
    .from('coupon_redemptions')
    .select('id, coupon_code, kind, payment_status, amount_paid, redeemed_at, listing_id, listings(name)')
    .eq('coupon_code', code.trim().toLowerCase())
    .order('redeemed_at', { ascending: false })

  type Raw = Omit<RedemptionDetail, 'listing_name'> & {
    listings: { name: string } | { name: string }[] | null
  }

  return ((data ?? []) as unknown as Raw[]).map(({ listings, ...rest }) => ({
    ...rest,
    listing_name: Array.isArray(listings) ? (listings[0]?.name ?? null) : (listings?.name ?? null),
  }))
}
```

- [ ] **Step 2: Add `assigned_to` to the Coupon type**

In `src/lib/data/pricing.ts`, add the field to the `Coupon` interface (after `usage_count`):

```ts
  assigned_to: string | null
```

and add `assigned_to` to the select list in `getCachedActiveCoupons`:

```ts
      .select('id, code, label, final_price, enabled, usage_count, assigned_to, created_at')
```

- [ ] **Step 3: Add the report and assignment actions**

In `src/app/actions/pricing.ts`, add the imports:

```ts
import { fetchAllRedemptions } from '@/lib/data/coupon-redemptions'
import {
  summariseByCoupon,
  summariseByPerson,
  type CouponTotals,
  type PersonTotals,
} from '@/lib/coupon-reporting'
```

and append these exports at the end of the file:

```ts
export async function getCouponReport(): Promise<{
  byCoupon: CouponTotals[]
  byPerson: PersonTotals[]
}> {
  try {
    const db = await checkAdmin()
    const rows = await fetchAllRedemptions()

    const { data } = await db.from('coupons').select('code, assigned_to')
    const assignedBy: Record<string, string | null> = {}
    for (const c of (data ?? []) as { code: string; assigned_to: string | null }[]) {
      assignedBy[c.code] = c.assigned_to
    }

    return {
      byCoupon: summariseByCoupon(rows),
      byPerson: summariseByPerson(rows, assignedBy),
    }
  } catch {
    return { byCoupon: [], byPerson: [] }
  }
}

export async function setCouponAssignedTo(
  id: string,
  assignedTo: string,
): Promise<{ error?: string }> {
  try {
    const db = await checkAdmin()
    const value = assignedTo.trim() || null
    const { error } = await db.from('coupons').update({ assigned_to: value }).eq('id', id)
    if (error) return { error: error.message }
    revalidateCouponCache()
    return {}
  } catch (e: unknown) {
    return { error: e instanceof Error ? e.message : 'Failed to update coupon.' }
  }
}
```

- [ ] **Step 4: Accept `assigned_to` when creating a coupon**

In `createCoupon` in the same file, read the field and include it in the insert:

```ts
    const assigned_to = ((formData.get('assigned_to') as string) ?? '').trim() || null
```

and change the insert to:

```ts
    const { error } = await db.from('coupons').insert({ code, label, final_price, enabled, assigned_to })
```

- [ ] **Step 5: Verify the report returns the backfilled data**

Run: `npx tsc --noEmit`
Expected: no output.

Run: `npx eslint src/lib/data/coupon-redemptions.ts src/lib/data/pricing.ts src/app/actions/pricing.ts`
Expected: no output.

Confirm the underlying aggregation matches the ledger directly (`execute_sql`):
```sql
select coupon_code, count(*) total, sum(amount_paid) revenue
from coupon_redemptions group by coupon_code order by total desc;
```
Expected: 7 codes, ourdahanu 10/₹1500 first, totalling 32 rows and ₹7525.

- [ ] **Step 6: Commit**

```bash
git add src/lib/data/coupon-redemptions.ts src/lib/data/pricing.ts src/app/actions/pricing.ts
git commit -m "feat(coupons): admin ledger reads, report aggregation, assigned_to"
```

---

## Task 6: Admin UI — report page and fixing the false "used 0×"

**Files:**
- Create: `src/app/admin/coupons/page.tsx`
- Modify: `src/app/admin/pricing/PricingManager.tsx` (replace `usage_count` display; add `assigned_to` input)

**Interfaces:**
- Consumes: `getCouponReport()`, `setCouponAssignedTo()`, `createCoupon()` from Task 5; `fetchRedemptionsForCode()` from Task 5.
- Produces: nothing consumed by later tasks.

- [ ] **Step 1: Check the admin page conventions before writing UI**

Read `src/app/admin/pricing/page.tsx` in full to copy its admin auth guard and layout wrapper. The new page must use the same guard — do not invent a new auth check.

Run: `cat src/app/admin/pricing/page.tsx`

- [ ] **Step 2: Build the report page**

Create `src/app/admin/coupons/page.tsx`. Mirror the auth guard and page shell you just read from `src/app/admin/pricing/page.tsx`, and render:

```tsx
import { getCouponReport } from '@/app/actions/pricing'

export const metadata = { title: 'Coupon Report' }

export default async function AdminCouponsPage() {
  // Apply the SAME admin guard used by src/app/admin/pricing/page.tsx here.
  const { byCoupon, byPerson } = await getCouponReport()

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-10">
      <header>
        <h1 className="text-2xl font-bold text-gray-900">Coupon Report</h1>
        <p className="text-sm text-gray-500 mt-1">
          Counted only on successful payment and registration.
        </p>
      </header>

      <section>
        <h2 className="text-lg font-semibold text-gray-900 mb-3">By person</h2>
        {byPerson.length === 0 ? (
          <p className="text-sm text-gray-400">No redemptions yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b">
                  <th className="py-2">Person</th>
                  <th className="py-2">Codes</th>
                  <th className="py-2 text-right">Registrations</th>
                  <th className="py-2 text-right">Revenue</th>
                </tr>
              </thead>
              <tbody>
                {byPerson.map(p => (
                  <tr key={p.person} className="border-b last:border-0">
                    <td className="py-2 font-medium text-gray-900">{p.person}</td>
                    <td className="py-2 font-mono text-xs text-gray-500">{p.codes.join(', ')}</td>
                    <td className="py-2 text-right">{p.total}</td>
                    <td className="py-2 text-right">₹{p.revenue}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section>
        <h2 className="text-lg font-semibold text-gray-900 mb-3">By coupon</h2>
        {byCoupon.length === 0 ? (
          <p className="text-sm text-gray-400">No redemptions yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b">
                  <th className="py-2">Code</th>
                  <th className="py-2 text-right">New</th>
                  <th className="py-2 text-right">Renewals</th>
                  <th className="py-2 text-right">Total</th>
                  <th className="py-2 text-right">Revenue</th>
                </tr>
              </thead>
              <tbody>
                {byCoupon.map(c => (
                  <tr key={c.code} className="border-b last:border-0">
                    <td className="py-2 font-mono font-medium text-gray-900">{c.code}</td>
                    <td className="py-2 text-right">{c.newCount}</td>
                    <td className="py-2 text-right">{c.renewalCount}</td>
                    <td className="py-2 text-right font-semibold">{c.total}</td>
                    <td className="py-2 text-right">₹{c.revenue}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
```

- [ ] **Step 3: Add the drill-down**

Create `src/app/admin/coupons/[code]/page.tsx` using the same admin guard, rendering `fetchRedemptionsForCode(code)`:

```tsx
import Link from 'next/link'

import { fetchRedemptionsForCode } from '@/lib/data/coupon-redemptions'

export default async function CouponDrilldownPage({
  params,
}: {
  params: Promise<{ code: string }>
}) {
  // Apply the SAME admin guard used by src/app/admin/pricing/page.tsx here.
  const { code } = await params
  const rows = await fetchRedemptionsForCode(code)

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <Link href="/admin/coupons" className="text-sm text-gray-500 hover:text-gray-900">
        ← All coupons
      </Link>
      <h1 className="mt-2 text-2xl font-bold text-gray-900 font-mono">{code}</h1>
      <p className="text-sm text-gray-500 mt-1">{rows.length} redemptions</p>

      {rows.length === 0 ? (
        <p className="mt-6 text-sm text-gray-400">No redemptions for this code.</p>
      ) : (
        <div className="mt-6 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b">
                <th className="py-2">Business</th>
                <th className="py-2">Kind</th>
                <th className="py-2">When</th>
                <th className="py-2 text-right">Paid</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.id} className="border-b last:border-0">
                  <td className="py-2">
                    {r.listing_id ? (
                      <Link href={`/listings/${r.listing_id}`} className="text-[#C0582E] hover:underline">
                        {r.listing_name ?? 'View listing'}
                      </Link>
                    ) : (
                      <span className="text-gray-400">deleted listing</span>
                    )}
                  </td>
                  <td className="py-2">{r.kind}</td>
                  <td className="py-2">{new Date(r.redeemed_at).toLocaleDateString('en-IN')}</td>
                  <td className="py-2 text-right">
                    {r.payment_status === 'free_coupon' ? 'free' : `₹${r.amount_paid}`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
```

Then make each code in the "By coupon" table on `src/app/admin/coupons/page.tsx` link to it:

```tsx
                    <td className="py-2 font-mono font-medium text-gray-900">
                      <Link href={`/admin/coupons/${c.code}`} className="hover:underline">{c.code}</Link>
                    </td>
```

adding `import Link from 'next/link'` at the top of that file.

- [ ] **Step 4: Remove the false "used 0×" and add the assigned_to input**

In `src/app/admin/pricing/PricingManager.tsx`, delete line 250 entirely — it renders `used {coupon.usage_count}×`, which is always "used 0×" and is the misleading display this whole change exists to fix:

```tsx
                      <span className="text-xs text-gray-400">used {coupon.usage_count}×</span>
```

Replace it with a link to the real numbers:

```tsx
                      <a href={`/admin/coupons/${coupon.code}`} className="text-xs text-[#C0582E] hover:underline">
                        view usage
                      </a>
```

Add an "Assigned to" input to the new-coupon form. Add the state alongside the other new-coupon fields (near line 28):

```tsx
  const [newAssignedTo, setNewAssignedTo] = useState('')
```

Include it in `handleCreateCoupon`'s FormData (after the `enabled` line):

```tsx
    fd.set('assigned_to', newAssignedTo)
```

Reset it wherever the other new-coupon fields are cleared on success, and render an input next to the existing label input, styled to match its siblings:

```tsx
  <input
    value={newAssignedTo}
    onChange={e => setNewAssignedTo(e.target.value)}
    placeholder="Assigned to (e.g. Ajay Bari)"
    className="..."  /* copy the className from the adjacent label input */
  />
```

Also surface the value on each coupon row, next to the label:

```tsx
                    <p className="text-xs text-gray-500 mt-0.5 truncate">
                      {coupon.label}
                      {coupon.assigned_to ? ` · ${coupon.assigned_to}` : ''}
                    </p>
```

- [ ] **Step 5: Verify it compiles, lints and builds**

Run: `npx tsc --noEmit`
Expected: no output.

Run: `npx eslint src/app/admin/coupons/page.tsx "src/app/admin/coupons/[code]/page.tsx" src/app/admin/pricing/PricingManager.tsx`
Expected: no output.

Run: `npx next build`
Expected: build succeeds; `/admin/coupons` and `/admin/coupons/[code]` appear in the route list.

- [ ] **Step 6: Verify in the browser**

Start the preview with `mcp__Claude_Browser__preview_start` using the `dev` launch config, then navigate to `http://localhost:3000/admin/coupons`.

Confirm, signed in as an admin:
- "By coupon" lists 7 codes; `ourdahanu` shows 10 registrations / ₹1500
- Totals across the table sum to 32 registrations and ₹7525
- Clicking `ajay100` opens the drill-down and lists 9 businesses with dates
- `/admin/pricing` no longer shows "used 0×" anywhere

Check `read_console_messages` for errors. Note that a pre-existing footer hydration warning was fixed in PR #63 — if any hydration error appears here it is new and must be investigated, not ignored.

- [ ] **Step 7: Commit**

```bash
git add src/app/admin/coupons src/app/admin/pricing/PricingManager.tsx
git commit -m "feat(coupons): admin coupon report with per-person roll-up and drill-down"
```

---

## Self-Review

**Spec coverage** — every section of `2026-09-01-coupon-redemption-tracking-design.md` maps to a task:

| Spec section | Task |
|---|---|
| §1 `coupon_redemptions` table, indexes, RLS | Task 1 |
| §2 Write path (submit + renew, service role, failure isolation) | Task 3 |
| §3 `coupons.assigned_to` | Task 1 (column), Task 5 (actions), Task 6 (UI) |
| §4 Per-coupon totals / drill-down / per-person roll-up | Task 2 (logic), Task 5 (reads), Task 6 (UI) |
| §5 Backfill, idempotent, deleted codes preserved | Task 4 |
| §6 Remove broken code (increment block, dead function, usage_count reads) | Task 3 (code), Task 6 (display) |
| Testing: pure functions via `tsx --test` | Task 2 |
| Testing: migration verified, idempotent, 32 rows, 3 orphans | Task 4 Steps 4-6 |
| Testing: RLS not user-insertable | Task 1 Step 5 |
| Testing: no ledger row on abandoned checkout | Task 3 Step 7 |
| Out of scope: CSV export, dropping `usage_count` | Not built — stated in Global Constraints |

**Placeholder scan** — no TBD/TODO. Two steps intentionally say "apply the SAME admin guard used by `src/app/admin/pricing/page.tsx`" rather than inlining code; Task 6 Step 1 requires reading that file first, so the implementer has the exact guard in hand. One `className="..."` is marked "copy from the adjacent label input" for the same reason — the surrounding file is the source of truth for styling, and inventing a different class string would break visual consistency.

**Type consistency** — `RedemptionRow` is defined once in Task 2 and imported by Task 5. `RecordCouponRedemptionInput` field names (`couponCode`, `userId`, `listingId`, `kind`, `paymentStatus`, `amountPaid`, `paymentId`) are used identically in Task 3 Steps 1-3. `CouponTotals` uses `newCount`/`renewalCount`/`total`/`revenue` in Task 2 and the same names in the Task 6 tables. `PersonTotals` uses `person`/`codes`/`total`/`revenue` consistently. `summariseByCoupon` / `summariseByPerson` are spelled identically in Tasks 2, 5.

**One deliberate ordering choice:** Task 4 (backfill) runs after Task 3 (write path) so that Task 3 Step 7 can assert the ledger is still empty — proving abandoned checkouts write nothing. Backfilling first would make that assertion impossible.
