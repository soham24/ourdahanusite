# Shop Checkout Flow Redesign

**Date:** 2026-08-02
**Status:** Design approved, ready for implementation plan

## Summary

The "Buy now" flow in the Shop section of business pages (e.g.
`organic.ourdahanu.in`) renders its checkout modal inconsistently — sometimes
clipped inside the product card, sometimes fullscreen — with a visible flicker
between the two. The root cause is a CSS containing-block capture, proven by
measurement (below), not a styling accident that can be patched with z-index.

This plan replaces the in-card modal with a dedicated `/checkout/[productId]`
route, which makes the entire bug class structurally impossible, and redesigns
the checkout UI around the fact that buyers are always signed in. It also
repairs the sign-in return path, which currently strands buyers on the apex
domain, and hardens an open redirect that the new flow depends on.

## Verified findings (measured against the live site before writing this spec)

`BuyButton` renders its overlay as a DOM descendant of the product card:

```
<article class="od-card od-card-hover ... overflow-hidden">   ← ProductCard
  ...
  <div class="fixed inset-0 z-50 ...">                        ← BuyButton modal
```

`.od-card-hover:hover` applies `transform: translateY(-2px)`
(`src/app/globals.css:132-136`). A CSS transform makes that element the
**containing block** for `position: fixed` descendants, and the card's
`overflow-hidden` then clips the result.

Measured on `https://organic.ourdahanu.in`, same element, same overlay:

| Card state | Overlay rect |
| --- | --- |
| Not hovered | 304 × 681 at (0, 0) — correct fullscreen |
| Hovered (`translateY(-2px)`) | 221 × 405 at (41, **−127**) — trapped in the card, partly off-screen |

The cursor is necessarily over the card when "Buy now" is clicked, so the modal
**always opens in the broken state**. Moving the pointer away un-hovers the
card and the overlay snaps to fullscreen. Because `.od-card-hover` transitions
`transform` over 180ms, that snap animates — this is the reported flicker.

An ancestor scan confirmed this hover transform is the **only** containing-block
trigger on the path from the card to `<html>`; no other ancestor sets
`transform`, `filter`, `perspective`, `contain`, `will-change`, or
`backdrop-filter`.

Five further defects found in the same flow:

1. **No scroll lock** — the page scrolls behind the open modal.
2. **No focus trap and no `role="dialog"`/`aria-modal`** — keyboard and
   screen-reader users can reach the page behind the overlay.
3. **Razorpay stacks a second overlay** over ours; dismissing it (`ondismiss`
   sets `status: 'idle'`) leaves our modal open underneath.
4. **Sign-in dead-ends.** `loginHref` is
   `https://ourdahanu.in/login?next=/listings/<uuid>`
   (`src/app/listings/[id]/page.tsx:268`), so the buyer lands on the apex
   listing URL having lost the subdomain, the product, and the intent to buy.
5. **The recovery link is unclickable plain text.** On the worst path — payment
   captured but order save failed — `BuyButton.tsx:196-198` builds
   `"... click here to recover: <url>"` and renders it inside a `<div>`. There
   is no anchor. Meanwhile the Pay button still reads "Pay ₹450", inviting a
   double charge. The target page (`/payments/recover/[orderId]`) already exists
   and works; it is simply unreachable.

`OrderModal` (Services section) shares the Razorpay/recovery logic but is
rendered outside the card grid, so it does **not** have the containing-block
bug. It is out of scope here.

## Goals

- Clicking "Buy now" reliably opens a stable checkout — no flicker, no clipping,
  no dependence on pointer position.
- Checkout fits one mobile screen with the Pay button visible without scrolling.
- Signing in from a product returns the buyer to that product's checkout on the
  same subdomain.
- The payment-captured-but-save-failed path reassures the buyer, shows a
  tappable payment reference, and offers a working recovery action.
- No double-charge affordance: the Pay button never remains active after a
  successful capture.

## Non-Goals (YAGNI)

- No changes to `OrderModal` or the Services section, and no unification of the
  two checkout implementations. (Explicitly deferred; noted below as known
  duplication.)
- No buy button on the standalone `/p/[productId]` page.
- No cart, no multi-item checkout, no saved addresses, no guest checkout.
- No changes to `/api/razorpay/create-marketplace-order`, `placeMarketplaceOrder`,
  or the `payment-retry` helpers — all reused as-is.
