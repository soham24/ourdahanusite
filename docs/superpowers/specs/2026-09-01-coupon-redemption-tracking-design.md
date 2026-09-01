# Coupon Redemption Tracking — Design

**Status:** approved, ready for implementation planning
**Date:** 2026-09-01

## Goal

Let an admin see, for every coupon code: how many registrations it drove, which
accounts used it, when, and how much money came in — rolled up per person the
code was given to. A redemption counts only when payment succeeded and the
listing was actually created or renewed.

## Why this is needed

The existing `coupons.usage_count` reads **0 for every coupon**, while
`listings` holds **32 real paid coupon registrations**. Three independent
defects cause this, all verified against production:

1. **RLS silently blocks the write.** `coupons` has exactly one policy —
   `SELECT`. There is no `UPDATE` policy. The increment in
   `src/app/api/razorpay/create-listing-order/route.ts:36-50` runs on the
   user-scoped client, so Postgres rejects it without raising an error the
   caller ever sees.
2. **It is a dangling promise.** That block uses `.then()` with no `await`
   inside a serverless function, so the function can return before the write is
   attempted. It also does a read-then-write with no atomicity, which would
   lose concurrent redemptions even if the policy existed.
3. **It fires at the wrong moment.** The increment runs when the Razorpay order
   is *created*, not when payment succeeds. Two abandoned `listing` payment
   intents already carry coupons and would have inflated the count.

A fourth problem is structural rather than a bug: `renewListing` overwrites
`listings.coupon_used` on the same row. A listing created with `ajay100` and
later renewed with `mukul150` retains only `mukul150`. The original attribution
is destroyed, so no report derived from `listings` alone can be correct.

`incrementCouponUsage()` in `src/app/actions/pricing.ts:122` is dead code — no
caller anywhere in the repo.

### Production state at time of writing

| Coupon | Paid registrations | ₹ collected | Still in `coupons`? |
|---|---|---|---|
| ourdahanu | 10 | 1,500 | deleted |
| ajay100 | 9 | 3,600 | yes |
| coreourdahanu | 7 | 200 | deleted |
| mukul100 | 3 | 1,200 | yes |
| mukul150 | 1 | 600 | yes |
| tanvi100 | 1 | 400 | yes |
| manas | 1 | 25 | deleted |

Three of seven codes were hard-deleted via `deleteCoupon`, taking 18
registrations' worth of attribution with them. Any design keyed solely on a
coupon foreign key would repeat that loss.

## Decisions

Confirmed with the site owner before designing:

- Renewals **are** tracked, recorded separately from new registrations.
- Free (₹0) coupon registrations **do** count, flagged so revenue stays honest.
- All 32 historical redemptions are backfilled, **including** deleted codes.
- Coupons carry an explicit `assigned_to` person, not a name parsed from the code.
- Admin needs: per-coupon totals, drill-down to individual redemptions, and a
  per-person roll-up.
- CSV export is **out of scope** (YAGNI — not requested; trivial to add later
  against the same table).

## Architecture

### 1. `coupon_redemptions` — append-only ledger

One row per successful redemption. Never updated, never deleted by application
code.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | `gen_random_uuid()` |
| `coupon_id` | uuid NULL | FK → `coupons(id)` `ON DELETE SET NULL` |
| `coupon_code` | text NOT NULL | lowercase snapshot at redemption time |
| `user_id` | uuid NOT NULL | FK → `auth.users(id)`, the redeeming account |
| `listing_id` | uuid NULL | FK → `listings(id)` `ON DELETE SET NULL` |
| `kind` | text NOT NULL | `CHECK (kind IN ('new','renewal'))` |
| `payment_status` | text NOT NULL | `CHECK (payment_status IN ('paid','free_coupon'))` |
| `amount_paid` | integer NOT NULL | rupees, `0` for free coupons |
| `payment_id` | text NULL | Razorpay payment id; NULL for free coupons |
| `redeemed_at` | timestamptz NOT NULL | `DEFAULT now()` |

Storing **both** `coupon_id` and `coupon_code` is load-bearing. The FK enables
joins while a coupon exists; the text snapshot preserves history after
deletion. `ON DELETE SET NULL` (not `CASCADE`) means deleting a coupon never
destroys redemption rows.

`listing_id` is `ON DELETE SET NULL` for the same reason: a deleted listing
must not erase the fact that money came in under a coupon.

**On the `payment_status` CHECK:** `listings.payment_status` has a third value
in production — `'manual'` (3 rows), written by admin-created listings at
`src/app/actions/admin-listings.ts:66`. Every one of those rows has
`coupon_used IS NULL`, and the admin creation path never applies a coupon, so
`'manual'` cannot reach this ledger. The two-value CHECK is therefore correct
and matches `SubmissionCharge.paymentStatus`, which is typed
`'paid' | 'free_coupon'` in `src/lib/payment-security.ts:14`. If admin-created
listings ever gain coupon support, this constraint must be widened first —
otherwise the insert will fail the CHECK.

**Indexes**

- `UNIQUE (payment_id) WHERE payment_id IS NOT NULL` — idempotency. A retried
  or replayed payment cannot double-count.
- `(coupon_code)` — per-coupon aggregation.
- `(redeemed_at DESC)` — drill-down ordering.

