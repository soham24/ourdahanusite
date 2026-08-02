# Shop Checkout Flow Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the flickering in-card "Buy now" modal with a dedicated `/checkout/[productId]` route, and repair the sign-in return path and the payment-recovery dead-end that surround it.

**Architecture:** The flicker is caused by the product card's `.od-card-hover` transform capturing the modal's `position: fixed` overlay as its containing block. Rather than defend against that with portals, we move checkout to a real route, where the bug is structurally impossible. The card button becomes a plain `<Link>`. Payment logic (Razorpay, `payment-retry` helpers, the order server action) is reused unchanged; only its host component moves.

**Tech Stack:** Next.js 16.2.1 App Router, React 19.2.4, TypeScript, Tailwind, Supabase, Razorpay Checkout. Tests: `node:test` + `node:assert/strict`, run via `tsx --test`.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-08-02-shop-checkout-redesign-design.md`. Read it before starting.
- Do **not** modify `src/components/OrderModal.tsx`, `src/app/listings/[id]/ServicesSection.tsx`, or `src/app/p/[productId]/page.tsx`. Explicitly out of scope.
- Do **not** change `.od-card-hover` in `src/app/globals.css`. The hover effect stays; we stop rendering fixed overlays inside cards.
- Do **not** modify `src/app/api/razorpay/create-marketplace-order/route.ts`, `src/app/actions/marketplace-orders.ts`, or `src/lib/payment-retry.ts`. Reuse as-is.
- No new npm dependencies.
- Brand colour for the Razorpay theme is exactly `#C4663A` (unchanged from current code).
- Currency display uses `₹${(paise / 100).toLocaleString('en-IN')}` — match existing formatting exactly.
- `src/proxy.ts`'s `export const config` must contain **pure inline literals only**. Copy the host regex verbatim; never extract it to a variable (Next's `extractExportedConstValue` cannot resolve references and the build fails).
- Verification for every task: `npx tsc --noEmit`, `npx eslint <touched files>`, and `npm run build` must all pass clean.
- Manual verification uses a business subdomain on the dev server: `http://organic.localhost:3000`. Start it with the Browser pane's `preview_start` (never `npm run dev` via a shell tool).

## File Structure

| File | Responsibility |
| --- | --- |
| `src/lib/safe-redirect.ts` *(new)* | Pure function deciding whether an OAuth `next` value is safe to redirect to |
| `src/lib/safe-redirect.test.ts` *(new)* | `node:test` unit tests for the above |
| `src/app/auth/callback/route.ts` *(modify)* | Use the safe resolver instead of trusting `next` |
| `src/app/login/page.tsx` *(modify)* | Stop discarding `?next=` on business subdomains |
| `src/proxy.ts` *(modify)* | Add `/checkout/:path*` to the subdomain matcher |
| `src/app/checkout/[productId]/page.tsx` *(new)* | Server component: fetch, auth gate, sold-out guard |
| `src/app/checkout/[productId]/CheckoutForm.tsx` *(new)* | Client component: Express UI, Razorpay, four states |
| `src/components/BuyButton.tsx` *(modify)* | Shrinks from modal host to a link |
| `src/app/listings/[id]/components/ListingContent.tsx` *(modify)* | Update `BuyButton` call site for its new props |

---

### Task 1: Safe redirect resolver + auth fixes

Closes the open redirect in `/auth/callback` and stops `/login` throwing away the requested path on subdomains. Independent of checkout — nothing here depends on later tasks.

**Files:**
- Create: `src/lib/safe-redirect.ts`
- Create: `src/lib/safe-redirect.test.ts`
- Modify: `package.json` (add the new test file to `test:existing`)
- Modify: `src/app/auth/callback/route.ts:35-38`
- Modify: `src/app/login/page.tsx:34-36`

**Interfaces:**
- Consumes: nothing from other tasks.
- Produces: `resolveSafeRedirect(next: string | null, origin: string): string` — returns an absolute URL string that is always safe to pass to `NextResponse.redirect`. Task 2's login link relies on the `/login` fix landing here.

- [ ] **Step 1: Write the failing test**

Create `src/lib/safe-redirect.test.ts`:

```ts
import assert from 'node:assert/strict'
import test from 'node:test'
import { resolveSafeRedirect } from './safe-redirect'

const ORIGIN = 'https://ourdahanu.in'

test('relative paths resolve against the origin', () => {
  assert.equal(resolveSafeRedirect('/account/orders', ORIGIN), 'https://ourdahanu.in/account/orders')
})

test('null and empty fall back to the origin root', () => {
  assert.equal(resolveSafeRedirect(null, ORIGIN), 'https://ourdahanu.in/')
  assert.equal(resolveSafeRedirect('', ORIGIN), 'https://ourdahanu.in/')
})

test('apex and business subdomains are allowed', () => {
  assert.equal(
    resolveSafeRedirect('https://organic.ourdahanu.in/checkout/abc', ORIGIN),
    'https://organic.ourdahanu.in/checkout/abc',
  )
  assert.equal(resolveSafeRedirect('https://ourdahanu.in/shop', ORIGIN), 'https://ourdahanu.in/shop')
})

test('foreign hosts are rejected', () => {
  assert.equal(resolveSafeRedirect('https://evil.com', ORIGIN), 'https://ourdahanu.in/')
  assert.equal(resolveSafeRedirect('https://evil.com/x', ORIGIN), 'https://ourdahanu.in/')
})

test('lookalike hosts that merely end in the brand are rejected', () => {
  assert.equal(resolveSafeRedirect('https://notourdahanu.in', ORIGIN), 'https://ourdahanu.in/')
  assert.equal(resolveSafeRedirect('https://ourdahanu.in.evil.com', ORIGIN), 'https://ourdahanu.in/')
})

test('protocol-relative URLs are rejected', () => {
  assert.equal(resolveSafeRedirect('//evil.com', ORIGIN), 'https://ourdahanu.in/')
  assert.equal(resolveSafeRedirect('//evil.com/path', ORIGIN), 'https://ourdahanu.in/')
})

test('non-https schemes are rejected', () => {
  assert.equal(resolveSafeRedirect('javascript:alert(1)', ORIGIN), 'https://ourdahanu.in/')
  assert.equal(resolveSafeRedirect('http://ourdahanu.in/x', ORIGIN), 'https://ourdahanu.in/')
})

test('unparseable input falls back to the origin root', () => {
  assert.equal(resolveSafeRedirect('http://[', ORIGIN), 'https://ourdahanu.in/')
})

test('localhost subdomains are allowed so dev sign-in works', () => {
  const devOrigin = 'http://localhost:3000'
  assert.equal(
    resolveSafeRedirect('http://organic.localhost:3000/checkout/abc', devOrigin),
    'http://organic.localhost:3000/checkout/abc',
  )
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx tsx --test src/lib/safe-redirect.test.ts`
Expected: FAIL — cannot find module `./safe-redirect`.

