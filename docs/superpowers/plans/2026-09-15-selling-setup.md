# Selling Setup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Any approved business can connect Razorpay on its own, rehearse a purchase that only it can see, follow one "Sell online" checklist, and never lose a paid order; admins suspend instead of switching each business on.

**Architecture:** Pure decision functions in `src/lib/selling/` (key classification, shop mode, checklist) are unit tested and shared by the server actions, the cached business page, checkout, My Business and the admin page. `listings.payments_enabled` keeps meaning "selling is switched on" but is now set by the owner's verified keys; two new suspension columns and `orders.is_test` are added, and a trigger stops API roles from changing the selling columns directly. Visibility of a test-mode shop is enforced twice: hidden in the page for non-owners, and refused on the server at checkout.

**Tech Stack:** Next.js 16.2 App Router with Cache Components, React 19, TypeScript, Tailwind with the `od-` design system, Supabase (Postgres + RLS), Razorpay Orders API, `node:test` via `tsx`.

**Spec:** `docs/superpowers/specs/2026-09-15-selling-setup-design.md` (roadmap: `docs/superpowers/specs/2026-09-15-commerce-usability-roadmap.md`).

## Global Constraints

- **The database is LIVE PRODUCTION.** Migrations are additive and idempotent. Apply only through the Supabase MCP `apply_migration` tool (project `slmbqngmxketyxjauxxk`). If that tool is unavailable, stop and report — never reach the database another way. Never delete rows you did not create.
- **Money goes straight to the business's own Razorpay account.** The Razorpay key secret is never logged, never returned to a client, never selected outside `loadOwnerRazorpayKeys`. The public business page never receives a key ID — only the derived shop mode.
- **The key prefix decides test vs live:** `rzp_test_…` is test, `rzp_live_…` is live. Owners are never asked to tick a test-mode box.
- **Copy, verbatim:**
  - Key ID labels: "Test key · practice, no real money", "Live key · real payments", "This doesn't look like a Razorpay Key ID"
  - Invalid Key ID error: "That Key ID doesn't look right. It starts with rzp_test_ or rzp_live_."
  - Razorpay 401 while saving: "Razorpay didn't accept these keys. The secret is only shown once, so generate a new key and paste both again."
  - Other failure while saving: "We couldn't reach Razorpay just now. Your keys weren't saved. Please try again."
  - Listing not approved: "Your listing needs to be live before you can sell online."
  - Suspended: "Selling is paused by OurDahanu: {reason}. Contact us to resume."
  - Checkout refused: "This shop isn't taking online payments yet."
  - Test banner on the business page: "Test mode · only you can see your shop. Try a practice purchase — no real money moves."
  - Practice notice at checkout: "Practice purchase · use test UPI success@razorpay or card 4111 1111 1111 1111 with any future date and CVV."
  - Keys rejected: "Razorpay stopped accepting your keys. Reconnect to keep selling."
  - Disconnect confirmation: "Customers won't be able to pay until you reconnect."
- **A payment Razorpay captured and that passes the signature, amount, status and notes checks is always saved as an order.** Suspension, a lapsed listing or rejected keys only stop new payments from starting.
- **Test orders** (`orders.is_test = true`) never reduce stock, never count in totals, stats or earnings, and never notify admins.
- **Notification delivery is best-effort:** a dispatch failure is logged and never changes an action's result. Use `after()` from `next/server` for notifications sent from actions and route handlers.
- **Untouched:** Telegram delivery code, `/api/v1/orders`, `/api/razorpay/create-product-order`, `OrderModal`, `ServicesSection`, `/shop`.
- **Tests:** `node:test` via `tsx --test`. Every new test file is appended to the explicit list in `package.json`'s `test:existing` script. Modules imported by a test use relative imports for runtime values. Baseline: `npm run test:existing` passes everything except clock-dependent appointment-slot test(s) that already fail on `main` (1–8 depending on the day).
- **`npx tsc --noEmit` stays clean.** No `any`, no `@ts-ignore`. `as` casts only on Supabase query results (the existing data-layer pattern).
- **Lint baseline is 0 errors / 11 warnings.** A task adds zero problems of either kind. `react-hooks/set-state-in-effect` is enforced.
- **`'use server'` files export only async functions** (type exports are fine). Types and constants live in non-server modules.
- **Next.js 16:** `params` and `searchParams` are Promises. Server actions invalidate public listing data with `revalidatePublicListingDetail(listingId)` from `src/lib/cache-tags.ts`. This Next.js has breaking changes — read `node_modules/next/dist/docs/` whenever an API is unclear.
- **Design system on every new or redesigned screen:** `od-page`, `od-shell`, `od-card`, `od-card-hover`, `od-button-primary`, `od-button-secondary`, `od-input`, `od-eyebrow`, `od-section-title`, `od-muted` and `var(--od-*)` / `var(--color-*)` tokens. No new hard-coded hex colours. One column and large touch targets on phones.
- **Browser checks** run on `http://localhost:3000` with the Browser pane's `preview_start` (`dev` config), never from a shell. Business pages are at `/listings/<id>`. The pane never fires `requestAnimationFrame`, so streamed Suspense content can stay hidden: run `if (window.$RB?.length) window.$RV(window.$RB)` in `javascript_tool` before judging what is visible.
- Scratch files go in the system temp directory, never the repo. If the dev server rewrites `next-env.d.ts`, revert it (`git checkout -- next-env.d.ts`) before committing. Commit with `git commit -m "<subject>" -m "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"`; no heredocs.

## File Map

| File | Responsibility | Task |
|---|---|---|
| `supabase/add_selling_setup.sql` | Suspension columns, `orders.is_test`, guard trigger on selling columns | 1 |
| `src/lib/database.types.ts` | New column types | 1 |
| `src/lib/selling/keys.ts` | Key ID classification and save-error copy | 2 |
| `src/lib/selling/shop-mode.ts` | Shop mode, admin status, who may buy, shared copy | 2 |
| `src/lib/selling/checklist.ts` | "Sell online" checklist steps | 2 |
| `src/lib/selling/selling.test.ts` | Unit tests for the three modules above | 2 |
| `src/lib/notifications/types.ts`, `templates.ts`, `selling-templates.test.ts` | `selling.paused`, `selling.resumed`, test-order titles, `shop_live` admin alert | 3 |
| `src/app/account/notifications/PreferencesForm.tsx` | Labels for the new types | 3 |
| `src/app/actions/listing-payments.ts` | Connect, disconnect, suspend, resume, load owner keys | 4, 8 |
| `src/app/actions/products.ts` | Item actions gated on approval and suspension | 4 |
| `src/lib/selling/shop-state.ts` | Uncached server read of a listing's shop mode and owner | 5 |
| `src/lib/data/listing-detail.ts`, `src/app/listings/[id]/page.tsx`, `src/app/listings/[id]/components/ListingContent.tsx` | Shop mode on the business page, owner-only test shop | 5 |
| `src/app/checkout/[productId]/page.tsx`, `CheckoutForm.tsx`, `src/app/api/razorpay/create-marketplace-order/route.ts` | Refuse test-mode checkout for others, practice notice, notify on rejected keys | 5 |
| `src/app/actions/marketplace-orders.ts` | Never refuse a paid order, test orders | 6 |
| `src/app/my-business/payments/page.tsx`, `ConnectRazorpay.tsx` (replaces `RazorpaySetupForm.tsx`) | Guided connection flow | 7 |
| `src/app/my-business/products/page.tsx`, `src/app/my-business/products/[listingId]/page.tsx` | No admin gate on items | 7 |
| `src/app/admin/payments/page.tsx`, `SellingControls.tsx`, `SellingStatusBadge.tsx` | Admin status, suspend and lift | 8 |
| `src/app/admin/products/page.tsx`, `src/app/admin/products/[listingId]/page.tsx` | Same four statuses | 8 |
| `src/app/my-business/SellOnlineCard.tsx`, `src/app/my-business/page.tsx` | One "Sell online" card | 9 |
| `src/app/actions/orders.ts`, `src/app/my-business/orders/page.tsx`, `src/app/account/orders/page.tsx`, `src/app/account/orders/[id]/page.tsx` | Test badge, excluded from totals | 10 |

---

### Task 1: Database columns and guard trigger

**Files:**
- Create: `supabase/add_selling_setup.sql`
- Modify: `src/lib/database.types.ts` (listings Row ~1401, Insert ~1457, Update ~1513; orders Row ~1725, Insert ~1757, Update ~1789)

**Interfaces:**
- Consumes: nothing.
- Produces (used by every later task): `listings.payments_suspended_at timestamptz null`, `listings.payments_suspended_reason text null` (≤ 300 characters), `orders.is_test boolean not null default false`; API roles (`anon`, `authenticated`) can no longer change `payments_enabled`, `payments_suspended_at` or `payments_suspended_reason`.

Why the trigger: `public.listings` has the policy "Owners can manage own listings" (FOR ALL, `auth.uid() = owner_id`, no WITH CHECK) and `anon`/`authenticated` hold UPDATE and INSERT grants, so without it an owner could lift their own suspension through the REST API. The app only writes these columns with the service-role client (`src/app/actions/listing-payments.ts`), whose `current_user` is `service_role`, so the trigger does not affect it.

- [ ] **Step 1: Write the migration**

Create `supabase/add_selling_setup.sql`:

```sql
-- ============================================================
-- Selling setup (commerce roadmap piece 1)
--   - Admins can suspend a listing's online selling.
--   - Orders paid with Razorpay test keys are marked as tests.
--   - API roles cannot change the selling columns directly; only
--     server code using the service role can.
-- Additive and idempotent: safe to run more than once.
-- ============================================================

ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS payments_suspended_at timestamptz,
  ADD COLUMN IF NOT EXISTS payments_suspended_reason text;

ALTER TABLE public.listings
  DROP CONSTRAINT IF EXISTS listings_payments_suspended_reason_length;
ALTER TABLE public.listings
  ADD CONSTRAINT listings_payments_suspended_reason_length
  CHECK (payments_suspended_reason IS NULL OR char_length(payments_suspended_reason) <= 300);

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS is_test boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.guard_listing_selling_columns()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF current_user NOT IN ('anon', 'authenticated') THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.payments_enabled := false;
    NEW.payments_suspended_at := NULL;
    NEW.payments_suspended_reason := NULL;
    RETURN NEW;
  END IF;

  IF NEW.payments_enabled IS DISTINCT FROM OLD.payments_enabled
     OR NEW.payments_suspended_at IS DISTINCT FROM OLD.payments_suspended_at
     OR NEW.payments_suspended_reason IS DISTINCT FROM OLD.payments_suspended_reason THEN
    RAISE EXCEPTION 'Selling status can only be changed by OurDahanu.'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_listing_selling_columns ON public.listings;
CREATE TRIGGER trg_guard_listing_selling_columns
  BEFORE INSERT OR UPDATE ON public.listings
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_listing_selling_columns();
```

- [ ] **Step 2: Pre-check production**

Run with the Supabase MCP `execute_sql` tool:

```sql
select
  (select json_agg(column_name) from information_schema.columns
     where table_schema = 'public' and table_name = 'listings'
       and column_name in ('payments_suspended_at', 'payments_suspended_reason')) as listing_columns,
  (select json_agg(column_name) from information_schema.columns
     where table_schema = 'public' and table_name = 'orders' and column_name = 'is_test') as order_columns,
  (select json_agg(tgname) from pg_trigger
     where tgrelid = 'public.listings'::regclass and not tgisinternal) as listing_triggers,
  (select count(*) from pg_proc where proname = 'guard_listing_selling_columns') as guard_functions;
```

Expected: `listing_columns` null, `order_columns` null, `listing_triggers` `["trg_lowercase_subdomain"]`, `guard_functions` 0. If anything differs, stop and report.

- [ ] **Step 3: Apply**

Apply the file's SQL with the Supabase MCP `apply_migration` tool, name `add_selling_setup`.

- [ ] **Step 4: Verify**

Run with `execute_sql`:

```sql
select
  (select json_agg(json_build_object('column', column_name, 'type', data_type, 'nullable', is_nullable, 'default', column_default))
     from information_schema.columns
     where table_schema = 'public'
       and ((table_name = 'listings' and column_name like 'payments_suspended%')
         or (table_name = 'orders' and column_name = 'is_test'))) as columns,
  (select json_agg(tgname) from pg_trigger
     where tgrelid = 'public.listings'::regclass and not tgisinternal) as listing_triggers,
  (select count(*) from orders where is_test) as test_orders;
```

Expected: three columns (`is_test` boolean, NOT NULL, default false); triggers include `trg_guard_listing_selling_columns`; `test_orders` 0.

Then prove the guard, inside a transaction that is always rolled back (it changes nothing):

```sql
begin;
select set_config(
  'request.jwt.claims',
  json_build_object('sub', (select owner_id from listings where owner_id is not null limit 1), 'role', 'authenticated')::text,
  true
);
set local role authenticated;
update listings set payments_suspended_reason = 'guard check'
  where owner_id = (select auth.uid());
rollback;
```

Expected: the `update` fails with `Selling status can only be changed by OurDahanu.` (then the rollback runs). If the MCP tool runs statements separately and reports no error because no row matched, report that instead of guessing.

- [ ] **Step 5: Add the types**

In `src/lib/database.types.ts`:

1. In the `listings` Row block, replace `          payments_enabled: boolean | null` (one occurrence) with:

```ts
          payments_enabled: boolean | null
          payments_suspended_at: string | null
          payments_suspended_reason: string | null
```

2. Replace both occurrences (replace-all) of `          payments_enabled?: boolean | null` with:

```ts
          payments_enabled?: boolean | null
          payments_suspended_at?: string | null
          payments_suspended_reason?: string | null
```

3. Search for `owner_razorpay_order_id`: it appears only in the `orders` block (Row, Insert, Update). Replace `          owner_razorpay_order_id: string | null` with:

```ts
          is_test: boolean
          owner_razorpay_order_id: string | null
```

and replace both occurrences (replace-all) of `          owner_razorpay_order_id?: string | null` with:

```ts
          is_test?: boolean
          owner_razorpay_order_id?: string | null
```

- [ ] **Step 6: Typecheck**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 7: Commit**

```bash
git add supabase/add_selling_setup.sql src/lib/database.types.ts
git commit -m "feat(selling): suspension columns, test orders and selling-column guard" -m "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 2: Selling decision logic

**Files:**
- Create: `src/lib/selling/keys.ts`
- Create: `src/lib/selling/shop-mode.ts`
- Create: `src/lib/selling/checklist.ts`
- Create: `src/lib/selling/selling.test.ts`
- Modify: `package.json` (`test:existing`)

**Interfaces:**
- Consumes: nothing.
- Produces (used by Tasks 4–10):
  - `keys.ts`: `type RazorpayKeyKind = 'empty' | 'invalid' | 'test' | 'live'`; `classifyRazorpayKeyId(raw: string | null | undefined): RazorpayKeyKind`; `verifyFailureMessage(status: number | null): string`; constants `KEY_ID_INVALID_MESSAGE`, `KEYS_REJECTED_MESSAGE`, `RAZORPAY_UNREACHABLE_MESSAGE`
  - `shop-mode.ts`: `type ShopMode = 'off' | 'test' | 'live'`; `type SellingStatus = 'not_connected' | 'test' | 'live' | 'suspended'`; `interface ShopModeInput { approved: boolean; paymentsEnabled: boolean; suspendedAt: string | null; verifiedAt: string | null; keyId: string | null }`; `deriveShopMode(input: ShopModeInput): ShopMode`; `deriveSellingStatus(input: ShopModeInput): SellingStatus`; `canBuyFromShop(mode: ShopMode, viewer: { isOwner: boolean; isAdmin: boolean }): boolean`; `becameLive(previous: { keyId: string | null; verifiedAt: string | null } | null, nextKeyId: string): boolean`; `sellingPausedMessage(reason: string | null): string`; constants `SHOP_NOT_OPEN_MESSAGE`, `LISTING_NOT_LIVE_MESSAGE`
  - `checklist.ts`: `type ChecklistStepId = 'listing' | 'connect' | 'item' | 'practice' | 'live'`; `type ChecklistStepState = 'done' | 'todo' | 'blocked' | 'skipped'`; `type ChecklistStatus = 'setup' | 'complete' | 'suspended' | 'keys_rejected'`; `interface ChecklistInput { approved: boolean; suspendedAt: string | null; hasConfig: boolean; verifiedAt: string | null; keyId: string | null; activeItemCount: number; orderCount: number; testOrderCount: number }`; `interface ChecklistStep { id: ChecklistStepId; state: ChecklistStepState }`; `interface SellingChecklist { status: ChecklistStatus; steps: ChecklistStep[] }`; `deriveSellingChecklist(input: ChecklistInput): SellingChecklist`

- [ ] **Step 1: Write the failing test**

Create `src/lib/selling/selling.test.ts`:

```ts
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
```

- [ ] **Step 2: Register the test and watch it fail**

In `package.json`, in the `test:existing` script, replace `src/app/actions/jobs-core.test.ts"` with `src/app/actions/jobs-core.test.ts src/lib/selling/selling.test.ts"`.

Run: `npx tsx --test src/lib/selling/selling.test.ts`
Expected: FAIL with "Cannot find module './checklist'".

- [ ] **Step 3: Write `src/lib/selling/keys.ts`**

```ts
/**
 * Razorpay Key IDs carry their mode in the prefix: rzp_test_… keys only move
 * practice money, rzp_live_… keys move real money. The prefix is the single
 * source of truth for test vs live — owners are never asked to tick a box.
 */
export type RazorpayKeyKind = 'empty' | 'invalid' | 'test' | 'live'

export const KEY_ID_INVALID_MESSAGE =
  "That Key ID doesn't look right. It starts with rzp_test_ or rzp_live_."

export const KEYS_REJECTED_MESSAGE =
  "Razorpay didn't accept these keys. The secret is only shown once, so generate a new key and paste both again."

export const RAZORPAY_UNREACHABLE_MESSAGE =
  "We couldn't reach Razorpay just now. Your keys weren't saved. Please try again."

export function classifyRazorpayKeyId(raw: string | null | undefined): RazorpayKeyKind {
  const value = (raw ?? '').trim()
  if (!value) return 'empty'
  if (/^rzp_test_[A-Za-z0-9]+$/.test(value)) return 'test'
  if (/^rzp_live_[A-Za-z0-9]+$/.test(value)) return 'live'
  return 'invalid'
}

