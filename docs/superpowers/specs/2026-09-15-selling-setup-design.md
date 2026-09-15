# Selling Setup Design

**Date:** 2026-09-15
**Status:** Design approved by the site owner, ready for an implementation plan
**Part of:** `2026-09-15-commerce-usability-roadmap.md` (piece 1 of 4)

## Summary

Any approved business can start taking online payments on its own. The owner connects Razorpay through a guided flow that recognises test and live keys, can make a practice purchase that only they can see, and follows one "Sell online" checklist on My Business. Admins can suspend a business instead of switching each one on. A paid order is never refused.

## Goals

- An owner goes from "never sold online" to "live" without contacting OurDahanu.
- A business on test keys is invisible to customers, on the page and on the server.
- An owner can rehearse a full purchase and see what a real order looks like, without it counting as a sale.
- My Business shows, at a glance, what is done and what the next step is.
- A customer whose payment Razorpay has captured always gets a saved order.

## Non-goals

- Merging the old "Services & Products" list, item options, basket, delivery, order steps and refunds (pieces 2–4 of the roadmap).
- Razorpay OAuth or Partner onboarding. Owners still paste API keys.
- Changes to the mobile endpoints (`/api/v1/orders`, `/api/razorpay/create-product-order`) or to Telegram delivery.
- `/shop`.

## Current behaviour this replaces

- `listings.payments_enabled` defaults to false and only an admin can set it (`toggleListingPaymentsEnabled`, `/admin/payments`). Until then `saveRazorpayConfig`, the product actions and `/my-business/products` all refuse the owner.
- `listing_payment_configs.test_mode` comes from an owner-ticked checkbox, not from the key.
- `getCachedListingDetail` sets `marketplaceReady = payments_enabled && verified_at`, ignoring test mode (`src/lib/data/listing-detail.ts:163`), so a test-key shop is public.
- `placeMarketplaceOrder` rejects the order after payment capture when the listing is no longer approved or `payments_enabled` is false (`src/app/actions/marketplace-orders.ts:108-110`).
- When Razorpay returns 401 at checkout, `create-marketplace-order` clears `verified_at` and hides the shop, but nobody tells the owner.

## Design

### 1. Switching on and suspending

**Data (additive, idempotent migration `supabase/add_selling_setup.sql`):**

```sql
ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS payments_suspended_at timestamptz,
  ADD COLUMN IF NOT EXISTS payments_suspended_reason text;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS is_test boolean NOT NULL DEFAULT false;
```

`payments_enabled` keeps its meaning of "selling is switched on" and every existing check of it stays. What changes is who sets it:

| Event | Effect |
|---|---|
| Owner saves keys that Razorpay verifies | `payments_enabled = true` |
| Owner disconnects keys | `payments_enabled = false` |
| Admin suspends (reason required, up to 300 characters) | `payments_enabled = false`, `payments_suspended_at = now()`, reason stored |
| Admin lifts the suspension | suspension columns cleared; `payments_enabled = true` only if verified keys still exist |

**Who may connect keys:** the listing owner (or an admin) when the listing is approved and `payments_suspended_at` is null. Otherwise `saveRazorpayConfig` returns a plain message:

- not approved: "Your listing needs to be live before you can sell online."
- suspended: "Selling is paused by OurDahanu: {reason}. Contact us to resume."

The three listings already switched on keep `payments_enabled = true` and behave exactly as before.

**Product actions** (`assertListingOwner` in `src/app/actions/products.ts`) stop requiring `payments_enabled`; they require an approved, non-suspended listing. Owners can prepare items before connecting Razorpay. `/my-business/products` and `/my-business/products/[listingId]` drop the "ask an admin" gate in the same way.

### 2. Connecting Razorpay (`/my-business/payments`)

A guided flow per business. Owners with one approved business land straight on it; owners with several first see one row per business with its status.

**Step 1 — "Have a Razorpay account?"**
- "Not yet": link to Razorpay sign-up and the note "Free to open. You can connect and test right away. Razorpay checks your business documents before you can take real money, usually within a few days."
- "Yes": continue.

**Step 2 — "Copy your keys."** Numbered steps with the menu path Account & Settings → API Keys → Generate Key, the warning that the Key Secret is shown only once, and a simple inline SVG drawing of where the keys appear (no Razorpay screenshots).

**Step 3 — "Paste them here."**
- **Key ID** field with a live label from `classifyRazorpayKeyId`:
  - `rzp_test_…` → "Test key · practice, no real money"
  - `rzp_live_…` → "Live key · real payments"
  - anything else non-empty → "This doesn't look like a Razorpay Key ID"