- No redesign of the product cards themselves. `.od-card-hover` stays exactly as
  it is; the fix is to stop rendering a fixed overlay inside it, not to remove
  the hover effect.

## Design

### Route structure

Two new files under `src/app/checkout/[productId]/`:

**`page.tsx`** — server component.
Reads `productId`, fetches the product and its listing (reusing
`fetchProductAndListing` from `src/lib/data/product-detail.ts`), reads the
viewer via `createClient()` from `@/lib/supabase/server`, and then:

- product or listing missing → `notFound()`
- not signed in → `redirect('/login?next=/checkout/<productId>')`
- `quantity_in_stock === 0` → render a "Sold out" state with a link back to the
  business page (no form)
- otherwise → render `<CheckoutForm>` with product, listing name, and prefilled
  `userName` / `userPhone` / `userEmail`

The page reads auth cookies, so it is dynamic automatically; no explicit
`dynamic` export is needed.

**`CheckoutForm.tsx`** — client component. Owns the Express UI, the Razorpay
call, and the four states. This is where the logic currently inside
`BuyButton.tsx` moves, minus all the overlay markup.

### Proxy

`/checkout/:path*` must be added to the matcher array in `src/proxy.ts`, using
the same `has` host-regex block already used for `/p/:path*` and `/s/:path*`, so
the business subdomain sets `x-subdomain` for the route. Per the existing
comment in that file, the matcher entries must stay pure inline literals — copy
the regex verbatim rather than extracting it to a constant.

### The product card button

`BuyButton.tsx` loses its modal entirely and becomes a link:

- signed out → `<Link href={`/login?next=/checkout/${id}`}>Sign in to buy</Link>`
- signed in → `<Link href={`/checkout/${id}`}>Buy now</Link>` (or "Book now"
  for `type === 'service'`)
- sold out / disabled → unchanged disabled button

Keeping the "Sign in to buy" label preserves today's honesty about what the tap
will do. The checkout page also guards server-side, so a direct URL visit while
signed out still redirects correctly.

Because no `position: fixed` element is rendered inside the card any more, the
containing-block bug cannot recur — including for any future card that gains a
hover transform.

### Checkout UI — "Express" layout

One screen, no scrolling, sticky footer. Top to bottom:

1. **Product strip** — thumbnail, name, business name, unit price.
2. **Quantity** — `−` / value / `+` stepper, capped at `quantity_in_stock`, with
   "N available" when stock is tracked.
3. **Your details** — a single summary row reading `{name} · {phone}` with an
   "Edit" affordance that expands to the two inputs. Collapsed by default
   because the buyer is signed in and these are already known.
4. **Deliver to** — address input, shown only for `type === 'product'`.
5. **Add a note for the seller** — collapsed row; expands to a textarea.
6. **Trust line** — "Payment goes straight to {business}".
7. **Sticky footer** — total on the left, `Pay ₹X` on the right.

Mobile input hygiene, currently missing: `inputMode="numeric"` and
`autoComplete="tel"` on phone, `autoComplete="name"` on name,
`autoComplete="street-address"` on address.

Validation matches today's rules (non-empty name; 10 digits after stripping
non-digits) but renders errors inline against the offending field rather than as
a banner at the top of the form.

### States

**1 · Paying** (`ordering` → `paying` → `submitting`)
Form fields lock. Footer button becomes a non-interactive "Please wait…". The
page stays put behind Razorpay's own overlay — since checkout is a plain page,
there is no second overlay of ours underneath it. If the buyer dismisses
Razorpay, the form unlocks and returns to idle.

**2 · Success**
Replaces the form with a confirmation: order reference, line item, amount, who
was paid, and two exits — "View my order" and "Back to {business}". No dead-end
"Close".

`placeMarketplaceOrder` returns `{ orderId }`, and the `orders` table has no
human-friendly order-number column — only a `uuid` primary key (verified
against the live schema). Rather than add one (scope creep), the reference is
rendered as the first 8 characters of that UUID, uppercased, e.g. `4B9EF2A1`,
labelled "Reference". "View my order" links to `/account/orders/<orderId>`,
which already exists; both it and `/account/orders` resolve on the subdomain
(verified: `GET /account/orders` returns 200 on `organic.ourdahanu.in`).