/** Owner-facing message for a failed key check; `null` means no HTTP answer. */
export function verifyFailureMessage(status: number | null): string {
  return status === 401 ? KEYS_REJECTED_MESSAGE : RAZORPAY_UNREACHABLE_MESSAGE
}
```

- [ ] **Step 4: Write `src/lib/selling/shop-mode.ts`**

```ts
import { classifyRazorpayKeyId } from './keys'

/** off: no online selling · test: only the owner may see and buy · live: everyone. */
export type ShopMode = 'off' | 'test' | 'live'

/** How admins see a business: suspension outranks everything else. */
export type SellingStatus = 'not_connected' | 'test' | 'live' | 'suspended'

export interface ShopModeInput {
  approved: boolean
  paymentsEnabled: boolean
  suspendedAt: string | null
  verifiedAt: string | null
  keyId: string | null
}

export const SHOP_NOT_OPEN_MESSAGE = "This shop isn't taking online payments yet."

export const LISTING_NOT_LIVE_MESSAGE = 'Your listing needs to be live before you can sell online.'

export function sellingPausedMessage(reason: string | null): string {
  const why = reason?.trim() || 'no reason given'
  return `Selling is paused by OurDahanu: ${why}. Contact us to resume.`
}

export function deriveShopMode(input: ShopModeInput): ShopMode {
  if (!input.approved || !input.paymentsEnabled || input.suspendedAt || !input.verifiedAt) {
    return 'off'
  }
  const kind = classifyRazorpayKeyId(input.keyId)
  if (kind === 'live') return 'live'
  if (kind === 'test') return 'test'
  return 'off'
}

export function deriveSellingStatus(input: ShopModeInput): SellingStatus {
  if (input.suspendedAt) return 'suspended'
  const mode = deriveShopMode(input)
  return mode === 'off' ? 'not_connected' : mode
}

export function canBuyFromShop(
  mode: ShopMode,
  viewer: { isOwner: boolean; isAdmin: boolean },
): boolean {
  if (mode === 'live') return true
  if (mode === 'test') return viewer.isOwner || viewer.isAdmin
  return false
}

/**
 * True when saving `nextKeyId` makes the shop live for the first time, or
 * moves it from test (or unverified) keys to live keys. Replacing one live
 * key with another is not news.
 */
export function becameLive(
  previous: { keyId: string | null; verifiedAt: string | null } | null,
  nextKeyId: string,
): boolean {
  if (classifyRazorpayKeyId(nextKeyId) !== 'live') return false
  const wasLive = Boolean(previous?.verifiedAt) && classifyRazorpayKeyId(previous?.keyId) === 'live'
  return !wasLive
}
```

- [ ] **Step 5: Write `src/lib/selling/checklist.ts`**

```ts
import { classifyRazorpayKeyId } from './keys'

export type ChecklistStepId = 'listing' | 'connect' | 'item' | 'practice' | 'live'
export type ChecklistStepState = 'done' | 'todo' | 'blocked' | 'skipped'
export type ChecklistStatus = 'setup' | 'complete' | 'suspended' | 'keys_rejected'

export interface ChecklistInput {
  approved: boolean
  suspendedAt: string | null
  /** A listing_payment_configs row exists, verified or not. */
  hasConfig: boolean
  verifiedAt: string | null
  keyId: string | null
  activeItemCount: number
  /** All owner_razorpay orders for the listing, test orders included. */
  orderCount: number
  testOrderCount: number
}

export interface ChecklistStep {
  id: ChecklistStepId
  state: ChecklistStepState
}

export interface SellingChecklist {
  status: ChecklistStatus
  steps: ChecklistStep[]
}

export function deriveSellingChecklist(input: ChecklistInput): SellingChecklist {
  const kind = classifyRazorpayKeyId(input.keyId)
  const connected = Boolean(input.verifiedAt) && (kind === 'test' || kind === 'live')
  const live = connected && kind === 'live'

  const listing: ChecklistStepState = input.approved ? 'done' : 'todo'
  const connect: ChecklistStepState = connected ? 'done' : input.approved ? 'todo' : 'blocked'
  const item: ChecklistStepState =
    input.activeItemCount > 0 ? 'done' : input.approved ? 'todo' : 'blocked'
  const practice: ChecklistStepState =
    input.orderCount > 0
      ? 'done'
      : live && input.testOrderCount === 0
        ? 'skipped'
        : connected
          ? 'todo'
          : 'blocked'
  const goLive: ChecklistStepState = live ? 'done' : connected ? 'todo' : 'blocked'

  const steps: ChecklistStep[] = [
    { id: 'listing', state: listing },
    { id: 'connect', state: connect },
    { id: 'item', state: item },
    { id: 'practice', state: practice },
    { id: 'live', state: goLive },
  ]

  let status: ChecklistStatus
  if (input.suspendedAt) {
    status = 'suspended'
  } else if (input.hasConfig && !input.verifiedAt) {
    status = 'keys_rejected'
  } else if (steps.every((step) => step.state === 'done' || step.state === 'skipped')) {
    status = 'complete'
  } else {
    status = 'setup'
  }

  return { status, steps }
}
```

- [ ] **Step 6: Run the tests**

Run: `npx tsx --test src/lib/selling/selling.test.ts`
Expected: PASS, all tests.

Run: `npx tsc --noEmit && npm run lint`
Expected: typecheck clean; lint 0 errors / 11 warnings.

- [ ] **Step 7: Commit**

```bash
git add src/lib/selling/keys.ts src/lib/selling/shop-mode.ts src/lib/selling/checklist.ts src/lib/selling/selling.test.ts package.json
git commit -m "feat(selling): key, shop-mode and checklist decision logic" -m "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 3: Notifications for selling and test orders

**Files:**
- Modify: `src/lib/notifications/types.ts`
- Modify: `src/lib/notifications/templates.ts`
- Modify: `src/app/account/notifications/PreferencesForm.tsx`
- Create: `src/lib/notifications/selling-templates.test.ts`
- Modify: `package.json` (`test:existing`)

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces (used by Tasks 4, 5 and 6):
  - notification types `'selling.paused'` with payload `{ listingId: string; listingName: string; reason: string; byAdmin: boolean }` and `'selling.resumed'` with payload `{ listingId: string; listingName: string }`
  - `'order.placed'` payload gains optional `isTest?: boolean`
  - `'admin.new_submission'` kind gains `'shop_live'` (use `title` = business name, `reviewPath` = `'/admin/payments'`)

- [ ] **Step 1: Write the failing test**

Create `src/lib/notifications/selling-templates.test.ts`:

```ts
import assert from 'node:assert/strict'
import test from 'node:test'

import { renderNotification } from './templates'

test('selling.paused by an admin quotes the reason and links to payments', () => {
  const rendered = renderNotification('selling.paused', {
    listingId: 'l1',
    listingName: 'Organic Farm',
    reason: 'Fake <items>',
    byAdmin: true,
  })
  assert.equal(rendered.title, 'Selling paused · Organic Farm')
  assert.equal(rendered.body, 'Selling is paused by OurDahanu: Fake <items>. Contact us to resume.')
  assert.equal(rendered.link, '/my-business/payments')
  assert.match(rendered.email?.html ?? '', /Fake &lt;items&gt;/)
  assert.equal((rendered.email?.html ?? '').includes('<items>'), false)
})

test('selling.paused after Razorpay rejects keys asks the owner to reconnect', () => {
  const rendered = renderNotification('selling.paused', {
    listingId: 'l1',
    listingName: 'Organic Farm',
    reason: 'Razorpay stopped accepting your keys',
    byAdmin: false,
  })
  assert.equal(rendered.body, 'Razorpay stopped accepting your keys. Reconnect Razorpay to keep selling.')
  assert.equal(rendered.link, '/my-business/payments')
})

test('selling.resumed links to My Business', () => {
  const rendered = renderNotification('selling.resumed', { listingId: 'l1', listingName: 'Organic Farm' })
  assert.equal(rendered.title, 'Selling resumed · Organic Farm')
  assert.equal(rendered.link, '/my-business')
})

test('test orders say so in the buyer and owner titles', () => {
  const base = {
    orderId: 'o1',
    listingId: 'l1',
    listingName: 'Organic Farm',
    productName: 'Chikoo',
    quantity: 2,
    amountTotal: 300,
    buyerName: 'Asha',
    isTest: true,
  }
  assert.equal(
    renderNotification('order.placed', { ...base, recipient: 'buyer' }).title,
    'Test order · Order confirmed · Organic Farm',
  )
  assert.equal(
    renderNotification('order.placed', { ...base, recipient: 'owner' }).title,
    'Test order · New order · Chikoo',
  )
  assert.match(renderNotification('order.placed', { ...base, recipient: 'owner' }).email?.subject ?? '', /^\[Test\] /)
})

test('real orders keep their titles', () => {
  const base = {
    orderId: 'o1',
    listingId: 'l1',
    listingName: 'Organic Farm',
    productName: 'Chikoo',
    quantity: 2,
    amountTotal: 300,
    buyerName: 'Asha',
  }
  assert.equal(renderNotification('order.placed', { ...base, recipient: 'buyer' }).title, 'Order confirmed · Organic Farm')
  assert.equal(renderNotification('order.placed', { ...base, recipient: 'owner' }).title, 'New order · Chikoo')
})

test('admin shop_live alert names the business', () => {
  const rendered = renderNotification('admin.new_submission', {
    kind: 'shop_live',
    title: 'Organic Farm',
    reviewPath: '/admin/payments',
  })
  assert.equal(rendered.title, 'Organic Farm is now selling online')
  assert.equal(rendered.link, '/admin/payments')
})
```

- [ ] **Step 2: Register the test and watch it fail**

In `package.json`, in the `test:existing` script, replace `src/lib/selling/selling.test.ts"` with `src/lib/selling/selling.test.ts src/lib/notifications/selling-templates.test.ts"`.

Run: `npx tsx --test src/lib/notifications/selling-templates.test.ts`
Expected: FAIL. `renderNotification` has no `selling.paused` case and titles do not carry "Test order".

- [ ] **Step 3: Extend the types**

In `src/lib/notifications/types.ts`:

1. Replace

```ts
  'job.expiring',
  // Reviews
```

with

```ts
  'job.expiring',
  // Selling online
  'selling.paused',
  'selling.resumed',
  // Reviews
```

2. Replace

```ts
  buyerName: string
  /** Which recipient is this rendered for? */
  recipient: 'buyer' | 'owner' | 'admin'
}
```

with

```ts
  buyerName: string
  /** Which recipient is this rendered for? */
  recipient: 'buyer' | 'owner' | 'admin'
  /** Paid with Razorpay test keys: a practice purchase, no real money moved. */
  isTest?: boolean
}
```

3. Replace

```ts
interface JobExpiringPayload {
  postId: string
  title: string
  kind: 'hiring' | 'seeking'
  daysLeft: number
}
```

with

```ts
interface JobExpiringPayload {
  postId: string
  title: string
  kind: 'hiring' | 'seeking'
  daysLeft: number
}

interface SellingPausedPayload {
  listingId: string
  listingName: string
  /** Shown to the owner: written by an admin, or a fixed system reason. */
  reason: string
  /** True when an admin paused selling; false when Razorpay rejected the keys. */
  byAdmin: boolean
}

interface SellingResumedPayload {
  listingId: string
  listingName: string
}
```

4. Replace

```ts
    | 'job'
    | 'job_report'
```

with

```ts
    | 'job'
    | 'job_report'
    | 'shop_live'
```

5. Replace

```ts
  'job.expiring': JobExpiringPayload
```

with

```ts
  'job.expiring': JobExpiringPayload
  'selling.paused': SellingPausedPayload
  'selling.resumed': SellingResumedPayload
```

- [ ] **Step 4: Update the renderers**

In `src/lib/notifications/templates.ts`:

1. Replace

```ts
  const amount = formatCurrency(p.amountTotal)
  const qty = p.quantity
```

with

```ts
  const amount = formatCurrency(p.amountTotal)
  const qty = p.quantity
  const testPrefix = p.isTest ? 'Test order · ' : ''
  const testSubject = p.isTest ? '[Test] ' : ''
```

2. Replace `      title: \`Order confirmed · ${p.listingName}\`,` with `      title: \`${testPrefix}Order confirmed · ${p.listingName}\`,`

3. Replace `        subject: \`Order confirmed at ${p.listingName}\`,` with `        subject: \`${testSubject}Order confirmed at ${p.listingName}\`,`

4. Replace `      title: \`New order · ${p.productName}\`,` with `      title: \`${testPrefix}New order · ${p.productName}\`,`

5. Replace `        subject: \`🛒 New order — ${p.productName} (${amount})\`,` with `        subject: \`${testSubject}🛒 New order — ${p.productName} (${amount})\`,`

6. Directly above `function renderReviewNew(`, add:

```ts
function renderSellingPaused(p: NotificationPayload<'selling.paused'>): RenderedNotification {
  const body = p.byAdmin
    ? `Selling is paused by OurDahanu: ${p.reason}. Contact us to resume.`
    : `${p.reason}. Reconnect Razorpay to keep selling.`
  return {
    title: `Selling paused · ${p.listingName}`,
    body,
    link: '/my-business/payments',
    icon: 'AlertCircle',
    metadata: { listingId: p.listingId },
    email: {
      subject: `Online payments paused for ${p.listingName}`,
      html: renderEmailLayout({
        eyebrow: 'Selling paused',
        headline: 'Customers can’t pay online right now',
        introHtml: escapeHtml(body),
        ctaUrl: `${SITE_URL}/my-business/payments`,
        ctaText: p.byAdmin ? 'Open payments' : 'Reconnect Razorpay',
      }),
    },
    telegram: {
      text: `⏸️ <b>Selling paused</b>\n${escapeHtml(p.listingName)}: ${escapeHtml(body)}`,
    },
  }
}

function renderSellingResumed(p: NotificationPayload<'selling.resumed'>): RenderedNotification {
  const body =
    'OurDahanu has lifted the pause. If your Razorpay keys are still connected, customers can buy from your shop again.'
  return {
    title: `Selling resumed · ${p.listingName}`,
    body,
    link: '/my-business',
    icon: 'CheckCircle',
    metadata: { listingId: p.listingId },
    email: {
      subject: `Online payments resumed for ${p.listingName}`,
      html: renderEmailLayout({
        eyebrow: 'Selling resumed',
        headline: 'Your shop can take payments again',
        introHtml: escapeHtml(body),
        ctaUrl: `${SITE_URL}/my-business`,
        ctaText: 'Open My Business',
      }),
    },
    telegram: {
      text: `▶️ <b>Selling resumed</b>\n${escapeHtml(p.listingName)}: ${escapeHtml(body)}`,
    },
  }
}

```

7. Replace

```ts
    job: 'Job post',
    job_report: 'Job report',
  }
  const label = labels[p.kind]
```

with

```ts
    job: 'Job post',
    job_report: 'Job report',
    shop_live: 'Shop',
  }
  if (p.kind === 'shop_live') {
    return {
      title: `${p.title} is now selling online`,
      body: 'Live Razorpay keys connected. Take a quick look at their shop.',
      link: p.reviewPath,
      icon: 'ShoppingBag',
      email: {
        subject: `${p.title} is now selling online`,
        html: renderEmailLayout({
          eyebrow: 'Admin Alert',
          headline: `${p.title} is now selling online`,
          introHtml: `<strong>${escapeHtml(p.title)}</strong> connected live Razorpay keys. Customers can now pay on their page.`,
          ctaUrl: `${SITE_URL}${p.reviewPath}`,
          ctaText: 'Open payments',
        }),
      },
    }
  }
  const label = labels[p.kind]
```

(`renderEmailLayout` escapes `headline` itself.)

8. Replace

```ts
    case 'job.expiring':
      return renderJobExpiring(payload as NotificationPayload<'job.expiring'>)
```

with

```ts
    case 'job.expiring':
      return renderJobExpiring(payload as NotificationPayload<'job.expiring'>)
    case 'selling.paused':
      return renderSellingPaused(payload as NotificationPayload<'selling.paused'>)
    case 'selling.resumed':
      return renderSellingResumed(payload as NotificationPayload<'selling.resumed'>)
```

- [ ] **Step 5: Label the new types in notification preferences**

In `src/app/account/notifications/PreferencesForm.tsx`, replace

```ts
  'job.expiring': { label: 'Job post expiring', hint: 'When your job post is about to expire' },
```

with

```ts
  'job.expiring': { label: 'Job post expiring', hint: 'When your job post is about to expire' },
  'selling.paused': { label: 'Selling paused', hint: 'When online payments stop for your business' },
  'selling.resumed': { label: 'Selling resumed', hint: 'When a pause on selling is lifted' },
```

- [ ] **Step 6: Run the tests**

Run: `npx tsx --test src/lib/notifications/selling-templates.test.ts src/lib/notifications/job-templates.test.ts`
Expected: PASS, all tests.

Run: `npx tsc --noEmit`
Expected: clean. (`TYPE_LABELS` is a `Record<NotificationType, …>`, so a missing label is a type error.)

- [ ] **Step 7: Commit**

```bash
git add src/lib/notifications/types.ts src/lib/notifications/templates.ts src/app/account/notifications/PreferencesForm.tsx src/lib/notifications/selling-templates.test.ts package.json
git commit -m "feat(selling): notifications for paused and resumed selling and test orders" -m "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 4: Self-serve Razorpay connection and admin suspension actions

**Files:**
- Modify (full replacement): `src/app/actions/listing-payments.ts`
- Modify: `src/app/actions/products.ts:48-93`

**Interfaces:**
- Consumes: `classifyRazorpayKeyId`, `KEY_ID_INVALID_MESSAGE`, `verifyFailureMessage` (Task 2, `@/lib/selling/keys`); `LISTING_NOT_LIVE_MESSAGE`, `sellingPausedMessage`, `becameLive` (Task 2, `@/lib/selling/shop-mode`); notification types from Task 3; columns from Task 1.
- Produces (used by Tasks 6, 7 and 8):
  - `saveRazorpayConfig(formData: FormData): Promise<{ error?: string; ok?: true; mode?: 'test' | 'live' }>` — form fields `listing_id`, `razorpay_key_id`, `razorpay_key_secret`
  - `deleteRazorpayConfig(listingId: string): Promise<{ error?: string; ok?: true }>`
  - `suspendListingSelling(listingId: string, reason: string): Promise<{ error?: string }>`
  - `resumeListingSelling(listingId: string): Promise<{ error?: string }>`
  - `loadOwnerRazorpayKeys(listingId: string, options?: { allowUnverified?: boolean }): Promise<OwnerRazorpayKeys | null>` where `OwnerRazorpayKeys = { keyId: string; keySecret: string; testMode: boolean }`
  - `toggleListingPaymentsEnabled` and `updateListingPaymentsFromForm` stay, unchanged, until Task 8 removes them.

These are server actions that call Supabase and Razorpay, so they are verified by typecheck, lint and build here, and in the browser in later tasks. The decisions they rely on are unit tested in Task 2.

- [ ] **Step 1: Replace `src/app/actions/listing-payments.ts`**

```ts
'use server'