- **Key Secret** field, `type="password"`, with a show/hide button that is keyboard reachable (the current `tabIndex={-1}` goes).
- One **Connect** button. The owner-ticked test-mode checkbox is removed; `saveRazorpayConfig` sets `test_mode` from the key prefix.

**Plain-language errors:**

| Cause | Message |
|---|---|
| Key ID not `rzp_test_`/`rzp_live_` | "That Key ID doesn't look right. It starts with rzp_test_ or rzp_live_." |
| Razorpay 401 | "Razorpay didn't accept these keys. The secret is only shown once, so generate a new key and paste both again." |
| Other Razorpay status or network failure | "We couldn't reach Razorpay just now. Your keys weren't saved. Please try again." |

**Connected state** replaces the form:
- A status line: **Live · real payments on** or **Test · only you can see your shop**.
- Key ending (…1234) and connected date.
- **Replace keys** re-opens step 3.
- **Disconnect**, behind a confirmation dialog: "Customers won't be able to pay until you reconnect."
- In test mode, a **"Ready for real payments?"** box: once Razorpay has activated the account, generate Live keys and paste them here.
- If keys were rejected at checkout (config exists, `verified_at` is null): "Razorpay stopped accepting your keys. Reconnect to keep selling." with step 3 open.
- If suspended: the pause message and reason, no form.

### 3. Shop mode and test purchases

**Pure function** `deriveShopMode` (new `src/lib/selling/shop-mode.ts`, unit tested):

```ts
type ShopMode = 'off' | 'test' | 'live'

deriveShopMode({
  approved: boolean,
  paymentsEnabled: boolean,
  suspendedAt: string | null,
  verifiedAt: string | null,
  keyId: string | null,
}): ShopMode
```

`off` unless approved, enabled, not suspended and verified; then `test` for `rzp_test_` keys, `live` for `rzp_live_` keys.

**Business page.** `getCachedListingDetail` returns `shopMode` in place of `marketplaceReady`. It already reads the config with the service-role client; it adds `razorpay_key_id` to that select and never returns the key itself, only the mode. `ListingContent` renders the Shop section when:

- `shopMode === 'live'`, for everyone, or
- `shopMode === 'test'` and `viewer.isOwner` (from the existing `/api/listings/[id]/viewer` fetch), with the banner "Test mode · only you can see your shop. Try a practice purchase — no real money moves."

**Server enforcement.** A shared helper `canBuyFromShop(mode, { isOwner, isAdmin })` returns true for `live`, and for `test` only when the buyer is the owner or an admin. It is checked in:

- `src/app/checkout/[productId]/page.tsx`: otherwise render "This shop isn't taking online payments yet." with a link back to the business.
- `src/app/api/razorpay/create-marketplace-order/route.ts`: otherwise respond 422 with the same message.

**Practice purchase.** In test mode the checkout shows a notice above the Pay button: "Practice purchase · use test UPI success@razorpay or card 4111 1111 1111 1111 with any future date and CVV."

**Test orders.** `placeMarketplaceOrder` sets `orders.is_test = true` when the owner's keys are test keys, and for test orders:

- does not call `decrement_product_stock`;
- still notifies the owner, with "Test order" in the notification title;
- notifies the buyer as usual, also with "Test order" in the title;
- does not notify admins.

**Showing test orders.**
- `/my-business/orders`: a **Test** badge, excluded from the stats and "Earned" total. When the business is live they are hidden by default behind a "Show test orders" switch.
- `/account/orders` and `/account/orders/[id]`: a **Test** badge, excluded from "Total spent".
- Existing orders keep `is_test = false`.

### 4. Never refuse a paid order

`placeMarketplaceOrder` no longer rejects on `listing.approved` or `payments_enabled` once the payment is proven genuine. The existing checks stay: HMAC signature with the owner's secret, Razorpay order amount, `amount_paid`, `status === 'paid'`, and matching notes (flow, buyer, product, listing, quantity). Suspension or a lapsed listing only blocks creating new Razorpay orders.

The stock check stays. An item that sold out between opening Razorpay and capture still returns the existing out-of-stock error, and the buyer lands on the recovery screen as today.

### 5. "Sell online" checklist on My Business

The Customer Orders, Products & Services and Accept Payments cards in `src/app/my-business/page.tsx` become one **Sell online** card. Appointments stays separate. Owners with several businesses get one row per business.

Steps come from a pure function `deriveSellingChecklist` (new `src/lib/selling/checklist.ts`, unit tested), each with a state of `done`, `todo`, `blocked` or `skipped`:

| # | Step | Done when | Button |
|---|---|---|---|
| 1 | Listing is live | listing approved | "View listing" when not approved |
| 2 | Connect Razorpay | verified keys | "Connect" → `/my-business/payments` |
| 3 | Add your first item | at least one active `listing_products` row | "Add item" → `/my-business/products/[listingId]` |
| 4 | Try a practice purchase (optional) | any order exists for the listing; `skipped` when live keys are connected and no test order exists | "View my shop" |
| 5 | Go live | live keys verified | "How to go live" → `/my-business/payments` |

Owners can do steps 2 and 3 in either order.

- **When all steps are done or skipped:** the card collapses to "Selling online · Live" with quick links to Orders (badge: count of non-test orders with status `confirmed`), Items, Payments and View your shop.
- **When suspended:** the card shows the pause message and reason in place of the steps.

The page adds one batched set of reads for the owner's listings: payment configs, active item counts, and order counts split by `is_test` and status.

### 6. Admin → Payments

`src/app/admin/payments/page.tsx`:

- The "Enable payments" checkbox form is removed.
- Each business shows one status (**Not connected**, **Test**, **Live**, **Suspended**) with filter tabs.
- Headline stats become Live, Test, Suspended and Not connected.
- **Suspend selling** opens a reason field (required) and calls `suspendListingSelling(listingId, reason)`. **Lift suspension** calls `resumeListingSelling(listingId)`. Both are `requireAdmin` server actions.
- "Manage products" stays.

`src/app/admin/products/page.tsx` and `src/app/admin/products/[listingId]/page.tsx` replace their `payments_enabled` wording with the same four statuses.

### 7. Notifications

| Type | Recipient | When |
|---|---|---|
| `admin.new_submission` with new kind `shop_live` | admins | a business saves verified live keys for the first time or switches from test to live |
| `selling.paused` (new) | listing owner | admin suspends (reason) or Razorpay rejects keys at checkout (reason "Razorpay stopped accepting your keys") |
| `selling.resumed` (new) | listing owner | admin lifts a suspension |

- `selling.paused` links to `/my-business/payments`; `selling.resumed` links to `/my-business`.
- Both new types get renderers in `src/lib/notifications/templates.ts` and labels in `src/app/account/notifications/PreferencesForm.tsx`.
- The 401 path in `create-marketplace-order` sends `selling.paused` at most once per rejection. It sends only when it is the request that cleared `verified_at` (`update … where verified_at is not null` affecting a row).

Notification delivery is best-effort: a dispatch failure is logged and never changes the result of the action that triggered it.

## Error handling

- Razorpay unreachable while saving keys: nothing is saved; the previous config, if any, is untouched.
- Suspend or lift on a listing that no longer exists: "Listing not found."
- Owner opens `/my-business/payments` for a listing they do not own: 404.
- Checkout by a non-owner while the shop is in test mode: the not-taking-payments state from section 3, never a Razorpay window.
- A dispatch failure in any new notification: logged with the action name, action result unchanged.

## Testing

Unit tests (`node:test` via `tsx`, registered in `package.json` `test:existing`, relative runtime imports only):

- `classifyRazorpayKeyId`: test, live, empty, wrong prefix, surrounding whitespace.
- `deriveShopMode`: every combination of approved, enabled, suspended, verified and key prefix.
- `canBuyFromShop`: live and off for anyone; test for owner, admin and a stranger.
- `deriveSellingChecklist`: new owner, keys before items, items before keys, test with a practice order, live without a test order (step 4 skipped), suspended, keys rejected.

Checks: `npx tsc --noEmit`, `npm run lint` at the 0 errors / 11 warnings baseline, `npm run test:existing`, `npm run build`.

Browser checks on the dev server: logged-out business page for a test-mode listing shows no Shop section and no Buy buttons; a logged-out visit to `/checkout/<test-mode product>` redirects to login; the admin and owner pages redirect when signed out.

Owner-signed-in checks (by the site owner, in production after deploy):
1. Connect Razorpay test keys; the Shop appears only for you, with the banner.
2. Make a practice purchase; the order shows a Test badge and stock does not change.
3. Connect live keys; the checklist completes, admins get the "shop live" notice, and the Shop is public.
4. Suspend and lift from Admin → Payments; the owner receives both notifications and the Shop hides and returns.

## Rollout

1. Apply `add_selling_setup.sql` through the Supabase connector after confirming the three columns do not already exist.
2. Merge and deploy.
3. The site owner runs the signed-in checks above.
