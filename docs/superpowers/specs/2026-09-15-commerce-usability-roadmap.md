# Commerce Usability Roadmap

**Date:** 2026-09-15
**Status:** Decisions agreed with the site owner. Piece 1 has its own spec; pieces 2–4 each get their own spec before they are built.

## Why

The shop lets a business sell items and take payment straight into its own Razorpay account. It works, but it is hard to use on both sides. The goal is for owners and customers to find it effortless.

Live data on 2026-09-15:

| Measure | Count |
|---|---|
| Approved businesses | 65 |
| Allowed to take payments (`payments_enabled`) | 3 |
| Razorpay keys saved / verified | 2 / 1 |
| Shop items (`listing_products`) | 4, across 2 businesses |
| Shop orders | 3, all still `confirmed` (never updated by the owner) |
| Businesses using the old "Services & Products" list | 20 (87 items) |

## Review findings

### Business owners

1. Setup is spread over three separate cards and pages on My Business (Orders, Products & Services, Accept Payments), with no sign of what is done or what comes next.
2. An admin must switch on payments before the owner can do anything, and the owner has no way to ask ("Ask an admin to enable payments").
3. Connecting Razorpay means pasting an API Key ID and Secret with little guidance. A "test mode" checkbox duplicates what the key prefix already says, and there is no way to try a purchase.
4. There are two unrelated item lists: the old `listings.services` JSON (edited in the listing form, WhatsApp only) and `listing_products` (the Shop).
5. The item manager reloads the page after every save, drag-to-reorder does not work on phones, a ₹0 price is accepted but checkout then fails ("Minimum order amount is ₹1"), and there is no preview.
6. The Orders page shows three badges per order, including one for an unused "UPI via OurDahanu" flow. "Pending" and "Confirmed" mean the same thing. Owners can call but not WhatsApp the buyer, and cancelling says nothing about refunds.

### Customers

1. The business page has two look-alike sections: "Services & Products" (WhatsApp) and "Shop" (pay online).
2. A shared item link (`/p/[productId]`) offers only "Order on WhatsApp", even when the business takes payments.
3. Buyers must sign in with Google before they can see the checkout form.
4. Checkout covers one item per payment.
5. The delivery address is a single optional line. There is no delivery or pickup choice and no delivery fee.
6. After paying, the buyer is told the seller "will contact you to confirm" while the order already says "Confirmed". "Fulfilled" is jargon, and a cancelled order only says "contact the business" about refunds.
7. A business connected with Razorpay test keys shows its Shop to the public, so a real customer could complete a checkout that moves no money.

### Visual consistency

Owner pages use hard-coded colours and older grey utility styles. The public pages use the `od-` design system. Each piece below redesigns the screens it touches in the design system, so no screen is redesigned twice.

## Decisions

| Topic | Decision |
|---|---|
| Item lists | Merge into one catalog; the 20 old lists are copied across automatically |
| Payments gate | Self-serve for any approved business; admins can suspend |
| Buyer sign-in | Checkout is open to everyone; Google sign-in happens at Pay and returns the buyer with everything filled in |
| Multiple items | One basket per business, one payment per basket |
| Delivery | Each business offers Pickup and/or Delivery; delivery has a flat fee, optional free-above amount, optional minimum order and an area note. Reuses `listing_delivery_config`; its per-km and radius columns stay unused |
| Order tracking | New → Accepted → Ready for pickup / Out for delivery → Completed, with "Cancel & refund" through the owner's Razorpay account |
| Item options | Up to 6 options per item, each with its own price and optional stock |
| Sequencing | Four separate pieces, each with its own spec, plan and PR, in the order below |

## The four pieces

### 1. Selling setup — spec: `2026-09-15-selling-setup-design.md`

Self-serve payments, guided Razorpay connection, test mode that is invisible to the public, practice purchases with labelled test orders, one "Sell online" checklist on My Business, admin suspend, and never losing a paid order.

### 2. One catalog

- Copy every `listings.services` item into `listing_products`, keeping name, description, image and image aspect.
- Prices: plain numbers become `price_paise`. Items with no price, or text prices ("180 per 250 grams", "3000 and above", "Price on request"), keep the text as a price note and cannot be bought online until the owner sets a fixed price. Of 87 old items, 41 have plain number prices, 32 have none and about 14 are text.
- Item options (up to 6, each with price and optional stock).
- One section on the business page: each item shows Buy when the business is live, otherwise WhatsApp.
- `/p/[productId]` shows Buy when the business is live. Old `/s/[index]` links keep working by redirecting to the copied item.
- Item manager: no page reloads, move up/down buttons that work on phones, a minimum price of ₹1 for items sold online, and a preview of the customer's view.
- The listing submit and edit forms stop editing the old list and point to the item manager. The old column stays in the database until the mobile app no longer reads it.

### 3. Basket and checkout

- "Add" on each item and a basket bar on that business's page; one checkout and one payment per basket. Baskets never mix businesses.
- Checkout opens without sign-in; Google sign-in at Pay returns the buyer to the same checkout with the basket, delivery choice and details intact.
- Pickup or Delivery chosen at checkout; address required only for delivery; delivery fee, free-above and minimum order applied from `listing_delivery_config`.
- Orders hold several line items (new `order_items` table; `orders` keeps the totals).

### 4. Orders and refunds

- Steps: New → Accepted → Ready for pickup or Out for delivery → Completed, plus Cancelled. Each step notifies the customer.
- Owner Orders screen: one clear status, one large button for the next step, WhatsApp and call buttons for the buyer, new orders first.
- "Cancel & refund" refunds through the owner's Razorpay account in the same action and records the refund.
- Customer order page: a simple progress tracker, pickup or delivery details, and contact buttons.

## Constraints that apply to every piece

- Supabase is live production. Migrations are additive and idempotent, applied through the Supabase connector after a pre-check. Never delete rows we did not create.
- Money goes straight to the business's own Razorpay account; OurDahanu never holds it. Refunds are between buyer and seller, as the Terms already say.
- The mobile app's existing endpoints (`/api/v1/orders`, `/api/razorpay/create-*-order`) keep working until the app is updated.
- Telegram notification delivery is not changed.
- `/shop` (currently a "coming soon" page) is out of scope for all four pieces.