import { after } from 'next/server'

import { getUserRole, requireAdmin } from '@/app/actions/admin'
import { revalidatePublicListingDetail } from '@/lib/cache-tags'
import { encryptSecret, keyIdLast4 } from '@/lib/crypto/secret'
import { sendNotification, sendNotificationToAdmins } from '@/lib/notifications'
import {
  KEY_ID_INVALID_MESSAGE,
  classifyRazorpayKeyId,
  verifyFailureMessage,
} from '@/lib/selling/keys'
import {
  LISTING_NOT_LIVE_MESSAGE,
  becameLive,
  sellingPausedMessage,
} from '@/lib/selling/shop-mode'
import { createAdminClient } from '@/lib/supabase/admin-client'
import { createClient } from '@/lib/supabase/server'

/* ------------------------------------------------------------------ */
/*  Admin: toggle payments_enabled per listing                         */
/* ------------------------------------------------------------------ */

export async function toggleListingPaymentsEnabled(
  listingId: string,
  enabled: boolean,
): Promise<{ error?: string }> {
  const supabase = await createClient()
  await requireAdmin(supabase)

  const adminClient = createAdminClient()
  if (!adminClient) return { error: 'Server configuration error.' }

  const { error } = await adminClient
    .from('listings')
    .update({ payments_enabled: enabled })
    .eq('id', listingId)

  if (error) return { error: error.message }

  revalidatePublicListingDetail(listingId)
  return {}
}

export async function updateListingPaymentsFromForm(
  listingId: string,
  formData: FormData,
): Promise<{ error?: string }> {
  const enabled = formData.get('payments_enabled') === 'on'
  return toggleListingPaymentsEnabled(listingId, enabled)
}

/* ------------------------------------------------------------------ */
/*  Owner: connect and disconnect Razorpay                             */
/* ------------------------------------------------------------------ */

/** Verify keys work by asking Razorpay for the authenticated orders list. */
async function verifyRazorpayKeys(
  keyId: string,
  keySecret: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const auth = `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString('base64')}`
  try {
    const res = await fetch('https://api.razorpay.com/v1/orders?count=1', {
      method: 'GET',
      headers: { Authorization: auth },
      cache: 'no-store',
    })
    if (res.ok) return { ok: true }
    return { ok: false, error: verifyFailureMessage(res.status) }
  } catch {
    return { ok: false, error: verifyFailureMessage(null) }
  }
}

type SellingListing = {
  id: string
  name: string
  owner_id: string | null
  approved: boolean | null
  payments_suspended_at: string | null
  payments_suspended_reason: string | null
}

/**
 * The listing, when the signed-in user owns it or is an admin. Approval and
 * suspension are checked by the caller, because disconnecting stays allowed
 * while selling is paused.
 */
async function loadOwnedListing(
  listingId: string,
): Promise<{ listing: SellingListing } | { error: string }> {
  const supabase = await createClient()
  const { user, role } = await getUserRole(supabase)
  if (!user) return { error: 'Please sign in.' }

  const adminClient = createAdminClient()
  if (!adminClient) return { error: 'Server configuration error.' }

  const { data } = await adminClient
    .from('listings')
    .select('id, name, owner_id, approved, payments_suspended_at, payments_suspended_reason')
    .eq('id', listingId)
    .maybeSingle()

  const listing = (data ?? null) as SellingListing | null
  if (!listing) return { error: 'Listing not found.' }
  if (listing.owner_id !== user.id && role !== 'admin') {
    return { error: 'You do not own this listing.' }
  }
  return { listing }
}

export async function saveRazorpayConfig(
  formData: FormData,
): Promise<{ error?: string; ok?: true; mode?: 'test' | 'live' }> {
  const listingId = String(formData.get('listing_id') ?? '').trim()
  const keyId = String(formData.get('razorpay_key_id') ?? '').trim()
  const keySecret = String(formData.get('razorpay_key_secret') ?? '').trim()

  if (!listingId) return { error: 'Listing is required.' }
  const kind = classifyRazorpayKeyId(keyId)
  if (kind === 'empty') return { error: 'Paste your Razorpay Key ID.' }
  if (kind === 'invalid') return { error: KEY_ID_INVALID_MESSAGE }
  if (!keySecret) return { error: 'Paste your Razorpay Key Secret.' }

  const owned = await loadOwnedListing(listingId)
  if ('error' in owned) return { error: owned.error }
  const { listing } = owned

  if (listing.payments_suspended_at) {
    return { error: sellingPausedMessage(listing.payments_suspended_reason) }
  }
  if (!listing.approved) return { error: LISTING_NOT_LIVE_MESSAGE }

  const verify = await verifyRazorpayKeys(keyId, keySecret)
  if (!verify.ok) return { error: verify.error }

  let ciphertext: string
  try {
    ciphertext = encryptSecret(keySecret)
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Encryption failed.' }
  }

  const adminClient = createAdminClient()
  if (!adminClient) return { error: 'Server configuration error.' }

  const { data: previousData } = await adminClient
    .from('listing_payment_configs')
    .select('razorpay_key_id, verified_at')
    .eq('listing_id', listingId)
    .maybeSingle()
  const previous = (previousData ?? null) as
    | { razorpay_key_id: string; verified_at: string | null }
    | null

  const now = new Date().toISOString()
  const { error: configError } = await adminClient
    .from('listing_payment_configs')
    .upsert(
      {
        listing_id: listingId,
        razorpay_key_id: keyId,
        razorpay_key_secret_encrypted: ciphertext,
        razorpay_key_last4: keyIdLast4(keyId),
        // The key prefix decides test vs live; owners are never asked.
        test_mode: kind === 'test',
        verified_at: now,
        updated_at: now,
      },
      { onConflict: 'listing_id' },
    )
  if (configError) return { error: configError.message }

  const { error: listingError } = await adminClient
    .from('listings')
    .update({ payments_enabled: true })
    .eq('id', listingId)
  if (listingError) return { error: listingError.message }

  revalidatePublicListingDetail(listingId)

  const goesLive = becameLive(
    previous ? { keyId: previous.razorpay_key_id, verifiedAt: previous.verified_at } : null,
    keyId,
  )
  if (goesLive) {
    after(async () => {
      try {
        await sendNotificationToAdmins(
          'admin.new_submission',
          { kind: 'shop_live', title: listing.name, reviewPath: '/admin/payments' },
          { awaitDelivery: true },
        )
      } catch (error) {
        console.error('[listing-payments] shop_live notification failed', error)
      }
    })
  }

  return { ok: true, mode: kind }
}

export async function deleteRazorpayConfig(
  listingId: string,
): Promise<{ error?: string; ok?: true }> {
  const owned = await loadOwnedListing(listingId)
  if ('error' in owned) return { error: owned.error }

  const adminClient = createAdminClient()
  if (!adminClient) return { error: 'Server configuration error.' }

  const { error } = await adminClient
    .from('listing_payment_configs')
    .delete()
    .eq('listing_id', listingId)
  if (error) return { error: error.message }

  const { error: listingError } = await adminClient
    .from('listings')
    .update({ payments_enabled: false })
    .eq('id', listingId)
  if (listingError) return { error: listingError.message }

  revalidatePublicListingDetail(listingId)
  return { ok: true }
}

/* ------------------------------------------------------------------ */
/*  Admin: suspend and resume selling                                  */
/* ------------------------------------------------------------------ */

export async function suspendListingSelling(
  listingId: string,
  reason: string,
): Promise<{ error?: string }> {
  const supabase = await createClient()
  await requireAdmin(supabase)

  const trimmed = String(reason ?? '').trim()
  if (!trimmed) return { error: 'Add a short reason the owner will see.' }
  if (trimmed.length > 300) return { error: 'Keep the reason to 300 characters or fewer.' }

  const adminClient = createAdminClient()
  if (!adminClient) return { error: 'Server configuration error.' }

  const { data, error } = await adminClient
    .from('listings')
    .update({
      payments_enabled: false,
      payments_suspended_at: new Date().toISOString(),
      payments_suspended_reason: trimmed,
    })
    .eq('id', listingId)
    .select('id, name, owner_id')
    .maybeSingle()

  if (error) return { error: error.message }
  const listing = (data ?? null) as { id: string; name: string; owner_id: string | null } | null
  if (!listing) return { error: 'Listing not found.' }

  revalidatePublicListingDetail(listingId)

  const ownerId = listing.owner_id
  if (ownerId) {
    after(async () => {
      try {
        await sendNotification(
          ownerId,
          'selling.paused',
          { listingId, listingName: listing.name, reason: trimmed, byAdmin: true },
          { awaitDelivery: true },
        )
      } catch (err) {
        console.error('[listing-payments] selling.paused notification failed', err)
      }
    })
  }

  return {}
}

export async function resumeListingSelling(listingId: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  await requireAdmin(supabase)

  const adminClient = createAdminClient()
  if (!adminClient) return { error: 'Server configuration error.' }

  const { data: configData } = await adminClient
    .from('listing_payment_configs')
    .select('verified_at')
    .eq('listing_id', listingId)
    .maybeSingle()
  const hasVerifiedKeys = Boolean((configData as { verified_at: string | null } | null)?.verified_at)

  const { data, error } = await adminClient
    .from('listings')
    .update({
      payments_enabled: hasVerifiedKeys,
      payments_suspended_at: null,
      payments_suspended_reason: null,
    })
    .eq('id', listingId)
    .select('id, name, owner_id')
    .maybeSingle()

  if (error) return { error: error.message }
  const listing = (data ?? null) as { id: string; name: string; owner_id: string | null } | null
  if (!listing) return { error: 'Listing not found.' }

  revalidatePublicListingDetail(listingId)

  const ownerId = listing.owner_id
  if (ownerId) {
    after(async () => {
      try {
        await sendNotification(
          ownerId,
          'selling.resumed',
          { listingId, listingName: listing.name },
          { awaitDelivery: true },
        )
      } catch (err) {
        console.error('[listing-payments] selling.resumed notification failed', err)
      }
    })
  }

  return {}
}

/* ------------------------------------------------------------------ */
/*  Server-only helper for checkout: load decrypted owner keys         */
/* ------------------------------------------------------------------ */

export type OwnerRazorpayKeys = {
  keyId: string
  keySecret: string
  testMode: boolean
}

/**
 * Internal use only — NEVER return this from a server action to the client.
 *
 * `allowUnverified` is for finalising a payment Razorpay already captured:
 * the keys may have been flagged since that payment started, but the HMAC
 * check still needs the secret.
 */
export async function loadOwnerRazorpayKeys(
  listingId: string,
  options: { allowUnverified?: boolean } = {},
): Promise<OwnerRazorpayKeys | null> {
  const { decryptSecret } = await import('@/lib/crypto/secret')
  const adminClient = createAdminClient()
  if (!adminClient) return null

  const { data } = await adminClient
    .from('listing_payment_configs')
    .select('razorpay_key_id, razorpay_key_secret_encrypted, verified_at')
    .eq('listing_id', listingId)
    .maybeSingle()

  if (!data) return null
  if (!data.verified_at && !options.allowUnverified) return null

  try {
    return {
      keyId: data.razorpay_key_id,
      keySecret: decryptSecret(data.razorpay_key_secret_encrypted),
      testMode: classifyRazorpayKeyId(data.razorpay_key_id) === 'test',
    }
  } catch (e) {
    console.error('[loadOwnerRazorpayKeys] decrypt failed:', e)
    return null
  }
}
```

- [ ] **Step 2: Let owners manage items before connecting Razorpay**

In `src/app/actions/products.ts`:

1. Add this import after `import { revalidatePublicListingDetail } from '@/lib/cache-tags'`:

```ts
import { LISTING_NOT_LIVE_MESSAGE, sellingPausedMessage } from '@/lib/selling/shop-mode'
```

2. Replace

```ts
  type ListingRow = { id: string; owner_id: string; payments_enabled: boolean }
```

with

```ts
  type ListingRow = {
    id: string
    owner_id: string
    approved: boolean | null
    payments_suspended_at: string | null
    payments_suspended_reason: string | null
  }
```

3. Replace both occurrences (use replace-all) of

```ts
      .select('id, owner_id, payments_enabled')
```

with

```ts
      .select('id, owner_id, approved, payments_suspended_at, payments_suspended_reason')
```

4. Replace

```ts
  if (!listing.payments_enabled && role !== 'admin') {
    return { ok: false, error: 'Payments are not enabled for this listing yet.' }
  }
```

with

```ts
  // Owners can prepare items before connecting Razorpay; customers only see
  // them once the shop is live. Admins manage any listing.
  if (role !== 'admin') {
    if (listing.payments_suspended_at) {
      return { ok: false, error: sellingPausedMessage(listing.payments_suspended_reason) }
    }
    if (!listing.approved) {
      return { ok: false, error: LISTING_NOT_LIVE_MESSAGE }
    }
  }
```

- [ ] **Step 3: Typecheck, lint and test**

Run: `npx tsc --noEmit && npm run lint && npm run test:existing`
Expected: typecheck clean; lint 0 errors / 11 warnings; tests pass except the known clock-dependent appointment-slot failure(s).

- [ ] **Step 4: Commit**

```bash
git add src/app/actions/listing-payments.ts src/app/actions/products.ts
git commit -m "feat(selling): self-serve Razorpay connection and admin suspension" -m "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 5: Shop mode on the business page and at checkout

**Files:**
- Create: `src/lib/selling/shop-state.ts`
- Modify: `src/lib/data/listing-detail.ts`
- Modify: `src/app/listings/[id]/page.tsx:213,386`
- Modify: `src/app/listings/[id]/components/ListingContent.tsx`
- Modify (full replacement): `src/app/checkout/[productId]/page.tsx`
- Modify: `src/app/checkout/[productId]/CheckoutForm.tsx`
- Modify: `src/app/api/razorpay/create-marketplace-order/route.ts`

**Interfaces:**
- Consumes: `deriveShopMode`, `canBuyFromShop`, `SHOP_NOT_OPEN_MESSAGE`, `type ShopMode` (Task 2); `selling.paused` notification (Task 3); `getUserRole(supabase)` from `@/app/actions/admin` (returns `{ user, role }`, `role` is `'admin' | 'moderator' | 'user'`); `useListingViewer()` from `src/app/listings/[id]/ListingViewerContext.tsx` (has `isOwner`).
- Produces:
  - `loadShopState(listingId: string): Promise<ShopState | null>` with `interface ShopState { mode: ShopMode; ownerId: string | null; listingName: string }` (server-only, uncached)
  - `ListingDetailData.shopMode: ShopMode` replaces `marketplaceReady`
  - `CheckoutFormProps.testMode: boolean`

- [ ] **Step 1: Write `src/lib/selling/shop-state.ts`**

```ts
import 'server-only'

import { deriveShopMode, type ShopMode } from '@/lib/selling/shop-mode'
import { createAdminClient } from '@/lib/supabase/admin-client'

export interface ShopState {
  mode: ShopMode
  ownerId: string | null
  listingName: string
}

/**
 * Live (never cached) read of a listing's shop mode and owner, for decisions
 * that must not trust a cached page: who may open checkout and create a
 * Razorpay order. Uses the service role because payment configs have no
 * public read policy; the key secret is never selected.
 */
export async function loadShopState(listingId: string): Promise<ShopState | null> {
  const adminClient = createAdminClient()
  if (!adminClient) return null

  const [{ data: listingData }, { data: configData }] = await Promise.all([
    adminClient
      .from('listings')
      .select('name, owner_id, approved, payments_enabled, payments_suspended_at')
      .eq('id', listingId)
      .maybeSingle(),
    adminClient
      .from('listing_payment_configs')
      .select('verified_at, razorpay_key_id')
      .eq('listing_id', listingId)
      .maybeSingle(),
  ])

  const listing = (listingData ?? null) as {
    name: string
    owner_id: string | null
    approved: boolean | null
    payments_enabled: boolean | null
    payments_suspended_at: string | null
  } | null
  if (!listing) return null

  const config = (configData ?? null) as { verified_at: string | null; razorpay_key_id: string } | null

  return {
    mode: deriveShopMode({
      approved: listing.approved === true,
      paymentsEnabled: listing.payments_enabled === true,
      suspendedAt: listing.payments_suspended_at,
      verifiedAt: config?.verified_at ?? null,
      keyId: config?.razorpay_key_id ?? null,
    }),
    ownerId: listing.owner_id,
    listingName: listing.name,
  }
}
```

- [ ] **Step 2: Return `shopMode` from the cached listing detail**

In `src/lib/data/listing-detail.ts`:

1. Replace

```ts
import { logCacheRegeneration } from '@/lib/isr-debug'
import { createAdminClient } from '@/lib/supabase/admin-client'
```

with

```ts
import { logCacheRegeneration } from '@/lib/isr-debug'
import { deriveShopMode, type ShopMode } from '@/lib/selling/shop-mode'
import { createAdminClient } from '@/lib/supabase/admin-client'
```

2. Replace

```ts
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
```

with

```ts
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

type PaymentConfigSummary = { verified_at: string | null; razorpay_key_id: string }
```

3. Replace

```ts
  /** True only when both admin-enabled AND the owner's keys are verified. */
  marketplaceReady: boolean
```

with

```ts
  /**
   * off: no online selling · test: only the owner may see and use the shop ·
   * live: everyone. Derived from approval, suspension and the key prefix.
   */
  shopMode: ShopMode
```