**3 · Paid, save failed** — the critical path.
Leads with reassurance ("Your money reached {business} safely"), states plainly
that the order could not be saved, and shows the payment ID in a selectable
monospace block. Two real actions:

- **"Finish my order →"** — a genuine `<Link>` to `recoveryUrlFor(orderId)`,
  replacing today's unclickable text.
- **"Copy reference & WhatsApp seller"** — copies the payment ID and opens
  `wa.me` with a prefilled message, when the listing has a WhatsApp number.

The Pay button is **removed** in this state, not merely disabled, so there is no
double-charge affordance.

**4 · Validation / pre-payment errors**
Inline against the field. The Pay button stays available, since nothing has been
charged.

### Auth redirect repair

`src/app/login/page.tsx:34-36` currently discards the requested path on
subdomains:

```ts
const next = isSubdomain
  ? window.location.origin                      // drops ?next=
  : (searchParams.get('next') || '/')
```

becomes:

```ts
const next = isSubdomain
  ? window.location.origin + (searchParams.get('next') || '/')
  : (searchParams.get('next') || '/')
```

`/auth/callback` already accepts absolute URLs
(`src/app/auth/callback/route.ts:36-37`), so no change is needed there for the
redirect itself.

### Open-redirect hardening

`src/app/auth/callback/route.ts:36-38` redirects to any absolute URL supplied as
`next`, so `…/auth/callback?next=https://evil.com` is an open redirect usable
for phishing. This is pre-existing, but the checkout sign-in flow now depends on
this path, so it is fixed here.

`next` is accepted only when it is either:

- a relative path beginning with a single `/` (not `//`, which browsers treat as
  protocol-relative), or
- an absolute `https://` URL whose hostname is `ourdahanu.in` or ends with
  `.ourdahanu.in`

Anything else falls back to `origin`. Parse with `new URL()` inside a
`try`/`catch` and treat a parse failure as rejection.

## Known duplication (accepted, not addressed)

`BuyButton`/`CheckoutForm` and `OrderModal` will still carry near-identical
Razorpay and recovery logic. Unifying them was explicitly scoped out. The
recovery-link and double-charge defects described above **also exist in
`OrderModal`** (`src/components/OrderModal.tsx:154-158`) and remain there after
this work. Worth a follow-up.

## Testing

No test framework in this project — verification is `npx tsc --noEmit`,
`npx eslint <touched files>`, `npm run build`, plus live verification against a
running dev server on a business subdomain with marketplace products.

Regression checks, all against `<subdomain>.localhost:3000`:

- **The original bug:** open the Shop section, hover a product card, click
  "Buy now". Checkout must render as a full page with no flicker and no
  clipping. Repeat while moving the pointer off the card mid-navigation — the
  result must be identical.
- **Containing-block proof:** confirm no `position: fixed` element is rendered
  inside `article[id^=product-]` at any point in the flow.
- **Sign-in return:** signed out, click "Sign in to buy" on a product; after
  Google auth, land on `<subdomain>.localhost:3000/checkout/<productId>` — the
  same subdomain, the same product — not the apex listing page.
- **Open redirect:** `/auth/callback?next=https://example.com` must redirect to
  `origin`, not to `example.com`. `/auth/callback?next=//example.com` likewise.
  `/auth/callback?next=/account/orders` must still work, as must
  `next=https://organic.ourdahanu.in/checkout/<id>`.
- **Sold out:** a product with `quantity_in_stock = 0` must render the sold-out
  state and never the form, both from the card and by direct URL.
- **Quantity cap:** the `+` stepper must stop at `quantity_in_stock`.
- **Recovery state:** force a `placeMarketplaceOrder` failure after a successful
  test payment; confirm "Finish my order" is a real anchor pointing at
  `/payments/recover/<orderId>`, the payment ID is selectable, and no Pay button
  remains on screen.
- **Prefill and keyboards:** name and phone arrive prefilled and collapsed; the
  phone field raises a numeric keypad.
- **Success exits:** the reference shown matches the first 8 characters of the
  returned `orderId`, and "View my order" resolves to a real order page rather
  than 404ing.
- **Untouched paths:** the Services section's own order flow and the
  `/p/[productId]` page must behave exactly as before.
