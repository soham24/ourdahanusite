# Drop the Mobile API and the Old Payment Route

**Date:** 2026-09-16
**Status:** Design approved by the site owner, ready for an implementation plan
**Related:** `2026-09-15-commerce-usability-roadmap.md` (clears the ground before piece 3)

## Why

The site carries an API built for a mobile app that does not exist, and a second payment route — "the customer pays OurDahanu, OurDahanu pays the business later" — that came with it. Both are dead:

| Evidence | Figure |
|---|---|
| Orders ever placed through the old route (`payment_flow = 'platform_upi_payout'`) | 0 |
| Push tokens ever registered (`device_tokens`) | 0 |
| Payment intents ever created for the old order flow | 0 |
| `/api/v1/*` requests in production logs (24 h, and absent from the top 25 paths) | 0 |
| Real orders, all through the business's own Razorpay | 3 |

Meanwhile the old route's fields clutter the Orders screens, `listings.services` stays frozen because those endpoints still read it, and roadmap pieces 3 (basket and checkout) and 4 (order steps and refunds) would have to be designed around both.

## Goals

- One payment route on the site: the customer pays, the money goes straight into the business's own Razorpay account.
- No endpoint, table or column that exists only for an app that was never built.
- The Orders screens show what a real order is, with nothing about payouts or payment routes.
- Nothing a customer sees changes.

## Non-goals

- Redesigning the Orders screens (piece 4).
- Basket, delivery or refunds (pieces 3 and 4).
- Changing how payment works today, or any existing order.
- Keeping a copy of the old services text. The owner chose to drop it without a backup; Supabase's own retention is the only remaining copy.

## What is removed

### Code

- `src/app/api/v1/` — `orders`, `devices`, `me`, `appointments`.
- `src/lib/api/` — `auth`, `cors`, `form`, `respond` (used only by those four routes).
- `src/app/api/razorpay/create-product-order/route.ts`.
- From `src/app/actions/orders.ts`: `placeOrder`, `updateOrderStatus`, `retryPayout`, `getMyOrders`, `getListingOrders`. `getAllOrders`, `getMyListingOrders` and the `Order` type stay, the type minus its dead fields.
- `resolveListingService` and `ResolvedListingService` from `src/lib/payment-security.ts`. Submission charges and Razorpay verification stay.
- The `order` case in `src/app/payments/recover/[orderId]/RecoverClient.tsx`, and `'order'` from `PaymentIntentFlow` (`src/lib/payment-intents.ts`) and `PaymentRecoveryFlow` (`src/lib/payment-retry.ts`), with its label and success route.

### Screens (website only — owner and admin pages)

- **`/my-business/orders`**: the payment-route badge ("Direct payment" / "UPI via OurDahanu"), the payout badge, and the route filter tabs are removed. Marking an order fulfilled or cancelled always goes through `updateMarketplaceOrderStatus`, which notifies the buyer. Everything else on the row stays: item and option, status, Test badge, amount, quantity and unit price, buyer, date.
- **`/admin/orders`**: the route tabs, payout column, payout filter, retry-payout button and payout totals are removed.
- **`/account/orders`** and every customer-facing page: unchanged.

### Order saving

`placeMarketplaceOrder` stops writing the removed columns. Every other rule stays, including: a payment Razorpay captured is always saved, with the price and option label taken from the payment intent.

### Database (`supabase/drop_mobile_api.sql`)

- `DROP TABLE public.device_tokens` (0 rows; its four RLS policies go with it).
- `ALTER TABLE public.listings DROP COLUMN services`.
- `ALTER TABLE public.orders DROP COLUMN` for: `payment_flow`, `commission_rate`, `commission_amount`, `seller_payout_amount`, `seller_upi_id`, `payout_status`, `razorpay_payout_id`, `payout_error`, `razorpay_order_id`, `razorpay_payment_id`, `razorpay_signature`.

Checked before writing this: no RLS policy, function, trigger, view or index depends on any of those columns, and the `orders` triggers list is empty.

## Order of work

`commission_amount`, `seller_payout_amount` and `seller_upi_id` are `NOT NULL` with **no default**, and `payment_flow` still defaults to the old route's value. The insert therefore cannot simply stop writing them while the columns exist: every captured payment would fail to save, after stock had already been reduced. The order is:

1. **Before merging:** apply `supabase/relax_legacy_order_columns.sql` — it makes those three columns optional and points `payment_flow`'s default at the surviving route, so the site keeps saving orders in the window between deploy and the drop. Applied to production on 2026-09-16.
2. Ship the code removal, merge, let it deploy.
3. Apply `supabase/drop_mobile_api.sql`, with pre-checks confirming the counts above are still zero.
4. Regenerate `src/lib/database.types.ts` and commit.

If the counts are not zero at step 3 — an order through the old route, or a registered device — stop and report instead of dropping.

## Error handling

Nothing here adds a runtime path. The risks are all at removal time:

| Risk | Handling |
|---|---|
| Something still calls a deleted endpoint | Verified zero traffic first; a 404 is the honest answer afterwards |
| Migration applied before the code deploys | Step order above; the migration's pre-check also fails loudly if `payment_flow` still has rows using the old value |
| A screen reads a column that no longer exists | Types are regenerated and `tsc` is run after the migration; the removal commit already stops reading them |

## Testing

- `npx tsc --noEmit`, `npm run lint` at the 0 errors / 11 warnings baseline, `npm run build`, `npm run test:existing` (only the known clock-dependent failure) and `npm run test:game`.
- Grep gates: no reference remains to `api/v1`, `lib/api/`, `create-product-order`, `placeOrder`, `resolveListingService`, `payment_flow`, `payout_status`, `seller_upi_id`, `device_tokens` or `listings.services`.
- Logged out on the dev server: a business page, an item page and checkout still render; `/api/v1/me` returns 404.
- After the migration: `select` one order and confirm the remaining columns are intact; the owner and admin Orders pages load; a practice purchase still saves (owner check).