4. Replace

```ts
    const listing = listingData as ListingRecord
```

with

```ts
    // The suspension reason is written for the owner, not the public, and this
    // record is serialised to the browser — so it is dropped here.
    const listing: ListingRecord = { ...(listingData as ListingRecord) }
    delete listing.payments_suspended_reason
```

5. Replace

```ts
      // RLS on listing_payment_configs only permits the listing owner to
      // SELECT — there is no public/anon policy. Use the service-role admin
      // client so public visitors can resolve marketplaceReady. We only read
      // the verified_at timestamp (no secrets like key_id/key_secret).
      paymentsEnabled
        ? (() => {
            const adminClient = createAdminClient()
            if (!adminClient) {
              return Promise.resolve({ data: null as { verified_at: string | null } | null })
            }
            return adminClient
              .from('listing_payment_configs')
              .select('verified_at')
              .eq('listing_id', listingId)
              .maybeSingle()
          })()
        : Promise.resolve({ data: null as { verified_at: string | null } | null }),
```

with

```ts
      // RLS on listing_payment_configs only permits the listing owner to
      // SELECT — there is no public/anon policy. Use the service-role admin
      // client so public visitors can resolve shopMode. The key ID is read
      // only to tell test keys from live keys; it never leaves this function.
      paymentsEnabled
        ? (() => {
            const adminClient = createAdminClient()
            if (!adminClient) {
              return Promise.resolve({ data: null as PaymentConfigSummary | null })
            }
            return adminClient
              .from('listing_payment_configs')
              .select('verified_at, razorpay_key_id')
              .eq('listing_id', listingId)
              .maybeSingle()
          })()
        : Promise.resolve({ data: null as PaymentConfigSummary | null }),
```

6. Replace

```ts
    const paymentConfig = (paymentConfigResult.data ?? null) as { verified_at: string | null } | null
    const marketplaceReady = paymentsEnabled && !!paymentConfig?.verified_at
```

with

```ts
    const paymentConfig = (paymentConfigResult.data ?? null) as PaymentConfigSummary | null
    const shopMode = deriveShopMode({
      approved: listing.approved === true,
      paymentsEnabled,
      suspendedAt: typeof listing.payments_suspended_at === 'string' ? listing.payments_suspended_at : null,
      verifiedAt: paymentConfig?.verified_at ?? null,
      keyId: paymentConfig?.razorpay_key_id ?? null,
    })
```

7. Replace `      marketplaceReady,` (in the returned object) with `      shopMode,`.

- [ ] **Step 3: Pass it through the business page**

In `src/app/listings/[id]/page.tsx`:

1. Replace `  const marketplaceReady = publicData?.marketplaceReady ?? false` with `  const shopMode = publicData?.shopMode ?? 'off'`.
2. Replace `              marketplaceReady={marketplaceReady}` with `              shopMode={shopMode}`.

- [ ] **Step 4: Show a test-mode shop to its owner only**

In `src/app/listings/[id]/components/ListingContent.tsx`:

1. Replace

```ts
import type { ListingRecord, ListingProductPublic } from '@/lib/data/listing-detail'
```

with

```ts
import type { ListingRecord, ListingProductPublic } from '@/lib/data/listing-detail'
import type { ShopMode } from '@/lib/selling/shop-mode'
```

2. Replace `  marketplaceReady: boolean` (in `ListingContentProps`) with `  shopMode: ShopMode`.

3. Replace

```ts
  marketplaceReady,
  marketplaceProducts,
```

with

```ts
  shopMode,
  marketplaceProducts,
```

4. Replace

```ts
  const viewer = useListingViewer()

  return (
```

with

```ts
  const viewer = useListingViewer()
  // A shop on test keys is a rehearsal: only its owner sees it. The server
  // refuses checkout for anyone else too (see /checkout and
  // create-marketplace-order), so this is presentation, not the safeguard.
  const showShop =
    marketplaceProducts.length > 0 &&
    (shopMode === 'live' || (shopMode === 'test' && viewer.isOwner))

  return (
```

5. Replace

```tsx
      {marketplaceReady && marketplaceProducts.length > 0 && (
        <Card id={services.length > 0 ? undefined : 'services'} className="scroll-mt-32">
          <div className="flex items-center justify-between mb-4 gap-2">
            <h2 className="text-base font-bold text-ink flex items-center gap-2">
              <span className="w-1 h-4 bg-brand rounded-full inline-block" />
              Shop
            </h2>
            <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2.5 py-1 text-[11px] font-semibold text-green-700">
              <CheckCircle size={11} />
              Direct payment to {String(listing.name)}
            </span>
          </div>
```

with

```tsx
      {showShop && (
        <Card id={services.length > 0 ? undefined : 'services'} className="scroll-mt-32">
          <div className="flex items-center justify-between mb-4 gap-2">
            <h2 className="text-base font-bold text-ink flex items-center gap-2">
              <span className="w-1 h-4 bg-brand rounded-full inline-block" />
              Shop
            </h2>
            {shopMode === 'live' ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2.5 py-1 text-[11px] font-semibold text-green-700">
                <CheckCircle size={11} />
                Direct payment to {String(listing.name)}
              </span>
            ) : (
              <span className="inline-flex items-center rounded-full bg-[rgba(200,136,30,0.14)] px-2.5 py-1 text-[11px] font-bold text-[var(--od-brand-strong)]">
                Test mode
              </span>
            )}
          </div>
          {shopMode === 'test' && (
            <p
              role="note"
              className="mb-4 rounded-xl border border-[rgba(200,136,30,0.35)] bg-[rgba(200,136,30,0.07)] px-3.5 py-2.5 text-[13px] leading-relaxed text-[var(--od-ink-2)]"
            >
              Test mode · only you can see your shop. Try a practice purchase — no real money moves.
            </p>
          )}
```

- [ ] **Step 5: Replace `src/app/checkout/[productId]/page.tsx`**

```tsx
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import type { Metadata } from 'next'
import { ArrowLeft, PackageX, Store } from 'lucide-react'

import { getUserRole } from '@/app/actions/admin'
import { fetchProductAndListing } from '@/lib/data/product-detail'
import { getCanonicalListingUrl } from '@/lib/listing-url'
import { SHOP_NOT_OPEN_MESSAGE, canBuyFromShop } from '@/lib/selling/shop-mode'
import { loadShopState } from '@/lib/selling/shop-state'
import { createClient } from '@/lib/supabase/server'
import CheckoutForm from './CheckoutForm'

// Checkout is per-buyer and must never be cached or indexed.
export const metadata: Metadata = {
  title: 'Checkout',
  robots: { index: false, follow: false },
}

function CheckoutUnavailable({
  icon,
  title,
  message,
  businessUrl,
  listingName,
}: {
  icon: React.ReactNode
  title: string
  message: string
  businessUrl: string
  listingName: string
}) {
  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md flex-col items-center justify-center gap-4 px-4 text-center">
      <span className="flex h-16 w-16 items-center justify-center rounded-full bg-[var(--color-surface-soft)] text-[var(--od-muted)]">
        {icon}
      </span>
      <h1 className="font-display text-2xl">{title}</h1>
      <p className="max-w-xs text-sm leading-relaxed text-[var(--od-muted)]">{message}</p>
      <Link href={businessUrl} className="od-button-primary mt-1 px-4 py-2 text-sm">
        Back to {listingName}
      </Link>
    </div>
  )
}

export default async function CheckoutPage({
  params,
}: {
  params: Promise<{ productId: string }>
}) {
  const { productId } = await params

  const data = await fetchProductAndListing(productId)
  if (!data?.product || !data.listing) notFound()
  const { product, listing } = data

  // Reading auth cookies makes this route dynamic automatically — no
  // `export const dynamic` needed.
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    redirect(`/login?next=${encodeURIComponent(`/checkout/${productId}`)}`)
  }

  const businessUrl = getCanonicalListingUrl(String(listing.id), listing.subdomain)

  // Uncached: a shop on test keys sells only to its owner (and admins).
  const [shop, { role }, { data: profile }] = await Promise.all([
    loadShopState(String(listing.id)),
    getUserRole(supabase),
    supabase.from('profiles').select('full_name, phone').eq('id', user.id).maybeSingle(),
  ])

  if (!shop || !canBuyFromShop(shop.mode, { isOwner: shop.ownerId === user.id, isAdmin: role === 'admin' })) {
    return (
      <CheckoutUnavailable
        icon={<Store size={30} aria-hidden />}
        title="Not open yet"
        message={SHOP_NOT_OPEN_MESSAGE}
        businessUrl={businessUrl}
        listingName={listing.name}
      />
    )
  }

  if (product.quantity_in_stock === 0) {
    return (
      <CheckoutUnavailable
        icon={<PackageX size={30} aria-hidden />}
        title="Sold out"
        message={`${product.name} is out of stock right now. ${listing.name} may restock it soon.`}
        businessUrl={businessUrl}
        listingName={listing.name}
      />
    )
  }

  return (
    <div className="mx-auto max-w-md px-4 py-5">
      <Link
        href={businessUrl}
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-[var(--od-muted)] transition-colors hover:text-[var(--od-brand)]"
      >
        <ArrowLeft size={14} aria-hidden />
        {listing.name}
      </Link>

      <CheckoutForm
        product={{
          id: product.id,
          name: product.name,
          pricePaise: product.price_paise,
          quantityInStock: product.quantity_in_stock,
          type: product.type,
          imageUrl: product.image_thumb_url || product.image_url,
        }}
        listing={{ id: String(listing.id), name: listing.name, whatsapp: listing.whatsapp }}
        businessUrl={businessUrl}
        buyerName={profile?.full_name || user.email?.split('@')[0] || ''}
        buyerPhone={profile?.phone || ''}
        buyerEmail={user.email ?? ''}
        testMode={shop.mode === 'test'}
      />
    </div>
  )
}
```

- [ ] **Step 6: Show the practice notice in the checkout form**

In `src/app/checkout/[productId]/CheckoutForm.tsx`:

1. Replace

```ts
  buyerEmail: string
}
```

with

```ts
  buyerEmail: string
  /** The business is on Razorpay test keys: this is a practice purchase. */
  testMode: boolean
}
```

2. Replace

```ts
  buyerEmail,
}: CheckoutFormProps) {
```

with

```ts
  buyerEmail,
  testMode,
}: CheckoutFormProps) {
```

3. Replace

```tsx
        Payment goes straight to {listing.name}
      </p>
```

with

```tsx
        Payment goes straight to {listing.name}
      </p>

      {testMode && (
        <p
          role="note"
          className="rounded-xl border border-[rgba(200,136,30,0.35)] bg-[rgba(200,136,30,0.07)] px-3.5 py-2.5 text-[13px] leading-relaxed text-[var(--od-ink-2)]"
        >
          Practice purchase · use test UPI success@razorpay or card 4111 1111 1111 1111 with any future date and CVV.
        </p>
      )}
```

- [ ] **Step 7: Enforce shop mode when creating the Razorpay order, and tell the owner when keys stop working**

In `src/app/api/razorpay/create-marketplace-order/route.ts`:

1. Replace

```ts
import { NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'

import { loadOwnerRazorpayKeys } from '@/app/actions/listing-payments'
import { CACHE_TAGS } from '@/lib/cache-tags'
import { recordPaymentIntent } from '@/lib/payment-intents'
```

with

```ts
import { NextResponse, after } from 'next/server'
import { revalidateTag } from 'next/cache'

import { getUserRole } from '@/app/actions/admin'
import { loadOwnerRazorpayKeys } from '@/app/actions/listing-payments'
import { CACHE_TAGS } from '@/lib/cache-tags'
import { sendNotification } from '@/lib/notifications'
import { recordPaymentIntent } from '@/lib/payment-intents'
import { SHOP_NOT_OPEN_MESSAGE, canBuyFromShop } from '@/lib/selling/shop-mode'
import { loadShopState } from '@/lib/selling/shop-state'
```

2. Replace

```ts
  if (!listing.payments_enabled) {
    return NextResponse.json({ error: 'This business is not accepting payments yet.' }, { status: 422 })
  }
```

with

```ts
  // Test-key shops sell only to their owner (and admins), for practice.
  const shop = await loadShopState(product.listing_id)
  const { role } = await getUserRole(supabase)
  if (!shop || !canBuyFromShop(shop.mode, { isOwner: shop.ownerId === user.id, isAdmin: role === 'admin' })) {
    return NextResponse.json({ error: SHOP_NOT_OPEN_MESSAGE }, { status: 422 })
  }
```

3. Replace

```ts
    if (response.status === 401) {
      await adminClient
        .from('listing_payment_configs')
        .update({ verified_at: null, updated_at: new Date().toISOString() })
        .eq('listing_id', product.listing_id)
      revalidateTag(CACHE_TAGS.listing(product.listing_id), 'max')
```

with

```ts
    if (response.status === 401) {
      // Only the request that actually clears verified_at tells the owner,
      // so a burst of buyers produces one "Selling paused" notice, not many.
      const { data: cleared } = await adminClient
        .from('listing_payment_configs')
        .update({ verified_at: null, updated_at: new Date().toISOString() })
        .eq('listing_id', product.listing_id)
        .not('verified_at', 'is', null)
        .select('listing_id')
      revalidateTag(CACHE_TAGS.listing(product.listing_id), 'max')

      const ownerId = shop.ownerId
      if (ownerId && Array.isArray(cleared) && cleared.length > 0) {
        after(async () => {
          try {
            await sendNotification(
              ownerId,
              'selling.paused',
              {
                listingId: product.listing_id,
                listingName: listing.name,
                reason: 'Razorpay stopped accepting your keys',
                byAdmin: false,
              },
              { awaitDelivery: true },
            )
          } catch (error) {
            console.error('[marketplace order] selling.paused notification failed', error)
          }
        })
      }
```

(The rest of the 401 branch — the 503 response — stays as it is.)

- [ ] **Step 8: Typecheck, lint, test and build**

Run: `npx tsc --noEmit && npm run lint && npm run test:existing && npm run build`
Expected: typecheck clean; lint 0 errors / 11 warnings; tests pass except the known clock-dependent appointment-slot failure(s); build succeeds. If `tsc` reports that `marketplaceReady` is still used somewhere, it is in `src/app/admin/products/*` — those files use their own local `marketplaceReady` variable, not `ListingDetailData`, and are handled in Task 8; do not change them here.

- [ ] **Step 9: Verify in the browser**

Start the dev server with the Browser pane (`preview_start`, `dev` config).

1. Find listings to check, with the Supabase MCP `execute_sql` tool:

```sql
select l.id, l.name,
  case when c.razorpay_key_id like 'rzp_live_%' then 'live' when c.razorpay_key_id like 'rzp_test_%' then 'test' else 'none' end as key_kind,
  c.verified_at is not null as verified,
  (select count(*) from listing_products p where p.listing_id = l.id and p.is_active) as active_items
from listings l
join listing_payment_configs c on c.listing_id = l.id
where l.approved and l.payments_enabled;
```

2. Logged out, open `http://localhost:3000/listings/<id>` for each row. Flush streamed content with `if (window.$RB?.length) window.$RV(window.$RB)` in `javascript_tool`, then check with `javascript_tool`: `document.body.innerText.includes('Shop')` and the count of `a[href^="/checkout/"], a[href*="/login?next=%2Fcheckout"]`. A verified live row with items shows the Shop; a test row shows no Shop section and no buy links. If there is no test row, say so.
3. Logged out, open `http://localhost:3000/checkout/<a product id>`: it redirects to `/login`.
4. No console errors.

Report exactly what you observed, and state that the owner-only test view and a practice purchase need a signed-in check by the site owner.

- [ ] **Step 10: Commit**

```bash
git add src/lib/selling/shop-state.ts src/lib/data/listing-detail.ts "src/app/listings/[id]/page.tsx" "src/app/listings/[id]/components/ListingContent.tsx" "src/app/checkout/[productId]/page.tsx" "src/app/checkout/[productId]/CheckoutForm.tsx" src/app/api/razorpay/create-marketplace-order/route.ts
git commit -m "feat(selling): test-mode shops visible and buyable only by their owner" -m "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 6: Never refuse a paid order, and record test orders

**Files:**
- Modify: `src/app/actions/marketplace-orders.ts`

**Interfaces:**
- Consumes: `classifyRazorpayKeyId` (Task 2); `loadOwnerRazorpayKeys(listingId, { allowUnverified: true })` (Task 4); `isTest` on the `order.placed` payload (Task 3); `orders.is_test` (Task 1).
- Produces (used by Task 10): `MarketplaceOrder.is_test: boolean`.

- [ ] **Step 1: Import the key classifier**

Replace

```ts
import { createAdminClient } from '@/lib/supabase/admin-client'
import { createClient } from '@/lib/supabase/server'

export interface MarketplaceOrder {
```

with

```ts
import { classifyRazorpayKeyId } from '@/lib/selling/keys'
import { createAdminClient } from '@/lib/supabase/admin-client'
import { createClient } from '@/lib/supabase/server'

export interface MarketplaceOrder {
```

- [ ] **Step 2: Add `is_test` to the order type**

Replace

```ts
  payment_status: string
  status: string
  created_at: string
  updated_at: string
  listing?: { name: string; subdomain: string | null } | null
}
```

with

```ts
  payment_status: string
  status: string
  /** Paid with Razorpay test keys: a practice purchase, no real money. */
  is_test: boolean
  created_at: string
  updated_at: string
  listing?: { name: string; subdomain: string | null } | null
}
```

- [ ] **Step 3: Stop refusing captured payments**

Replace

```ts
  const { data: listing } = await adminClient
    .from('listings')
    .select('id, name, approved, payments_enabled, owner_id')
    .eq('id', product.listing_id)
    .maybeSingle()

  if (!listing || !listing.approved || !listing.payments_enabled) {
    return { error: 'Listing is not accepting orders.' }
  }

  // 2. Load owner keys and verify HMAC with OWNER's secret
  const ownerKeys = await loadOwnerRazorpayKeys(product.listing_id)