- [ ] **Step 3: Write the implementation**

Create `src/lib/safe-redirect.ts`:

```ts
/**
 * Decide where an OAuth callback is allowed to send the browser.
 *
 * `next` arrives from a query string, so it is attacker-controlled: without
 * this gate, /auth/callback?next=https://evil.com is an open redirect that
 * can be used to phish OurDahanu users with a genuine ourdahanu.in link.
 *
 * Allowed:
 *   - relative paths beginning with a single '/'
 *   - https URLs on ourdahanu.in or any *.ourdahanu.in subdomain
 *   - localhost (any port, any subdomain) so local dev sign-in works
 * Everything else falls back to the origin root.
 */
export function resolveSafeRedirect(next: string | null, origin: string): string {
  const fallback = new URL('/', origin).toString()
  if (!next) return fallback

  // '//evil.com' is protocol-relative — the browser treats it as a foreign
  // host, so it must not be mistaken for a relative path.
  if (next.startsWith('//')) return fallback

  if (next.startsWith('/')) {
    try {
      return new URL(next, origin).toString()
    } catch {
      return fallback
    }
  }

  let parsed: URL
  try {
    parsed = new URL(next)
  } catch {
    return fallback
  }

  const host = parsed.hostname.toLowerCase()
  const isLocalhost = host === 'localhost' || host.endsWith('.localhost')

  // Only https off-localhost: http would let a network attacker strip TLS.
  if (parsed.protocol !== (isLocalhost ? 'http:' : 'https:')) return fallback

  // Note the leading dot on the suffix check: 'notourdahanu.in' and
  // 'ourdahanu.in.evil.com' must both fail.
  const isOurDomain = host === 'ourdahanu.in' || host.endsWith('.ourdahanu.in')
  if (!isOurDomain && !isLocalhost) return fallback

  return parsed.toString()
}
```

- [ ] **Step 4: Register the test file and run it**

In `package.json`, extend the `test:existing` script so the new file runs with the others. Change:

```json
"test:existing": "tsx --test src/app/actions/find-notifications.test.ts src/lib/find/safe-submission.test.ts src/lib/supabase/auth-regression.test.ts",
```

to:

```json
"test:existing": "tsx --test src/app/actions/find-notifications.test.ts src/lib/find/safe-submission.test.ts src/lib/supabase/auth-regression.test.ts src/lib/safe-redirect.test.ts",
```

Run: `npm run test:existing`
Expected: PASS — all suites green, including 9 new `safe-redirect` tests.

- [ ] **Step 5: Use the resolver in the auth callback**

In `src/app/auth/callback/route.ts`, add the import at the top alongside the existing imports:

```ts
import { resolveSafeRedirect } from '@/lib/safe-redirect'
```

Then replace these three lines (currently 35-38):

```ts
      // next may be a full URL (e.g. https://abcd.ourdahanu.in) or a path (e.g. /dashboard)
      const isFullUrl = next.startsWith('https://') || next.startsWith('http://')
      const redirectUrl = isFullUrl ? next : `${origin}${next}`
      return NextResponse.redirect(redirectUrl)
```

with:

```ts
      // `next` is attacker-controlled query input — resolveSafeRedirect keeps
      // it to our own domains so this cannot become an open redirect.
      return NextResponse.redirect(resolveSafeRedirect(next, origin))
```

- [ ] **Step 6: Preserve the path on subdomain sign-in**

In `src/app/login/page.tsx`, replace lines 33-36:

```ts
    // After auth, redirect back to where user came from (subdomain or next param)
    const next = isSubdomain
      ? window.location.origin
      : (searchParams.get('next') || '/')
```

with:

```ts
    // After auth, redirect back to where the user came from. On a business
    // subdomain the callback runs on the apex, so `next` must be absolute —
    // but it still has to keep the path, or a buyer signing in from a product
    // lands on the shop root instead of their checkout.
    const next = isSubdomain
      ? window.location.origin + (searchParams.get('next') || '/')
      : (searchParams.get('next') || '/')
```

- [ ] **Step 7: Verify the whole task**

Run each and confirm clean:

```bash
npx tsc --noEmit
```

```bash
npx eslint src/lib/safe-redirect.ts src/lib/safe-redirect.test.ts src/app/auth/callback/route.ts src/app/login/page.tsx
```

```bash
npm run test:existing
```

Expected: no type errors, no lint output, all tests pass.

- [ ] **Step 8: Commit**

```bash
git add src/lib/safe-redirect.ts src/lib/safe-redirect.test.ts package.json src/app/auth/callback/route.ts src/app/login/page.tsx
git commit -m "fix(auth): close open redirect in callback and keep ?next= on subdomain login"
```

---

### Task 2: Checkout route — server page and guards

Creates the route with all its server-side guards, rendering a read-only summary. No interactivity yet, so this task is reviewable on its guard behaviour alone.

**Files:**
- Modify: `src/proxy.ts` (matcher array, after the `/s/:path*` entry ending at line 121)
- Create: `src/app/checkout/[productId]/page.tsx`

**Interfaces:**
- Consumes: `fetchProductAndListing(productId)` from `@/lib/data/product-detail`, returning `{ product: StandaloneProduct, listing: StandaloneProductListing | null } | null`; `getCanonicalListingUrl(id, subdomain)` from `@/lib/listing-url`.
- Produces: the route `/checkout/<productId>`, and the prop contract Task 3 implements:
  ```ts
  interface CheckoutFormProps {
    product: { id: string; name: string; pricePaise: number; quantityInStock: number | null; type: 'product' | 'service'; imageUrl: string | null }
    listing: { id: string; name: string; whatsapp: string | null }
    businessUrl: string
    buyerName: string
    buyerPhone: string
    buyerEmail: string
  }
  ```

- [ ] **Step 1: Add the checkout matcher to the proxy**