**Idempotency limitation, stated explicitly:** free-coupon redemptions have no
`payment_id`, so the unique index does not cover them. This is accepted rather
than engineered around for `submitPaidListing` (a resubmit hits the `subdomain`
UNIQUE check before the ledger write), but not for `renewListing`, which
updates an existing row and has no natural key to collide on. A follow-up
migration (`supabase/add_coupon_redemptions_free_guard.sql`) closes this gap
with a `(listing_id, coupon_code, kind, ((redeemed_at AT TIME ZONE 'UTC')::date))`
unique index — note `AT TIME ZONE 'UTC'`, not `redeemed_at::date`, because a
plain `timestamptz::date` cast is not IMMUTABLE (it depends on the session's
`TimeZone` setting) and Postgres rejects it in an index expression.

### 2. Write path

The ledger row is inserted **after** payment signature verification passes
**and** the listing row is committed — never at checkout-open.

- **New registration** — `src/app/actions/listings.ts`, in `submitListing`,
  after the insert succeeds (currently line 191, alongside
  `markIntentFinalized`). `kind = 'new'`.
- **Renewal** — same file, in `renewListing`, after the update succeeds
  (currently line 764, alongside `markIntentFinalized`). `kind = 'renewal'`.

Both paths already know `charge.couponValid`, `charge.couponCode`,
`charge.finalPrice`, `charge.paymentStatus`, and `paymentId`. No new data needs
to be threaded through.

A redemption is written only when `charge.couponValid && charge.couponCode`.

**Privilege:** the insert uses `createAdminClient()` (service role), matching
the existing pattern — `renewListing` already calls it at line 743. This is a
security requirement, not a convenience: `coupon_redemptions` gets **no
user-facing INSERT policy**, so redemption counts cannot be forged by a user
crafting requests. RLS on the table is admin-read-only.

**Failure isolation:** a ledger write failure must never fail or roll back a
paid registration. The insert is wrapped so that an error is logged and
swallowed — the customer keeps their listing. This is a deliberate trade:
under-counting is recoverable (the listing row still holds `coupon_used`);
rejecting a paid signup is not.

### 3. `coupons.assigned_to`

New nullable text column — the person the code was given to (e.g.
`"Ajay Bari"`). Set from the admin coupon form. Groups `mukul100` and
`mukul150` under one person in the roll-up. Nullable because existing coupons
have no value and deleted-code history has no coupon row at all.

### 4. Admin reporting

Three views, all reading from `coupon_redemptions`:

- **Per-coupon totals** — registrations, new vs renewal split, ₹ collected.
  Replaces the `used {coupon.usage_count}×` text at
  `src/app/admin/pricing/PricingManager.tsx:250`, which currently always
  renders "used 0×".
- **Drill-down** — for one coupon: each redeeming business, account, date,
  amount paid, and a link to the listing.
- **Per-person roll-up** — totals grouped by `assigned_to`, spanning all codes
  that person holds. Redemptions whose coupon was deleted (`coupon_id IS NULL`)
  group under their `coupon_code` as an "unassigned" bucket rather than being
  dropped.

### 5. Backfill

A one-time migration replaying every `listings` row where `coupon_used IS NOT
NULL` into `coupon_redemptions`, mapping `coupon_id` by matching
`listings.coupon_used` to `coupons.code` where a coupon still exists and
leaving it NULL where it does not.

That `coupon_used IS NOT NULL` filter also excludes the three `'manual'`
admin-created listings automatically, since all of them have a NULL coupon —
no extra `payment_status` filter is needed. All 32 matching rows are
`payment_status = 'paid'`, so the backfill carries that value straight across
and no row can violate the CHECK.

**Accepted inaccuracy:** because renewals overwrote `coupon_used`, every
backfilled row is recorded as `kind = 'new'`. Past renewals cannot be
reconstructed from the database. Data from the deploy forward is exact; the
backfill is a best-effort reconstruction of what the column still holds. The
migration is idempotent — safe to re-run without duplicating rows.

### 6. Removing the broken code

- Delete the RLS-blocked increment block,
  `src/app/api/razorpay/create-listing-order/route.ts:36-50`.
- Delete the dead `incrementCouponUsage()`, `src/app/actions/pricing.ts:122-131`.
- Stop reading `usage_count` in `src/lib/data/pricing.ts` and `PricingManager.tsx`.

`coupons.usage_count` is **left in place** by this work and dropped in a
separate follow-up, after the ledger is confirmed working in production.
Dropping a column and its replacement code path in one deploy leaves no safe
rollback. This is deliberate sequencing, not an oversight.

## Testing

- **Pure functions** (aggregation/roll-up shaping) — `node:test` via
  `tsx --test`, registered in the explicit list in `package.json`, matching the
  repo's existing convention.
- **Migration** — verified against a Supabase branch, not production. Assert
  the backfill produces exactly 32 rows, that the three deleted codes land with
  `coupon_id IS NULL` and a preserved `coupon_code`, and that re-running the
  migration does not duplicate.
- **Write path** — cannot be unit-tested without a live Razorpay payment.
  Verified by build + typecheck + a manual free-coupon submission against a
  Supabase branch, plus confirming no ledger row is written when a checkout is
  abandoned.
- **RLS** — assert an anon/authenticated client cannot `INSERT` into
  `coupon_redemptions`. This is the security boundary the design depends on.

## Out of scope

- CSV export.
- Reconciling past renewals against Razorpay payment history. If the new-vs-
  renewal split matters for past commission payouts, that is a separate
  reconciliation job against Razorpay's records, not something the database can
  answer.
- Coupon usage limits, expiry dates, or per-user redemption caps. Not requested.
- Dropping `coupons.usage_count` (deliberate follow-up, see §6).