```

with

```ts
  const { data: listing } = await adminClient
    .from('listings')
    .select('id, name, owner_id')
    .eq('id', product.listing_id)
    .maybeSingle()

  if (!listing) {
    return { error: 'Listing not found.' }
  }

  // Deliberately no approved / payments_enabled / suspension check here: this
  // runs after Razorpay captured the buyer's money. Those gates only stop new
  // payments from starting (create-marketplace-order). A payment proven
  // genuine below is always saved.

  // 2. Load owner keys and verify HMAC with OWNER's secret. Unverified keys
  // are accepted: Razorpay may have started rejecting them for *new* orders
  // after this payment was created, and the signature still needs the secret.
  const ownerKeys = await loadOwnerRazorpayKeys(product.listing_id, { allowUnverified: true })
```

- [ ] **Step 4: Label test orders and leave stock alone**

Replace

```ts
  // 4. Atomic stock decrement
  if (product.quantity_in_stock !== null) {
```

with

```ts
  // Test keys move no real money: label the order and leave real stock alone.
  const isTest = classifyRazorpayKeyId(ownerKeys.keyId) === 'test'

  // 4. Atomic stock decrement
  if (!isTest && product.quantity_in_stock !== null) {
```

Replace

```ts
      payout_status: 'not_applicable',
      status: 'confirmed',
```

with

```ts
      payout_status: 'not_applicable',
      status: 'confirmed',
      is_test: isTest,
```

- [ ] **Step 5: Mark test notifications and skip admins for them**

Replace

```ts
      amountTotal: totalRupees,
      buyerName,
    } as const
```

with

```ts
      amountTotal: totalRupees,
      buyerName,
      isTest,
    } as const
```

Replace

```ts
      sendNotificationToAdmins('order.placed', {
        ...basePayload,
        recipient: 'admin',
      }),
```

with

```ts
      isTest
        ? Promise.resolve()
        : sendNotificationToAdmins('order.placed', {
            ...basePayload,
            recipient: 'admin',
          }),
```

- [ ] **Step 6: Typecheck, lint, test and build**

Run: `npx tsc --noEmit && npm run lint && npm run test:existing && npm run build`
Expected: typecheck clean; lint 0 errors / 11 warnings; tests pass except the known clock-dependent failure(s); build succeeds.

A real payment cannot be made from this environment. State in your report that a practice purchase (test order, stock unchanged, owner notified with "Test order", no admin notice) needs a signed-in check by the site owner.

- [ ] **Step 7: Commit**

```bash
git add src/app/actions/marketplace-orders.ts
git commit -m "feat(selling): always save captured payments; record test orders" -m "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 7: Guided Razorpay connection for owners

**Files:**
- Modify (full replacement): `src/app/my-business/payments/page.tsx`
- Create: `src/app/my-business/payments/ConnectRazorpay.tsx`
- Delete: `src/app/my-business/payments/RazorpaySetupForm.tsx`
- Modify (full replacement): `src/app/my-business/products/page.tsx`
- Modify: `src/app/my-business/products/[listingId]/page.tsx`