In `src/proxy.ts`, insert this object into the `config.matcher` array immediately after the `/s/:path*` entry (which closes at line 121) and before the `find.ourdahanu.in` entry. The host regex is copied verbatim from the neighbouring entries — do not refactor it into a constant, or the build will fail with "Invalid segment configuration export detected".

```ts
    {
      // Checkout pages — middleware sets the x-subdomain header for parity
      // with /p and /s. The page itself resolves everything from productId,
      // so nothing reads this header today; it is here so subdomain context
      // is available if checkout ever needs it.
      source: '/checkout/:path*',
      has: [
        {
          type: 'header',
          key: 'host',
          value:
            '(?!(?:www|admin|api|app|mail|shop|news|events|jobs|forum|classifieds|emergency|dashboard|login|profile|search|about|listings|my-business|offline|auth|static|assets|media|cdn|find)\\.)(?:[^.]+\\.ourdahanu\\.in|[^.]+\\.localhost(?::\\d+)?)',
        },
      ],
    },
```

- [ ] **Step 2: Create the server page**

Create `src/app/checkout/[productId]/page.tsx`:

```tsx
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import type { Metadata } from 'next'
import { ArrowLeft, PackageX } from 'lucide-react'

import { fetchProductAndListing } from '@/lib/data/product-detail'
import { getCanonicalListingUrl } from '@/lib/listing-url'
import { createClient } from '@/lib/supabase/server'
import CheckoutForm from './CheckoutForm'

// Checkout is per-buyer and must never be cached or indexed.
export const metadata: Metadata = {
  title: 'Checkout',
  robots: { index: false, follow: false },
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

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, phone')
    .eq('id', user.id)
    .maybeSingle()

  const businessUrl = getCanonicalListingUrl(String(listing.id), listing.subdomain)

  if (product.quantity_in_stock === 0) {
    return (
      <div className="mx-auto flex min-h-[70vh] max-w-md flex-col items-center justify-center gap-4 px-4 text-center">
        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-[var(--color-surface-soft)] text-[var(--od-muted)]">
          <PackageX size={30} aria-hidden />
        </span>
        <h1 className="font-display text-2xl">Sold out</h1>
        <p className="max-w-xs text-sm leading-relaxed text-[var(--od-muted)]">
          {product.name} is out of stock right now. {listing.name} may restock it soon.
        </p>
        <Link href={businessUrl} className="od-button-primary mt-1 px-4 py-2 text-sm">
          Back to {listing.name}
        </Link>
      </div>
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
      />
    </div>
  )
}
```

- [ ] **Step 3: Create a temporary CheckoutForm stub so the route compiles**

Task 3 replaces this entirely. It exists only so this task is independently buildable and its guards testable.

Create `src/app/checkout/[productId]/CheckoutForm.tsx`:

```tsx
'use client'

export interface CheckoutFormProps {
  product: {
    id: string
    name: string
    pricePaise: number
    quantityInStock: number | null
    type: 'product' | 'service'
    imageUrl: string | null
  }
  listing: { id: string; name: string; whatsapp: string | null }
  businessUrl: string
  buyerName: string
  buyerPhone: string
  buyerEmail: string
}

export default function CheckoutForm({ product, listing }: CheckoutFormProps) {
  return (
    <div className="od-card p-4">
      <p className="text-sm font-semibold text-[var(--od-ink)]">{product.name}</p>
      <p className="mt-0.5 text-lg font-bold text-[var(--od-brand)]">
        ₹{(product.pricePaise / 100).toLocaleString('en-IN')}
      </p>
      <p className="mt-0.5 text-xs text-[var(--od-muted)]">from {listing.name}</p>
    </div>
  )
}
```

- [ ] **Step 4: Verify build and types**

```bash
npx tsc --noEmit
```

```bash
npx eslint "src/app/checkout/[productId]/page.tsx" "src/app/checkout/[productId]/CheckoutForm.tsx" src/proxy.ts
```

```bash
npm run build
```

Expected: all clean. The build route table must list `/checkout/[productId]`. If the build instead fails with "Invalid segment configuration export detected", the proxy matcher regex was extracted to a variable — inline it.

- [ ] **Step 5: Verify the guards in a browser**

Start the dev server via the Browser pane (`preview_start` with the `dev` config), then check each guard. Get a real product id first:

```bash
node -e "console.log('open http://organic.localhost:3000 and copy a product id from an article[id^=product-]')"
```

- Signed out, visit `http://organic.localhost:3000/checkout/<productId>` → must redirect to `/login?next=%2Fcheckout%2F<productId>`.
- Signed in, same URL → renders the product name, price, and "from {business}", with a back link to the business page.

> **Expected in local dev:** `getCanonicalListingUrl` always returns the production URL (`https://organic.ourdahanu.in`), so the "back to business" link points at the live site even on localhost. This is pre-existing behaviour shared with `/p/[productId]` — do not "fix" it. Verify the link's `href` is correct rather than clicking it.
- Visit `http://organic.localhost:3000/checkout/00000000-0000-0000-0000-000000000000` → 404 page.
- Confirm the page's `<meta name="robots">` is `noindex, nofollow`.

- [ ] **Step 6: Commit**

```bash
git add "src/app/checkout/[productId]/page.tsx" "src/app/checkout/[productId]/CheckoutForm.tsx" src/proxy.ts
git commit -m "feat(checkout): add /checkout/[productId] route with auth and stock guards"
```

---

### Task 3: Express checkout UI

Replaces the stub with the full Express layout and validation. Still no payment — the Pay button validates and does nothing else, so this task is reviewable purely as UI.

**Files:**
- Modify: `src/app/checkout/[productId]/CheckoutForm.tsx` (full rewrite of the Task 2 stub)

**Interfaces:**
- Consumes: `CheckoutFormProps` exactly as defined in Task 2.
- Produces: the component internals Task 4 extends — state variables `quantity`, `buyerName`, `buyerPhone`, `deliveryAddress`, `notes`, `fieldError`, and a `handlePay()` function that Task 4 fills in with the Razorpay call.

- [ ] **Step 1: Rewrite CheckoutForm with the Express layout**

Replace the entire contents of `src/app/checkout/[productId]/CheckoutForm.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { Minus, Pencil, Plus, Package, ShieldCheck, Wrench } from 'lucide-react'

export interface CheckoutFormProps {
  product: {
    id: string
    name: string
    pricePaise: number
    quantityInStock: number | null
    type: 'product' | 'service'
    imageUrl: string | null
  }
  listing: { id: string; name: string; whatsapp: string | null }
  businessUrl: string
  buyerName: string
  buyerPhone: string
  buyerEmail: string
}

const inputCls =
  'w-full rounded-xl border border-[var(--od-border)] px-3.5 py-2.5 text-sm text-[var(--od-ink)] focus:border-[var(--od-brand)] focus:outline-none disabled:bg-[var(--color-surface-soft)]'
const labelCls = 'mb-1.5 block text-[11px] font-bold uppercase tracking-[0.04em] text-[var(--od-muted)]'

export function formatInr(paise: number): string {
  return `₹${(paise / 100).toLocaleString('en-IN')}`
}

/** Ten digits after stripping separators — matches the previous BuyButton rule. */
export function isValidPhone(raw: string): boolean {
  return /^\d{10}$/.test(raw.replace(/\D/g, '').slice(-10))
}

export default function CheckoutForm({
  product,
  listing,
  buyerName: initialName,
  buyerPhone: initialPhone,
}: CheckoutFormProps) {
  const [quantity, setQuantity] = useState(1)
  const [buyerName, setBuyerName] = useState(initialName)
  const [buyerPhone, setBuyerPhone] = useState(initialPhone)
  const [deliveryAddress, setDeliveryAddress] = useState('')
  const [notes, setNotes] = useState('')
  const [detailsOpen, setDetailsOpen] = useState(!initialName || !isValidPhone(initialPhone))
  const [notesOpen, setNotesOpen] = useState(false)
  const [fieldError, setFieldError] = useState<{ field: 'name' | 'phone'; message: string } | null>(null)

  const isService = product.type === 'service'
  const maxQuantity = product.quantityInStock ?? 99
  const totalPaise = product.pricePaise * quantity
  const busy = false // Task 4 replaces this with real payment state

  const handlePay = () => {
    if (!buyerName.trim()) {
      setFieldError({ field: 'name', message: 'Please enter your name.' })
      setDetailsOpen(true)
      return
    }
    if (!isValidPhone(buyerPhone)) {
      setFieldError({ field: 'phone', message: 'Enter a valid 10-digit phone number.' })
      setDetailsOpen(true)
      return
    }
    setFieldError(null)
    // Task 4: start the Razorpay flow here.
  }

  return (
    <div className="flex min-h-[calc(100vh-8rem)] flex-col gap-3">
      {/* Product strip */}
      <div className="flex items-center gap-3 rounded-[14px] border border-[var(--od-border)] bg-[var(--color-surface-soft)] p-3">
        {product.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={product.imageUrl}
            alt=""
            aria-hidden
            className="h-12 w-12 shrink-0 rounded-[10px] object-cover"
          />
        ) : (
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[10px] bg-[#fdf7f0] text-[#c4a990]">
            {isService ? <Wrench size={20} aria-hidden /> : <Package size={20} aria-hidden />}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-extrabold text-[var(--od-ink)]">{product.name}</p>
          <p className="truncate text-[11px] text-[var(--od-muted)]">{listing.name}</p>
        </div>
        <p className="shrink-0 text-base font-extrabold text-[var(--od-brand)]">
          {formatInr(product.pricePaise)}
        </p>
      </div>

      {/* Quantity */}
      <div>
        <span className={labelCls}>Quantity</span>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setQuantity((q) => Math.max(1, q - 1))}
            disabled={quantity <= 1 || busy}
            aria-label="Decrease quantity"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--od-border)] text-[var(--od-ink-2)] transition-colors hover:border-[var(--od-brand)] hover:text-[var(--od-brand)] disabled:opacity-40"
          >
            <Minus size={14} aria-hidden />
          </button>
          <span className="w-6 text-center text-base font-bold tabular-nums text-[var(--od-ink)]">
            {quantity}
          </span>
          <button
            type="button"
            onClick={() => setQuantity((q) => Math.min(maxQuantity, q + 1))}
            disabled={quantity >= maxQuantity || busy}
            aria-label="Increase quantity"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--od-border)] text-[var(--od-ink-2)] transition-colors hover:border-[var(--od-brand)] hover:text-[var(--od-brand)] disabled:opacity-40"
          >
            <Plus size={14} aria-hidden />
          </button>
          {product.quantityInStock !== null && (
            <span className="ml-auto text-xs text-[var(--od-muted)]">
              {product.quantityInStock} available
            </span>
          )}
        </div>
      </div>

      {/* Your details — collapsed, because a signed-in buyer's are already known */}
      <div>
        <span className={labelCls}>Your details</span>
        {detailsOpen ? (
          <div className="space-y-2.5">
            <div>
              <input
                type="text"
                value={buyerName}
                onChange={(e) => setBuyerName(e.target.value)}
                disabled={busy}
                autoComplete="name"
                placeholder="Full name"
                aria-label="Your name"
                aria-invalid={fieldError?.field === 'name'}
                className={inputCls}
              />
              {fieldError?.field === 'name' && (
                <p className="mt-1 text-xs font-semibold text-[var(--color-danger-strong,#a33)]">
                  {fieldError.message}
                </p>
              )}
            </div>
            <div>
              <input
                type="tel"
                inputMode="numeric"
                value={buyerPhone}
                onChange={(e) => setBuyerPhone(e.target.value)}
                disabled={busy}
                autoComplete="tel"
                placeholder="10-digit mobile number"
                aria-label="Phone number"
                aria-invalid={fieldError?.field === 'phone'}
                className={inputCls}
              />
              {fieldError?.field === 'phone' && (
                <p className="mt-1 text-xs font-semibold text-[var(--color-danger-strong,#a33)]">
                  {fieldError.message}
                </p>
              )}
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setDetailsOpen(true)}
            className="flex w-full items-center justify-between gap-2 rounded-xl border border-[var(--od-border)] bg-white px-3.5 py-2.5 text-left transition-colors hover:border-[var(--od-brand)]"
          >
            <span className="min-w-0 truncate text-sm text-[var(--od-ink-2)]">
              {buyerName} · {buyerPhone}
            </span>
            <span className="flex shrink-0 items-center gap-1 text-[11px] font-bold text-[var(--od-brand)]">
              <Pencil size={11} aria-hidden /> Edit
            </span>
          </button>
        )}
      </div>

      {/* Delivery — products only */}
      {!isService && (
        <div>
          <span className={labelCls}>Deliver to</span>
          <input
            type="text"
            value={deliveryAddress}
            onChange={(e) => setDeliveryAddress(e.target.value)}
            disabled={busy}
            autoComplete="street-address"
            placeholder="Street, Village, Pincode"
            aria-label="Delivery address"
            className={inputCls}
          />
        </div>
      )}

      {/* Optional note */}
      {notesOpen ? (
        <div>
          <span className={labelCls}>Note for the seller</span>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            disabled={busy}
            rows={2}
            placeholder="Preferred time, size, colour…"
            aria-label="Note for the seller"
            className={`${inputCls} resize-none`}
          />
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setNotesOpen(true)}
          className="flex w-full items-center justify-between gap-2 rounded-xl border border-dashed border-[var(--od-border)] px-3.5 py-2.5 text-left text-sm text-[var(--od-muted)] transition-colors hover:border-[var(--od-brand)] hover:text-[var(--od-brand)]"
        >
          <span>Add a note for the seller</span>
          <span className="text-[11px] font-bold text-[var(--od-brand)]">Add</span>
        </button>
      )}

      <p className="mt-1 flex items-center justify-center gap-1.5 text-[11px] font-semibold text-[var(--color-success-strong)]">
        <ShieldCheck size={12} className="text-[var(--od-success)]" aria-hidden />
        Payment goes straight to {listing.name}
      </p>

      {/* Sticky footer */}
      <div className="sticky bottom-0 mt-auto -mx-4 flex items-center gap-3 border-t border-[var(--od-border)] bg-white px-4 py-3">
        <span>
          <span className="block text-[10px] font-semibold text-[var(--od-muted)]">Total</span>
          <span className="block text-lg font-extrabold tabular-nums text-[var(--od-ink)]">
            {formatInr(totalPaise)}
          </span>
        </span>
        <button
          type="button"
          onClick={handlePay}
          disabled={busy}
          className="od-button-primary flex-1 py-3 text-sm disabled:opacity-60"
        >
          Pay {formatInr(totalPaise)}
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify types and lint**

```bash
npx tsc --noEmit
```

```bash
npx eslint "src/app/checkout/[productId]/CheckoutForm.tsx"
```

Expected: both clean.

- [ ] **Step 3: Verify the UI in a browser**

With the dev server running and signed in, open `http://organic.localhost:3000/checkout/<productId>` at a mobile viewport (`resize_window` preset `mobile`) and confirm:

- The Pay button is visible **without scrolling** at 375×812.
- Name and phone are prefilled and shown collapsed as one `name · phone` row; tapping "Edit" expands two inputs.
- The `+` stepper stops at the product's stock count and the total updates with quantity.
- "Deliver to" is present for a `product` and **absent** for a `service`.
- "Add a note for the seller" expands into a textarea.
- Clearing the name and pressing Pay shows "Please enter your name." under the name field, not as a top banner.
- Entering `12345` as the phone and pressing Pay shows the 10-digit message under the phone field.
- Focusing the phone field on a mobile viewport raises a numeric keypad.

- [ ] **Step 4: Commit**

```bash
git add "src/app/checkout/[productId]/CheckoutForm.tsx"
git commit -m "feat(checkout): express one-screen checkout layout with inline validation"
```

---

### Task 4: Razorpay payment and the four states

Adds the payment call and the paying / success / recovery / error states. This is the task that fixes the unclickable recovery link and removes the double-charge affordance.

**Files:**
- Modify: `src/app/checkout/[productId]/CheckoutForm.tsx`

**Interfaces:**
- Consumes: `POST /api/razorpay/create-marketplace-order` with body `{ productId, quantity }`, responding `{ orderId, amount, currency, keyId, listingName, productName }` or `{ error }`; `placeMarketplaceOrder(formData)` from `@/app/actions/marketplace-orders` returning `{ orderId?: string; error?: string }`; `persistRecoveryDraft`, `updateRecoveryDraft`, `clearRecoveryDraft`, `snapshotFormData`, `attemptWithRetry`, `recoveryUrlFor` from `@/lib/payment-retry`.
- Produces: nothing consumed by later tasks.

- [ ] **Step 1: Add imports and payment state**

At the top of `src/app/checkout/[productId]/CheckoutForm.tsx`, extend the imports:

```tsx
import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  CheckCircle,
  Copy,
  Loader2,
  Minus,
  Pencil,
  Plus,
  Package,
  ShieldCheck,
  Wrench,
} from 'lucide-react'

import { placeMarketplaceOrder } from '@/app/actions/marketplace-orders'
import {
  attemptWithRetry,
  clearRecoveryDraft,
  persistRecoveryDraft,
  recoveryUrlFor,
  snapshotFormData,
  updateRecoveryDraft,
} from '@/lib/payment-retry'
```

Add these type declarations just below the `CheckoutFormProps` interface:

```tsx
interface RazorpayOptions {
  key: string
  amount: number
  currency: string
  name: string
  description: string
  order_id: string
  handler: (r: {
    razorpay_payment_id: string
    razorpay_order_id: string
    razorpay_signature: string
  }) => void
  modal: { ondismiss: () => void }
  prefill: { name: string; contact: string; email?: string }
  theme: { color: string }
}

type Status = 'idle' | 'ordering' | 'paying' | 'submitting' | 'done' | 'recovery' | 'error'

interface DoneInfo { orderId: string }
interface RecoveryInfo { razorpayOrderId: string; paymentId: string; message: string }
```

Replace the `const busy = false` placeholder line and add the new state, alongside the existing `useState` calls:

```tsx
  const [status, setStatus] = useState<Status>('idle')
  const [error, setError] = useState('')
  const [done, setDone] = useState<DoneInfo | null>(null)
  const [recovery, setRecovery] = useState<RecoveryInfo | null>(null)
  const [scriptReady, setScriptReady] = useState(false)
  const [copied, setCopied] = useState(false)

  const busy = status === 'ordering' || status === 'paying' || status === 'submitting'
```

- [ ] **Step 2: Load the Razorpay script on mount**

Add this effect after the state declarations. Loading on mount — rather than on button press as the old modal did — means the script is ready by the time the buyer finishes typing, so the "Payment gateway is still loading" error path disappears.

```tsx
  useEffect(() => {
    if (document.getElementById('razorpay-script')) {
      setScriptReady(true)
      return
    }
    const s = document.createElement('script')
    s.id = 'razorpay-script'
    s.src = 'https://checkout.razorpay.com/v1/checkout.js'
    s.async = true
    s.onload = () => setScriptReady(true)
    document.body.appendChild(s)
  }, [])
```