**Interfaces:**
- Consumes: `saveRazorpayConfig`, `deleteRazorpayConfig` (Task 4); `classifyRazorpayKeyId` (Task 2); `LISTING_NOT_LIVE_MESSAGE`, `sellingPausedMessage` (Task 2).
- Produces (used by Task 9's links): `/my-business/payments?listing=<listingId>` opens that business's connection flow; `/my-business/payments` lists businesses when the owner has more than one.

- [ ] **Step 1: Write `src/app/my-business/payments/ConnectRazorpay.tsx`**

```tsx
'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { CheckCircle, ExternalLink, Eye, EyeOff, Loader2, PauseCircle } from 'lucide-react'

import { deleteRazorpayConfig, saveRazorpayConfig } from '@/app/actions/listing-payments'
import { classifyRazorpayKeyId } from '@/lib/selling/keys'
import { LISTING_NOT_LIVE_MESSAGE, sellingPausedMessage } from '@/lib/selling/shop-mode'

export type PaymentView =
  | { kind: 'not_approved' }
  | { kind: 'suspended'; reason: string | null }
  | { kind: 'not_connected' }
  | { kind: 'rejected' }
  | { kind: 'connected'; mode: 'test' | 'live'; keyLast4: string; connectedAt: string }

type AccountAnswer = 'unknown' | 'no' | 'yes'

const inputCls = 'od-input h-11 w-full px-3.5 text-[15px]'
const labelCls = 'mb-1 block text-[13px] font-bold text-[var(--od-ink-2)]'
const stepCls = 'text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--od-muted)]'
const headingCls = 'mt-1 text-lg font-bold text-[var(--od-ink)]'
const noteCls =
  'rounded-xl border border-[rgba(200,136,30,0.35)] bg-[rgba(200,136,30,0.07)] px-3.5 py-2.5 text-[13px] leading-relaxed text-[var(--od-ink-2)]'
const errorCls =
  'rounded-xl border border-[rgba(180,35,24,0.25)] bg-[rgba(180,35,24,0.05)] px-3.5 py-2.5 text-sm font-semibold text-[var(--od-danger)]'

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

/** A drawing, not a screenshot: where the keys live in the Razorpay dashboard. */
function KeysIllustration() {
  return (
    <svg
      viewBox="0 0 320 150"
      role="img"
      aria-label="Razorpay dashboard: Account and Settings, then API Keys, then Generate Key"
      className="w-full max-w-sm text-[var(--od-muted)]"
    >
      <rect x="1" y="1" width="318" height="148" rx="12" className="fill-white stroke-current" strokeOpacity="0.35" />
      <rect x="1" y="1" width="318" height="22" rx="12" className="fill-current" fillOpacity="0.08" />
      <circle cx="16" cy="12" r="3" className="fill-current" fillOpacity="0.4" />
      <circle cx="27" cy="12" r="3" className="fill-current" fillOpacity="0.4" />
      <circle cx="38" cy="12" r="3" className="fill-current" fillOpacity="0.4" />
      <rect x="12" y="34" width="88" height="104" rx="8" className="fill-current" fillOpacity="0.06" />
      <text x="20" y="54" fontSize="9" className="fill-current">Dashboard</text>
      <text x="20" y="72" fontSize="9" className="fill-current">Payments</text>
      <rect x="15" y="82" width="82" height="18" rx="5" className="fill-[var(--od-brand)]" fillOpacity="0.14" />
      <text x="19" y="94" fontSize="8.5" fontWeight="700" className="fill-[var(--od-brand-strong)]">Account &amp; Settings</text>
      <text x="112" y="54" fontSize="11" fontWeight="700" className="fill-current">API Keys</text>
      <rect x="112" y="66" width="192" height="16" rx="4" className="fill-current" fillOpacity="0.07" />
      <text x="118" y="77" fontSize="8" className="fill-current">Key ID · rzp_test_••••••••</text>
      <rect x="112" y="88" width="192" height="16" rx="4" className="fill-current" fillOpacity="0.07" />
      <text x="118" y="99" fontSize="8" className="fill-current">Key Secret · shown once</text>
      <rect x="112" y="114" width="92" height="22" rx="6" className="fill-[var(--od-brand)]" />
      <text x="126" y="129" fontSize="9" fontWeight="700" className="fill-white">Generate Key</text>
    </svg>
  )
}

function KeyIdHint({ keyId }: { keyId: string }) {
  const kind = classifyRazorpayKeyId(keyId)
  if (kind === 'empty') return null
  if (kind === 'invalid') {
    return (
      <p className="mt-1.5 text-xs font-semibold text-[var(--od-danger)]">
        This doesn&apos;t look like a Razorpay Key ID
      </p>
    )
  }
  return (
    <p className="mt-1.5 text-xs font-semibold text-[var(--color-success-strong)]">
      {kind === 'test' ? 'Test key · practice, no real money' : 'Live key · real payments'}
    </p>
  )
}

export default function ConnectRazorpay({
  listingId,
  view,
}: {
  listingId: string
  view: PaymentView
}) {
  const router = useRouter()
  const [editing, setEditing] = useState(view.kind === 'not_connected' || view.kind === 'rejected')
  const [account, setAccount] = useState<AccountAnswer>(view.kind === 'not_connected' ? 'unknown' : 'yes')
  const [keyId, setKeyId] = useState('')
  const [keySecret, setKeySecret] = useState('')
  const [showSecret, setShowSecret] = useState(false)
  const [confirmingDisconnect, setConfirmingDisconnect] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function connect(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    const formData = new FormData()
    formData.set('listing_id', listingId)
    formData.set('razorpay_key_id', keyId.trim())
    formData.set('razorpay_key_secret', keySecret.trim())
    startTransition(async () => {
      const result = await saveRazorpayConfig(formData)
      if (result.error) {
        setError(result.error)
        return
      }
      setKeyId('')
      setKeySecret('')
      setShowSecret(false)
      setEditing(false)
      router.refresh()
    })
  }

  function disconnect() {
    setError(null)
    startTransition(async () => {
      const result = await deleteRazorpayConfig(listingId)
      if (result.error) {
        setError(result.error)
        return
      }
      setConfirmingDisconnect(false)
      setAccount('yes')
      setEditing(true)
      router.refresh()
    })
  }

  if (view.kind === 'not_approved') {
    return (
      <section className="od-card p-5 text-center sm:p-6">
        <p className="text-base font-bold text-[var(--od-ink)]">{LISTING_NOT_LIVE_MESSAGE}</p>
        <Link href="/my-business" className="od-button-secondary mt-4 px-4 py-2.5 text-sm">
          Back to My Business
        </Link>
      </section>
    )
  }

  if (view.kind === 'suspended') {
    return (
      <section className="od-card flex items-start gap-3 p-5 sm:p-6">
        <PauseCircle size={22} className="mt-0.5 shrink-0 text-[var(--od-danger)]" aria-hidden />
        <p className="text-sm leading-relaxed text-[var(--od-ink-2)]">{sellingPausedMessage(view.reason)}</p>
      </section>
    )
  }

  if (view.kind === 'connected' && !editing) {
    return (
      <section className="od-card space-y-4 p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[rgba(19,138,75,0.12)]">
            <CheckCircle size={20} className="text-[var(--od-success)]" aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="text-base font-bold text-[var(--od-ink)]">
              {view.mode === 'live' ? 'Live · real payments on' : 'Test · only you can see your shop'}
            </p>
            <p className="mt-0.5 text-[13px] text-[var(--od-muted)]">
              Key ending …{view.keyLast4} · connected {formatDate(view.connectedAt)}
            </p>
          </div>
        </div>

        {view.mode === 'test' && (
          <div className={noteCls}>
            <p className="font-bold">Ready for real payments?</p>
            <p className="mt-1">
              Once Razorpay has activated your account, switch the Razorpay dashboard to Live Mode,
              generate Live keys, and paste them here with Replace keys.
            </p>
          </div>
        )}

        {error && (
          <p role="alert" className={errorCls}>
            {error}
          </p>
        )}

        {confirmingDisconnect ? (
          <div className="rounded-xl border border-[var(--od-border)] p-4">
            <p className="text-sm font-bold text-[var(--od-ink)]">Disconnect Razorpay?</p>
            <p className="mt-1 text-sm text-[var(--od-muted)]">
              Customers won&apos;t be able to pay until you reconnect.
            </p>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                onClick={disconnect}
                disabled={pending}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--od-danger)] px-4 py-2.5 text-sm font-bold text-white transition-opacity disabled:opacity-60"
              >
                {pending && <Loader2 size={15} className="animate-spin" aria-hidden />}
                Disconnect
              </button>
              <button
                type="button"
                onClick={() => setConfirmingDisconnect(false)}
                disabled={pending}
                className="od-button-secondary px-4 py-2.5 text-sm"
              >
                Keep connected
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={() => {
                setError(null)
                setEditing(true)
              }}
              className="od-button-secondary px-4 py-2.5 text-sm"
            >
              Replace keys
            </button>
            <button
              type="button"
              onClick={() => setConfirmingDisconnect(true)}
              className="inline-flex items-center justify-center rounded-xl px-4 py-2.5 text-sm font-semibold text-[var(--od-muted)] transition-colors hover:text-[var(--od-danger)]"
            >
              Disconnect
            </button>
          </div>
        )}
      </section>
    )
  }

  return (
    <div className="space-y-4">
      {view.kind === 'rejected' && (
        <p role="alert" className={errorCls}>
          Razorpay stopped accepting your keys. Reconnect to keep selling.
        </p>
      )}

      {account !== 'yes' && (
        <section className="od-card p-5 sm:p-6">
          <p className={stepCls}>Step 1 of 3</p>
          <h2 className={headingCls}>Have a Razorpay account?</h2>
          {account === 'unknown' ? (
            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <button type="button" onClick={() => setAccount('yes')} className="od-button-primary px-4 py-2.5 text-sm">
                Yes, I have one
              </button>
              <button type="button" onClick={() => setAccount('no')} className="od-button-secondary px-4 py-2.5 text-sm">
                Not yet
              </button>
            </div>
          ) : (
            <div className="mt-3 space-y-3">
              <p className="text-sm leading-relaxed text-[var(--od-ink-2)]">
                Free to open. You can connect and test right away. Razorpay checks your business
                documents before you can take real money, usually within a few days.
              </p>
              <div className="flex flex-col gap-2 sm:flex-row">
                <a
                  href="https://dashboard.razorpay.com/signup"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="od-button-primary px-4 py-2.5 text-sm"
                >
                  Open a Razorpay account
                  <ExternalLink size={14} aria-hidden />
                </a>
                <button type="button" onClick={() => setAccount('yes')} className="od-button-secondary px-4 py-2.5 text-sm">
                  I&apos;ve opened my account
                </button>
              </div>
            </div>
          )}
        </section>
      )}

      {account === 'yes' && (
        <>
          <section className="od-card p-5 sm:p-6">
            <p className={stepCls}>Step 2 of 3</p>
            <h2 className={headingCls}>Copy your keys</h2>
            <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-sm leading-relaxed text-[var(--od-ink-2)]">
              <li>
                Sign in at{' '}
                <a
                  href="https://dashboard.razorpay.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold text-[var(--od-brand-strong)] underline underline-offset-2"
                >
                  dashboard.razorpay.com
                </a>
                .
              </li>
              <li>
                Open <strong>Account &amp; Settings</strong> → <strong>API Keys</strong>.
              </li>
              <li>
                Tap <strong>Generate Key</strong>. Start in <strong>Test Mode</strong> to practise.
              </li>
            </ol>
            <p className={`${noteCls} mt-3`}>Razorpay shows the Key Secret only once. Copy it straight away.</p>
            <div className="mt-4">
              <KeysIllustration />
            </div>
          </section>

          <form onSubmit={connect} className="od-card space-y-4 p-5 sm:p-6">
            <div>
              <p className={stepCls}>Step 3 of 3</p>
              <h2 className={headingCls}>Paste them here</h2>
            </div>

            <label className="block">
              <span className={labelCls}>Key ID</span>
              <input
                value={keyId}
                onChange={(event) => setKeyId(event.target.value)}
                placeholder="rzp_test_…"
                autoComplete="off"
                autoCapitalize="none"
                spellCheck={false}
                disabled={pending}
                className={inputCls}
              />
              <KeyIdHint keyId={keyId} />
            </label>

            <div>
              <label htmlFor={`razorpay-secret-${listingId}`} className={labelCls}>
                Key Secret
              </label>
              <div className="relative">
                <input
                  id={`razorpay-secret-${listingId}`}
                  type={showSecret ? 'text' : 'password'}
                  value={keySecret}
                  onChange={(event) => setKeySecret(event.target.value)}
                  placeholder="Paste the Key Secret"
                  autoComplete="off"
                  autoCapitalize="none"
                  spellCheck={false}
                  disabled={pending}
                  className={`${inputCls} pr-12`}
                />
                <button
                  type="button"
                  onClick={() => setShowSecret((value) => !value)}
                  aria-label={showSecret ? 'Hide secret' : 'Show secret'}
                  aria-pressed={showSecret}
                  className="absolute right-1.5 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-[var(--od-muted)] transition-colors hover:text-[var(--od-brand)]"
                >
                  {showSecret ? <EyeOff size={16} aria-hidden /> : <Eye size={16} aria-hidden />}
                </button>
              </div>
              <p className="mt-1.5 text-xs text-[var(--od-muted)]">Stored encrypted. It is never shown again.</p>
            </div>

            {error && (
              <p role="alert" className={errorCls}>
                {error}
              </p>
            )}

            <div className="flex flex-col gap-2 sm:flex-row">
              <button type="submit" disabled={pending} className="od-button-primary px-5 py-2.5 text-sm disabled:opacity-60">
                {pending ? (
                  <>
                    <Loader2 size={15} className="animate-spin" aria-hidden />
                    Checking with Razorpay…
                  </>
                ) : (
                  'Connect'
                )}
              </button>
              {view.kind === 'connected' && (
                <button
                  type="button"
                  onClick={() => {
                    setEditing(false)
                    setError(null)
                  }}
                  disabled={pending}
                  className="od-button-secondary px-5 py-2.5 text-sm"
                >
                  Cancel
                </button>
              )}
            </div>
          </form>
        </>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Replace `src/app/my-business/payments/page.tsx`**

```tsx
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { ArrowLeft, ArrowRight } from 'lucide-react'

import { classifyRazorpayKeyId } from '@/lib/selling/keys'
import { createClient } from '@/lib/supabase/server'

import ConnectRazorpay, { type PaymentView } from './ConnectRazorpay'

type OwnerListing = {
  id: string
  name: string
  category: string | null
  approved: boolean | null
  payments_suspended_at: string | null
  payments_suspended_reason: string | null
}

type OwnerConfig = {
  listing_id: string
  razorpay_key_id: string
  razorpay_key_last4: string
  verified_at: string | null
  updated_at: string
}

function paymentViewFor(listing: OwnerListing, config: OwnerConfig | null): PaymentView {
  if (listing.payments_suspended_at) return { kind: 'suspended', reason: listing.payments_suspended_reason }
  if (!listing.approved) return { kind: 'not_approved' }
  if (!config) return { kind: 'not_connected' }
  if (!config.verified_at) return { kind: 'rejected' }
  return {
    kind: 'connected',
    mode: classifyRazorpayKeyId(config.razorpay_key_id) === 'live' ? 'live' : 'test',
    keyLast4: config.razorpay_key_last4,
    connectedAt: config.updated_at,
  }
}

function statusText(view: PaymentView): string {
  switch (view.kind) {
    case 'connected':
      return view.mode === 'live' ? 'Live' : 'Test'
    case 'rejected':
      return 'Reconnect needed'
    case 'suspended':
      return 'Paused'
    case 'not_approved':
      return 'Listing not live yet'
    case 'not_connected':
      return 'Not connected'
  }
}

export default async function MyBusinessPaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{ listing?: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(`/login?next=${encodeURIComponent('/my-business/payments')}`)

  const { listing: requestedId } = await searchParams

  const { data: listingsData } = await supabase
    .from('listings')
    .select('id, name, category, approved, payments_suspended_at, payments_suspended_reason')
    .eq('owner_id', user.id)
    .order('name', { ascending: true })
  const listings = (listingsData ?? []) as OwnerListing[]

  if (requestedId && !listings.some((listing) => listing.id === requestedId)) notFound()

  let configs: OwnerConfig[] = []
  if (listings.length > 0) {
    const { data } = await supabase
      .from('listing_payment_configs')
      .select('listing_id, razorpay_key_id, razorpay_key_last4, verified_at, updated_at')
      .in('listing_id', listings.map((listing) => listing.id))
    configs = (data ?? []) as OwnerConfig[]
  }
  const configByListing = new Map(configs.map((config) => [config.listing_id, config]))

  const selected = requestedId
    ? listings.find((listing) => listing.id === requestedId) ?? null
    : listings.length === 1
      ? listings[0]
      : null
  const backToList = selected !== null && listings.length > 1

  return (
    <div className="od-page min-h-screen py-8 md:py-10">
      <div className="od-shell max-w-2xl space-y-5">
        <Link
          href={backToList ? '/my-business/payments' : '/my-business'}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--od-muted)] transition-colors hover:text-[var(--od-brand)]"
        >
          <ArrowLeft size={14} aria-hidden />
          {backToList ? 'All businesses' : 'My Business'}
        </Link>

        <header>
          <p className="od-eyebrow">Sell online</p>
          <h1 className="od-section-title mt-1 text-3xl md:text-4xl">
            {selected ? selected.name : 'Online payments'}
          </h1>
          <p className="od-muted mt-2 text-sm leading-relaxed">
            Connect your own Razorpay account. Customers pay you directly — OurDahanu never holds your money.
          </p>
        </header>

        {listings.length === 0 ? (
          <section className="od-card p-6 text-center">
            <p className="text-base font-bold text-[var(--od-ink)]">Add your business first</p>
            <p className="od-muted mt-1 text-sm">Once your listing is live, you can start selling online.</p>
            <Link href="/listings/submit" className="od-button-primary mt-4 px-4 py-2.5 text-sm">
              Add your business
            </Link>
          </section>
        ) : selected ? (
          <ConnectRazorpay
            key={selected.id}
            listingId={selected.id}
            view={paymentViewFor(selected, configByListing.get(selected.id) ?? null)}
          />
        ) : (
          <ul className="space-y-3">
            {listings.map((listing) => {
              const view = paymentViewFor(listing, configByListing.get(listing.id) ?? null)
              return (
                <li key={listing.id}>
                  <Link
                    href={`/my-business/payments?listing=${listing.id}`}
                    className="od-card od-card-hover flex items-center justify-between gap-3 p-4"
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-bold text-[var(--od-ink)]">{listing.name}</span>
                      <span className="od-muted block text-xs">{listing.category ?? 'Business'}</span>
                    </span>
                    <span className="flex shrink-0 items-center gap-1.5 text-xs font-bold text-[var(--od-brand-strong)]">
                      {statusText(view)}
                      <ArrowRight size={14} aria-hidden />
                    </span>
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Delete the old form**

Run: `git rm src/app/my-business/payments/RazorpaySetupForm.tsx`

- [ ] **Step 4: Replace `src/app/my-business/products/page.tsx`**

```tsx
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowLeft, ArrowRight, Package } from 'lucide-react'

import { LISTING_NOT_LIVE_MESSAGE } from '@/lib/selling/shop-mode'
import { createClient } from '@/lib/supabase/server'

type Listing = {
  id: string
  name: string
  category: string | null
  approved: boolean | null
}

export default async function MyBusinessProductsIndex() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: listingsData } = await supabase
    .from('listings')
    .select('id, name, category, approved')
    .eq('owner_id', user.id)
    .order('name', { ascending: true })
  const listings = (listingsData ?? []) as Listing[]

  const productCounts = new Map<string, number>()
  if (listings.length > 0) {
    const { data: countsData } = await supabase
      .from('listing_products')
      .select('listing_id')
      .in('listing_id', listings.map((listing) => listing.id))
    for (const row of (countsData ?? []) as { listing_id: string }[]) {
      productCounts.set(row.listing_id, (productCounts.get(row.listing_id) ?? 0) + 1)
    }
  }

  return (
    <div className="od-page min-h-screen py-8 md:py-10">
      <div className="od-shell max-w-2xl space-y-5">
        <Link
          href="/my-business"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--od-muted)] transition-colors hover:text-[var(--od-brand)]"
        >
          <ArrowLeft size={14} aria-hidden />
          My Business
        </Link>

        <header>
          <p className="od-eyebrow">Sell online</p>
          <h1 className="od-section-title mt-1 flex items-center gap-2 text-3xl md:text-4xl">
            <Package size={28} className="text-[var(--od-brand)]" aria-hidden />
            Products &amp; Services
          </h1>
          <p className="od-muted mt-2 text-sm leading-relaxed">
            Add items customers can buy from your business page. You can add them before you connect Razorpay.
          </p>
        </header>

        {listings.length === 0 ? (
          <section className="od-card p-6 text-center">
            <p className="text-base font-bold text-[var(--od-ink)]">Add your business first</p>
            <Link href="/listings/submit" className="od-button-primary mt-4 px-4 py-2.5 text-sm">
              Add your business
            </Link>
          </section>
        ) : (
          <ul className="space-y-3">
            {listings.map((listing) => {
              const count = productCounts.get(listing.id) ?? 0
              if (!listing.approved) {
                return (
                  <li key={listing.id} className="od-card p-4">
                    <p className="truncate font-bold text-[var(--od-ink)]">{listing.name}</p>
                    <p className="od-muted mt-0.5 text-xs">{LISTING_NOT_LIVE_MESSAGE}</p>
                  </li>
                )
              }
              return (
                <li key={listing.id}>
                  <Link
                    href={`/my-business/products/${listing.id}`}
                    className="od-card od-card-hover flex items-center justify-between gap-3 p-4"
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-bold text-[var(--od-ink)]">{listing.name}</span>
                      <span className="od-muted block text-xs">
                        {listing.category ?? 'Business'} · {count} {count === 1 ? 'item' : 'items'}
                      </span>
                    </span>
                    <ArrowRight size={16} className="shrink-0 text-[var(--od-muted)]" aria-hidden />
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Remove the payments gate from the item manager page**

In `src/app/my-business/products/[listingId]/page.tsx`:

1. Replace

```ts
import { listOwnerProducts } from '@/app/actions/products'
import { createClient } from '@/lib/supabase/server'
```

with

```ts
import { listOwnerProducts } from '@/app/actions/products'
import { LISTING_NOT_LIVE_MESSAGE } from '@/lib/selling/shop-mode'
import { createClient } from '@/lib/supabase/server'
```

2. Replace `    .select('id, name, category, payments_enabled, owner_id')` with `    .select('id, name, category, approved, owner_id')`.

3. Replace

```ts
  if (!listing.payments_enabled) {
    redirect('/my-business/payments')
  }
```

with

```tsx
  if (!listing.approved) {
    return (
      <div className="od-page min-h-screen py-8 md:py-10">
        <div className="od-shell max-w-2xl">
          <section className="od-card p-6 text-center">
            <p className="text-base font-bold text-[var(--od-ink)]">{LISTING_NOT_LIVE_MESSAGE}</p>
            <Link href="/my-business" className="od-button-secondary mt-4 px-4 py-2.5 text-sm">
              Back to My Business
            </Link>
          </section>
        </div>
      </div>
    )
  }
```

- [ ] **Step 6: Typecheck, lint, test and build**

Run: `npx tsc --noEmit && npm run lint && npm run test:existing && npm run build`
Expected: typecheck clean; lint 0 errors / 11 warnings; tests pass except the known clock-dependent failure(s); build succeeds. `grep -r "RazorpaySetupForm" src` finds nothing.

- [ ] **Step 7: Verify in the browser**

1. Logged out, `http://localhost:3000/my-business/payments` redirects to `/login` with `next=%2Fmy-business%2Fpayments`.
2. Logged out, `http://localhost:3000/my-business/products` redirects to `/login`.
3. No console errors.

State in your report that the signed-in flow — the three steps, the Test/Live label while typing, a rejected key, Connect, Replace keys and Disconnect — needs a check by the site owner with real Razorpay test keys.

- [ ] **Step 8: Commit**

```bash
git add src/app/my-business/payments/page.tsx src/app/my-business/payments/ConnectRazorpay.tsx src/app/my-business/products/page.tsx "src/app/my-business/products/[listingId]/page.tsx"
git commit -m "feat(selling): guided Razorpay connection and ungated item manager" -m "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

(`git rm` in Step 3 already staged the deletion.)

---

### Task 8: Admin statuses, suspend and lift

**Files:**
- Create: `src/app/admin/payments/SellingStatusBadge.tsx`
- Create: `src/app/admin/payments/SellingControls.tsx`
- Modify (full replacement): `src/app/admin/payments/page.tsx`
- Modify: `src/app/actions/listing-payments.ts` (remove the admin toggle)
- Modify: `src/app/admin/products/page.tsx`
- Modify: `src/app/admin/products/[listingId]/page.tsx`

**Interfaces:**
- Consumes: `deriveSellingStatus`, `type SellingStatus` (Task 2); `suspendListingSelling`, `resumeListingSelling` (Task 4).
- Produces: default export `SellingStatusBadge({ status }: { status: SellingStatus })`; `toggleListingPaymentsEnabled` and `updateListingPaymentsFromForm` no longer exist.

- [ ] **Step 1: Write `src/app/admin/payments/SellingStatusBadge.tsx`**

```tsx
import type { SellingStatus } from '@/lib/selling/shop-mode'

const STYLES: Record<SellingStatus, { label: string; className: string }> = {
  live: {
    label: 'Live',
    className: 'bg-[rgba(19,138,75,0.12)] text-[var(--color-success-strong)]',
  },
  test: {
    label: 'Test',
    className: 'bg-[rgba(200,136,30,0.14)] text-[var(--od-brand-strong)]',
  },
  suspended: {
    label: 'Suspended',
    className: 'bg-[rgba(180,35,24,0.1)] text-[var(--od-danger)]',
  },
  not_connected: {
    label: 'Not connected',
    className: 'bg-[var(--color-surface-soft)] text-[var(--od-muted)]',
  },
}

export default function SellingStatusBadge({ status }: { status: SellingStatus }) {
  const style = STYLES[status]
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-bold ${style.className}`}>
      {style.label}
    </span>
  )
}
```

- [ ] **Step 2: Write `src/app/admin/payments/SellingControls.tsx`**

```tsx
'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'

import { resumeListingSelling, suspendListingSelling } from '@/app/actions/listing-payments'

export default function SellingControls({
  listingId,
  suspended,
}: {
  listingId: string
  suspended: boolean
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function run(action: () => Promise<{ error?: string }>) {
    setError(null)
    startTransition(async () => {
      const result = await action()
      if (result.error) {
        setError(result.error)
        return
      }
      setOpen(false)
      setReason('')
      router.refresh()
    })
  }

  const errorLine = error && (
    <p role="alert" className="mt-2 text-xs font-semibold text-[var(--od-danger)]">
      {error}
    </p>
  )

  if (suspended) {
    return (
      <div>
        <button
          type="button"
          onClick={() => run(() => resumeListingSelling(listingId))}
          disabled={pending}
          className="od-button-secondary px-3 py-2 text-sm disabled:opacity-60"
        >
          {pending && <Loader2 size={14} className="animate-spin" aria-hidden />}
          Lift suspension
        </button>
        {errorLine}
      </div>
    )
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center justify-center rounded-xl px-3 py-2 text-sm font-semibold text-[var(--od-muted)] transition-colors hover:text-[var(--od-danger)]"
      >
        Suspend selling
      </button>
    )
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        run(() => suspendListingSelling(listingId, reason))
      }}
      className="w-full space-y-2 sm:w-80"
    >
      <label className="block">
        <span className="mb-1 block text-[12px] font-bold text-[var(--od-ink-2)]">Reason the owner will see</span>
        <input
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          maxLength={300}
          required
          disabled={pending}
          className="od-input h-10 w-full px-3 text-sm"
        />
      </label>
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pending || !reason.trim()}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--od-danger)] px-3 py-2 text-sm font-bold text-white transition-opacity disabled:opacity-60"
        >
          {pending && <Loader2 size={14} className="animate-spin" aria-hidden />}
          Suspend
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          disabled={pending}
          className="od-button-secondary px-3 py-2 text-sm"
        >
          Cancel
        </button>
      </div>
      {errorLine}
    </form>
  )
}
```

- [ ] **Step 3: Replace `src/app/admin/payments/page.tsx`**

```tsx
import Link from 'next/link'
import { Package } from 'lucide-react'

import { requireAdmin } from '@/app/actions/admin'
import { deriveSellingStatus, type SellingStatus } from '@/lib/selling/shop-mode'
import { createAdminClient } from '@/lib/supabase/admin-client'
import { createClient } from '@/lib/supabase/server'

import SellingControls from './SellingControls'
import SellingStatusBadge from './SellingStatusBadge'

type AdminListingRow = {
  id: string
  name: string
  category: string | null
  subdomain: string | null
  approved: boolean | null
  payments_enabled: boolean | null
  payments_suspended_at: string | null
  payments_suspended_reason: string | null
}

type PaymentConfigRow = {
  listing_id: string
  razorpay_key_id: string
  razorpay_key_last4: string
  verified_at: string | null
  updated_at: string
}

type Filter = 'all' | SellingStatus

const FILTERS: Array<{ value: Filter; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'live', label: 'Live' },
  { value: 'test', label: 'Test' },
  { value: 'suspended', label: 'Suspended' },
  { value: 'not_connected', label: 'Not connected' },
]

const STATUS_ORDER: Record<SellingStatus, number> = { live: 0, test: 1, suspended: 2, not_connected: 3 }

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

function detailFor(listing: AdminListingRow, config: PaymentConfigRow | null, status: SellingStatus): string {
  if (status === 'suspended') return `Paused: ${listing.payments_suspended_reason ?? 'no reason given'}`
  if (!listing.approved) return 'Listing not approved'
  if (config && !config.verified_at) return 'Razorpay rejected the saved keys'
  if (config) return `Key …${config.razorpay_key_last4} · connected ${formatDate(config.updated_at)}`
  return 'Owner has not connected Razorpay'
}

export default async function AdminPaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>
}) {
  const supabase = await createClient()
  await requireAdmin(supabase)

  const { status: requested } = await searchParams
  const filter: Filter = FILTERS.find((option) => option.value === requested)?.value ?? 'all'

  const adminClient = createAdminClient()
  if (!adminClient) {
    throw new Error('Admin client not configured.')
  }

  const [{ data: listingsData }, { data: configsData }] = await Promise.all([
    adminClient
      .from('listings')
      .select('id, name, category, subdomain, approved, payments_enabled, payments_suspended_at, payments_suspended_reason')
      .order('name', { ascending: true }),
    adminClient
      .from('listing_payment_configs')
      .select('listing_id, razorpay_key_id, razorpay_key_last4, verified_at, updated_at'),
  ])

  const listings = (listingsData ?? []) as AdminListingRow[]
  const configs = (configsData ?? []) as PaymentConfigRow[]
  const configByListing = new Map(configs.map((config) => [config.listing_id, config]))

  const rows = listings
    .map((listing) => {
      const config = configByListing.get(listing.id) ?? null
      const status = deriveSellingStatus({
        approved: listing.approved === true,
        paymentsEnabled: listing.payments_enabled === true,
        suspendedAt: listing.payments_suspended_at,
        verifiedAt: config?.verified_at ?? null,
        keyId: config?.razorpay_key_id ?? null,
      })
      return { listing, config, status }
    })
    .sort(
      (a, b) =>
        STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || a.listing.name.localeCompare(b.listing.name),
    )

  const counts: Record<SellingStatus, number> = { live: 0, test: 0, suspended: 0, not_connected: 0 }
  for (const row of rows) counts[row.status] += 1
  const visible = filter === 'all' ? rows : rows.filter((row) => row.status === filter)

  const stats: Array<{ status: SellingStatus; hint: string }> = [
    { status: 'live', hint: 'Customers can pay' },
    { status: 'test', hint: 'Only the owner sees the shop' },
    { status: 'suspended', hint: 'Paused by an admin' },
    { status: 'not_connected', hint: 'No working Razorpay keys' },
  ]

  return (
    <div className="space-y-6">
      <header>
        <p className="od-eyebrow">Sell online</p>
        <h1 className="od-section-title mt-1 text-3xl">Payments</h1>
        <p className="od-muted mt-2 max-w-2xl text-sm leading-relaxed">
          Businesses connect their own Razorpay account. Suspend one to stop new payments; paid orders
          in progress are still saved.
        </p>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <div key={stat.status} className="od-card p-4">
            <SellingStatusBadge status={stat.status} />
            <p className="mt-2 text-3xl font-bold tabular-nums text-[var(--od-ink)]">{counts[stat.status]}</p>
            <p className="od-muted text-xs">{stat.hint}</p>
          </div>
        ))}
      </section>

      <nav aria-label="Filter by status" className="flex flex-wrap gap-2">
        {FILTERS.map((option) => (
          <Link
            key={option.value}
            href={option.value === 'all' ? '/admin/payments' : `/admin/payments?status=${option.value}`}
            aria-current={filter === option.value ? 'page' : undefined}
            className={`rounded-full border px-3.5 py-1.5 text-sm font-semibold transition-colors ${
              filter === option.value
                ? 'border-[var(--od-brand-strong)] bg-[var(--od-brand-strong)] text-white'
                : 'border-[var(--od-border)] bg-white text-[var(--od-ink-2)] hover:text-[var(--od-brand-strong)]'
            }`}
          >
            {option.label}
            {option.value !== 'all' && <span className="ml-1 tabular-nums">({counts[option.value]})</span>}
          </Link>
        ))}
      </nav>

      <section className="space-y-3">
        {visible.length === 0 ? (
          <p className="od-card p-6 text-center text-sm text-[var(--od-muted)]">No businesses in this view.</p>
        ) : (
          visible.map(({ listing, config, status }) => (
            <div
              key={listing.id}
              className="od-card flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate font-bold text-[var(--od-ink)]">{listing.name}</p>
                  <SellingStatusBadge status={status} />
                </div>
                <p className="od-muted mt-0.5 text-xs">
                  {listing.category ?? 'Uncategorized'}
                  {listing.subdomain ? ` · ${listing.subdomain}.ourdahanu.in` : ''}
                </p>
                <p className="mt-1.5 text-sm text-[var(--od-ink-2)]">{detailFor(listing, config, status)}</p>
              </div>
              <div className="flex flex-shrink-0 flex-wrap items-start gap-2">
                <SellingControls listingId={listing.id} suspended={status === 'suspended'} />
                <Link href={`/admin/products/${listing.id}`} className="od-button-secondary px-3 py-2 text-sm">
                  <Package size={14} aria-hidden />
                  Products
                </Link>
              </div>
            </div>
          ))
        )}
      </section>
    </div>
  )
}
```

- [ ] **Step 4: Remove the admin toggle actions**

In `src/app/actions/listing-payments.ts`, delete this block (it sits between the imports and the "Owner: connect and disconnect Razorpay" banner):

```ts
/* ------------------------------------------------------------------ */
/*  Admin: toggle payments_enabled per listing                         */
/* ------------------------------------------------------------------ */

export async function toggleListingPaymentsEnabled(
  listingId: string,
  enabled: boolean,
): Promise<{ error?: string }> {
  const supabase = await createClient()
  await requireAdmin(supabase)

  const adminClient = createAdminClient()
  if (!adminClient) return { error: 'Server configuration error.' }

  const { error } = await adminClient
    .from('listings')
    .update({ payments_enabled: enabled })
    .eq('id', listingId)

  if (error) return { error: error.message }

  revalidatePublicListingDetail(listingId)
  return {}
}

export async function updateListingPaymentsFromForm(
  listingId: string,
  formData: FormData,
): Promise<{ error?: string }> {
  const enabled = formData.get('payments_enabled') === 'on'
  return toggleListingPaymentsEnabled(listingId, enabled)
}

```

Then run `grep -rn "toggleListingPaymentsEnabled\|updateListingPaymentsFromForm" src` — expected: no matches.

- [ ] **Step 5: Use the same statuses on Admin → Products**

In `src/app/admin/products/page.tsx`:

1. Replace

```ts
import {
  ArrowRight,
  CheckCircle,
  CreditCard,
  Eye,
  EyeOff,
  Package,
  Sparkles,
  Store,
} from 'lucide-react'

import { requireAdmin } from '@/app/actions/admin'
```

with

```ts
import {
  ArrowRight,
  CreditCard,
  Package,
  Sparkles,
  Store,
} from 'lucide-react'

import { requireAdmin } from '@/app/actions/admin'
import SellingStatusBadge from '@/app/admin/payments/SellingStatusBadge'
import { deriveSellingStatus } from '@/lib/selling/shop-mode'
```

2. Replace

```ts
  payments_enabled: boolean | null
  approved: boolean | null
}

type ProductRow = {
```

with

```ts
  payments_enabled: boolean | null
  payments_suspended_at: string | null
  approved: boolean | null
}

type ProductRow = {
```

3. Replace

```ts
type PaymentConfigRow = {
  listing_id: string
  verified_at: string | null
}
```

with

```ts
type PaymentConfigRow = {
  listing_id: string
  verified_at: string | null
  razorpay_key_id: string
}
```

4. Replace `        .select('id, name, category, subdomain, payments_enabled, approved')` with `        .select('id, name, category, subdomain, payments_enabled, payments_suspended_at, approved')`.

5. Replace `      adminClient.from('listing_payment_configs').select('listing_id, verified_at'),` with `      adminClient.from('listing_payment_configs').select('listing_id, verified_at, razorpay_key_id'),`.

6. Replace

```ts
  const verifiedByListing = new Map(
    configs
      .filter((c) => c.verified_at)
      .map((c) => [c.listing_id, c.verified_at!]),
  )
```

with

```ts
  const configByListing = new Map(configs.map((c) => [c.listing_id, c]))
```

7. Replace

```ts
        paymentsEnabled: listing.payments_enabled === true,
        approved: listing.approved === true,
        keysVerified: verifiedByListing.has(listing.id),
        totalProducts,
        activeProducts,
        marketplaceReady:
          listing.payments_enabled === true &&
          verifiedByListing.has(listing.id) &&
          activeProducts > 0,
      }
```

with

```ts
        approved: listing.approved === true,
        sellingStatus: deriveSellingStatus({
          approved: listing.approved === true,
          paymentsEnabled: listing.payments_enabled === true,
          suspendedAt: listing.payments_suspended_at,
          verifiedAt: configByListing.get(listing.id)?.verified_at ?? null,
          keyId: configByListing.get(listing.id)?.razorpay_key_id ?? null,
        }),
        totalProducts,
        activeProducts,
      }
```

8. Replace `        Number(b.paymentsEnabled) - Number(a.paymentsEnabled) ||` with `        Number(b.sellingStatus !== 'not_connected') - Number(a.sellingStatus !== 'not_connected') ||`.

9. Replace

```ts
  const enabledCount = rows.filter((r) => r.paymentsEnabled).length
  const listingsWithProducts = rows.filter((r) => r.totalProducts > 0).length
  const liveCount = rows.filter((r) => r.marketplaceReady).length
```

with

```ts
  const testCount = rows.filter((r) => r.sellingStatus === 'test').length
  const listingsWithProducts = rows.filter((r) => r.totalProducts > 0).length
  const liveCount = rows.filter((r) => r.sellingStatus === 'live').length
```

10. Replace

```tsx
            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-[#9b7c69]">Payments On</span>
          </div>
          <p className="mt-4 text-3xl font-bold text-[#2d160b]">{enabledCount}</p>
          <p className="mt-2 text-sm text-[#7c6253]">Listings that can accept direct payments.</p>
```

with

```tsx
            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-[#9b7c69]">Test Mode</span>
          </div>
          <p className="mt-4 text-3xl font-bold text-[#2d160b]">{testCount}</p>
          <p className="mt-2 text-sm text-[#7c6253]">Shops only their owner can see so far.</p>
```

(These hex colours already exist in this file; this task does not redesign Admin → Products.)

11. Replace `          Sorted by payments-enabled first, then by item count. Click Manage to add, edit,` with `          Sorted by selling status first, then by item count. Click Manage to add, edit,`.

12. Replace

```tsx
                      {row.paymentsEnabled ? (
                        <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-[11px] font-semibold text-green-700">
                          Payments On
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-[11px] font-semibold text-gray-600">
                          Payments Off
                        </span>
                      )}

                      {row.keysVerified && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2.5 py-0.5 text-[11px] font-semibold text-blue-700">
                          <CheckCircle size={10} />
                          Keys Verified
                        </span>
                      )}

                      {row.marketplaceReady ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700">
                          <Eye size={10} />
                          Shop Live
                        </span>
                      ) : row.totalProducts > 0 ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-semibold text-amber-700">
                          <EyeOff size={10} />
                          Not Live
                        </span>
                      ) : null}
```

with

```tsx
                      <SellingStatusBadge status={row.sellingStatus} />
```

In `src/app/admin/products/[listingId]/page.tsx`:

1. Replace

```ts
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle,
  CreditCard,
  ExternalLink,
  Package,
  ShieldAlert,
} from 'lucide-react'

import { requireAdmin } from '@/app/actions/admin'
```

with

```ts
import {
  AlertTriangle,
  ArrowLeft,
  ExternalLink,
  Package,
} from 'lucide-react'

import { requireAdmin } from '@/app/actions/admin'
import SellingStatusBadge from '@/app/admin/payments/SellingStatusBadge'
import { deriveSellingStatus } from '@/lib/selling/shop-mode'
```

2. Replace

```ts
  payments_enabled: boolean | null
  approved: boolean | null
  owner_id: string | null
}
```

with

```ts
  payments_enabled: boolean | null
  payments_suspended_at: string | null
  approved: boolean | null
  owner_id: string | null
}
```

3. Replace

```ts
type PaymentConfigRow = {
  verified_at: string | null
  test_mode: boolean
  razorpay_key_last4: string | null
}
```

with

```ts
type PaymentConfigRow = {
  verified_at: string | null
  razorpay_key_id: string
  razorpay_key_last4: string | null
}
```

4. Replace `        .select('id, name, category, subdomain, payments_enabled, approved, owner_id')` with `        .select('id, name, category, subdomain, payments_enabled, payments_suspended_at, approved, owner_id')`.

5. Replace `        .select('verified_at, test_mode, razorpay_key_last4')` with `        .select('verified_at, razorpay_key_id, razorpay_key_last4')`.

6. Replace

```ts
  const paymentsEnabled = listing.payments_enabled === true
  const keysVerified = !!config?.verified_at
  const marketplaceReady = paymentsEnabled && keysVerified
```

with

```ts
  const sellingStatus = deriveSellingStatus({
    approved: listing.approved === true,
    paymentsEnabled: listing.payments_enabled === true,
    suspendedAt: listing.payments_suspended_at,
    verifiedAt: config?.verified_at ?? null,
    keyId: config?.razorpay_key_id ?? null,
  })
```

7. Replace

```tsx
          {paymentsEnabled ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-1 font-semibold text-green-700">
              <CreditCard size={11} />
              Payments enabled
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-1 font-semibold text-gray-600">
              <CreditCard size={11} />
              Payments disabled
            </span>
          )}

          {keysVerified ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2.5 py-1 font-semibold text-blue-700">
              <CheckCircle size={11} />
              Razorpay verified
              {config?.razorpay_key_last4 ? ` · …${config.razorpay_key_last4}` : ''}
              {config?.test_mode ? ' · Test mode' : ''}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 font-semibold text-amber-700">
              <ShieldAlert size={11} />
              Owner has not submitted Razorpay keys
            </span>
          )}
```

with

```tsx
          <SellingStatusBadge status={sellingStatus} />
          {config?.razorpay_key_last4 && (
            <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-1 font-semibold text-gray-600">
              Key …{config.razorpay_key_last4}
            </span>
          )}
```

8. Replace

```tsx
        {!marketplaceReady && (
          <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            <p className="font-semibold">Items will not appear on the public page yet.</p>
            <p className="mt-1 leading-5">
              The Shop section requires both <strong>payments enabled</strong> and{' '}
              <strong>verified Razorpay keys</strong>. You can still add or edit items here so
              they go live the moment those flip — useful for onboarding.
              {!paymentsEnabled && (
                <>
                  {' '}
                  <Link
                    href="/admin/payments"
                    className="font-semibold underline underline-offset-2"
                  >
                    Toggle payments
                  </Link>
                  .
                </>
              )}
            </p>
          </div>
        )}
```

with

```tsx
        {sellingStatus !== 'live' && (
          <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            <p className="font-semibold">Customers can&apos;t buy these items yet.</p>
            <p className="mt-1 leading-5">
              The Shop is public once the owner connects live Razorpay keys; with test keys only the
              owner sees it. You can still add or edit items here.{' '}
              <Link href="/admin/payments" className="font-semibold underline underline-offset-2">
                Open payments
              </Link>
              .
            </p>
          </div>
        )}
```

- [ ] **Step 6: Typecheck, lint, test and build**

Run: `npx tsc --noEmit && npm run lint && npm run test:existing && npm run build`
Expected: typecheck clean; lint 0 errors / 11 warnings (removed icons must not linger as unused imports); tests pass except the known clock-dependent failure(s); build succeeds.

- [ ] **Step 7: Verify in the browser**

1. Logged out, `http://localhost:3000/admin/payments` is refused the way other admin pages are (same redirect as `/admin/reviews`).
2. No console errors.

State that the admin view, filters, Suspend (reason required) and Lift need a signed-in admin check by the site owner.

- [ ] **Step 8: Commit**

```bash
git add src/app/admin/payments/page.tsx src/app/admin/payments/SellingControls.tsx src/app/admin/payments/SellingStatusBadge.tsx src/app/actions/listing-payments.ts src/app/admin/products/page.tsx "src/app/admin/products/[listingId]/page.tsx"
git commit -m "feat(selling): admin selling statuses with suspend and lift" -m "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 9: One "Sell online" card on My Business

**Files:**
- Create: `src/app/my-business/SellOnlineCard.tsx`
- Modify: `src/app/my-business/page.tsx`

**Interfaces:**
- Consumes: `deriveSellingChecklist`, `type SellingChecklist`, `type ChecklistStep`, `type ChecklistStepId`, `type ChecklistStepState` (Task 2); `sellingPausedMessage` (Task 2); `getListingHref(id, subdomain)` from `@/lib/listing-url`; `/my-business/payments?listing=<id>` (Task 7).
- Produces: default export `SellOnlineCard({ rows }: { rows: SellOnlineRow[] })` and `interface SellOnlineRow { listingId: string; listingName: string; shopHref: string; suspendedReason: string | null; checklist: SellingChecklist; newOrderCount: number }`.

- [ ] **Step 1: Write `src/app/my-business/SellOnlineCard.tsx`**

```tsx
import Link from 'next/link'
import { ArrowUpRight, CheckCircle2, Circle, Lock, PauseCircle, ShoppingBag, SkipForward } from 'lucide-react'

import type {
  ChecklistStep,
  ChecklistStepId,
  ChecklistStepState,
  SellingChecklist,
} from '@/lib/selling/checklist'
import { sellingPausedMessage } from '@/lib/selling/shop-mode'

export interface SellOnlineRow {
  listingId: string
  listingName: string
  shopHref: string
  suspendedReason: string | null
  checklist: SellingChecklist
  /** Real (non-test) orders still waiting at "confirmed". */
  newOrderCount: number
}

const STEP_COPY: Record<ChecklistStepId, { title: string; hint: string }> = {
  listing: { title: 'Listing is live', hint: 'Your listing must be approved before customers can buy.' },
  connect: { title: 'Connect Razorpay', hint: 'Payments go straight to your own Razorpay account.' },
  item: { title: 'Add your first item', hint: 'Products or services customers can buy.' },
  practice: {
    title: 'Try a practice purchase',
    hint: 'Optional. Buy from your own shop while on test keys — no real money moves.',
  },
  live: { title: 'Go live', hint: 'Connect Live keys once Razorpay activates your account.' },
}

const STATE_LABEL: Record<ChecklistStepState, string> = {
  done: 'Done',
  skipped: 'Skipped',
  blocked: 'Waiting on an earlier step',
  todo: 'To do',
}

function stepAction(step: ChecklistStep, row: SellOnlineRow): { label: string; href: string } | null {
  if (step.state !== 'todo') return null
  const paymentsHref = `/my-business/payments?listing=${row.listingId}`
  switch (step.id) {
    case 'listing':
      return { label: 'View listing', href: row.shopHref }
    case 'connect':
      return { label: 'Connect', href: paymentsHref }
    case 'item':
      return { label: 'Add item', href: `/my-business/products/${row.listingId}` }
    case 'practice':
      return { label: 'View my shop', href: row.shopHref }
    case 'live':
      return { label: 'How to go live', href: paymentsHref }
  }
}

function StepIcon({ state }: { state: ChecklistStepState }) {
  if (state === 'done') return <CheckCircle2 size={18} className="text-[var(--od-success)]" aria-hidden />
  if (state === 'skipped') return <SkipForward size={16} className="text-[var(--od-muted)]" aria-hidden />
  if (state === 'blocked') return <Lock size={15} className="text-[var(--od-muted)]" aria-hidden />
  return <Circle size={18} className="text-[var(--od-brand)]" aria-hidden />
}

function ListingSelling({ row, showName }: { row: SellOnlineRow; showName: boolean }) {
  const { checklist } = row
  const paymentsHref = `/my-business/payments?listing=${row.listingId}`

  return (
    <div className="rounded-2xl border border-[var(--od-border)] bg-white/70 p-4">
      {showName && <p className="mb-3 font-bold text-[var(--od-ink)]">{row.listingName}</p>}

      {checklist.status === 'suspended' ? (
        <div className="flex items-start gap-2">
          <PauseCircle size={18} className="mt-0.5 shrink-0 text-[var(--od-danger)]" aria-hidden />
          <p className="text-sm leading-relaxed text-[var(--od-ink-2)]">{sellingPausedMessage(row.suspendedReason)}</p>
        </div>
      ) : checklist.status === 'complete' ? (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="flex items-center gap-2 text-sm font-bold text-[var(--od-ink)]">
            <CheckCircle2 size={18} className="text-[var(--od-success)]" aria-hidden />
            Selling online · Live
          </p>
          <nav aria-label={`Selling links for ${row.listingName}`} className="flex flex-wrap gap-2">
            <Link href="/my-business/orders" className="od-button-secondary px-3 py-1.5 text-sm">
              Orders
              {row.newOrderCount > 0 && (
                <span className="rounded-full bg-[var(--od-brand)] px-1.5 py-0.5 text-[11px] font-bold tabular-nums text-white">
                  {row.newOrderCount}
                </span>
              )}
            </Link>
            <Link href={`/my-business/products/${row.listingId}`} className="od-button-secondary px-3 py-1.5 text-sm">
              Items
            </Link>
            <Link href={paymentsHref} className="od-button-secondary px-3 py-1.5 text-sm">
              Payments
            </Link>
            <Link href={row.shopHref} className="od-button-secondary px-3 py-1.5 text-sm">
              View your shop
              <ArrowUpRight size={13} aria-hidden />
            </Link>
          </nav>
        </div>
      ) : (
        <>
          {checklist.status === 'keys_rejected' && (
            <div className="mb-3 flex flex-col gap-2 rounded-xl border border-[rgba(180,35,24,0.25)] bg-[rgba(180,35,24,0.05)] p-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm font-semibold text-[var(--od-danger)]">
                Razorpay stopped accepting your keys. Reconnect to keep selling.
              </p>
              <Link href={paymentsHref} className="od-button-primary shrink-0 px-3 py-1.5 text-sm">
                Reconnect
              </Link>
            </div>
          )}
          <ol className="space-y-3">
            {checklist.steps.map((step) => {
              const action = stepAction(step, row)
              const muted = step.state === 'done' || step.state === 'skipped'
              return (
                <li key={step.id} className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center">
                    <StepIcon state={step.state} />
                    <span className="sr-only">{STATE_LABEL[step.state]}</span>
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className={`text-sm font-bold ${muted ? 'text-[var(--od-muted)]' : 'text-[var(--od-ink)]'}`}>
                      {STEP_COPY[step.id].title}
                    </p>
                    <p className="text-xs leading-relaxed text-[var(--od-muted)]">{STEP_COPY[step.id].hint}</p>
                  </div>
                  {action && (
                    <Link href={action.href} className="od-button-primary shrink-0 px-3 py-1.5 text-xs">
                      {action.label}
                    </Link>
                  )}
                </li>
              )
            })}
          </ol>
        </>
      )}
    </div>
  )
}

export default function SellOnlineCard({ rows }: { rows: SellOnlineRow[] }) {
  if (rows.length === 0) return null

  return (
    <section className="od-card mb-4 p-5 sm:p-6" aria-labelledby="sell-online-heading">
      <div className="mb-4 flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--color-surface-soft)]">
          <ShoppingBag size={18} className="text-[var(--od-brand)]" aria-hidden />
        </span>
        <div>
          <h2 id="sell-online-heading" className="text-lg font-bold text-[var(--od-ink)]">
            Sell online
          </h2>
          <p className="text-xs text-[var(--od-muted)]">Take payments straight into your own Razorpay account.</p>
        </div>
      </div>
      <div className="space-y-3">
        {rows.map((row) => (
          <ListingSelling key={row.listingId} row={row} showName={rows.length > 1} />
        ))}
      </div>
    </section>
  )
}
```

- [ ] **Step 2: Load the checklist data and replace the three cards**

In `src/app/my-business/page.tsx`:

1. Replace

```ts
  Calendar,
  ShoppingBag,
  Package,
  CreditCard,
} from 'lucide-react'
```

with

```ts
  Calendar,
} from 'lucide-react'
```

2. Replace

```ts
import { EMPTY_LISTING_STATS } from '@/lib/listing-stats'
```

with

```ts
import { EMPTY_LISTING_STATS } from '@/lib/listing-stats'
import { deriveSellingChecklist } from '@/lib/selling/checklist'
import SellOnlineCard, { type SellOnlineRow } from './SellOnlineCard'
```

3. Replace

```ts
  views:        number | null
  expires_at:   string | null
}
```

with

```ts
  views:        number | null
  expires_at:   string | null
  payments_suspended_at:     string | null
  payments_suspended_reason: string | null
}
```

4. Replace `      .select('id, name, category, subdomain, plan, approved, rating, review_count, views, expires_at')` with `      .select('id, name, category, subdomain, plan, approved, rating, review_count, views, expires_at, payments_suspended_at, payments_suspended_reason')`.

5. Replace

```ts
  const hasExpiring = listings.some(l => {
```

with

```ts
  // One batched set of reads for the "Sell online" card. Owners can read
  // their own configs, products and orders through RLS.
  let sellRows: SellOnlineRow[] = []
  if (listings.length > 0) {
    const ids = listings.map((l) => l.id)
    const [{ data: configData }, { data: productData }, { data: orderData }] = await Promise.all([
      supabase
        .from('listing_payment_configs')
        .select('listing_id, razorpay_key_id, verified_at')
        .in('listing_id', ids),
      supabase
        .from('listing_products')
        .select('listing_id')
        .eq('is_active', true)
        .in('listing_id', ids),
      supabase
        .from('orders')
        .select('listing_id, is_test, status')
        .eq('payment_flow', 'owner_razorpay')
        .in('listing_id', ids),
    ])

    const configs = new Map(
      ((configData ?? []) as { listing_id: string; razorpay_key_id: string; verified_at: string | null }[])
        .map((config) => [config.listing_id, config]),
    )
    const activeItems = new Map<string, number>()
    for (const row of (productData ?? []) as { listing_id: string }[]) {
      activeItems.set(row.listing_id, (activeItems.get(row.listing_id) ?? 0) + 1)
    }
    const orderRows = (orderData ?? []) as { listing_id: string | null; is_test: boolean; status: string }[]

    sellRows = listings.map((listing) => {
      const config = configs.get(listing.id) ?? null
      const listingOrders = orderRows.filter((order) => order.listing_id === listing.id)
      return {
        listingId: listing.id,
        listingName: listing.name,
        shopHref: getListingHref(listing.id, listing.subdomain),
        suspendedReason: listing.payments_suspended_reason,
        newOrderCount: listingOrders.filter((order) => !order.is_test && order.status === 'confirmed').length,
        checklist: deriveSellingChecklist({
          approved: listing.approved === true,
          suspendedAt: listing.payments_suspended_at,
          hasConfig: config !== null,
          verifiedAt: config?.verified_at ?? null,
          keyId: config?.razorpay_key_id ?? null,
          activeItemCount: activeItems.get(listing.id) ?? 0,
          orderCount: listingOrders.length,
          testOrderCount: listingOrders.filter((order) => order.is_test).length,
        }),
      }
    })
  }

  const hasExpiring = listings.some(l => {
```

6. Replace

```tsx
      {/* Orders shortcut */}
      <div className="od-card mb-4 flex items-center justify-between gap-4 p-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-surface-soft rounded-xl flex items-center justify-center">
            <ShoppingBag size={18} className="text-brand" />
          </div>
          <div>
            <p className="font-semibold text-gray-900 text-sm">Customer Orders</p>
            <p className="text-xs text-gray-400">View and manage orders placed on your listings</p>
          </div>
        </div>
        <Link
          href="/my-business/orders"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand hover:text-brand-strong border border-border hover:border-brand px-3 py-2 rounded-xl transition-colors"
        >
          <ArrowUpRight size={14} />
          View Orders
        </Link>
      </div>
```

with

```tsx
      <SellOnlineCard rows={sellRows} />
```

7. Delete this block (the Products & Services and Accept Payments cards, directly after the Appointments card):

```tsx
      <div className="od-card mb-4 flex items-center justify-between gap-4 p-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-surface-soft rounded-xl flex items-center justify-center">
            <Package size={18} className="text-brand" />
          </div>
          <div>
            <p className="font-semibold text-gray-900 text-sm">Products &amp; Services</p>
            <p className="text-xs text-gray-400">Add items customers can buy from your business page</p>
          </div>
        </div>
        <Link
          href="/my-business/products"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand hover:text-brand-strong border border-border hover:border-brand px-3 py-2 rounded-xl transition-colors"
        >
          <ArrowUpRight size={14} />
          Manage Catalog
        </Link>
      </div>

      <div className="od-card mb-6 flex items-center justify-between gap-4 p-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-surface-soft rounded-xl flex items-center justify-center">
            <CreditCard size={18} className="text-brand" />
          </div>
          <div>
            <p className="font-semibold text-gray-900 text-sm">Accept Payments</p>
            <p className="text-xs text-gray-400">Connect your Razorpay account to sell directly</p>
          </div>
        </div>
        <Link
          href="/my-business/payments"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand hover:text-brand-strong border border-border hover:border-brand px-3 py-2 rounded-xl transition-colors"
        >
          <ArrowUpRight size={14} />
          Payment Setup
        </Link>
      </div>

```

- [ ] **Step 3: Typecheck, lint, test and build**

Run: `npx tsc --noEmit && npm run lint && npm run test:existing && npm run build`
Expected: typecheck clean; lint 0 errors / 11 warnings (`ShoppingBag`, `Package` and `CreditCard` must be gone from the page's imports); tests pass except the known clock-dependent failure(s); build succeeds.

- [ ] **Step 4: Verify in the browser**

Logged out, `http://localhost:3000/my-business` redirects to `/login`; no console errors. State that the card's states — new owner, test with practice order, live (collapsed with links and order badge), suspended and keys rejected — need a signed-in check by the site owner.

- [ ] **Step 5: Commit**

```bash
git add src/app/my-business/SellOnlineCard.tsx src/app/my-business/page.tsx
git commit -m "feat(selling): one Sell online checklist on My Business" -m "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 10: Show test orders as tests, never as sales

**Files:**
- Modify: `src/app/actions/orders.ts`
- Modify: `src/app/my-business/orders/page.tsx`
- Modify: `src/app/account/orders/page.tsx`
- Modify: `src/app/account/orders/[id]/page.tsx`

**Interfaces:**
- Consumes: `orders.is_test` (Task 1); `MarketplaceOrder.is_test` (Task 6); `classifyRazorpayKeyId` (Task 2).
- Produces: `Order.is_test: boolean`; `getMyListingOrders(): Promise<{ orders: Order[]; listingId: string | null; hideTestByDefault: boolean }>` — `hideTestByDefault` is true when the listing's verified key is a live key.

- [ ] **Step 1: Extend the owner orders action**

In `src/app/actions/orders.ts`:

1. Replace

```ts
import { createClient } from '@/lib/supabase/server'

export interface Order {
```

with

```ts
import { classifyRazorpayKeyId } from '@/lib/selling/keys'
import { createClient } from '@/lib/supabase/server'

export interface Order {
```

2. Replace

```ts
  payout_error: string | null
  status: string
  created_at: string
```

with

```ts
  payout_error: string | null
  status: string
  /** Paid with Razorpay test keys: a practice purchase, no real money. */
  is_test: boolean
  created_at: string
```

3. Replace

```ts
export async function getMyListingOrders(): Promise<{ orders: Order[]; listingId: string | null }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { orders: [], listingId: null }
```

with

```ts
export async function getMyListingOrders(): Promise<{
  orders: Order[]
  listingId: string | null
  /** Live keys connected: practice orders are old news, so hide them by default. */
  hideTestByDefault: boolean
}> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { orders: [], listingId: null, hideTestByDefault: false }
```

4. Replace

```ts
  if (!listing) return { orders: [], listingId: null }

  const orders = await getListingOrders(listing.id)
  return { orders, listingId: listing.id }
}
```

with

```ts
  if (!listing) return { orders: [], listingId: null, hideTestByDefault: false }

  const [orders, { data: configData }] = await Promise.all([
    getListingOrders(listing.id),
    supabase
      .from('listing_payment_configs')
      .select('razorpay_key_id, verified_at')
      .eq('listing_id', listing.id)
      .maybeSingle(),
  ])
  const config = (configData ?? null) as { razorpay_key_id: string; verified_at: string | null } | null
  const hideTestByDefault =
    Boolean(config?.verified_at) && classifyRazorpayKeyId(config?.razorpay_key_id) === 'live'

  return { orders, listingId: listing.id, hideTestByDefault }
}
```

- [ ] **Step 2: Badge and exclude test orders on the owner Orders page**

In `src/app/my-business/orders/page.tsx`:

1. Replace

```tsx
function PayoutBadge({ status }: { status: string }) {
```

with

```tsx
function TestBadge() {
  return (
    <span className="inline-flex items-center rounded-full bg-[rgba(200,136,30,0.14)] px-2 py-0.5 text-xs font-bold text-[var(--od-brand-strong)]">
      Test
    </span>
  )
}

function PayoutBadge({ status }: { status: string }) {
```

2. Replace

```tsx
            <FlowBadge flow={order.payment_flow} />
```

with

```tsx
            <FlowBadge flow={order.payment_flow} />
            {order.is_test && <TestBadge />}
```

3. Replace

```tsx
  const [flowFilter, setFlowFilter] = useState<FlowFilter>('all')

  useEffect(() => {
    getMyListingOrders().then(({ orders }) => {
      setOrders(orders)
      setLoading(false)
    })
  }, [])
```

with

```tsx
  const [flowFilter, setFlowFilter] = useState<FlowFilter>('all')
  const [showTest, setShowTest] = useState(true)

  useEffect(() => {
    getMyListingOrders().then(({ orders, hideTestByDefault }) => {
      setOrders(orders)
      setShowTest(!hideTestByDefault)
      setLoading(false)
    })
  }, [])
```

4. Replace

```tsx
  const flowFiltered = useMemo(
    () => (flowFilter === 'all' ? orders : orders.filter((o) => o.payment_flow === flowFilter)),
    [orders, flowFilter],
  )
```

with

```tsx
  const testCount = orders.filter((o) => o.is_test).length
  const visibleOrders = useMemo(
    () => (showTest ? orders : orders.filter((o) => !o.is_test)),
    [orders, showTest],
  )

  const flowFiltered = useMemo(
    () =>
      flowFilter === 'all'
        ? visibleOrders
        : visibleOrders.filter((o) => o.payment_flow === flowFilter),
    [visibleOrders, flowFilter],
  )

  // Test orders can be shown, but they never count as sales.
  const realFiltered = flowFiltered.filter((o) => !o.is_test)
```

5. Replace

```tsx
  const counts = {
    all: flowFiltered.length,
    confirmed: flowFiltered.filter((o) => o.status === 'confirmed').length,
    fulfilled: flowFiltered.filter((o) => o.status === 'fulfilled').length,
    cancelled: flowFiltered.filter((o) => o.status === 'cancelled').length,
  }

  const flowCounts = {
    all: orders.length,
    owner_razorpay: orders.filter((o) => o.payment_flow === 'owner_razorpay').length,
    platform_upi_payout: orders.filter((o) => o.payment_flow === 'platform_upi_payout').length,
  }

  const totalEarnings = flowFiltered
```

with

```tsx
  const counts = {
    all: realFiltered.length,
    confirmed: realFiltered.filter((o) => o.status === 'confirmed').length,
    fulfilled: realFiltered.filter((o) => o.status === 'fulfilled').length,
    cancelled: realFiltered.filter((o) => o.status === 'cancelled').length,
  }

  const flowCounts = {
    all: visibleOrders.length,
    owner_razorpay: visibleOrders.filter((o) => o.payment_flow === 'owner_razorpay').length,
    platform_upi_payout: visibleOrders.filter((o) => o.payment_flow === 'platform_upi_payout').length,
  }

  const totalEarnings = realFiltered
```

6. Replace

```tsx
          {/* Status filter tabs */}
```

with

```tsx
          {testCount > 0 && (
            <label className="mb-3 inline-flex items-center gap-2 text-xs font-semibold text-gray-600">
              <input
                type="checkbox"
                checked={showTest}
                onChange={(event) => setShowTest(event.target.checked)}
                className="rounded border-gray-300 text-brand focus:ring-brand"
              />
              Show test orders ({testCount})
            </label>
          )}

          {/* Status filter tabs */}
```

- [ ] **Step 3: Badge test orders for buyers**

In `src/app/account/orders/page.tsx`:

1. Replace

```ts
  const totalSpend = orders
    .filter((order) => order.status !== 'cancelled')
```

with

```ts
  const totalSpend = orders
    .filter((order) => order.status !== 'cancelled' && !order.is_test)
```

2. Replace

```tsx
                        <StatusBadge status={order.status} />
```

with

```tsx
                        <StatusBadge status={order.status} />
                        {order.is_test && (
                          <span className="inline-flex items-center rounded-full bg-[rgba(200,136,30,0.14)] px-2 py-0.5 text-xs font-bold text-[var(--od-brand-strong)]">
                            Test
                          </span>
                        )}
```

In `src/app/account/orders/[id]/page.tsx`, replace

```tsx
        <StatusRow status={order.status} />
```

with

```tsx
        <StatusRow status={order.status} />

        {order.is_test && (
          <p className="rounded-xl border border-[rgba(200,136,30,0.35)] bg-[rgba(200,136,30,0.07)] px-4 py-3 text-sm leading-relaxed text-[var(--od-ink-2)]">
            <strong className="font-bold">Test order</strong> · a practice purchase made with Razorpay test keys. No real money moved.
          </p>
        )}
```

- [ ] **Step 4: Typecheck, lint, test and build**

Run: `npx tsc --noEmit && npm run lint && npm run test:existing && npm run build`
Expected: typecheck clean; lint 0 errors / 11 warnings; tests pass except the known clock-dependent failure(s); build succeeds.

- [ ] **Step 5: Verify in the browser**

Logged out, `http://localhost:3000/account/orders` and `http://localhost:3000/my-business/orders` do not show order data (redirect to login or the existing empty state); no console errors. State that the Test badge, the "Show test orders" switch, and totals excluding test orders need a signed-in check by the site owner after a practice purchase.

- [ ] **Step 6: Commit**

```bash
git add src/app/actions/orders.ts src/app/my-business/orders/page.tsx src/app/account/orders/page.tsx "src/app/account/orders/[id]/page.tsx"
git commit -m "feat(selling): label test orders and keep them out of totals" -m "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Post-implementation checks

Not tasks — what to confirm before and after this ships.

- [ ] `npx tsc --noEmit` clean, `npm run lint` at 0 errors / 11 warnings, `npm run test:existing` passing except the known clock-dependent appointment-slot failure(s), `npm run build` succeeds.
- [ ] `grep -rn "marketplaceReady\|payments_enabled" src --include=*.ts --include=*.tsx` shows only intended uses: gates and writes in `listing-payments.ts`, `listing-detail.ts`, `shop-state.ts`, the admin pages' `deriveSellingStatus` inputs, and the unchanged legacy flows.
- [ ] **Migration applied and guarded** (Task 1 Steps 2–4).
- [ ] **Site owner, signed in, on production after deploy:**
  1. My Business shows one "Sell online" card with the right next step.
  2. Connect Razorpay **test** keys: the label says "Test key" while typing, Connect succeeds, the card shows "Test · only you can see your shop".
  3. Your business page shows the Shop with the Test mode banner; in a private window (logged out, or another account) the Shop is absent and `/checkout/<product>` says the shop isn't open.
  4. Practice purchase with `success@razorpay`: order saved with a **Test** badge, stock unchanged, your notification says "Test order", no admin notification.
  5. Replace with **live** keys: admins get "is now selling online", the checklist collapses to "Selling online · Live", the Shop is public, test orders are hidden behind "Show test orders".
  6. Admin → Payments: Suspend with a reason → owner gets "Selling paused", the Shop disappears, the payments page shows the pause; Lift → "Selling resumed", Shop returns.
  7. A wrong Key Secret shows "Razorpay didn't accept these keys…".