- [ ] **Step 3: Implement the payment handler**

Replace the placeholder `handlePay` from Task 3 with:

```tsx
  const handlePay = async () => {
    if (!buyerName.trim()) {
      setFieldError({ field: 'name', message: 'Please enter your name.' })
      setDetailsOpen(true)
      return
    }
    if (!isValidPhone(buyerPhone)) {
      setFieldError({ field: 'phone', message: 'Enter a valid 10-digit phone number.' })
      setDetailsOpen(true)
      return
    }
    setFieldError(null)
    setError('')

    try {
      setStatus('ordering')
      const orderRes = await fetch('/api/razorpay/create-marketplace-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId: product.id, quantity }),
      })
      const orderData = await orderRes.json()
      if (!orderRes.ok || orderData.error) {
        setError(orderData.error || 'Could not start the payment. Please try again.')
        setStatus('error')
        return
      }

      setStatus('paying')

      const baseFields: Record<string, string> = {
        product_id: product.id,
        quantity: String(quantity),
        buyer_name: buyerName.trim(),
        buyer_phone: buyerPhone.trim(),
        delivery_address: deliveryAddress.trim(),
        notes: notes.trim(),
      }

      persistRecoveryDraft({
        orderId: orderData.orderId,
        flow: 'marketplace',
        amountPaise: orderData.amount,
        fields: baseFields,
        returnTo: window.location.pathname,
      })

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const Razorpay = (window as any).Razorpay as new (o: RazorpayOptions) => { open: () => void }

      new Razorpay({
        key: orderData.keyId,
        amount: orderData.amount,
        currency: orderData.currency || 'INR',
        name: orderData.listingName || listing.name,
        description: `${product.name} ×${quantity}`,
        order_id: orderData.orderId,
        handler: async (response) => {
          setStatus('submitting')
          const fd = new FormData()
          for (const [key, value] of Object.entries(baseFields)) fd.set(key, value)
          fd.set('razorpay_order_id', response.razorpay_order_id)
          fd.set('razorpay_payment_id', response.razorpay_payment_id)
          fd.set('razorpay_signature', response.razorpay_signature)

          updateRecoveryDraft(orderData.orderId, {
            fields: snapshotFormData(fd),
            paymentId: response.razorpay_payment_id,
            signature: response.razorpay_signature,
          })

          const result = await attemptWithRetry(() => placeMarketplaceOrder(fd))
          if (result.error) {
            // Money has been captured. Never show a Pay button from here on.
            updateRecoveryDraft(orderData.orderId, { lastError: result.error })
            setRecovery({
              razorpayOrderId: orderData.orderId,
              paymentId: response.razorpay_payment_id,
              message: result.error,
            })
            setStatus('recovery')
          } else {
            clearRecoveryDraft(orderData.orderId)
            setDone({ orderId: result.orderId ?? orderData.orderId })
            setStatus('done')
          }
        },
        modal: {
          // Buyer closed Razorpay without paying — unlock the form.
          ondismiss: () => setStatus('idle'),
        },
        prefill: { name: buyerName, contact: buyerPhone, email: buyerEmail },
        theme: { color: '#C4663A' },
      }).open()
    } catch (e) {
      console.error('[CheckoutForm] payment error:', e)
      setError('Something went wrong. Please try again.')
      setStatus('error')
    }
  }
```

Change the component signature to keep `buyerEmail` and `businessUrl`, which the states below need:

```tsx
export default function CheckoutForm({
  product,
  listing,
  businessUrl,
  buyerName: initialName,
  buyerPhone: initialPhone,
  buyerEmail,
}: CheckoutFormProps) {
```

- [ ] **Step 4: Render the success state**

Insert this immediately before the component's main `return`, so it short-circuits the form:

```tsx
  if (status === 'done' && done) {
    const reference = done.orderId.replace(/-/g, '').slice(0, 8).toUpperCase()
    return (
      <div className="flex min-h-[calc(100vh-8rem)] flex-col items-center gap-4 pt-10 text-center">
        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-[rgba(19,138,75,0.12)]">
          <CheckCircle size={34} className="text-[var(--od-success)]" aria-hidden />
        </span>
        <h1 className="font-display text-2xl">Order placed</h1>
        <p className="max-w-xs text-sm leading-relaxed text-[var(--od-muted)]">
          {listing.name} has been notified and will contact you to confirm.
        </p>

        <div className="w-full space-y-2 rounded-[14px] border border-[var(--od-border)] bg-white p-4 text-left">
          <div className="flex justify-between text-[13px]">
            <span className="text-[var(--od-muted)]">Reference</span>
            <span className="font-mono font-bold text-[var(--od-ink)]">{reference}</span>
          </div>
          <div className="flex justify-between text-[13px]">
            <span className="text-[var(--od-muted)]">
              {product.name} ×{quantity}
            </span>
            <span className="font-bold text-[var(--od-ink)]">{formatInr(totalPaise)}</span>
          </div>
          <div className="flex justify-between text-[13px]">
            <span className="text-[var(--od-muted)]">Paid to</span>
            <span className="font-bold text-[var(--od-ink)]">{listing.name}</span>
          </div>
        </div>

        <div className="mt-auto w-full space-y-2 pb-4">
          <Link
            href={`/account/orders/${done.orderId}`}
            className="od-button-primary w-full py-3 text-sm"
          >
            View my order
          </Link>
          <Link href={businessUrl} className="od-button-secondary w-full py-3 text-sm">
            Back to {listing.name}
          </Link>
        </div>
      </div>
    )
  }
```

- [ ] **Step 5: Render the recovery state**

Insert directly after the success block. This is the state that replaces today's unclickable text URL, and it deliberately renders **no Pay button**.

```tsx
  if (status === 'recovery' && recovery) {
    const waHref = listing.whatsapp
      ? `https://wa.me/${listing.whatsapp.replace(/\D/g, '')}?text=${encodeURIComponent(
          `Hi ${listing.name}, I paid for ${product.name} ×${quantity} (${formatInr(totalPaise)}) but the order did not save. My payment reference is ${recovery.paymentId}.`,
        )}`
      : null

    return (
      <div className="flex min-h-[calc(100vh-8rem)] flex-col items-center gap-4 pt-10 text-center">
        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-[rgba(200,136,30,0.14)] text-2xl font-black text-[var(--od-gold)]">
          !
        </span>
        <h1 className="font-display text-2xl">Payment received</h1>
        <p className="max-w-xs text-sm leading-relaxed text-[var(--od-muted)]">
          Your money reached {listing.name} safely, but we couldn’t finish saving the order.
        </p>

        <div className="w-full rounded-[14px] border border-[rgba(200,136,30,0.35)] bg-[rgba(200,136,30,0.07)] p-4 text-left">
          <p className="text-[13px] leading-relaxed text-[var(--od-ink-2)]">
            Nothing is lost — we’ve kept your payment reference. Tap below and we’ll finish it.
          </p>
          <code className="mt-2 block select-all rounded-lg border border-[var(--od-border)] bg-white px-3 py-2 font-mono text-[13px] font-bold text-[var(--od-ink)]">
            {recovery.paymentId}
          </code>
        </div>

        <div className="mt-auto w-full space-y-2 pb-4">
          <Link
            href={recoveryUrlFor(recovery.razorpayOrderId)}
            className="od-button-primary w-full py-3 text-sm"
          >
            Finish my order →
          </Link>
          {waHref && (
            <a
              href={waHref}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => {
                navigator.clipboard?.writeText(recovery.paymentId).then(
                  () => setCopied(true),
                  () => undefined,
                )
              }}
              className="od-button-secondary flex w-full items-center justify-center gap-1.5 py-3 text-sm"
            >
              <Copy size={14} aria-hidden />
              {copied ? 'Reference copied' : 'Copy reference & WhatsApp seller'}
            </a>
          )}
        </div>
      </div>
    )
  }
```

- [ ] **Step 6: Wire the busy state into the footer button**

Replace the sticky-footer button from Task 3 with a version that reflects payment progress and blocks input while the gateway is open:

```tsx
        <button
          type="button"
          onClick={handlePay}
          disabled={busy || !scriptReady}
          className="od-button-primary flex flex-1 items-center justify-center gap-2 py-3 text-sm disabled:opacity-60"
        >
          {busy ? (
            <>
              <Loader2 size={15} className="animate-spin" aria-hidden />
              {status === 'ordering' && 'Opening payment…'}
              {status === 'paying' && 'Waiting for payment…'}
              {status === 'submitting' && 'Finalising order…'}
            </>
          ) : scriptReady ? (
            <>Pay {formatInr(totalPaise)}</>
          ) : (
            <>Loading payment…</>
          )}
        </button>
```

Add the pre-payment error banner directly above the sticky footer, inside the main return. This only ever shows errors from before capture, so offering a retry is safe:

```tsx
      {status === 'error' && error && (
        <div className="rounded-xl border border-[rgba(200,60,40,0.25)] bg-[rgba(200,60,40,0.06)] px-4 py-3 text-sm text-[var(--od-ink-2)]">
          {error}
        </div>
      )}
```

- [ ] **Step 7: Verify types, lint and build**

```bash
npx tsc --noEmit
```

```bash
npx eslint "src/app/checkout/[productId]/CheckoutForm.tsx"
```

```bash
npm run build
```

Expected: all clean.

- [ ] **Step 8: Verify the payment flow in a browser**

Signed in on `http://organic.localhost:3000/checkout/<productId>`:

- On load the Pay button briefly reads "Loading payment…" and then shows the amount. It must never show an error about the gateway still loading.
- Press Pay → Razorpay opens over the page. The page beneath must not shift, flicker, or show a second dark overlay of ours.
- Dismiss Razorpay without paying → the form unlocks and the Pay button returns to "Pay ₹X".
- Complete a Razorpay **test** payment → the success state shows an 8-character reference, the line item, the amount, and two working links. Confirm "View my order" resolves rather than 404s.

To exercise the recovery state without breaking a real order, temporarily force the failure branch by replacing the `attemptWithRetry` line with `const result = { error: 'Simulated save failure.' } as { error?: string; orderId?: string }`, then verify:

- The heading reads "Payment received" and leads with the reassurance.
- "Finish my order →" is a real anchor whose `href` is `/payments/recover/<razorpay order id>`.
- The payment reference is selectable text.
- **No Pay button is present anywhere on screen.**

Restore the `attemptWithRetry` line afterwards and re-run `npx tsc --noEmit`.

- [ ] **Step 9: Commit**

```bash
git add "src/app/checkout/[productId]/CheckoutForm.tsx"
git commit -m "feat(checkout): razorpay flow with success, recovery and error states"
```

---

### Task 5: Switch the product card over and delete the modal

The cut-over. Once this lands, the original bug is gone because no fixed-position element is rendered inside a product card any more.

**Files:**
- Modify: `src/components/BuyButton.tsx` (full rewrite — drops from ~465 lines to ~55)
- Modify: `src/app/listings/[id]/components/ListingContent.tsx:169-185`

**Interfaces:**
- Consumes: the `/checkout/<productId>` route from Task 2 and the `/login?next=` fix from Task 1.
- Produces: `BuyButton` with the reduced prop set `{ product: BuyProductInfo; isSignedIn: boolean; disabled?: boolean }`. The `loginHref`, `userName`, `userPhone`, and `userEmail` props are **removed** — the checkout page reads the buyer's profile server-side, so passing them through the card is now dead weight.

- [ ] **Step 1: Rewrite BuyButton as a link**

Replace the entire contents of `src/components/BuyButton.tsx`:

```tsx
import Link from 'next/link'
import { ShoppingCart } from 'lucide-react'

export interface BuyProductInfo {
  id: string
  name: string
  pricePaise: number
  quantityInStock: number | null
  listingName: string
  type: 'product' | 'service'
}

const buttonCls =
  'inline-flex items-center justify-center gap-1.5 rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-bg transition-colors hover:bg-brand-strong'

/**
 * Entry point into checkout.
 *
 * This deliberately renders nothing but a link. It used to host the whole
 * checkout modal, but a `position: fixed` overlay rendered inside a product
 * card is captured by the card's `.od-card-hover` transform, which becomes
 * the overlay's containing block — the modal was clipped to the card while
 * hovered and snapped to fullscreen when not, producing a visible flicker.
 * Checkout now lives at its own route, so no overlay exists here to capture.
 */
export default function BuyButton({
  product,
  isSignedIn,
  disabled = false,
}: {
  product: BuyProductInfo
  isSignedIn: boolean
  disabled?: boolean
}) {
  const isSoldOut = product.quantityInStock === 0

  if (disabled || isSoldOut) {
    return (
      <button
        type="button"
        disabled
        className="inline-flex cursor-not-allowed items-center justify-center gap-1.5 rounded-xl border border-gray-200 bg-gray-100 px-4 py-2 text-sm font-semibold text-gray-400"
      >
        {isSoldOut ? 'Sold out' : 'Unavailable'}
      </button>
    )
  }

  const checkoutPath = `/checkout/${product.id}`

  if (!isSignedIn) {
    return (
      <Link href={`/login?next=${encodeURIComponent(checkoutPath)}`} className={buttonCls}>
        <ShoppingCart size={14} aria-hidden />
        Sign in to buy
      </Link>
    )
  }

  return (
    <Link href={checkoutPath} className={buttonCls}>
      <ShoppingCart size={14} aria-hidden />
      {product.type === 'service' ? 'Book now' : 'Buy now'}
    </Link>
  )
}
```

- [ ] **Step 2: Update the call site**

In `src/app/listings/[id]/components/ListingContent.tsx`, replace the `BuyButton` element at lines 170-184:

```tsx
                  <BuyButton
                    product={{
                      id: product.id,
                      name: product.name,
                      pricePaise: product.price_paise,
                      quantityInStock: product.quantity_in_stock,
                      listingName: String(listing.name),
                      type: product.type,
                    }}
                    isSignedIn={viewer.isLoggedIn}
                    loginHref={platformLoginUrl}
                    userName={viewer.name}
                    userPhone={viewer.phone}
                    userEmail={viewer.email}
                  />
```

with:

```tsx
                  <BuyButton
                    product={{
                      id: product.id,
                      name: product.name,
                      pricePaise: product.price_paise,
                      quantityInStock: product.quantity_in_stock,
                      listingName: String(listing.name),
                      type: product.type,
                    }}
                    isSignedIn={viewer.isLoggedIn}
                  />
```

- [ ] **Step 3: Check whether platformLoginUrl is now unused**

`platformLoginUrl` is still consumed by `ListingReviewsSection` (`src/app/listings/[id]/components/ListingReviewsSection.tsx:134`), so the prop must stay on `ListingContent`. Confirm rather than assume:

```bash
grep -rn "platformLoginUrl" src/
```

Expected: matches remain in `ListingContent.tsx` (prop declaration and the reviews call site) and in `ListingReviewsSection.tsx`, and **no** match on a `BuyButton`. If the only remaining matches were the declaration and pass-through, remove the prop; otherwise leave it exactly as is.

- [ ] **Step 4: Verify types, lint and build**

```bash
npx tsc --noEmit
```

```bash
npx eslint src/components/BuyButton.tsx "src/app/listings/[id]/components/ListingContent.tsx"
```

```bash
npm run build
```

Expected: all clean. Type errors here would most likely mean a `BuyButton` prop was left behind at the call site.

- [ ] **Step 5: Verify the original bug is gone**

This is the acceptance test for the whole plan. On `http://organic.localhost:3000` at a mobile viewport, signed in:

- Hover a product card so it lifts, then click "Buy now" **without moving the pointer**. Checkout must open as a full page. There must be no clipped box inside the card and no flicker.
- Repeat, moving the pointer off the card mid-navigation. The result must be identical.
- Use the browser back button — it must return to the business page with the card grid intact.

Then prove no fixed overlay remains inside a card. With the shop section on screen, run this in the browser console:

```js
[...document.querySelectorAll('article[id^=product-]')]
  .flatMap(c => [...c.querySelectorAll('*')])
  .filter(el => getComputedStyle(el).position === 'fixed').length
```

Expected: `0`.

Finally, confirm the sign-out path end to end: sign out, click "Sign in to buy" on a product, complete Google auth, and confirm you land on `http://organic.localhost:3000/checkout/<productId>` — same subdomain, same product — not on the apex listing page.

- [ ] **Step 6: Confirm out-of-scope flows still work**

- The Services & Products section's own "Order"/"Book" flow (`OrderModal`) opens and behaves exactly as before.
- `http://organic.localhost:3000/p/<productId>` still renders with its WhatsApp and "View full business page" buttons and no buy button.

- [ ] **Step 7: Commit**

```bash
git add src/components/BuyButton.tsx "src/app/listings/[id]/components/ListingContent.tsx"
git commit -m "feat(shop): link Buy now to the checkout route and remove the in-card modal"
```

---

## Self-Review

**Spec coverage**

| Spec requirement | Task |
| --- | --- |
| `/checkout/[productId]` route with auth gate, notFound, sold-out | 2 |
| Proxy matcher entry | 2 |
| Card button becomes a Link; no fixed overlay in cards | 5 |
| Express layout (strip, quantity, collapsed details, address, notes, sticky footer) | 3 |
| Mobile input hygiene (`inputMode`, `autoComplete`) | 3 |
| Inline per-field validation | 3 |
| State 1 paying — fields lock, no second overlay | 4 |
| State 2 success — reference, receipt, two exits | 4 |
| State 3 recovery — reassurance, tappable reference, real link, no Pay button | 4 |
| State 4 pre-payment errors, retry allowed | 4 |
| Login preserves `?next=` on subdomains | 1 |
| `/auth/callback` open-redirect hardening | 1 |
| Reuse order API, server action, payment-retry unchanged | 4 (imports only) |
| OrderModal / ServicesSection / `/p` untouched | Global constraints; verified in 5 |

No gaps.

**Placeholder scan:** No TBD/TODO. Every code step contains complete, runnable code. The one intentional stub (Task 2 Step 3) is labelled as such and fully replaced in Task 3 Step 1.

**Type consistency:** `CheckoutFormProps` is declared identically in Task 2 Step 3 and Task 3 Step 1, and Task 4 only adds fields to the destructure without changing the interface. `formatInr` and `isValidPhone` are defined once (Task 3) and reused in Task 4. `BuyProductInfo` keeps its existing shape; only `BuyButton`'s own props shrink, and the single call site is updated in the same task.

**One risk worth flagging to the reviewer:** Task 4 Step 8 asks the implementer to temporarily edit the `attemptWithRetry` line to exercise the recovery state, then restore it. If that edit is committed by mistake, every checkout would report failure. The step ends with an explicit restore-and-recheck instruction; the reviewer should confirm `attemptWithRetry(() => placeMarketplaceOrder(fd))` is present in the final diff.
