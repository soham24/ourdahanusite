# One Catalog Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every business has one catalog of products and services (old "Services & Products" copied in), with options, price notes, Buy-or-WhatsApp per item, option picking at checkout, and a phone-friendly item manager.

**Architecture:** One additive migration adds `price_note`, `image_aspect`, `legacy_service_index` and optional `price_paise` to `listing_products`, a new `listing_product_options` table, option columns on `orders`, a stock function, and copies `listings.services` once. Pure rules (price line, Buy/WhatsApp decision, validation, manager helpers) live in `src/lib/catalog/` with `node:test` coverage. Pages, checkout and the item manager consume those rules.

**Tech Stack:** Next.js 16.2 App Router (Cache Components, `'use cache'`, params are Promises), React 19, Supabase (live production), Tailwind with the site's `od-` design classes, `node:test` via `tsx`.

**Spec:** `docs/superpowers/specs/2026-09-15-one-catalog-design.md`

## Global Constraints

- Supabase is **live production**. Only Task 1 touches the database, and only the controller runs it (Supabase connector). Never delete rows this plan did not create.
- Nothing writes `listings.services` after this plan. The mobile flows that read it stay unchanged: `src/app/api/razorpay/create-product-order/route.ts`, `placeOrder`/`resolveListingService` in `src/app/actions/orders.ts`, `src/app/api/v1/orders`.
- Telegram notification delivery is not changed.
- The Razorpay key secret is never logged, returned to a client, or selected outside `loadOwnerRazorpayKeys`.
- A payment Razorpay captured is always saved: unit price and option label come from the payment intent, never refused because an item or option was renamed, repriced, hidden or deleted.
- Limits (exact): online price at least ₹1 (`100` paise); at most ₹1 crore (`1_000_000_000` paise, because `price_paise` is a 32-bit integer); at most **6** options per item; option label ≤ **40** characters; price note ≤ **32**; item name ≤ **80**; description ≤ **600**; stock is a whole number ≤ 1,000,000 or blank (no limit).
- Customer copy (exact): section title `Products & Services`; `Show all N items`; buttons `Buy`, `Book`, `Sold out`, `Order on WhatsApp`, `Book on WhatsApp`; price line `From ₹180`, the price note, or `Ask for price`.
- Server errors (exact): `Choose an option.`; `This item can't be bought online.`; `Only N left.`; `That option just sold out. Please pick another.`; `That option is no longer available. Please pick another.`
- Modules in `src/lib/catalog/` use **relative imports only** (so `tsx --test` resolves them) and have no server-only imports.
- New and redesigned screens use the `od-` classes (`od-page`, `od-shell`, `od-card`, `od-button-primary`, `od-button-secondary`, `od-input`, `od-eyebrow`, `od-section-title`, `od-muted`) and CSS variables (`--od-ink`, `--od-ink-2`, `--od-muted`, `--od-brand`, `--od-brand-strong`, `--od-border`, `--od-surface-soft`). `od-input` has no padding: add `px-3.5 py-2.5 text-sm`. Everything must work at 360px wide; tap targets at least 40px.
- This is not the Next.js in your training data: read the relevant guide in `node_modules/next/dist/docs/` before using an API you are unsure of.
- Tests: `node:test` via `tsx`; new test files are added to the explicit list in `package.json` `test:existing`. Baseline: every test passes except the known clock-dependent `an override can open a normally closed day`. `npm test` stops after that failure, so also run `npm run test:game` (47/47).
- Lint baseline: `npm run lint` → 0 errors, 11 warnings. No new warnings.
- The dev server rewrites `next-env.d.ts`; revert it (`git checkout next-env.d.ts`) before committing. Scratch files go to the system temp directory, never the repo.
- End every commit message with `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`.

## File map

| File | Responsibility | Task |
|---|---|---|
| `supabase/add_one_catalog.sql` | Schema + one-time copy | 1 |
| `src/lib/database.types.ts` | Regenerated types | 1 |
| `src/lib/catalog/types.ts` | `CatalogItem`, `CatalogOption`, `OwnerCatalogItem` | 2 |
| `src/lib/catalog/catalog.ts` | Price line, buyability, Buy/WhatsApp action, order labels, row shaping, select strings | 2 |
| `src/lib/catalog/validate.ts` | `validateCatalogItem`, `coerceCatalogItemInput`, price/stock parsing | 2 |
| `src/lib/catalog/manager.ts` | Manager row text, reordering, form conversion, preview | 2 |
| `src/lib/catalog/catalog.test.ts` | Unit tests for the three modules | 2 |
| `src/lib/data/listing-detail.ts`, `src/lib/data/product-detail.ts` | Load catalog for every approved listing; `/p` data with shop mode | 3 |
| `src/components/catalog/CatalogItemCard.tsx` | Customer item card + action button | 3 |
| `src/app/listings/[id]/components/CatalogSection.tsx` | The one section on the business page | 3 |
| `src/app/listings/[id]/components/ListingContent.tsx`, `ListingNavigation.tsx`, `page.tsx` | Use the section; keywords from catalog | 3 |
| `src/app/p/[productId]/page.tsx` | Shared item page with Buy | 3 |
| `src/app/s/[index]/route.ts` | Old share links redirect | 4 |
| `src/app/api/razorpay/create-marketplace-order/route.ts`, `src/app/actions/marketplace-orders.ts` | Options at payment and order save | 5 |
| Order pages (`account/orders`, `my-business/orders`) | Show option label | 5 |
| `src/app/checkout/[productId]/page.tsx`, `CheckoutForm.tsx` | Option picker | 6 |
| `src/lib/catalog/owner-gate.ts`, `src/app/actions/catalog.ts` | Owner gate; item manager server actions | 7 |
| `src/app/my-business/products/[listingId]/*`, `src/app/admin/products/[listingId]/page.tsx` | Redesigned item manager | 8 |
| `EditListingForm.tsx`, edit `page.tsx`, `actions/listings.ts`, `my-business/page.tsx` | Stop editing the old list; checklist counts buyable items | 9 |

Deleted along the way: `src/components/ProductCard.tsx`, `src/components/BuyButton.tsx`, `src/components/OrderModal.tsx`, `src/app/listings/[id]/ServicesSection.tsx` (Task 3); `src/app/s/[index]/page.tsx`, `src/lib/data/service-detail.ts` (Task 4); `src/app/actions/products.ts` (Task 8).

---

### Task 1: Migration, one-time copy and regenerated types

**Controller task.** It needs the Supabase connector (`apply_migration`, `execute_sql`, `generate_typescript_types`, `get_advisors`) on project `slmbqngmxketyxjauxxk`. Do not dispatch it to a subagent.

**Files:**
- Create: `supabase/add_one_catalog.sql`
- Modify: `src/lib/database.types.ts` (regenerated)

**Interfaces:**
- Produces: columns `listing_products.price_note text NULL`, `listing_products.image_aspect text NOT NULL DEFAULT 'square'`, `listing_products.legacy_service_index integer NULL`, nullable `listing_products.price_paise` (`NULL` or `>= 100`); table `listing_product_options(id, product_id, label, price_paise, quantity_in_stock, sort_order, created_at, updated_at)`; `orders.product_option_id uuid NULL`, `orders.option_label text NULL`; RPC `decrement_option_stock(p_option_id uuid, p_quantity integer) RETURNS boolean` (service role only).

- [ ] **Step 1: Write the migration**

Create `supabase/add_one_catalog.sql`:

```sql
-- ============================================================
-- One catalog (commerce roadmap piece 2)
--   - listing_products: optional price, price note, photo shape and
--     legacy_service_index (old /s/ links + idempotent copy)
--   - listing_product_options: up to 6 priced options per item
--     (the limit is enforced by the only writer, the server action)
--   - orders: which option was bought
--   - decrement_option_stock: option stock after a captured payment
--   - one-time copy of listings.services into listing_products
-- Additive and idempotent: safe to run more than once.
-- listings.services is left untouched for the mobile app.
-- ============================================================

ALTER TABLE public.listing_products
  ADD COLUMN IF NOT EXISTS price_note text,
  ADD COLUMN IF NOT EXISTS image_aspect text NOT NULL DEFAULT 'square',
  ADD COLUMN IF NOT EXISTS legacy_service_index integer;

ALTER TABLE public.listing_products DROP CONSTRAINT IF EXISTS listing_products_price_note_check;
ALTER TABLE public.listing_products
  ADD CONSTRAINT listing_products_price_note_check
  CHECK (price_note IS NULL OR char_length(price_note) <= 32);

ALTER TABLE public.listing_products DROP CONSTRAINT IF EXISTS listing_products_image_aspect_check;
ALTER TABLE public.listing_products
  ADD CONSTRAINT listing_products_image_aspect_check
  CHECK (image_aspect IN ('square', 'portrait', 'landscape'));

CREATE UNIQUE INDEX IF NOT EXISTS listing_products_legacy_service_index_key
  ON public.listing_products (listing_id, legacy_service_index)
  WHERE legacy_service_index IS NOT NULL;

-- No fixed price means the item cannot be bought online.
ALTER TABLE public.listing_products ALTER COLUMN price_paise DROP NOT NULL;
ALTER TABLE public.listing_products DROP CONSTRAINT IF EXISTS listing_products_price_paise_check;
ALTER TABLE public.listing_products
  ADD CONSTRAINT listing_products_price_paise_check
  CHECK (price_paise IS NULL OR price_paise >= 100);

CREATE TABLE IF NOT EXISTS public.listing_product_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.listing_products(id) ON DELETE CASCADE,
  label text NOT NULL CHECK (char_length(label) BETWEEN 1 AND 40),
  price_paise integer NOT NULL CHECK (price_paise >= 100),
  quantity_in_stock integer CHECK (quantity_in_stock IS NULL OR quantity_in_stock >= 0),
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_listing_product_options_product_sort
  ON public.listing_product_options (product_id, sort_order);

ALTER TABLE public.listing_product_options ENABLE ROW LEVEL SECURITY;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.listing_product_options FROM anon, authenticated;
GRANT SELECT ON public.listing_product_options TO anon, authenticated;

DROP POLICY IF EXISTS "Public reads options of active products on approved listings" ON public.listing_product_options;
CREATE POLICY "Public reads options of active products on approved listings" ON public.listing_product_options
  FOR SELECT USING (
    EXISTS (
      SELECT 1
      FROM public.listing_products p
      JOIN public.listings l ON l.id = p.listing_id
      WHERE p.id = listing_product_options.product_id
        AND p.is_active = true
        AND l.approved = true
    )
  );

DROP POLICY IF EXISTS "Owners read own product options" ON public.listing_product_options;
CREATE POLICY "Owners read own product options" ON public.listing_product_options
  FOR SELECT USING (
    EXISTS (
      SELECT 1
      FROM public.listing_products p
      JOIN public.listings l ON l.id = p.listing_id
      WHERE p.id = listing_product_options.product_id
        AND l.owner_id = (SELECT auth.uid())
    )
  );

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS product_option_id uuid
    REFERENCES public.listing_product_options(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS option_label text;

ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_option_label_check;
ALTER TABLE public.orders
  ADD CONSTRAINT orders_option_label_check
  CHECK (option_label IS NULL OR char_length(option_label) <= 40);

CREATE OR REPLACE FUNCTION public.decrement_option_stock(
  p_option_id uuid,
  p_quantity integer
)
RETURNS boolean
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_updated integer;
BEGIN
  -- Runs only after Razorpay captured a payment, so there is no visibility
  -- filter: hiding an item mid-payment must not refuse that order.
  UPDATE public.listing_product_options
  SET quantity_in_stock = quantity_in_stock - p_quantity,
      updated_at = now()
  WHERE id = p_option_id
    AND (quantity_in_stock IS NULL OR quantity_in_stock >= p_quantity);

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated > 0;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.decrement_option_stock(uuid, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.decrement_option_stock(uuid, integer) TO service_role;

-- One-time copy. A listing that already has any copied row is skipped,
-- so running this again inserts nothing.
WITH eligible AS (
  SELECT l.id AS listing_id, l.services
  FROM public.listings l
  WHERE jsonb_typeof(l.services) = 'array'
    AND jsonb_array_length(l.services) > 0
    AND NOT EXISTS (
      SELECT 1 FROM public.listing_products p
      WHERE p.listing_id = l.id AND p.legacy_service_index IS NOT NULL
    )
),
base AS (
  SELECT e.listing_id, COALESCE(MAX(p.sort_order) + 1, 0) AS start_order
  FROM eligible e
  LEFT JOIN public.listing_products p ON p.listing_id = e.listing_id
  GROUP BY e.listing_id
),
items AS (
  SELECT e.listing_id,
         (s.ord - 1)::int AS legacy_index,
         s.elem,
         btrim(COALESCE(s.elem->>'price', '')) AS price_text
  FROM eligible e
  CROSS JOIN LATERAL jsonb_array_elements(e.services) WITH ORDINALITY AS s(elem, ord)
  WHERE jsonb_typeof(s.elem) = 'object'
    AND btrim(COALESCE(s.elem->>'name', '')) <> ''
),
priced AS (
  SELECT i.*,
         CASE
           WHEN i.price_text ~* '^(₹|rs\.?)?\s*[0-9][0-9,]*(\.[0-9]{1,2})?\s*(/-)?$'
           THEN replace(regexp_replace(i.price_text, '^(₹|rs\.?)\s*|\s*/-$', '', 'gi'), ',', '')::numeric
         END AS rupees
  FROM items i
)
INSERT INTO public.listing_products (
  listing_id, type, name, description, price_paise, price_note, quantity_in_stock,
  image_url, image_thumb_url, image_aspect, is_active, sort_order, legacy_service_index
)
SELECT
  p.listing_id,
  CASE WHEN p.elem->>'type' = 'service' THEN 'service' ELSE 'product' END,
  left(btrim(p.elem->>'name'), 80),
  NULLIF(left(btrim(COALESCE(p.elem->>'desc', '')), 280), ''),
  CASE WHEN p.rupees BETWEEN 1 AND 10000000 THEN round(p.rupees * 100)::int END,
  CASE WHEN p.rupees BETWEEN 1 AND 10000000 THEN NULL ELSE NULLIF(left(p.price_text, 32), '') END,
  NULL,
  NULLIF(btrim(COALESCE(p.elem->>'image', '')), ''),
  NULLIF(btrim(COALESCE(p.elem->>'image', '')), ''),
  CASE WHEN p.elem->>'imageAspect' IN ('square', 'portrait', 'landscape')
       THEN p.elem->>'imageAspect' ELSE 'landscape' END,
  true,
  b.start_order + p.legacy_index,
  p.legacy_index
FROM priced p
JOIN base b ON b.listing_id = p.listing_id;
```

- [ ] **Step 2: Pre-check production** (`execute_sql`)

```sql
select
  (select count(*) from listings where jsonb_typeof(services) = 'array' and jsonb_array_length(services) > 0) as listings_with_items,
  (select count(*) from listings l, jsonb_array_elements(case when jsonb_typeof(l.services) = 'array' then l.services else '[]'::jsonb end) s) as old_items,
  (select count(*) from listings l, jsonb_array_elements(case when jsonb_typeof(l.services) = 'array' then l.services else '[]'::jsonb end) s where jsonb_typeof(s) = 'object' and btrim(coalesce(s->>'name', '')) <> '') as named_items,
  (select count(*) from listing_products) as existing_items,
  (select count(*) from listing_products where price_paise < 100) as items_under_one_rupee,
  (select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'listing_products' and column_name = 'legacy_service_index') as already_migrated;
```

Expected on 2026-09-15: `20 | 87 | 85 | 4 | 0 | 0`. If `items_under_one_rupee` is not 0, stop and report (the new price check would fail). Other differences mean the data changed since the spec: report them before applying.

- [ ] **Step 3: Apply** — `apply_migration` with name `add_one_catalog` and the file contents. The connector runs a migration as one transaction; if any statement fails nothing is applied.

- [ ] **Step 4: Verify the copy** (`execute_sql`)

```sql
select
  (select count(*) from listing_products where legacy_service_index is not null) as copied,
  (select count(*) from listing_products where legacy_service_index is not null and price_paise is not null) as with_price,
  (select count(*) from listing_products where legacy_service_index is not null and price_note is not null) as with_note,
  (select count(*) from listing_products where legacy_service_index is null) as original_items,
  (select count(*)
     from listing_products p
     join listings l on l.id = p.listing_id
     cross join lateral (select l.services -> p.legacy_service_index as elem) s
    where p.legacy_service_index is not null
      and (p.name <> left(btrim(s.elem->>'name'), 80)
        or p.description is distinct from nullif(left(btrim(coalesce(s.elem->>'desc', '')), 280), '')
        or p.image_url is distinct from nullif(btrim(coalesce(s.elem->>'image', '')), '')
        or p.image_aspect <> case when s.elem->>'imageAspect' in ('square', 'portrait', 'landscape') then s.elem->>'imageAspect' else 'landscape' end)
  ) as mismatches,
  (select count(*) from listings l
    where jsonb_typeof(l.services) = 'array'
      and exists (select 1 from jsonb_array_elements(l.services) e where jsonb_typeof(e) = 'object' and btrim(coalesce(e->>'name', '')) <> '')
      and not exists (select 1 from listing_products p where p.listing_id = l.id and p.legacy_service_index is not null)
  ) as listings_a_rerun_would_copy;
```

Expected: `85 | 41 | 14 | 4 | 0 | 0`. Also spot-check: `select name, price_paise, price_note from listing_products where price_note is not null or price_paise in (37425, 139900) order by name;` shows "374.25" as 37425, "1399/-" as 139900, and text such as "per kilo" as notes.

- [ ] **Step 5: Verify access rules** (`execute_sql`). The block ends by raising an exception that carries the results, which also rolls everything back.

```sql
DO $$
DECLARE
  v_visible text;
  v_anon_insert text := 'allowed';
  v_auth_insert text := 'allowed';
  v_auth_exec text := 'allowed';
  v_first uuid;
  v_second uuid;
BEGIN
  SELECT p.id INTO v_first FROM public.listing_products p JOIN public.listings l ON l.id = p.listing_id
   WHERE l.approved AND p.is_active ORDER BY p.created_at, p.id LIMIT 1;
  SELECT p.id INTO v_second FROM public.listing_products p JOIN public.listings l ON l.id = p.listing_id
   WHERE l.approved AND p.is_active AND p.id <> v_first ORDER BY p.created_at, p.id LIMIT 1;

  INSERT INTO public.listing_product_options (product_id, label, price_paise)
  VALUES (v_first, 'Check visible', 100), (v_second, 'Check hidden', 100);
  UPDATE public.listing_products SET is_active = false WHERE id = v_second;

  EXECUTE 'SET LOCAL ROLE anon';
  SELECT string_agg(label, ',' ORDER BY label) INTO v_visible
    FROM public.listing_product_options WHERE label LIKE 'Check %';
  BEGIN
    INSERT INTO public.listing_product_options (product_id, label, price_paise) VALUES (v_first, 'Check anon', 100);
  EXCEPTION WHEN insufficient_privilege THEN v_anon_insert := 'refused';
  END;
  EXECUTE 'RESET ROLE';

  EXECUTE 'SET LOCAL ROLE authenticated';
  BEGIN
    INSERT INTO public.listing_product_options (product_id, label, price_paise) VALUES (v_first, 'Check auth', 100);
  EXCEPTION WHEN insufficient_privilege THEN v_auth_insert := 'refused';
  END;
  BEGIN
    PERFORM public.decrement_option_stock(gen_random_uuid(), 1);
  EXCEPTION WHEN insufficient_privilege THEN v_auth_exec := 'refused';
  END;
  EXECUTE 'RESET ROLE';

  RAISE EXCEPTION 'visible=% anon_insert=% auth_insert=% auth_exec=%', v_visible, v_anon_insert, v_auth_insert, v_auth_exec;
END $$;
```

Expected error text: `visible=Check visible anon_insert=refused auth_insert=refused auth_exec=refused`. Then `get_advisors` (security): no new warnings mention `listing_product_options` or `decrement_option_stock`.

- [ ] **Step 6: Regenerate types** — `generate_typescript_types`, write the output to `src/lib/database.types.ts`, keeping the two header comment lines at the top. Confirm the file now contains `listing_product_options`, `price_note`, `decrement_option_stock`, and `price_paise: number | null` under `listing_products` Row.

- [ ] **Step 7: Type-check** — Run: `npx tsc --noEmit`. Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add supabase/add_one_catalog.sql src/lib/database.types.ts
git commit -m "feat(catalog): item options, price notes and the one-time copy of old service lists"
```

---

### Task 2: Catalog rules library

**Files:**
- Create: `src/lib/catalog/types.ts`, `src/lib/catalog/catalog.ts`, `src/lib/catalog/validate.ts`, `src/lib/catalog/manager.ts`
- Test: `src/lib/catalog/catalog.test.ts`
- Modify: `package.json` (`test:existing` list)

**Interfaces:**
- Consumes: `normalizeServiceImageAspect`, `ServiceImageAspect` from `src/lib/service-image.ts`; `canBuyFromShop`, `ShopMode` from `src/lib/selling/shop-mode.ts`.
- Produces (used by Tasks 3–9):
  - types: `CatalogItemType`, `CatalogOption`, `CatalogItem`, `OwnerCatalogItem`
  - `catalog.ts`: `MIN_ONLINE_PRICE_PAISE`, `MAX_PRICE_PAISE`, `MAX_OPTIONS`, `CATALOG_ITEM_SELECT`, `OWNER_CATALOG_ITEM_SELECT`, `CatalogRow`, `OwnerCatalogRow`, `formatPaise(paise)`, `sortCatalogOptions(options)`, `toCatalogItem(row)`, `isBuyable(item)`, `isAvailable(stock)`, `isSoldOut(item)`, `lowestOptionPrice(options)`, `catalogPriceLine(item)`, `CatalogAction`, `catalogItemAction(item, shopMode, viewer, hasContactNumber)`, `catalogWhatsAppHref(number, item, priceLine, itemUrl)`, `firstAvailableOptionId(options)`, `orderItemName(name, optionLabel)`, `orderLineLabel(name, optionLabel, quantity)`
  - `validate.ts`: `NAME_MAX`, `DESCRIPTION_MAX`, `PRICE_NOTE_MAX`, `OPTION_LABEL_MAX`, `PricingMode`, `CatalogOptionInput`, `CatalogItemInput`, `CatalogItemValues`, `OptionFieldErrors`, `CatalogItemErrors`, `CatalogItemValidation`, `parsePrice(raw)`, `parseStock(raw)`, `validateCatalogItem(input)`, `coerceCatalogItemInput(raw)`
  - `manager.ts`: `managerPriceLine(item)`, `managerStockLine(item)`, `moveId(ids, id, direction)`, `countWithoutOnlinePrice(items)`, `noOnlinePriceHint(count)`, `emptyCatalogItemInput()`, `catalogItemToInput(item)`, `previewCatalogItem(input, id?)`

- [ ] **Step 1: Write the types**

`src/lib/catalog/types.ts`:

```ts
import type { ServiceImageAspect } from '../service-image'

export type CatalogItemType = 'product' | 'service'

export interface CatalogOption {
  id: string
  label: string
  price_paise: number
  /** Null means no stock limit. */
  quantity_in_stock: number | null
  sort_order: number
}

/** One item in a business's catalog, as customers see it. */
export interface CatalogItem {
  id: string
  type: CatalogItemType
  name: string
  description: string | null
  /** Null when the item has options or no fixed price. */
  price_paise: number | null
  price_note: string | null
  quantity_in_stock: number | null
  image_url: string | null
  image_thumb_url: string | null
  image_aspect: ServiceImageAspect
  sort_order: number
  /** When present, each option's price and stock apply instead of the item's. */
  options: CatalogOption[]
}

/** The owner's view of an item adds visibility and bookkeeping. */
export interface OwnerCatalogItem extends CatalogItem {
  listing_id: string
  is_active: boolean
  legacy_service_index: number | null
  created_at: string
  updated_at: string
}
```

- [ ] **Step 2: Write the failing tests**

`src/lib/catalog/catalog.test.ts`:

```ts
import assert from 'node:assert/strict'
import test from 'node:test'

import {
  catalogItemAction,
  catalogPriceLine,
  catalogWhatsAppHref,
  firstAvailableOptionId,
  formatPaise,
  isBuyable,
  isSoldOut,
  orderItemName,
  orderLineLabel,
  toCatalogItem,
} from './catalog'
import {
  catalogItemToInput,
  countWithoutOnlinePrice,
  emptyCatalogItemInput,
  managerPriceLine,
  managerStockLine,
  moveId,
  noOnlinePriceHint,
  previewCatalogItem,
} from './manager'
import type { CatalogItem, CatalogOption } from './types'
import { coerceCatalogItemInput, validateCatalogItem, type CatalogItemInput } from './validate'

function option(overrides: Partial<CatalogOption> = {}): CatalogOption {
  return { id: 'o1', label: '500 g', price_paise: 18000, quantity_in_stock: null, sort_order: 0, ...overrides }
}

function item(overrides: Partial<CatalogItem> = {}): CatalogItem {
  return {
    id: 'i1',
    type: 'product',
    name: 'Honey',
    description: null,
    price_paise: 15000,
    price_note: null,
    quantity_in_stock: null,
    image_url: null,
    image_thumb_url: null,
    image_aspect: 'square',
    sort_order: 0,
    options: [],
    ...overrides,
  }
}

function input(overrides: Partial<CatalogItemInput> = {}): CatalogItemInput {
  return { ...emptyCatalogItemInput(), name: 'Honey', price: '150', ...overrides }
}

const visitor = { isOwner: false, isAdmin: false }
const owner = { isOwner: true, isAdmin: false }

test('formatPaise shows rupees the Indian way', () => {
  assert.equal(formatPaise(15000), '₹150')
  assert.equal(formatPaise(37425), '₹374.25')
  assert.equal(formatPaise(139900), '₹1,399')
  assert.equal(formatPaise(10000000), '₹1,00,000')
})

test('catalogPriceLine: fixed price, lowest option, note, or ask', () => {
  assert.equal(catalogPriceLine(item()), '₹150')
  assert.equal(
    catalogPriceLine(item({ price_paise: null, options: [option({ price_paise: 25000 }), option({ id: 'o2', price_paise: 18000 })] })),
    'From ₹180',
  )
  assert.equal(catalogPriceLine(item({ price_paise: null, price_note: 'per kilo' })), 'per kilo')
  assert.equal(catalogPriceLine(item({ price_paise: null })), 'Ask for price')
})

test('isBuyable needs options or a price of at least ₹1', () => {
  assert.equal(isBuyable(item()), true)
  assert.equal(isBuyable(item({ price_paise: 99 })), false)
  assert.equal(isBuyable(item({ price_paise: null })), false)
  assert.equal(isBuyable(item({ price_paise: null, options: [option()] })), true)
})

test('isSoldOut looks at options when there are any', () => {
  assert.equal(isSoldOut(item({ quantity_in_stock: 0 })), true)
  assert.equal(isSoldOut(item({ quantity_in_stock: 3 })), false)
  assert.equal(isSoldOut(item({ price_paise: null, quantity_in_stock: 0, options: [option({ quantity_in_stock: 2 })] })), false)
  assert.equal(
    isSoldOut(item({ price_paise: null, options: [option({ quantity_in_stock: 0 }), option({ id: 'o2', quantity_in_stock: 0 })] })),
    true,
  )
})

test('catalogItemAction: Buy and Book in a live shop', () => {
  assert.deepEqual(catalogItemAction(item(), 'live', visitor, true), { kind: 'buy', label: 'Buy', href: '/checkout/i1' })
  assert.deepEqual(catalogItemAction(item({ type: 'service' }), 'live', visitor, false), {
    kind: 'buy',
    label: 'Book',
    href: '/checkout/i1',
  })
})

test('catalogItemAction: a test shop sells only to its owner', () => {
  assert.equal(catalogItemAction(item(), 'test', owner, true).kind, 'buy')
  assert.deepEqual(catalogItemAction(item(), 'test', visitor, true), { kind: 'whatsapp', label: 'Order on WhatsApp' })
  assert.deepEqual(catalogItemAction(item({ type: 'service' }), 'off', owner, true), { kind: 'whatsapp', label: 'Book on WhatsApp' })
})

test('catalogItemAction: Sold out only ever replaces Buy', () => {
  assert.deepEqual(catalogItemAction(item({ quantity_in_stock: 0 }), 'live', visitor, true), { kind: 'sold_out', label: 'Sold out' })
  assert.deepEqual(
    catalogItemAction(item({ price_paise: null, options: [option({ quantity_in_stock: 0 })] }), 'live', visitor, true),
    { kind: 'sold_out', label: 'Sold out' },
  )
  assert.equal(catalogItemAction(item({ quantity_in_stock: 0 }), 'off', visitor, true).kind, 'whatsapp')
})

test('catalogItemAction: unbuyable items use WhatsApp, or nothing without a number', () => {
  assert.equal(catalogItemAction(item({ price_paise: null, price_note: 'per kilo' }), 'live', visitor, true).kind, 'whatsapp')
  assert.deepEqual(catalogItemAction(item({ price_paise: null }), 'live', visitor, false), { kind: 'none' })
})

test('catalogWhatsAppHref prefills the item and its link', () => {
  const href = catalogWhatsAppHref('+91 98765-43210', item(), '₹150', 'https://farm.ourdahanu.in/p/i1') ?? ''
  assert.ok(href.startsWith('https://wa.me/919876543210?text='))
  assert.equal(
    decodeURIComponent(href.split('?text=')[1] ?? ''),
    "Hi! I'm interested in your product — *Honey* (₹150).\n\nCan you share more details?\n\nhttps://farm.ourdahanu.in/p/i1",
  )
  assert.equal(catalogWhatsAppHref('', item(), '₹150', 'x'), null)
  assert.equal(catalogWhatsAppHref(null, item(), '₹150', 'x'), null)
})

test('firstAvailableOptionId skips sold-out options', () => {
  assert.equal(
    firstAvailableOptionId([option({ id: 'a', quantity_in_stock: 0 }), option({ id: 'b' }), option({ id: 'c', quantity_in_stock: 5 })]),
    'b',
  )
  assert.equal(firstAvailableOptionId([option({ id: 'a', quantity_in_stock: 0 })]), null)
  assert.equal(firstAvailableOptionId([]), null)
})

test('order labels include the option when there is one', () => {
  assert.equal(orderItemName('Honey', '500 g'), 'Honey — 500 g')
  assert.equal(orderItemName('Honey', null), 'Honey')
  assert.equal(orderLineLabel('Honey', '500 g', 2), 'Honey — 500 g ×2')
  assert.equal(orderLineLabel('Honey', null, 1), 'Honey ×1')
})

test('toCatalogItem sorts options and defaults an unknown photo shape to square', () => {
  const shaped = toCatalogItem({
    ...item(),
    image_aspect: 'wide',
    options: [option({ id: 'b', sort_order: 1 }), option({ id: 'a', sort_order: 0 })],
  })
  assert.equal(shaped.image_aspect, 'square')
  assert.deepEqual(shaped.options.map((o) => o.id), ['a', 'b'])
  assert.deepEqual(toCatalogItem({ ...item(), options: null }).options, [])
})

test('validateCatalogItem: one price', () => {
  const result = validateCatalogItem(input({ price: '374.25', stock: '12', description: '  Raw  honey  ' }))
  assert.equal(result.ok, true)
  if (!result.ok) return
  assert.equal(result.values.price_paise, 37425)
  assert.equal(result.values.quantity_in_stock, 12)
  assert.equal(result.values.price_note, null)
  assert.deepEqual(result.values.options, [])
  assert.equal(result.values.description, 'Raw honey')
  assert.equal(result.values.image_aspect, 'square')
  assert.equal(validateCatalogItem(input({ price: '1,399' })).ok, true)
})

test('validateCatalogItem: prices below ₹1, above ₹1 crore and bad numbers are refused', () => {
  const cases: [string, string][] = [
    ['0', 'The price must be at least ₹1.'],
    ['0.50', 'The price must be at least ₹1.'],
    ['', 'Enter a price.'],
    ['12.345', 'Enter a price in rupees, like 150 or 99.50.'],
    ['abc', 'Enter a price in rupees, like 150 or 99.50.'],
    ['10000001', 'The price can be at most ₹1,00,00,000.'],
  ]
  for (const [price, message] of cases) {
    const result = validateCatalogItem(input({ price }))
    assert.equal(result.ok, false, price)
    if (!result.ok) assert.equal(result.errors.price, message, price)
  }
})

test('validateCatalogItem: stock must be a whole number or blank', () => {
  const bad = validateCatalogItem(input({ stock: '2.5' }))
  assert.equal(bad.ok, false)
  if (!bad.ok) assert.equal(bad.errors.stock, 'Enter stock as a whole number, or leave it blank for no limit.')
  const blank = validateCatalogItem(input({ stock: '   ' }))
  assert.equal(blank.ok && blank.values.quantity_in_stock, null)
})

test('validateCatalogItem: a name is required and capped; photo links must be web links', () => {
  const missing = validateCatalogItem(input({ name: '   ' }))
  assert.equal(missing.ok, false)
  if (!missing.ok) assert.equal(missing.errors.name, 'Enter a name.')
  const long = validateCatalogItem(input({ name: 'x'.repeat(100) }))
  assert.equal(long.ok && long.values.name.length, 80)
  const script = validateCatalogItem(input({ imageUrl: 'javascript:alert(1)' }))
  assert.equal(script.ok && script.values.image_url, null)
})

test('validateCatalogItem: options replace the item price and stock', () => {
  const result = validateCatalogItem(
    input({
      pricingMode: 'options',
      price: '150',
      stock: '4',
      options: [
        { id: 'o1', label: '500 g', price: '180', stock: '' },
        { label: '1 kg', price: '340', stock: '3' },
      ],
    }),
  )
  assert.equal(result.ok, true)
  if (!result.ok) return
  assert.equal(result.values.price_paise, null)
  assert.equal(result.values.quantity_in_stock, null)
  assert.deepEqual(result.values.options, [
    { id: 'o1', label: '500 g', price_paise: 18000, quantity_in_stock: null },
    { label: '1 kg', price_paise: 34000, quantity_in_stock: 3 },
  ])
})

test('validateCatalogItem: option rules', () => {
  const none = validateCatalogItem(input({ pricingMode: 'options', options: [] }))
  assert.equal(!none.ok && none.errors.options, 'Add at least one option.')

  const seven = validateCatalogItem(
    input({
      pricingMode: 'options',
      options: Array.from({ length: 7 }, (_, i) => ({ label: `Pack ${i}`, price: '100', stock: '' })),
    }),
  )
  assert.equal(!seven.ok && seven.errors.options, 'You can add up to 6 options.')

  const rows = validateCatalogItem(
    input({
      pricingMode: 'options',
      options: [
        { label: '500 g', price: '180', stock: '' },
        { label: '500 G', price: '0.5', stock: '-1' },
        { label: ' ', price: '100', stock: '' },
      ],
    }),
  )
  assert.equal(rows.ok, false)
  if (rows.ok) return
  assert.deepEqual(rows.errors.optionRows, {
    1: {
      label: 'Each option needs a different label.',
      price: 'The price must be at least ₹1.',
      stock: 'Enter stock as a whole number, or leave it blank for no limit.',
    },
    2: { label: 'Enter a label.' },
  })
})

test('validateCatalogItem: no fixed price keeps only the note', () => {
  const result = validateCatalogItem(
    input({ pricingMode: 'none', price: '150', priceNote: '  Price   on request, call us after 6 pm  ' }),
  )
  assert.equal(result.ok, true)
  if (!result.ok) return
  assert.equal(result.values.price_paise, null)
  assert.equal(result.values.price_note, 'Price on request, call us after')
  const blank = validateCatalogItem(input({ pricingMode: 'none', priceNote: ' ' }))
  assert.equal(blank.ok && blank.values.price_note, null)
})

test('coerceCatalogItemInput turns untrusted data into safe input', () => {
  const coerced = coerceCatalogItemInput({ type: 'service', name: 42, pricingMode: 'weird', options: 'nope', imageAspect: 'portrait' })
  assert.equal(coerced.type, 'service')
  assert.equal(coerced.name, '42')
  assert.equal(coerced.pricingMode, 'none')
  assert.deepEqual(coerced.options, [])
  assert.equal(coerced.imageAspect, 'portrait')
  assert.equal(coerceCatalogItemInput(null).type, 'product')
  const many = coerceCatalogItemInput({ pricingMode: 'options', options: Array.from({ length: 20 }, () => ({ label: 'x' })) })
  assert.equal(many.options.length, 7)
})

test('managerPriceLine and managerStockLine describe each row', () => {
  assert.equal(managerPriceLine(item()), '₹150')
  assert.equal(
    managerPriceLine(item({ price_paise: null, options: [option(), option({ id: 'o2', price_paise: 25000 }), option({ id: 'o3', price_paise: 30000 })] })),
    'From ₹180 · 3 options',
  )
  assert.equal(managerPriceLine(item({ price_paise: null, options: [option()] })), 'From ₹180 · 1 option')
  assert.equal(managerPriceLine(item({ price_paise: null, price_note: 'per kilo' })), 'No fixed price · WhatsApp only')

  assert.equal(managerStockLine(item()), null)
  assert.equal(managerStockLine(item({ quantity_in_stock: 0 })), 'Sold out')
  assert.equal(managerStockLine(item({ quantity_in_stock: 12 })), '12 left')
  assert.equal(managerStockLine(item({ options: [option({ quantity_in_stock: 2 }), option({ id: 'o2', quantity_in_stock: 3 })] })), '5 left')
  assert.equal(managerStockLine(item({ options: [option({ quantity_in_stock: 2 }), option({ id: 'o2' })] })), null)
  assert.equal(managerStockLine(item({ options: [option({ quantity_in_stock: 0 })] })), 'Sold out')
})

test('moveId swaps neighbours and ignores moves past the ends', () => {
  assert.deepEqual(moveId(['a', 'b', 'c'], 'b', 'up'), ['b', 'a', 'c'])
  assert.deepEqual(moveId(['a', 'b', 'c'], 'b', 'down'), ['a', 'c', 'b'])
  assert.deepEqual(moveId(['a', 'b', 'c'], 'a', 'up'), ['a', 'b', 'c'])
  assert.deepEqual(moveId(['a', 'b', 'c'], 'c', 'down'), ['a', 'b', 'c'])
  assert.deepEqual(moveId(['a', 'b'], 'zzz', 'up'), ['a', 'b'])
})

test('noOnlinePriceHint counts visible items customers cannot buy', () => {
  const items = [
    { ...item({ price_paise: null }), is_active: true },
    { ...item({ price_paise: null }), is_active: false },
    { ...item(), is_active: true },
  ]
  assert.equal(countWithoutOnlinePrice(items), 1)
  assert.equal(
    noOnlinePriceHint(1),
    '1 item has no fixed price. Customers can only ask about it on WhatsApp. Add a price to sell it online.',
  )
  assert.equal(
    noOnlinePriceHint(3),
    '3 items have no fixed price. Customers can only ask about them on WhatsApp. Add a price to sell them online.',
  )
})

test('catalogItemToInput round-trips through validation', () => {
  const original = item({
    price_paise: null,
    options: [option({ id: 'o1', price_paise: 37425, quantity_in_stock: 4 })],
    description: 'Raw honey',
    image_url: 'https://x.test/h.jpg',
    image_aspect: 'portrait',
  })
  const form = catalogItemToInput(original)
  assert.equal(form.pricingMode, 'options')
  assert.deepEqual(form.options, [{ id: 'o1', label: '500 g', price: '374.25', stock: '4' }])
  const result = validateCatalogItem(form)
  assert.equal(result.ok, true)
  if (!result.ok) return
  assert.deepEqual(result.values.options, [{ id: 'o1', label: '500 g', price_paise: 37425, quantity_in_stock: 4 }])
  assert.equal(result.values.image_aspect, 'portrait')
  assert.equal(catalogItemToInput(item({ price_paise: null, price_note: 'per kilo' })).pricingMode, 'none')
  assert.equal(catalogItemToInput(item()).pricingMode, 'fixed')
})

test('previewCatalogItem shows what customers will see before saving', () => {
  const preview = previewCatalogItem(
    input({
      pricingMode: 'options',
      options: [
        { label: '500 g', price: '180', stock: '0' },
        { label: '', price: '99', stock: '' },
      ],
    }),
  )
  assert.equal(preview.name, 'Honey')
  assert.equal(preview.options.length, 1)
  assert.equal(catalogPriceLine(preview), 'From ₹180')
  assert.equal(isSoldOut(preview), true)
  assert.equal(previewCatalogItem(input({ name: '' })).name, 'Item name')
})
```

- [ ] **Step 3: Register and run the tests to see them fail**

In `package.json`, append ` src/lib/catalog/catalog.test.ts` to the end of the `test:existing` file list (after `src/lib/notifications/selling-templates.test.ts`).

Run: `npx tsx --test src/lib/catalog/catalog.test.ts`
Expected: FAIL (cannot find module `./catalog`).

- [ ] **Step 4: Write `src/lib/catalog/catalog.ts`**

```ts
import { canBuyFromShop, type ShopMode } from '../selling/shop-mode'
import { normalizeServiceImageAspect } from '../service-image'
import type { CatalogItem, CatalogOption, OwnerCatalogItem } from './types'

/** Razorpay's minimum order, and the lowest price an item can be sold for online. */
export const MIN_ONLINE_PRICE_PAISE = 100
/** ₹1 crore. price_paise is a 32-bit integer column. */
export const MAX_PRICE_PAISE = 1_000_000_000
export const MAX_OPTIONS = 6

const OPTION_COLUMNS = 'id, label, price_paise, quantity_in_stock, sort_order'

/** Public item columns with options embedded (RLS hides options of hidden items). */
export const CATALOG_ITEM_SELECT = `id, type, name, description, price_paise, price_note, quantity_in_stock, image_url, image_thumb_url, image_aspect, sort_order, options:listing_product_options(${OPTION_COLUMNS})`

/** Every item column, for the owner's manager, with options embedded. */
export const OWNER_CATALOG_ITEM_SELECT = `*, options:listing_product_options(${OPTION_COLUMNS})`

/** A database row before shaping: the photo shape is free text and options may be missing. */
export type CatalogRow = Omit<CatalogItem, 'image_aspect' | 'options'> & {
  image_aspect: string | null
  options?: CatalogOption[] | null
}

export type OwnerCatalogRow = CatalogRow &
  Pick<OwnerCatalogItem, 'listing_id' | 'is_active' | 'legacy_service_index' | 'created_at' | 'updated_at'>

export function formatPaise(paise: number): string {
  return `₹${(paise / 100).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`
}

export function sortCatalogOptions(options: readonly CatalogOption[] | null | undefined): CatalogOption[] {
  return [...(options ?? [])].sort((a, b) => a.sort_order - b.sort_order || a.label.localeCompare(b.label))
}

export function toCatalogItem<T extends CatalogRow>(
  row: T,
): Omit<T, 'image_aspect' | 'options'> & Pick<CatalogItem, 'image_aspect' | 'options'> {
  return {
    ...row,
    image_aspect: normalizeServiceImageAspect(row.image_aspect, 'square'),
    options: sortCatalogOptions(row.options),
  } as Omit<T, 'image_aspect' | 'options'> & Pick<CatalogItem, 'image_aspect' | 'options'>
}

/** Options, or a fixed price of at least ₹1. */
export function isBuyable(item: { price_paise: number | null; options: readonly unknown[] }): boolean {
  return item.options.length > 0 || (item.price_paise ?? 0) >= MIN_ONLINE_PRICE_PAISE
}

export function isAvailable(stock: number | null): boolean {
  return stock === null || stock > 0
}

export function isSoldOut(item: Pick<CatalogItem, 'quantity_in_stock' | 'options'>): boolean {
  return item.options.length > 0
    ? item.options.every((option) => option.quantity_in_stock === 0)
    : item.quantity_in_stock === 0
}

export function lowestOptionPrice(options: readonly CatalogOption[]): number | null {
  return options.length === 0 ? null : Math.min(...options.map((option) => option.price_paise))
}

export function catalogPriceLine(item: Pick<CatalogItem, 'price_paise' | 'price_note' | 'options'>): string {
  const lowest = lowestOptionPrice(item.options)
  if (lowest !== null) return `From ${formatPaise(lowest)}`
  if (item.price_paise !== null) return formatPaise(item.price_paise)
  return item.price_note ?? 'Ask for price'
}

export type CatalogAction =
  | { kind: 'buy'; label: 'Buy' | 'Book'; href: string }
  | { kind: 'sold_out'; label: 'Sold out' }
  | { kind: 'whatsapp'; label: 'Order on WhatsApp' | 'Book on WhatsApp' }
  | { kind: 'none' }

export function catalogItemAction(
  item: Pick<CatalogItem, 'id' | 'type' | 'price_paise' | 'quantity_in_stock' | 'options'>,
  shopMode: ShopMode,
  viewer: { isOwner: boolean; isAdmin: boolean },
  hasContactNumber: boolean,
): CatalogAction {
  const isService = item.type === 'service'
  if (canBuyFromShop(shopMode, viewer) && isBuyable(item)) {
    if (isSoldOut(item)) return { kind: 'sold_out', label: 'Sold out' }
    return { kind: 'buy', label: isService ? 'Book' : 'Buy', href: `/checkout/${item.id}` }
  }
  if (!hasContactNumber) return { kind: 'none' }
  return { kind: 'whatsapp', label: isService ? 'Book on WhatsApp' : 'Order on WhatsApp' }
}

export function catalogWhatsAppHref(
  number: string | null,
  item: Pick<CatalogItem, 'type' | 'name'>,
  priceLine: string,
  itemUrl: string,
): string | null {
  const digits = (number ?? '').replace(/\D/g, '')
  if (!digits) return null
  const message = `Hi! I'm interested in your ${item.type} — *${item.name}* (${priceLine}).\n\nCan you share more details?\n\n${itemUrl}`
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`
}

export function firstAvailableOptionId(options: readonly CatalogOption[]): string | null {
  return options.find((option) => isAvailable(option.quantity_in_stock))?.id ?? null
}

export function orderItemName(name: string, optionLabel: string | null | undefined): string {
  return optionLabel ? `${name} — ${optionLabel}` : name
}

export function orderLineLabel(name: string, optionLabel: string | null | undefined, quantity: number): string {
  return `${orderItemName(name, optionLabel)} ×${quantity}`
}
```

- [ ] **Step 5: Write `src/lib/catalog/validate.ts`**

```ts
import { normalizeServiceImageAspect, type ServiceImageAspect } from '../service-image'
import { MAX_OPTIONS, MAX_PRICE_PAISE, MIN_ONLINE_PRICE_PAISE } from './catalog'
import type { CatalogItemType } from './types'

export const NAME_MAX = 80
export const DESCRIPTION_MAX = 600
export const PRICE_NOTE_MAX = 32
export const OPTION_LABEL_MAX = 40
const STOCK_MAX = 1_000_000

export type PricingMode = 'fixed' | 'options' | 'none'

/** What the item form holds: raw text, exactly as typed. */
export interface CatalogOptionInput {
  id?: string
  label: string
  price: string
  stock: string
}

export interface CatalogItemInput {
  type: CatalogItemType
  name: string
  description: string
  imageUrl: string
  imageAspect: ServiceImageAspect
  pricingMode: PricingMode
  price: string
  stock: string
  priceNote: string
  options: CatalogOptionInput[]
}

/** Clean values ready to write to listing_products and listing_product_options. */
export interface CatalogItemValues {
  type: CatalogItemType
  name: string
  description: string | null
  image_url: string | null
  image_aspect: ServiceImageAspect
  price_paise: number | null
  quantity_in_stock: number | null
  price_note: string | null
  options: { id?: string; label: string; price_paise: number; quantity_in_stock: number | null }[]
}

export type OptionFieldErrors = Partial<Record<'label' | 'price' | 'stock', string>>

export interface CatalogItemErrors {
  name?: string
  price?: string
  stock?: string
  options?: string
  optionRows?: Record<number, OptionFieldErrors>
}

export type CatalogItemValidation =
  | { ok: true; values: CatalogItemValues }
  | { ok: false; errors: CatalogItemErrors }

const PRICE_PATTERN = /^\d+(\.\d{1,2})?$/

export function parsePrice(raw: string): { paise: number } | { error: string } {
  const value = raw.trim().replace(/,/g, '')
  if (!value) return { error: 'Enter a price.' }
  if (!PRICE_PATTERN.test(value)) return { error: 'Enter a price in rupees, like 150 or 99.50.' }
  const paise = Math.round(Number(value) * 100)
  if (paise < MIN_ONLINE_PRICE_PAISE) return { error: 'The price must be at least ₹1.' }
  if (paise > MAX_PRICE_PAISE) return { error: 'The price can be at most ₹1,00,00,000.' }
  return { paise }
}

export function parseStock(raw: string): { stock: number | null } | { error: string } {
  const value = raw.trim()
  if (!value) return { stock: null }
  if (!/^\d+$/.test(value) || Number(value) > STOCK_MAX) {
    return { error: 'Enter stock as a whole number, or leave it blank for no limit.' }
  }
  return { stock: Number(value) }
}

function inlineText(value: string, max: number): string {
  return value.replace(/\s+/g, ' ').trim().slice(0, max).trim()
}

function multilineText(value: string, max: number): string | null {
  const text = value
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => line.replace(/[ \t]+/g, ' ').trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, max)
    .trim()
  return text || null
}

export function validateCatalogItem(input: CatalogItemInput): CatalogItemValidation {
  const errors: CatalogItemErrors = {}

  const name = inlineText(input.name, NAME_MAX)
  if (!name) errors.name = 'Enter a name.'

  const imageUrl = input.imageUrl.trim()
  let price_paise: number | null = null
  let quantity_in_stock: number | null = null
  let price_note: string | null = null
  const options: CatalogItemValues['options'] = []

  if (input.pricingMode === 'fixed') {
    const price = parsePrice(input.price)
    if ('error' in price) errors.price = price.error
    else price_paise = price.paise
    const stock = parseStock(input.stock)
    if ('error' in stock) errors.stock = stock.error
    else quantity_in_stock = stock.stock
  } else if (input.pricingMode === 'options') {
    if (input.options.length === 0) errors.options = 'Add at least one option.'
    else if (input.options.length > MAX_OPTIONS) errors.options = `You can add up to ${MAX_OPTIONS} options.`

    const seenLabels = new Set<string>()
    const optionRows: Record<number, OptionFieldErrors> = {}
    input.options.forEach((row, index) => {
      const rowErrors: OptionFieldErrors = {}
      const label = inlineText(row.label, OPTION_LABEL_MAX)
      if (!label) rowErrors.label = 'Enter a label.'
      else if (seenLabels.has(label.toLowerCase())) rowErrors.label = 'Each option needs a different label.'
      else seenLabels.add(label.toLowerCase())

      const price = parsePrice(row.price)
      if ('error' in price) rowErrors.price = price.error
      const stock = parseStock(row.stock)
      if ('error' in stock) rowErrors.stock = stock.error

      if ('error' in price || 'error' in stock || rowErrors.label) {
        optionRows[index] = rowErrors
        return
      }
      options.push({
        ...(row.id ? { id: row.id } : {}),
        label,
        price_paise: price.paise,
        quantity_in_stock: stock.stock,
      })
    })
    if (Object.keys(optionRows).length > 0) errors.optionRows = optionRows
  } else {
    price_note = inlineText(input.priceNote, PRICE_NOTE_MAX) || null
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors }

  return {
    ok: true,
    values: {
      type: input.type === 'service' ? 'service' : 'product',
      name,
      description: multilineText(input.description, DESCRIPTION_MAX),
      image_url: /^https?:\/\//i.test(imageUrl) ? imageUrl : null,
      image_aspect: normalizeServiceImageAspect(input.imageAspect, 'square'),
      price_paise,
      quantity_in_stock,
      price_note,
      options,
    },
  }
}

function text(value: unknown): string {
  if (typeof value === 'string') return value
  if (typeof value === 'number') return String(value)
  return ''
}

/** Server actions receive untrusted data: shape it before validating. */
export function coerceCatalogItemInput(raw: unknown): CatalogItemInput {
  const source = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const mode = source.pricingMode
  // One extra row survives so validation can still report "up to 6".
  const rows = Array.isArray(source.options) ? source.options.slice(0, MAX_OPTIONS + 1) : []
  return {
    type: source.type === 'service' ? 'service' : 'product',
    name: text(source.name),
    description: text(source.description),
    imageUrl: text(source.imageUrl),
    imageAspect: normalizeServiceImageAspect(source.imageAspect, 'square'),
    pricingMode: mode === 'fixed' || mode === 'options' ? mode : 'none',
    price: text(source.price),
    stock: text(source.stock),
    priceNote: text(source.priceNote),
    options: rows.map((row) => {
      const option = (row && typeof row === 'object' ? row : {}) as Record<string, unknown>
      return {
        ...(typeof option.id === 'string' && option.id ? { id: option.id } : {}),
        label: text(option.label),
        price: text(option.price),
        stock: text(option.stock),
      }
    }),
  }
}
```

- [ ] **Step 6: Write `src/lib/catalog/manager.ts`**

```ts
import { formatPaise, isBuyable, lowestOptionPrice } from './catalog'
import type { CatalogItem } from './types'
import { parsePrice, parseStock, type CatalogItemInput } from './validate'

export function managerPriceLine(item: Pick<CatalogItem, 'price_paise' | 'options'>): string {
  const lowest = lowestOptionPrice(item.options)
  if (lowest !== null) {
    const count = item.options.length
    return `From ${formatPaise(lowest)} · ${count} ${count === 1 ? 'option' : 'options'}`
  }
  if (item.price_paise !== null) return formatPaise(item.price_paise)
  return 'No fixed price · WhatsApp only'
}

export function managerStockLine(item: Pick<CatalogItem, 'quantity_in_stock' | 'options'>): string | null {
  if (item.options.length > 0) {
    if (item.options.every((option) => option.quantity_in_stock === 0)) return 'Sold out'
    if (item.options.some((option) => option.quantity_in_stock === null)) return null
    const total = item.options.reduce((sum, option) => sum + (option.quantity_in_stock ?? 0), 0)
    return `${total} left`
  }
  if (item.quantity_in_stock === null) return null
  return item.quantity_in_stock === 0 ? 'Sold out' : `${item.quantity_in_stock} left`
}

export function moveId(ids: readonly string[], id: string, direction: 'up' | 'down'): string[] {
  const index = ids.indexOf(id)
  const target = direction === 'up' ? index - 1 : index + 1
  const next = [...ids]
  if (index < 0 || target < 0 || target >= ids.length) return next
  ;[next[index], next[target]] = [next[target], next[index]]
  return next
}

export function countWithoutOnlinePrice(
  items: readonly { is_active: boolean; price_paise: number | null; options: readonly unknown[] }[],
): number {
  return items.filter((item) => item.is_active && !isBuyable(item)).length
}

export function noOnlinePriceHint(count: number): string {
  return count === 1
    ? '1 item has no fixed price. Customers can only ask about it on WhatsApp. Add a price to sell it online.'
    : `${count} items have no fixed price. Customers can only ask about them on WhatsApp. Add a price to sell them online.`
}

export function emptyCatalogItemInput(): CatalogItemInput {
  return {
    type: 'product',
    name: '',
    description: '',
    imageUrl: '',
    imageAspect: 'square',
    pricingMode: 'fixed',
    price: '',
    stock: '',
    priceNote: '',
    options: [],
  }
}

const rupees = (paise: number) => String(paise / 100)
const stockText = (stock: number | null) => (stock === null ? '' : String(stock))

export function catalogItemToInput(item: CatalogItem): CatalogItemInput {
  return {
    type: item.type,
    name: item.name,
    description: item.description ?? '',
    imageUrl: item.image_url ?? '',
    imageAspect: item.image_aspect,
    pricingMode: item.options.length > 0 ? 'options' : item.price_paise !== null ? 'fixed' : 'none',
    price: item.price_paise !== null ? rupees(item.price_paise) : '',
    stock: stockText(item.quantity_in_stock),
    priceNote: item.price_note ?? '',
    options: item.options.map((option) => ({
      id: option.id,
      label: option.label,
      price: rupees(option.price_paise),
      stock: stockText(option.quantity_in_stock),
    })),
  }
}

/** The customer card for unsaved form values; rows that are not valid yet are left out. */
export function previewCatalogItem(input: CatalogItemInput, id = 'preview'): CatalogItem {
  const price = input.pricingMode === 'fixed' ? parsePrice(input.price) : null
  const stock = input.pricingMode === 'fixed' ? parseStock(input.stock) : null
  const options =
    input.pricingMode === 'options'
      ? input.options.flatMap((row, index) => {
          const optionPrice = parsePrice(row.price)
          const optionStock = parseStock(row.stock)
          const label = row.label.trim()
          if (!label || 'error' in optionPrice) return []
          return [
            {
              id: row.id ?? `${id}-option-${index}`,
              label,
              price_paise: optionPrice.paise,
              quantity_in_stock: 'error' in optionStock ? null : optionStock.stock,
              sort_order: index,
            },
          ]
        })
      : []

  return {
    id,
    type: input.type,
    name: input.name.trim() || 'Item name',
    description: input.description.trim() || null,
    price_paise: price && !('error' in price) ? price.paise : null,
    price_note: input.pricingMode === 'none' ? input.priceNote.trim() || null : null,
    quantity_in_stock: stock && !('error' in stock) ? stock.stock : null,
    image_url: input.imageUrl || null,
    image_thumb_url: input.imageUrl || null,
    image_aspect: input.imageAspect,
    sort_order: 0,
    options,
  }
}
```

- [ ] **Step 7: Run the tests**

Run: `npx tsx --test src/lib/catalog/catalog.test.ts`
Expected: PASS, 0 failures.

- [ ] **Step 8: Full checks**

Run: `npx tsc --noEmit` (no errors), `npm run lint` (0 errors, 11 warnings), `npm run test:existing` (only the known clock-dependent failure).

- [ ] **Step 9: Commit**

```bash
git add src/lib/catalog package.json
git commit -m "feat(catalog): shared rules for prices, options, Buy or WhatsApp and the item form"
```

---

### Task 3: One catalog section for customers, and Buy on shared item links

**Files:**
- Modify: `src/lib/data/listing-detail.ts`, `src/lib/data/product-detail.ts`
- Create: `src/components/catalog/CatalogItemCard.tsx`, `src/app/listings/[id]/components/CatalogSection.tsx`
- Modify: `src/app/listings/[id]/components/ListingContent.tsx`, `src/app/listings/[id]/components/ListingNavigation.tsx`, `src/app/listings/[id]/page.tsx`, `src/app/p/[productId]/page.tsx`, `src/app/checkout/[productId]/page.tsx`
- Delete: `src/components/ProductCard.tsx`, `src/components/BuyButton.tsx`, `src/components/OrderModal.tsx`, `src/app/listings/[id]/ServicesSection.tsx`

**Interfaces:**
- Consumes (Task 2): `CatalogItem`, `CATALOG_ITEM_SELECT`, `CatalogRow`, `toCatalogItem`, `catalogItemAction`, `catalogPriceLine`, `catalogWhatsAppHref`, `formatPaise`, `isBuyable`, `CatalogAction`. (Task 1) regenerated types with `listing_product_options`.
- Produces:
  - `ListingProductPublic` is now an alias of `CatalogItem`; `ListingDetailData.products` holds active items for **every** approved listing.
  - `fetchProductAndListing(productId): Promise<{ product: StandaloneProduct; listing: StandaloneProductListing | null; shopMode: ShopMode } | null>` where `StandaloneProduct extends CatalogItem { listing_id: string }`.
  - `CatalogItemCard({ item, action, whatsappHref, shareUrl })` default export and `CatalogActionButton({ action, whatsappHref, size? })` named export from `src/components/catalog/CatalogItemCard.tsx` (Task 8's preview uses both).

- [ ] **Step 1: Load the catalog for every approved listing** — `src/lib/data/listing-detail.ts`

Add imports:

```ts
import { CATALOG_ITEM_SELECT, toCatalogItem, type CatalogRow } from '@/lib/catalog/catalog'
import type { CatalogItem } from '@/lib/catalog/types'
```

Replace the whole `export interface ListingProductPublic { … }` block with:

```ts
export type ListingProductPublic = CatalogItem
```

Replace the products entry in `Promise.all` (the `paymentsEnabled ? supabase.from('listing_products')… : Promise.resolve({ data: [] as ListingProductPublic[] })` expression) with:

```ts
      // Every approved listing shows its catalog; shopMode decides Buy or WhatsApp.
      supabase
        .from('listing_products')
        .select(CATALOG_ITEM_SELECT)
        .eq('listing_id', listingId)
        .eq('is_active', true)
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true })
        .order('id', { ascending: true }),
```

Replace `const products = (productsResult.data ?? []) as ListingProductPublic[]` with:

```ts
    const products: ListingProductPublic[] = ((productsResult.data ?? []) as unknown as CatalogRow[]).map(
      (row) => toCatalogItem(row),
    )
```

The payment config read stays conditional on `paymentsEnabled`.

- [ ] **Step 2: Rewrite `src/lib/data/product-detail.ts`**

```ts
import 'server-only'

import { cacheLife, cacheTag } from 'next/cache'

import { CACHE_TAGS } from '@/lib/cache-tags'
import { PUBLIC_CONTENT_CACHE } from '@/lib/cache-policy'
import { CATALOG_ITEM_SELECT, toCatalogItem, type CatalogRow } from '@/lib/catalog/catalog'
import type { CatalogItem } from '@/lib/catalog/types'
import { logCacheRegeneration } from '@/lib/isr-debug'
import { deriveShopMode, type ShopMode } from '@/lib/selling/shop-mode'
import { createAdminClient } from '@/lib/supabase/admin-client'
import { createPublicClient } from '@/lib/supabase/public'

export interface StandaloneProduct extends CatalogItem {
  listing_id: string
}

export interface StandaloneProductListing {
  id: string
  name: string
  subdomain: string | null
  whatsapp: string | null
  phone: string | null
  approved: boolean
}

export async function fetchProductAndListing(productId: string): Promise<{
  product: StandaloneProduct
  listing: StandaloneProductListing | null
  shopMode: ShopMode
} | null> {
  'use cache'

  cacheLife(PUBLIC_CONTENT_CACHE)

  const supabase = createPublicClient()
  const { data: productData } = await supabase
    .from('listing_products')
    .select(`listing_id, ${CATALOG_ITEM_SELECT}`)
    .eq('id', productId)
    .eq('is_active', true)
    .maybeSingle()
  if (!productData) return null
  const product = toCatalogItem(productData as unknown as CatalogRow & { listing_id: string })

  // Tagged with the owning listing, which is only known once the product is
  // fetched — the same after-the-fetch tagging getCachedListingDetail uses.
  //
  // This matters beyond freshness: /checkout reads price and stock from here,
  // while the Razorpay order is created from the live DB row. Without a tag
  // nothing could invalidate this entry, so a seller's price edit would leave
  // the buyer charged the new amount while the receipt showed the old one, and
  // a restocked item would keep rendering "Sold out". Every product mutation
  // already calls revalidatePublicListingDetail(listing_id), so subscribing to
  // that tag is all this needed.
  cacheTag(CACHE_TAGS.listing(product.listing_id))
  logCacheRegeneration({
    scope: 'product:detail',
    tags: [CACHE_TAGS.listing(product.listing_id)],
    detail: { productId },
  })

  const { data: listingData } = await supabase
    .from('listings')
    .select('id, name, subdomain, whatsapp, phone, approved, payments_enabled, payments_suspended_at')
    .eq('id', product.listing_id)
    .eq('approved', true)
    .maybeSingle()
  const listingRow = (listingData ?? null) as
    | (StandaloneProductListing & { payments_enabled: boolean | null; payments_suspended_at: string | null })
    | null

  // Payment configs have no public read policy; the key id is read only to
  // tell test keys from live keys and never leaves this function.
  const adminClient = listingRow?.payments_enabled ? createAdminClient() : null
  const { data: configData } = adminClient
    ? await adminClient
        .from('listing_payment_configs')
        .select('verified_at, razorpay_key_id')
        .eq('listing_id', product.listing_id)
        .maybeSingle()
    : { data: null }
  const config = (configData ?? null) as { verified_at: string | null; razorpay_key_id: string } | null

  const shopMode = deriveShopMode({
    approved: listingRow?.approved === true,
    paymentsEnabled: listingRow?.payments_enabled === true,
    suspendedAt: listingRow?.payments_suspended_at ?? null,
    verifiedAt: config?.verified_at ?? null,
    keyId: config?.razorpay_key_id ?? null,
  })

  const listing: StandaloneProductListing | null = listingRow
    ? {
        id: listingRow.id,
        name: listingRow.name,
        subdomain: listingRow.subdomain,
        whatsapp: listingRow.whatsapp,
        phone: listingRow.phone,
        approved: listingRow.approved,
      }
    : null

  return { product, listing, shopMode }
}
```

- [ ] **Step 3: Create `src/components/catalog/CatalogItemCard.tsx`**

```tsx
'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Check, Link2, MessageCircle, Package, ShoppingBag, Wrench } from 'lucide-react'

import { catalogPriceLine, type CatalogAction } from '@/lib/catalog/catalog'
import type { CatalogItem } from '@/lib/catalog/types'
import { getServiceImageAspectOption } from '@/lib/service-image'

function ShareButton({ url }: { url: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url)
    } catch {
      const textarea = document.createElement('textarea')
      textarea.value = url
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      title="Copy a link to this item"
      className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-[var(--od-border)] bg-white px-3 text-xs font-semibold text-[var(--od-muted)] transition-colors hover:border-[var(--od-brand)] hover:text-[var(--od-brand)]"
    >
      {copied ? <Check size={13} aria-hidden /> : <Link2 size={13} aria-hidden />}
      {copied ? 'Copied' : 'Share'}
    </button>
  )
}

export function CatalogActionButton({
  action,
  whatsappHref,
  size = 'sm',
}: {
  action: CatalogAction
  whatsappHref: string | null
  size?: 'sm' | 'lg'
}) {
  const sizing = size === 'lg' ? 'w-full min-h-12 px-4 text-sm' : 'min-h-10 px-4 text-sm'

  if (action.kind === 'buy') {
    return (
      <Link href={action.href} className={`od-button-primary ${sizing}`}>
        <ShoppingBag size={15} aria-hidden />
        {action.label}
      </Link>
    )
  }
  if (action.kind === 'sold_out') {
    return (
      <button
        type="button"
        disabled
        className={`inline-flex cursor-not-allowed items-center justify-center rounded-xl border border-[var(--od-border)] bg-[var(--od-surface-soft)] font-semibold text-[var(--od-muted)] ${sizing}`}
      >
        {action.label}
      </button>
    )
  }
  if (action.kind === 'whatsapp' && whatsappHref) {
    return (
      <a
        href={whatsappHref}
        target="_blank"
        rel="noopener noreferrer"
        className={`inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#1FA855] font-bold text-white transition-colors hover:bg-[#188F47] ${sizing}`}
      >
        <MessageCircle size={15} aria-hidden />
        {action.label}
      </a>
    )
  }
  return null
}

export default function CatalogItemCard({
  item,
  action,
  whatsappHref,
  shareUrl,
}: {
  item: CatalogItem
  action: CatalogAction
  whatsappHref: string | null
  shareUrl: string | null
}) {
  const aspect = getServiceImageAspectOption(item.image_aspect, 'square')
  const imageUrl = item.image_url || item.image_thumb_url
  const isService = item.type === 'service'

  return (
    <article id={`item-${item.id}`} className="od-card flex scroll-mt-28 flex-col overflow-hidden">
      {imageUrl && (
        <div className="bg-[var(--od-surface-soft)]">
          <div
            className={`relative overflow-hidden ${aspect.value === 'portrait' ? 'mx-auto w-3/4' : 'w-full'}`}
            style={{ aspectRatio: aspect.cssAspectRatio }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={imageUrl} alt={item.name} loading="lazy" className="h-full w-full object-cover" />
          </div>
        </div>
      )}

      <div className="flex flex-1 flex-col gap-2 p-4">
        <span className="inline-flex w-fit items-center gap-1 rounded-full bg-[var(--od-surface-soft)] px-2 py-0.5 text-[11px] font-bold text-[var(--od-brand-strong)]">
          {isService ? <Wrench size={11} aria-hidden /> : <Package size={11} aria-hidden />}
          {isService ? 'Service' : 'Product'}
        </span>
        <h3 className="text-base font-extrabold leading-snug text-[var(--od-ink)]">{item.name}</h3>
        {item.description && (
          <p className="line-clamp-3 whitespace-pre-line text-sm leading-relaxed text-[var(--od-muted)]">
            {item.description}
          </p>
        )}
        <p className="mt-auto pt-1 text-lg font-extrabold text-[var(--od-ink)]">{catalogPriceLine(item)}</p>
        <div className="flex flex-wrap items-center gap-2">
          <CatalogActionButton action={action} whatsappHref={whatsappHref} />
          {shareUrl && <ShareButton url={shareUrl} />}
        </div>
      </div>
    </article>
  )
}
```

- [ ] **Step 4: Create `src/app/listings/[id]/components/CatalogSection.tsx`**

```tsx
'use client'

import { useState } from 'react'
import { CheckCircle } from 'lucide-react'

import Card from '@/components/ui/Card'
import CatalogItemCard from '@/components/catalog/CatalogItemCard'
import { catalogItemAction, catalogPriceLine, catalogWhatsAppHref } from '@/lib/catalog/catalog'
import type { CatalogItem } from '@/lib/catalog/types'
import type { ShopMode } from '@/lib/selling/shop-mode'
import { useListingViewer } from '../ListingViewerContext'

const INITIAL_VISIBLE = 8

export default function CatalogSection({
  items,
  shopMode,
  listingName,
  businessUrl,
  whatsappNum,
}: {
  items: CatalogItem[]
  shopMode: ShopMode
  listingName: string
  businessUrl: string
  whatsappNum: string | null
}) {
  const viewer = useListingViewer()
  const [showAll, setShowAll] = useState(false)

  if (items.length === 0) return null

  // The server refuses checkout on a test shop for anyone but its owner, so
  // this only decides which button to show.
  const buyer = { isOwner: viewer.isOwner, isAdmin: false }
  const ownerTesting = shopMode === 'test' && viewer.isOwner
  const visible = showAll ? items : items.slice(0, INITIAL_VISIBLE)

  return (
    <Card id="services" className="scroll-mt-32">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-base font-bold text-ink">
          <span className="inline-block h-4 w-1 rounded-full bg-brand" />
          Products &amp; Services
        </h2>
        {shopMode === 'live' && (
          <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2.5 py-1 text-[11px] font-semibold text-green-700">
            <CheckCircle size={11} aria-hidden />
            Pay online · straight to {listingName}
          </span>
        )}
        {ownerTesting && (
          <span className="inline-flex items-center rounded-full bg-[rgba(200,136,30,0.14)] px-2.5 py-1 text-[11px] font-bold text-[var(--od-brand-strong)]">
            Test mode
          </span>
        )}
      </div>

      {ownerTesting && (
        <p
          role="note"
          className="mb-4 rounded-xl border border-[rgba(200,136,30,0.35)] bg-[rgba(200,136,30,0.07)] px-3.5 py-2.5 text-[13px] leading-relaxed text-[var(--od-ink-2)]"
        >
          Test mode · only you see Buy buttons. Try a practice purchase — no real money moves.
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {visible.map((item) => {
          const itemUrl = `${businessUrl}/p/${item.id}`
          const action = catalogItemAction(item, shopMode, buyer, Boolean(whatsappNum))
          return (
            <CatalogItemCard
              key={item.id}
              item={item}
              action={action}
              whatsappHref={
                action.kind === 'whatsapp' ? catalogWhatsAppHref(whatsappNum, item, catalogPriceLine(item), itemUrl) : null
              }
              shareUrl={itemUrl}
            />
          )
        })}
      </div>

      {!showAll && items.length > INITIAL_VISIBLE && (
        <button
          type="button"
          onClick={() => setShowAll(true)}
          className="od-button-secondary mt-4 min-h-11 w-full text-sm"
        >
          Show all {items.length} items
        </button>
      )}
    </Card>
  )
}
```

- [ ] **Step 5: Use the section in `ListingContent.tsx`**

- Remove the imports of `CheckCircle`, `ServicesSection`, `ProductCard`, `BuyButton`, and `NormalizedService` (keep `AppointmentSettings`: `import type { AppointmentSettings } from '@/lib/listing-content'`). Change the listing-detail type import to `import type { ListingRecord } from '@/lib/data/listing-detail'` and add `import type { CatalogItem } from '@/lib/catalog/types'` and `import CatalogSection from './CatalogSection'`.
- In `ListingContentProps` and the destructured props: remove `services`; rename `marketplaceProducts: ListingProductPublic[]` to `catalogItems: CatalogItem[]`.
- Delete the `showShop` constant and its comment.
- Replace both the `{/* Services & Products */}` block and the `{/* Marketplace — shoppable products & services */}` block with:

```tsx
      <CatalogSection
        items={catalogItems}
        shopMode={shopMode}
        listingName={String(listing.name)}
        businessUrl={businessUrl}
        whatsappNum={whatsappNum}
      />
```

`viewer` stays (the booking widget uses it).

- [ ] **Step 6: One navigation link** — replace `src/app/listings/[id]/components/ListingNavigation.tsx` with:

```tsx
"use client"

import React from 'react'
import Badge from '@/components/ui/Badge'

interface ListingNavigationProps {
  hasCatalog: boolean
  photos: string[]
}

export default function ListingNavigation({ hasCatalog, photos }: ListingNavigationProps) {
  const hasPhotos = photos && photos.length > 0

  return (
    <nav className="sticky top-[62px] z-30 mb-5 -mx-4 overflow-x-auto border-y border-border bg-[rgba(250,250,247,0.9)] px-4 py-2 backdrop-blur-xl md:static md:mx-0 md:rounded-2xl md:border">
      <div className="flex min-w-max gap-2">
        <a href="#overview">
          <Badge variant="outline" size="md" className="cursor-pointer hover:border-brand hover:text-brand font-medium">Overview</Badge>
        </a>
        {hasCatalog && (
          <a href="#services">
            <Badge variant="outline" size="md" className="cursor-pointer hover:border-brand hover:text-brand font-medium">Products &amp; Services</Badge>
          </a>
        )}
        {hasPhotos && (
          <a href="#photos">
            <Badge variant="outline" size="md" className="cursor-pointer hover:border-brand hover:text-brand font-medium">Photos</Badge>
          </a>
        )}
        <a href="#reviews">
          <Badge variant="outline" size="md" className="cursor-pointer hover:border-brand hover:text-brand font-medium">Reviews</Badge>
        </a>
        <a href="#contact">
          <Badge variant="outline" size="md" className="cursor-pointer hover:border-brand hover:text-brand font-medium">Contact</Badge>
        </a>
      </div>
    </nav>
  )
}
```

- [ ] **Step 7: Wire the business page** — `src/app/listings/[id]/page.tsx`

- In `generateMetadata`, delete the `parsedServices` block and replace `const serviceNames = parsedServices.slice(0, 5).map(s => s.name).filter(Boolean)` with:

```ts
  const serviceNames = (listingDetail?.products ?? []).slice(0, 5).map((item) => item.name)
```

- In the page body: rename `const marketplaceProducts = publicData?.products ?? []` to `const catalogItems = publicData?.products ?? []`; delete `const services = parseJson(listing.services, [])`.
- Replace the `<ListingNavigation … />` element with `<ListingNavigation hasCatalog={catalogItems.length > 0} photos={photos} />`.
- In `<ListingContent … />`, remove `services={services}` and replace `marketplaceProducts={marketplaceProducts}` with `catalogItems={catalogItems}`.

- [ ] **Step 8: Rewrite `src/app/p/[productId]/page.tsx`**

```tsx
import { notFound } from 'next/navigation'
import Link from 'next/link'
import type { Metadata } from 'next'
import { Suspense } from 'react'
import { ArrowLeft, Package, Wrench } from 'lucide-react'

import { CatalogActionButton } from '@/components/catalog/CatalogItemCard'
import {
  catalogItemAction,
  catalogPriceLine,
  catalogWhatsAppHref,
  formatPaise,
} from '@/lib/catalog/catalog'
import { fetchProductAndListing } from '@/lib/data/product-detail'
import { getCanonicalListingUrl } from '@/lib/listing-url'
import { getServiceImageAspectOption } from '@/lib/service-image'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ productId: string }>
}): Promise<Metadata> {
  const { productId } = await params
  const data = await fetchProductAndListing(productId)
  if (!data?.listing) return { title: 'Product' }

  const { product, listing } = data
  const price = catalogPriceLine(product)
  const businessUrl = getCanonicalListingUrl(listing.id, listing.subdomain)
  const title = `${product.name} — ${price} | ${listing.name}`
  const description = product.description ?? `${product.name} (${price}) from ${listing.name} in Dahanu.`
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: `${businessUrl}/p/${product.id}`,
      images: product.image_url ? [{ url: product.image_url }] : undefined,
    },
    twitter: {
      card: product.image_url ? 'summary_large_image' : 'summary',
      title,
      description,
      images: product.image_url ? [product.image_url] : undefined,
    },
  }
}

// Root page: non-async, wraps content in Suspense so PPR prerendering
// can build a static shell while the dynamic params/data resolve at request time.
export default function StandaloneProductPage({
  params,
}: {
  params: Promise<{ productId: string }>
}) {
  return (
    <Suspense fallback={<div className="od-page min-h-screen" />}>
      <ProductContent params={params} />
    </Suspense>
  )
}

async function ProductContent({ params }: { params: Promise<{ productId: string }> }) {
  const { productId } = await params
  const data = await fetchProductAndListing(productId)
  if (!data?.listing) notFound()

  const { product, listing, shopMode } = data
  const businessUrl = getCanonicalListingUrl(listing.id, listing.subdomain)
  const itemUrl = `${businessUrl}/p/${product.id}`
  const whatsappNum = listing.whatsapp || listing.phone
  const priceLine = catalogPriceLine(product)
  // This page is cached for everyone, so it never knows the viewer: only a
  // live shop shows Buy here. Owners practise on test keys from the business page.
  const action = catalogItemAction(product, shopMode, { isOwner: false, isAdmin: false }, Boolean(whatsappNum))
  const whatsappHref =
    action.kind === 'whatsapp' ? catalogWhatsAppHref(whatsappNum, product, priceLine, itemUrl) : null
  const aspect = getServiceImageAspectOption(product.image_aspect, 'square')
  const imageUrl = product.image_url || product.image_thumb_url
  const isService = product.type === 'service'

  return (
    <div className="od-page min-h-screen">
      <div className="mx-auto max-w-lg px-4 py-6">
        <Link
          href={businessUrl}
          className="mb-5 inline-flex min-h-10 items-center gap-1.5 text-sm font-medium text-[var(--od-muted)] transition-colors hover:text-[var(--od-brand)]"
        >
          <ArrowLeft size={14} aria-hidden />
          {listing.name}
        </Link>

        <div className="od-card overflow-hidden">
          {imageUrl ? (
            <div className="bg-[var(--od-surface-soft)]">
              <div
                className={`relative overflow-hidden ${aspect.value === 'portrait' ? 'mx-auto w-3/4' : 'w-full'}`}
                style={{ aspectRatio: aspect.cssAspectRatio }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={imageUrl} alt={product.name} className="h-full w-full object-cover" />
              </div>
            </div>
          ) : null}

          <div className="space-y-3.5 p-6">
            <span className="inline-flex items-center gap-1 rounded-full bg-[var(--od-surface-soft)] px-2.5 py-1 text-[11px] font-bold text-[var(--od-brand-strong)]">
              {isService ? <Wrench size={11} aria-hidden /> : <Package size={11} aria-hidden />}
              {isService ? 'Service' : 'Product'}
            </span>

            <h1 className="font-display text-2xl leading-tight text-[var(--od-ink)]">{product.name}</h1>

            {product.description && (
              <p className="whitespace-pre-line text-sm leading-relaxed text-[var(--od-muted)]">{product.description}</p>
            )}

            <p className="font-display text-[28px] leading-none text-[var(--od-brand-strong)]">{priceLine}</p>

            {product.options.length > 0 && (
              <ul className="divide-y divide-[var(--od-border)] rounded-xl border border-[var(--od-border)]">
                {product.options.map((option) => (
                  <li key={option.id} className="flex items-center justify-between gap-3 px-3.5 py-2.5 text-sm">
                    <span className="font-semibold text-[var(--od-ink-2)]">{option.label}</span>
                    <span className="font-bold text-[var(--od-ink)]">
                      {formatPaise(option.price_paise)}
                      {option.quantity_in_stock === 0 && (
                        <span className="ml-1.5 font-semibold text-[var(--od-muted)]">· Sold out</span>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            )}

            <div className="space-y-2.5 pt-2">
              <CatalogActionButton action={action} whatsappHref={whatsappHref} size="lg" />
              <Link href={businessUrl} className="od-button-secondary min-h-12 w-full text-sm">
                View full business page
              </Link>
            </div>
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-[var(--od-muted)]">
          Listed on{' '}
          <Link href="https://ourdahanu.in" className="font-semibold hover:text-[var(--od-brand)]">
            OurDahanu
          </Link>
        </p>
      </div>
    </div>
  )
}
```

- [ ] **Step 9: Keep checkout type-safe until options arrive** — `src/app/checkout/[productId]/page.tsx`

Add `import { isBuyable } from '@/lib/catalog/catalog'`. Directly after `const { product, listing } = data`, add:

```ts
  // Items without a fixed price are enquiries, and option picking isn't on
  // this page yet: send both to the item page, which offers the right button.
  const pricePaise = product.price_paise
  if (!isBuyable(product) || product.options.length > 0 || pricePaise === null) {
    redirect(`/p/${product.id}`)
  }
```

and pass `pricePaise` (instead of `product.price_paise`) to `CheckoutForm`.

- [ ] **Step 10: Delete the replaced components**

```bash
git rm src/components/ProductCard.tsx src/components/BuyButton.tsx src/components/OrderModal.tsx "src/app/listings/[id]/ServicesSection.tsx"
```

Then search for leftovers: `ProductCard`, `BuyButton`, `OrderModal`, `ServicesSection`, `marketplaceProducts` must only appear in comments (the `#razorpay-script` comment in `CheckoutForm.tsx` is updated in Task 6).

- [ ] **Step 11: Checks**

Run: `npx tsc --noEmit` (no errors); `npm run lint` (0 errors, 11 warnings); `npm run build` (succeeds).

- [ ] **Step 12: Commit**

```bash
git add -A src
git commit -m "feat(catalog): one Products & Services section with Buy or WhatsApp per item"
```

---

### Task 4: Old share links redirect to the copied item

**Files:**
- Create: `src/app/s/[index]/route.ts`
- Modify: `src/lib/data/product-detail.ts` (add one function)
- Delete: `src/app/s/[index]/page.tsx`, `src/lib/data/service-detail.ts`

**Interfaces:**
- Consumes: `listing_products.legacy_service_index` (Task 1); `getCanonicalListingUrl(id, subdomain)` from `src/lib/listing-url.ts`; `getBusinessSubdomain(host)` from `src/lib/subdomain.ts`.
- Produces: `fetchLegacyServiceTarget(subdomain: string, index: number): Promise<{ listingId: string; productId: string | null } | null>`.

A route handler, not a page, so the redirect is a real HTTP 308 (a page inside Suspense can only stream a client-side redirect). When the listing exists but no visible copied item matches, the link goes to the business page (307) instead of a dead end; an unknown business returns 404.

- [ ] **Step 1: Add the lookup** — append to `src/lib/data/product-detail.ts`:

```ts
/** Where an old /s/<position> share link should go now. */
export async function fetchLegacyServiceTarget(
  subdomain: string,
  index: number,
): Promise<{ listingId: string; productId: string | null } | null> {
  'use cache'

  cacheLife(PUBLIC_CONTENT_CACHE)

  const supabase = createPublicClient()
  const { data: listingData } = await supabase
    .from('listings')
    .select('id')
    .eq('subdomain', subdomain)
    .eq('approved', true)
    .maybeSingle()
  const listingId = (listingData as { id: string } | null)?.id
  if (!listingId) return null

  cacheTag(CACHE_TAGS.listing(listingId))

  const { data: productData } = await supabase
    .from('listing_products')
    .select('id')
    .eq('listing_id', listingId)
    .eq('legacy_service_index', index)
    .eq('is_active', true)
    .maybeSingle()

  return { listingId, productId: (productData as { id: string } | null)?.id ?? null }
}
```

- [ ] **Step 2: Create `src/app/s/[index]/route.ts`**

```ts
import { headers } from 'next/headers'
import { NextResponse } from 'next/server'

import { fetchLegacyServiceTarget } from '@/lib/data/product-detail'
import { getCanonicalListingUrl } from '@/lib/listing-url'
import { getBusinessSubdomain } from '@/lib/subdomain'

// Old "Services & Products" share links (/s/<position>) point at the item
// copied from that position into the catalog.
export async function GET(_request: Request, { params }: { params: Promise<{ index: string }> }) {
  const { index } = await params
  const headerList = await headers()
  const subdomain =
    headerList.get('x-subdomain') ?? getBusinessSubdomain(headerList.get('x-forwarded-host') ?? headerList.get('host'))

  if (!subdomain || !/^\d{1,4}$/.test(index)) {
    return new NextResponse('Not found', { status: 404 })
  }

  const target = await fetchLegacyServiceTarget(subdomain, Number(index))
  if (!target) return new NextResponse('Not found', { status: 404 })

  const businessUrl = getCanonicalListingUrl(target.listingId, subdomain)
  if (!target.productId) return NextResponse.redirect(businessUrl, 307)
  return NextResponse.redirect(`${businessUrl}/p/${target.productId}`, 308)
}
```

Check `node_modules/next/dist/docs/01-app/03-api-reference/file-conventions/route.md` for the route handler context signature before finalising.

- [ ] **Step 3: Delete the old page and loader**

```bash
git rm "src/app/s/[index]/page.tsx" src/lib/data/service-detail.ts
```

- [ ] **Step 4: Checks**

Run: `npx tsc --noEmit`; `npm run lint` (0 errors, 11 warnings); `npm run build` (succeeds, and the build output lists `/s/[index]` as a route handler).

- [ ] **Step 5: Commit**

```bash
git add -A src
git commit -m "feat(catalog): old /s/ share links redirect to the copied catalog item"
```

---

### Task 5: Options when creating the payment and saving the order

**Files:**
- Modify: `src/app/api/razorpay/create-marketplace-order/route.ts`
- Modify: `src/app/actions/marketplace-orders.ts`
- Modify: `src/app/actions/orders.ts` (the `Order` interface only)
- Modify: `src/app/account/orders/[id]/page.tsx`, `src/app/account/orders/page.tsx`, `src/app/my-business/orders/page.tsx`

**Interfaces:**
- Consumes: `orderItemName` (Task 2); `listing_product_options`, `orders.product_option_id`, `orders.option_label`, `decrement_option_stock` (Task 1).
- Produces:
  - `POST /api/razorpay/create-marketplace-order` body `{ productId: string; quantity: number; optionId?: string }`. Error JSON may carry `code: 'option_sold_out' | 'option_unavailable'` (status 409), which tells the checkout page to reload. Success JSON adds `optionLabel: string | null`; `productPricePaise` is the unit price charged.
  - `placeMarketplaceOrder(formData)` reads an optional `option_id` field.
  - `MarketplaceOrder` and `Order` gain `option_label: string | null` (`MarketplaceOrder` also `product_option_id: string | null`).

- [ ] **Step 1: Accept an option when creating the Razorpay order** — `create-marketplace-order/route.ts`

Replace the body parsing block:

```ts
  let productId = ''
  let optionId = ''
  let quantity = 1

  try {
    const body = (await request.json()) as { productId?: string; optionId?: string; quantity?: number }
    productId = body.productId?.trim() ?? ''
    optionId = typeof body.optionId === 'string' ? body.optionId.trim() : ''
    quantity = Math.max(1, Math.min(99, Math.floor(Number(body.quantity) || 1)))
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
  }
```

Replace the product read and the stock check (from `const { data: product } = await adminClient` through the closing `}` of the `quantity_in_stock < quantity` check) with:

```ts
  const { data: product } = await adminClient
    .from('listing_products')
    .select('id, listing_id, type, name, price_paise, quantity_in_stock, is_active, options:listing_product_options(id, label, price_paise, quantity_in_stock)')
    .eq('id', productId)
    .maybeSingle()

  if (!product || !product.is_active) {
    return NextResponse.json({ error: 'Product is not available.' }, { status: 404 })
  }

  type OptionRow = { id: string; label: string; price_paise: number; quantity_in_stock: number | null }
  const options = (product.options ?? []) as OptionRow[]
  let option: OptionRow | null = null

  if (options.length > 0) {
    if (!optionId) {
      return NextResponse.json({ error: 'Choose an option.' }, { status: 400 })
    }
    option = options.find((row) => row.id === optionId) ?? null
    if (!option) {
      return NextResponse.json(
        { error: 'That option is no longer available. Please pick another.', code: 'option_unavailable' },
        { status: 409 },
      )
    }
  } else if (optionId) {
    // The owner removed the options while the customer was choosing.
    return NextResponse.json(
      { error: 'That option is no longer available. Please pick another.', code: 'option_unavailable' },
      { status: 409 },
    )
  } else if (product.price_paise === null) {
    return NextResponse.json({ error: "This item can't be bought online." }, { status: 422 })
  }

  const unitPricePaise: number = option ? option.price_paise : product.price_paise
  const stock: number | null = option ? option.quantity_in_stock : product.quantity_in_stock
  if (stock !== null && stock < quantity) {
    if (option && stock === 0) {
      return NextResponse.json(
        { error: 'That option just sold out. Please pick another.', code: 'option_sold_out' },
        { status: 409 },
      )
    }
    return NextResponse.json(
      { error: stock === 0 ? 'Sorry, this item just sold out.' : `Only ${stock} left.` },
      { status: 409 },
    )
  }
```

Then:
- `const amountPaise = product.price_paise * quantity` → `const amountPaise = unitPricePaise * quantity`.
- In the Razorpay `notes` object, after `product_name: product.name,` add `...(option ? { option_id: option.id, option_label: option.label } : {}),`.
- In `recordPaymentIntent`'s `payload`, replace `product_price_paise: product.price_paise,` with:

```ts
      product_price_paise: unitPricePaise,
      option_id: option?.id ?? null,
      option_label: option?.label ?? null,
```

- In the success JSON, replace `productPricePaise: product.price_paise,` with `productPricePaise: unitPricePaise,` and add `optionLabel: option?.label ?? null,`.

- [ ] **Step 2: Save the option with the order** — `src/app/actions/marketplace-orders.ts`

Add `import { orderItemName } from '@/lib/catalog/catalog'`.

In `MarketplaceOrder`, after `product_id: string | null`, add:

```ts
  product_option_id: string | null
  option_label: string | null
```

After `const productId = …` / `if (!productId) …`, add:

```ts
  const optionId = sanitizeString(formData.get('option_id'), 80)
```

After the `if (!product) { … }` block, add:

```ts
  // The option may have been renamed, repriced or deleted since payment
  // started; the intent below still carries what the buyer agreed to.
  const { data: optionData } = optionId
    ? await adminClient
        .from('listing_product_options')
        .select('id, product_id, label, price_paise, quantity_in_stock')
        .eq('id', optionId)
        .maybeSingle()
    : { data: null }
  const option =
    optionData && optionData.product_id === product.id
      ? (optionData as { id: string; label: string; price_paise: number; quantity_in_stock: number | null })
      : null
```

Replace the unit price block (`const intentUnitPrice = …` through `const expectedAmountPaise = …`) with:

```ts
  const intentUnitPrice = intent?.payload?.product_price_paise
  const fallbackUnitPrice: number | null = option?.price_paise ?? product.price_paise ?? null
  const unitPricePaise =
    typeof intentUnitPrice === 'number' && Number.isInteger(intentUnitPrice) && intentUnitPrice > 0
      ? intentUnitPrice
      : fallbackUnitPrice
  if (unitPricePaise === null) {
    return { error: 'Order details do not match the original request.' }
  }
  const expectedAmountPaise = intent?.amount_paise ?? unitPricePaise * quantity
  const intentOptionLabel = intent?.payload?.option_label
  const optionLabel =
    typeof intentOptionLabel === 'string' && intentOptionLabel ? intentOptionLabel : option?.label ?? null
```

In the `razorpayOrder` notes type add `option_id?: string`, and add this line to the notes comparison (after the `n.quantity` line, joined with `||`):

```ts
    (n.option_id ?? '') !== optionId
```

Replace the stock block (`// 4. Atomic stock decrement` through its closing `}`) with:

```ts
  // 4. Atomic stock decrement (the option's stock when an option was bought)
  const stockRpc =
    isTest
      ? null
      : optionId
        ? option && option.quantity_in_stock !== null
          ? { fn: 'decrement_option_stock', args: { p_option_id: option.id, p_quantity: quantity } }
          : null
        : product.quantity_in_stock !== null
          ? { fn: 'decrement_product_stock', args: { p_product_id: product.id, p_quantity: quantity } }
          : null
  if (stockRpc) {
    const { data: decOk, error: decError } = await adminClient.rpc(stockRpc.fn, stockRpc.args)
    if (decError) {
      console.error('[marketplace] stock rpc error:', decError)
      return { error: 'Could not reserve stock. Please try again.' }
    }
    if (!decOk) {
      return { error: 'Sorry — this item just went out of stock.' }
    }
  }
```

In the `orders` insert, after `product_id: product.id,` add:

```ts
      product_option_id: option?.id ?? null,
      option_label: optionLabel,
```

In `basePayload`, replace `productName: product.name,` with `productName: orderItemName(product.name, optionLabel),`.

In `updateMarketplaceOrderStatus`, change the order select to `'id, listing_id, buyer_id, service_name, option_label, payment_flow'` and `productName: order.service_name,` to `productName: orderItemName(order.service_name, order.option_label),`.

- [ ] **Step 3: Show the option on order pages**

- `src/app/actions/orders.ts`: in `Order`, after `service_name: string`, add `option_label: string | null`.
- `src/app/account/orders/[id]/page.tsx`: add `import { orderItemName } from '@/lib/catalog/catalog'`; after `const whatsapp = …` add `const itemName = orderItemName(order.service_name, order.option_label)`; replace the three uses of `order.service_name` (WhatsApp message, `<h1>`, and the Item row) with `itemName`.
- `src/app/account/orders/page.tsx`: add the same import; replace `{order.service_name}` with `{orderItemName(order.service_name, order.option_label)}`.
- `src/app/my-business/orders/page.tsx`: add the same import; replace `{order.service_name}` in `OrderRow` with `{orderItemName(order.service_name, order.option_label)}`.

- [ ] **Step 4: Checks**

Run: `npx tsc --noEmit`; `npm run lint` (0 errors, 11 warnings); `npm run test:existing` (only the known failure; `selling-templates.test.ts` still passes because templates are unchanged).

- [ ] **Step 5: Commit**

```bash
git add src/app/api/razorpay/create-marketplace-order/route.ts src/app/actions/marketplace-orders.ts src/app/actions/orders.ts "src/app/account/orders" src/app/my-business/orders/page.tsx
git commit -m "feat(catalog): charge and record the chosen option, keeping captured payments safe"
```

---

### Task 6: Option picker on the checkout page

**Files:**
- Modify: `src/app/checkout/[productId]/page.tsx`
- Modify: `src/app/checkout/[productId]/CheckoutForm.tsx`

**Interfaces:**
- Consumes: `fetchProductAndListing` (Task 3); `isBuyable`, `isSoldOut`, `isAvailable`, `firstAvailableOptionId`, `orderLineLabel`, `CatalogOption` (Task 2); the route contract from Task 5 (`optionId`, `code`), and `option_id` form field for `placeMarketplaceOrder`.
- Produces: `CheckoutFormProps['product']` becomes `{ id; name; pricePaise: number | null; quantityInStock: number | null; type; imageUrl; options: CatalogOption[] }`.

- [ ] **Step 1: Let items with options through** — `src/app/checkout/[productId]/page.tsx`

Change the catalog import to `import { isBuyable, isSoldOut } from '@/lib/catalog/catalog'`. Replace the Task 3 guard with:

```ts
  // Items without a fixed price or options are enquiries: the item page offers WhatsApp.
  if (!isBuyable(product)) redirect(`/p/${product.id}`)
```

Replace `if (product.quantity_in_stock === 0) {` with `if (isSoldOut(product)) {`.

In the `CheckoutForm` `product` prop, set `pricePaise: product.price_paise,` and add `options: product.options,`.

- [ ] **Step 2: Props, state and derived values** — `CheckoutForm.tsx`

Add imports:

```ts
import { useRouter } from 'next/navigation'
import { firstAvailableOptionId, isAvailable, orderLineLabel } from '@/lib/catalog/catalog'
import type { CatalogOption } from '@/lib/catalog/types'
```

In `CheckoutFormProps['product']`, change `pricePaise: number` to `pricePaise: number | null` and add:

```ts
    /** When present the buyer picks one; its price and stock apply. */
    options: CatalogOption[]
```

After `const [quantity, setQuantity] = useState(1)` add:

```ts
  const [chosenOptionId, setChosenOptionId] = useState<string | null>(null)
```

Replace

```ts
  const isService = product.type === 'service'
  const maxQuantity = product.quantityInStock ?? 99
  const totalPaise = product.pricePaise * quantity
```

with

```ts
  const router = useRouter()
  const isService = product.type === 'service'
  // A choice that has since sold out (after a reload) falls back to the first option still available.
  const selectedOption =
    product.options.find((option) => option.id === chosenOptionId && isAvailable(option.quantity_in_stock)) ??
    product.options.find((option) => option.id === firstAvailableOptionId(product.options)) ??
    null
  const optionLabel = selectedOption?.label ?? null
  const unitPricePaise = selectedOption?.price_paise ?? product.pricePaise ?? 0
  const stockLimit = selectedOption ? selectedOption.quantity_in_stock : product.quantityInStock
  const maxQuantity = Math.max(1, stockLimit ?? 99)
  const orderQuantity = Math.min(quantity, maxQuantity)
  const totalPaise = unitPricePaise * orderQuantity
```

- [ ] **Step 3: Send the option and reload on stock changes** — in `handlePay`

- Request body: `body: JSON.stringify({ productId: product.id, optionId: selectedOption?.id, quantity: orderQuantity }),`
- Error branch becomes:

```ts
      if (!orderRes.ok || orderData.error) {
        setError(orderData.error || 'Could not start the payment. Please try again.')
        setStatus('error')
        // Stock or options changed since the page loaded: fetch them again.
        if (orderData.code === 'option_sold_out' || orderData.code === 'option_unavailable') {
          router.refresh()
        }
        return
      }
```

- `baseFields`: `quantity: String(orderQuantity),` and add `option_id: selectedOption?.id ?? '',`.
- Razorpay `description`: `description: orderLineLabel(product.name, optionLabel, orderQuantity),`.

- [ ] **Step 4: Labels on the done and recovery screens**

- Done screen: replace `{product.name} ×{quantity}` with `{orderLineLabel(product.name, optionLabel, orderQuantity)}`.
- Recovery WhatsApp text: replace `I paid for ${product.name} ×${quantity} (${formatInr(totalPaise)})` with `I paid for ${orderLineLabel(product.name, optionLabel, orderQuantity)} (${formatInr(totalPaise)})`.
- Product strip price: `{formatInr(product.pricePaise)}` → `{formatInr(unitPricePaise)}`.
- Update the shared-script comment: `// \`#razorpay-script\` is a shared id: AppointmentBooking, ListingSubmitForm and RenewForm all inject the same tag onto` (drop `OrderModal,`; keep the rest of the comment).

- [ ] **Step 5: The picker and quantity** — insert directly before `{/* Quantity */}`:

```tsx
      {product.options.length > 0 && (
        <fieldset>
          <legend className={labelCls}>Choose an option</legend>
          <div className="space-y-2">
            {product.options.map((option) => {
              const available = isAvailable(option.quantity_in_stock)
              const checked = selectedOption?.id === option.id
              return (
                <label
                  key={option.id}
                  className={`flex min-h-12 items-center justify-between gap-3 rounded-xl border px-3.5 py-2.5 text-sm transition-colors ${
                    checked
                      ? 'border-[var(--od-brand)] bg-[rgba(192,88,46,0.06)]'
                      : 'border-[var(--od-border)] bg-white'
                  } ${available ? 'cursor-pointer' : 'cursor-not-allowed opacity-60'}`}
                >
                  <span className="flex items-center gap-2.5">
                    <input
                      type="radio"
                      name="option"
                      value={option.id}
                      checked={checked}
                      disabled={!available || busy}
                      onChange={() => {
                        setChosenOptionId(option.id)
                        setQuantity(1)
                      }}
                      className="h-4 w-4 accent-[var(--od-brand)]"
                    />
                    <span className="font-semibold text-[var(--od-ink)]">{option.label}</span>
                  </span>
                  <span
                    className={available ? 'font-bold text-[var(--od-ink)]' : 'text-xs font-semibold text-[var(--od-muted)]'}
                  >
                    {available ? formatInr(option.price_paise) : 'Sold out'}
                  </span>
                </label>
              )
            })}
          </div>
        </fieldset>
      )}
```

In the Quantity block:
- decrease: `onClick={() => setQuantity(Math.max(1, orderQuantity - 1))}` and `disabled={orderQuantity <= 1 || busy}`
- shown value: `{orderQuantity}`
- increase: `onClick={() => setQuantity(Math.min(maxQuantity, orderQuantity + 1))}` and `disabled={orderQuantity >= maxQuantity || busy}`
- available note: `{stockLimit !== null && (<span className="ml-auto text-xs text-[var(--od-muted)]">{stockLimit} available</span>)}`

- [ ] **Step 6: Checks**

Run: `npx tsc --noEmit`; `npm run lint` (0 errors, 11 warnings); `npm run build`.

- [ ] **Step 7: Commit**

```bash
git add "src/app/checkout/[productId]"
git commit -m "feat(catalog): customers choose an option on the checkout page"
```

---

### Task 7: Item manager server actions

**Files:**
- Create: `src/lib/catalog/owner-gate.ts`
- Create: `src/app/actions/catalog.ts`
- Modify: `src/app/actions/products.ts` (use the shared gate; the whole file is deleted in Task 8)

**Interfaces:**
- Consumes: `coerceCatalogItemInput`, `validateCatalogItem`, `CatalogItemErrors`, `CatalogItemValues`, `OWNER_CATALOG_ITEM_SELECT`, `OwnerCatalogRow`, `toCatalogItem`, `OwnerCatalogItem` (Task 2).
- Produces:
  - `assertListingOwner(listingId: string): Promise<{ ok: true; userId: string } | { ok: false; error: string }>` (server-only)
  - `type CatalogItemResult = { item?: OwnerCatalogItem; error?: string; fieldErrors?: CatalogItemErrors }`
  - `listOwnerCatalogItems(listingId: string): Promise<OwnerCatalogItem[]>`
  - `createCatalogItem(listingId: string, input: unknown): Promise<CatalogItemResult>`
  - `updateCatalogItem(itemId: string, input: unknown): Promise<CatalogItemResult>`
  - `setCatalogItemVisible(itemId: string, visible: boolean): Promise<CatalogItemResult>`
  - `moveCatalogItems(listingId: string, orderedIds: string[]): Promise<{ error?: string }>`
  - `deleteCatalogItem(itemId: string): Promise<{ error?: string }>`

- [ ] **Step 1: Move the owner gate** — create `src/lib/catalog/owner-gate.ts` with the body of `assertListingOwner` from `src/app/actions/products.ts`, unchanged, exported:

```ts
import 'server-only'

import { getUserRole } from '@/app/actions/admin'
import { LISTING_NOT_LIVE_MESSAGE, sellingPausedMessage } from '@/lib/selling/shop-mode'
import { loadSuspensionReason } from '@/lib/selling/suspension-reasons'
import { createAdminClient } from '@/lib/supabase/admin-client'
import { createClient } from '@/lib/supabase/server'

/**
 * Owners manage items on their own approved, non-suspended listings; admins
 * manage items on any listing.
 */
export async function assertListingOwner(listingId: string): Promise<
  { ok: true; userId: string } | { ok: false; error: string }
> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Please sign in.' }

  const { role } = await getUserRole(supabase)

  // Admins manage products on any listing (including unapproved or
  // not-yet-payments-enabled ones, e.g. during onboarding). The listings RLS
  // policy hides unapproved listings from non-owners, so use the admin
  // client for the lookup when the caller is an admin. Owners always satisfy
  // RLS via the owner_id check.
  type ListingRow = {
    id: string
    owner_id: string
    approved: boolean | null
    payments_suspended_at: string | null
  }
  let listing: ListingRow | null = null
  if (role === 'admin') {
    const adminClient = createAdminClient()
    if (!adminClient) return { ok: false, error: 'Server configuration error.' }
    const { data } = await adminClient
      .from('listings')
      .select('id, owner_id, approved, payments_suspended_at')
      .eq('id', listingId)
      .maybeSingle()
    listing = (data ?? null) as ListingRow | null
  } else {
    const { data } = await supabase
      .from('listings')
      .select('id, owner_id, approved, payments_suspended_at')
      .eq('id', listingId)
      .maybeSingle()
    listing = (data ?? null) as ListingRow | null
  }

  if (!listing) return { ok: false, error: 'Listing not found.' }

  if (listing.owner_id !== user.id && role !== 'admin') {
    return { ok: false, error: 'You do not own this listing.' }
  }

  // Owners can prepare items before connecting Razorpay; customers only see
  // them once the shop is live. Admins manage any listing.
  if (role !== 'admin') {
    if (listing.payments_suspended_at) {
      return { ok: false, error: sellingPausedMessage(await loadSuspensionReason(listingId)) }
    }
    if (!listing.approved) {
      return { ok: false, error: LISTING_NOT_LIVE_MESSAGE }
    }
  }

  return { ok: true, userId: user.id }
}
```

In `src/app/actions/products.ts`, delete the local `assertListingOwner` function, add `import { assertListingOwner } from '@/lib/catalog/owner-gate'`, and remove imports that become unused (`LISTING_NOT_LIVE_MESSAGE`, `sellingPausedMessage`, `loadSuspensionReason`; keep `getUserRole` and `createClient`, which `listOwnerProducts` still uses).

- [ ] **Step 2: Create `src/app/actions/catalog.ts`**

```ts
'use server'

import { revalidatePublicListingDetail } from '@/lib/cache-tags'
import { OWNER_CATALOG_ITEM_SELECT, toCatalogItem, type OwnerCatalogRow } from '@/lib/catalog/catalog'
import { assertListingOwner } from '@/lib/catalog/owner-gate'
import type { OwnerCatalogItem } from '@/lib/catalog/types'
import {
  coerceCatalogItemInput,
  validateCatalogItem,
  type CatalogItemErrors,
  type CatalogItemValues,
} from '@/lib/catalog/validate'
import { getUserRole } from '@/app/actions/admin'
import { createAdminClient } from '@/lib/supabase/admin-client'
import { createClient } from '@/lib/supabase/server'

export type CatalogItemResult = {
  item?: OwnerCatalogItem
  error?: string
  fieldErrors?: CatalogItemErrors
}

type AdminClient = NonNullable<ReturnType<typeof createAdminClient>>

const SAVE_FAILED = 'Could not save the item. Please try again.'

async function loadItem(adminClient: AdminClient, itemId: string): Promise<OwnerCatalogItem | null> {
  const { data } = await adminClient
    .from('listing_products')
    .select(OWNER_CATALOG_ITEM_SELECT)
    .eq('id', itemId)
    .maybeSingle()
  return data ? toCatalogItem(data as OwnerCatalogRow) : null
}

async function loadItemListingId(adminClient: AdminClient, itemId: string): Promise<string | null> {
  const { data } = await adminClient.from('listing_products').select('listing_id').eq('id', itemId).maybeSingle()
  return (data as { listing_id: string } | null)?.listing_id ?? null
}

/** Updates kept options, adds new ones and removes the rest — only for this item. */
async function saveOptions(
  adminClient: AdminClient,
  itemId: string,
  options: CatalogItemValues['options'],
): Promise<string | null> {
  const { data: existingData, error: loadError } = await adminClient
    .from('listing_product_options')
    .select('id')
    .eq('product_id', itemId)
  if (loadError) return loadError.message

  const existingIds = new Set(((existingData ?? []) as { id: string }[]).map((row) => row.id))
  const keptIds = new Set<string>()
  const now = new Date().toISOString()

  for (const [index, option] of options.entries()) {
    const row = {
      label: option.label,
      price_paise: option.price_paise,
      quantity_in_stock: option.quantity_in_stock,
      sort_order: index,
      updated_at: now,
    }
    if (option.id && existingIds.has(option.id)) {
      keptIds.add(option.id)
      const { error } = await adminClient
        .from('listing_product_options')
        .update(row)
        .eq('id', option.id)
        .eq('product_id', itemId)
      if (error) return error.message
    } else {
      const { error } = await adminClient.from('listing_product_options').insert({ ...row, product_id: itemId })
      if (error) return error.message
    }
  }

  const removedIds = [...existingIds].filter((id) => !keptIds.has(id))
  if (removedIds.length > 0) {
    const { error } = await adminClient
      .from('listing_product_options')
      .delete()
      .eq('product_id', itemId)
      .in('id', removedIds)
    if (error) return error.message
  }
  return null
}

function itemColumns(values: CatalogItemValues) {
  const { options: _options, ...columns } = values
  return { ...columns, image_thumb_url: values.image_url }
}

export async function listOwnerCatalogItems(listingId: string): Promise<OwnerCatalogItem[]> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data: listing } = await supabase.from('listings').select('id, owner_id').eq('id', listingId).maybeSingle()
  if (!listing) return []

  const { role } = await getUserRole(supabase)
  if (listing.owner_id !== user.id && role !== 'admin') return []

  const { data } = await supabase
    .from('listing_products')
    .select(OWNER_CATALOG_ITEM_SELECT)
    .eq('listing_id', listingId)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })

  return ((data ?? []) as unknown as OwnerCatalogRow[]).map((row) => toCatalogItem(row))
}

export async function createCatalogItem(listingId: string, input: unknown): Promise<CatalogItemResult> {
  if (!listingId) return { error: 'Listing is required.' }

  const ownership = await assertListingOwner(listingId)
  if (!ownership.ok) return { error: ownership.error }

  const validation = validateCatalogItem(coerceCatalogItemInput(input))
  if (!validation.ok) return { error: 'Please fix the highlighted fields.', fieldErrors: validation.errors }

  const adminClient = createAdminClient()
  if (!adminClient) return { error: 'Server configuration error.' }

  const { data: last } = await adminClient
    .from('listing_products')
    .select('sort_order')
    .eq('listing_id', listingId)
    .order('sort_order', { ascending: false })
    .limit(1)
  const nextSortOrder = last && last.length > 0 ? (last[0].sort_order ?? 0) + 1 : 0

  const { data: created, error } = await adminClient
    .from('listing_products')
    .insert({ ...itemColumns(validation.values), listing_id: listingId, is_active: true, sort_order: nextSortOrder })
    .select('id')
    .single()
  if (error || !created) {
    console.error('[catalog] create item failed:', error)
    return { error: SAVE_FAILED }
  }

  const optionsError = await saveOptions(adminClient, created.id, validation.values.options)
  revalidatePublicListingDetail(listingId)
  const item = (await loadItem(adminClient, created.id)) ?? undefined

  if (optionsError) {
    console.error('[catalog] save options failed:', optionsError)
    return { item, error: 'The item was saved, but its options were not. Edit it to try again.' }
  }
  return item ? { item } : { error: 'Saved. Refresh the page to see it.' }
}

export async function updateCatalogItem(itemId: string, input: unknown): Promise<CatalogItemResult> {
  const adminClient = createAdminClient()
  if (!adminClient) return { error: 'Server configuration error.' }

  const listingId = await loadItemListingId(adminClient, itemId)
  if (!listingId) return { error: 'This item no longer exists.' }

  const ownership = await assertListingOwner(listingId)
  if (!ownership.ok) return { error: ownership.error }

  const validation = validateCatalogItem(coerceCatalogItemInput(input))
  if (!validation.ok) return { error: 'Please fix the highlighted fields.', fieldErrors: validation.errors }

  const { error } = await adminClient
    .from('listing_products')
    .update({ ...itemColumns(validation.values), updated_at: new Date().toISOString() })
    .eq('id', itemId)
  if (error) {
    console.error('[catalog] update item failed:', error)
    return { error: SAVE_FAILED }
  }

  const optionsError = await saveOptions(adminClient, itemId, validation.values.options)
  revalidatePublicListingDetail(listingId)
  const item = (await loadItem(adminClient, itemId)) ?? undefined

  if (optionsError) {
    console.error('[catalog] save options failed:', optionsError)
    return { item, error: 'The item was saved, but its options were not. Try again.' }
  }
  return item ? { item } : { error: 'Saved. Refresh the page to see it.' }
}

export async function setCatalogItemVisible(itemId: string, visible: boolean): Promise<CatalogItemResult> {
  const adminClient = createAdminClient()
  if (!adminClient) return { error: 'Server configuration error.' }

  const listingId = await loadItemListingId(adminClient, itemId)
  if (!listingId) return { error: 'This item no longer exists.' }

  const ownership = await assertListingOwner(listingId)
  if (!ownership.ok) return { error: ownership.error }

  const { error } = await adminClient
    .from('listing_products')
    .update({ is_active: visible === true, updated_at: new Date().toISOString() })
    .eq('id', itemId)
  if (error) {
    console.error('[catalog] visibility failed:', error)
    return { error: 'Could not change visibility. Please try again.' }
  }

  revalidatePublicListingDetail(listingId)
  const item = await loadItem(adminClient, itemId)
  return item ? { item } : { error: 'This item no longer exists.' }
}

export async function moveCatalogItems(listingId: string, orderedIds: string[]): Promise<{ error?: string }> {
  if (!listingId) return { error: 'Listing is required.' }

  const ownership = await assertListingOwner(listingId)
  if (!ownership.ok) return { error: ownership.error }

  if (!Array.isArray(orderedIds) || orderedIds.length === 0) return { error: 'Nothing to reorder.' }

  const adminClient = createAdminClient()
  if (!adminClient) return { error: 'Server configuration error.' }

  const { data: existing } = await adminClient.from('listing_products').select('id').eq('listing_id', listingId)
  const validIds = new Set(((existing ?? []) as { id: string }[]).map((row) => row.id))
  if (orderedIds.some((id) => !validIds.has(id))) {
    return { error: 'The list changed. Refresh the page and try again.' }
  }

  const results = await Promise.all(
    orderedIds.map((id, index) => adminClient.from('listing_products').update({ sort_order: index }).eq('id', id)),
  )
  const failed = results.find((result) => result.error)
  if (failed?.error) {
    console.error('[catalog] reorder failed:', failed.error)
    return { error: 'Could not move the item. Please try again.' }
  }

  revalidatePublicListingDetail(listingId)
  return {}
}

export async function deleteCatalogItem(itemId: string): Promise<{ error?: string }> {
  const adminClient = createAdminClient()
  if (!adminClient) return { error: 'Server configuration error.' }

  const listingId = await loadItemListingId(adminClient, itemId)
  if (!listingId) return {}

  const ownership = await assertListingOwner(listingId)
  if (!ownership.ok) return { error: ownership.error }

  // Past orders keep their item name and option label; their links are set to null.
  const { error } = await adminClient.from('listing_products').delete().eq('id', itemId)
  if (error) {
    console.error('[catalog] delete failed:', error)
    return { error: 'Could not delete the item. Please try again.' }
  }

  revalidatePublicListingDetail(listingId)
  return {}
}
```

If lint flags `_options` as unused, replace `itemColumns` with an explicit object listing `type, name, description, image_url, image_aspect, price_paise, quantity_in_stock, price_note` from `values`.

- [ ] **Step 3: Checks**

Run: `npx tsc --noEmit`; `npm run lint` (0 errors, 11 warnings).

- [ ] **Step 4: Commit**

```bash
git add src/lib/catalog/owner-gate.ts src/app/actions/catalog.ts src/app/actions/products.ts
git commit -m "feat(catalog): item manager actions that save options and return the saved item"
```

---

### Task 8: The phone-friendly item manager

**Files:**
- Rewrite: `src/app/my-business/products/[listingId]/ProductsManager.tsx`
- Create: `src/app/my-business/products/[listingId]/ItemSheet.tsx`, `src/app/my-business/products/[listingId]/OptionsEditor.tsx`
- Modify: `src/app/my-business/products/[listingId]/page.tsx`, `src/app/admin/products/[listingId]/page.tsx`
- Delete: `src/app/actions/products.ts`

**Interfaces:**
- Consumes: Task 7 actions and `CatalogItemResult`; Task 3 `CatalogItemCard`; Task 2 `managerPriceLine`, `managerStockLine`, `moveId`, `countWithoutOnlinePrice`, `noOnlinePriceHint`, `catalogItemToInput`, `emptyCatalogItemInput`, `previewCatalogItem`, `validateCatalogItem`, `catalogItemAction`, `catalogPriceLine`, `catalogWhatsAppHref`, `MAX_OPTIONS`, limits; `CompactImageUpload` (`value`, `aspect`, `onUpload(url)`, `onClear()`, `onAspectChange(aspect)`); `loadShopState(listingId)`.
- Produces: `ProductsManager({ listingId, shopMode, whatsappNumber, initialItems })`.

- [ ] **Step 1: Rewrite `ProductsManager.tsx`**

```tsx
'use client'

import { useState, useTransition } from 'react'
import { ArrowDown, ArrowUp, Package, Pencil, Plus, Trash2, Wrench } from 'lucide-react'

import { deleteCatalogItem, moveCatalogItems, setCatalogItemVisible } from '@/app/actions/catalog'
import {
  countWithoutOnlinePrice,
  managerPriceLine,
  managerStockLine,
  moveId,
  noOnlinePriceHint,
} from '@/lib/catalog/manager'
import type { OwnerCatalogItem } from '@/lib/catalog/types'
import type { ShopMode } from '@/lib/selling/shop-mode'
import { getServiceImageAspectOption } from '@/lib/service-image'

import ItemSheet from './ItemSheet'

type SheetState = { kind: 'closed' } | { kind: 'new' } | { kind: 'edit'; itemId: string }

const iconButton =
  'inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--od-border)] bg-white text-[var(--od-ink-2)] transition-colors hover:border-[var(--od-brand)] hover:text-[var(--od-brand)] disabled:opacity-40 disabled:hover:border-[var(--od-border)] disabled:hover:text-[var(--od-ink-2)]'

export function ProductsManager({
  listingId,
  shopMode,
  whatsappNumber,
  initialItems,
}: {
  listingId: string
  shopMode: ShopMode
  whatsappNumber: string | null
  initialItems: OwnerCatalogItem[]
}) {
  const [items, setItems] = useState(initialItems)
  const [sheet, setSheet] = useState<SheetState>({ kind: 'closed' })
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({})
  const [, startTransition] = useTransition()

  const setRowError = (itemId: string, message: string | null) =>
    setRowErrors((previous) => {
      const next = { ...previous }
      if (message) next[itemId] = message
      else delete next[itemId]
      return next
    })

  const upsertItem = (item: OwnerCatalogItem) =>
    setItems((previous) =>
      previous.some((existing) => existing.id === item.id)
        ? previous.map((existing) => (existing.id === item.id ? item : existing))
        : [...previous, item],
    )

  const handleMove = (itemId: string, direction: 'up' | 'down') => {
    const previous = items
    const nextIds = moveId(items.map((item) => item.id), itemId, direction)
    const byId = new Map(items.map((item) => [item.id, item]))
    setItems(nextIds.flatMap((id) => byId.get(id) ?? []))
    setRowError(itemId, null)
    startTransition(async () => {
      const result = await moveCatalogItems(listingId, nextIds)
      if (result.error) {
        setItems(previous)
        setRowError(itemId, result.error)
      }
    })
  }

  const handleVisible = (item: OwnerCatalogItem) => {
    const visible = !item.is_active
    upsertItem({ ...item, is_active: visible })
    setRowError(item.id, null)
    startTransition(async () => {
      const result = await setCatalogItemVisible(item.id, visible)
      if (result.item) upsertItem(result.item)
      if (result.error) {
        upsertItem(item)
        setRowError(item.id, result.error)
      }
    })
  }

  const handleDelete = (item: OwnerCatalogItem) => {
    if (!window.confirm(`Delete "${item.name}"? This can't be undone.`)) return
    const previous = items
    setItems(items.filter((existing) => existing.id !== item.id))
    startTransition(async () => {
      const result = await deleteCatalogItem(item.id)
      if (result.error) {
        setItems(previous)
        setRowError(item.id, result.error)
      }
    })
  }

  const handleSaved = (item: OwnerCatalogItem, error: string | null) => {
    upsertItem(item)
    setRowError(item.id, error)
    setSheet({ kind: 'closed' })
  }

  const withoutPrice = countWithoutOnlinePrice(items)
  const editing = sheet.kind === 'edit' ? items.find((item) => item.id === sheet.itemId) ?? null : null

  return (
    <div className="space-y-4">
      {items.length > 0 && (
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-bold text-[var(--od-ink)]">
            {items.length} {items.length === 1 ? 'item' : 'items'}
          </p>
          <button type="button" onClick={() => setSheet({ kind: 'new' })} className="od-button-primary min-h-11 px-4 text-sm">
            <Plus size={16} aria-hidden />
            Add item
          </button>
        </div>
      )}

      {withoutPrice > 0 && (
        <p
          role="note"
          className="rounded-xl border border-[rgba(200,136,30,0.35)] bg-[rgba(200,136,30,0.07)] px-3.5 py-2.5 text-[13px] leading-relaxed text-[var(--od-ink-2)]"
        >
          {noOnlinePriceHint(withoutPrice)}
        </p>
      )}

      {items.length === 0 ? (
        <section className="od-card flex flex-col items-center p-8 text-center">
          <Package size={32} className="text-[var(--od-muted)]" aria-hidden />
          <p className="mt-3 text-base font-bold text-[var(--od-ink)]">No items yet</p>
          <p className="od-muted mt-1 text-sm">Add what you sell or offer. Customers see it on your business page.</p>
          <button type="button" onClick={() => setSheet({ kind: 'new' })} className="od-button-primary mt-5 min-h-12 px-5 text-sm">
            <Plus size={16} aria-hidden />
            Add your first item
          </button>
        </section>
      ) : (
        <ul className="space-y-3">
          {items.map((item, index) => {
            const aspect = getServiceImageAspectOption(item.image_aspect, 'square')
            const imageUrl = item.image_url || item.image_thumb_url
            const stock = managerStockLine(item)
            return (
              <li key={item.id} className="od-card p-3.5">
                <div className={`flex gap-3 ${item.is_active ? '' : 'opacity-60'}`}>
                  <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-[var(--od-surface-soft)] text-[var(--od-muted)]">
                    {imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={imageUrl}
                        alt=""
                        style={{ width: aspect.thumbnailWidth, height: aspect.thumbnailHeight }}
                        className="rounded-lg object-cover"
                      />
                    ) : item.type === 'service' ? (
                      <Wrench size={22} aria-hidden />
                    ) : (
                      <Package size={22} aria-hidden />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <p className="min-w-0 truncate font-bold text-[var(--od-ink)]">{item.name}</p>
                      <span className="rounded-full bg-[var(--od-surface-soft)] px-2 py-0.5 text-[11px] font-bold text-[var(--od-brand-strong)]">
                        {item.type === 'service' ? 'Service' : 'Product'}
                      </span>
                      {!item.is_active && (
                        <span className="rounded-full border border-[var(--od-border)] px-2 py-0.5 text-[11px] font-bold text-[var(--od-muted)]">
                          Hidden
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-sm font-semibold text-[var(--od-ink-2)]">{managerPriceLine(item)}</p>
                    {stock && <p className="od-muted text-xs">{stock}</p>}
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-[var(--od-border)] pt-3">
                  <label className="mr-auto inline-flex min-h-10 cursor-pointer items-center gap-2 text-sm font-semibold text-[var(--od-ink-2)]">
                    <input
                      type="checkbox"
                      role="switch"
                      checked={item.is_active}
                      onChange={() => handleVisible(item)}
                      className="h-5 w-5 accent-[var(--od-brand)]"
                    />
                    Visible
                  </label>
                  <button
                    type="button"
                    onClick={() => handleMove(item.id, 'up')}
                    disabled={index === 0}
                    aria-label={`Move ${item.name} up`}
                    className={iconButton}
                  >
                    <ArrowUp size={16} aria-hidden />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleMove(item.id, 'down')}
                    disabled={index === items.length - 1}
                    aria-label={`Move ${item.name} down`}
                    className={iconButton}
                  >
                    <ArrowDown size={16} aria-hidden />
                  </button>
                  <button
                    type="button"
                    onClick={() => setSheet({ kind: 'edit', itemId: item.id })}
                    className="od-button-secondary min-h-10 px-3 text-sm"
                  >
                    <Pencil size={14} aria-hidden />
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(item)}
                    aria-label={`Delete ${item.name}`}
                    className={`${iconButton} hover:!text-red-600`}
                  >
                    <Trash2 size={16} aria-hidden />
                  </button>
                </div>

                {rowErrors[item.id] && (
                  <p role="alert" className="mt-2 text-xs font-semibold text-[var(--color-danger-strong,#a33)]">
                    {rowErrors[item.id]}
                  </p>
                )}
              </li>
            )
          })}
        </ul>
      )}

      {sheet.kind !== 'closed' && (
        <ItemSheet
          key={sheet.kind === 'edit' ? sheet.itemId : 'new'}
          listingId={listingId}
          shopMode={shopMode}
          whatsappNumber={whatsappNumber}
          item={editing}
          onClose={() => setSheet({ kind: 'closed' })}
          onSaved={handleSaved}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 2: Create `OptionsEditor.tsx`**

```tsx
'use client'

import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react'

import { MAX_OPTIONS } from '@/lib/catalog/catalog'
import { OPTION_LABEL_MAX, type CatalogOptionInput, type OptionFieldErrors } from '@/lib/catalog/validate'

const errorCls = 'mt-1 text-xs font-semibold text-[var(--color-danger-strong,#a33)]'
const smallIcon =
  'inline-flex h-10 w-10 items-center justify-center rounded-lg text-[var(--od-muted)] transition-colors hover:bg-[var(--od-surface-soft)] hover:text-[var(--od-brand)] disabled:opacity-40'

export default function OptionsEditor({
  options,
  onChange,
  error,
  rowErrors,
}: {
  options: CatalogOptionInput[]
  onChange: (next: CatalogOptionInput[]) => void
  error?: string
  rowErrors?: Record<number, OptionFieldErrors>
}) {
  const updateRow = (index: number, patch: Partial<CatalogOptionInput>) =>
    onChange(options.map((row, i) => (i === index ? { ...row, ...patch } : row)))

  const moveRow = (index: number, direction: -1 | 1) => {
    const target = index + direction
    if (target < 0 || target >= options.length) return
    const next = [...options]
    ;[next[index], next[target]] = [next[target], next[index]]
    onChange(next)
  }

  return (
    <div>
      <p className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.04em] text-[var(--od-muted)]">Options</p>
      <ul className="space-y-3">
        {options.map((row, index) => {
          const rowError = rowErrors?.[index]
          return (
            <li key={row.id ?? `new-${index}`} className="rounded-xl border border-[var(--od-border)] bg-white p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold text-[var(--od-muted)]">Option {index + 1}</span>
                <div className="flex">
                  <button type="button" onClick={() => moveRow(index, -1)} disabled={index === 0} aria-label={`Move option ${index + 1} up`} className={smallIcon}>
                    <ArrowUp size={15} aria-hidden />
                  </button>
                  <button type="button" onClick={() => moveRow(index, 1)} disabled={index === options.length - 1} aria-label={`Move option ${index + 1} down`} className={smallIcon}>
                    <ArrowDown size={15} aria-hidden />
                  </button>
                  <button type="button" onClick={() => onChange(options.filter((_, i) => i !== index))} aria-label={`Remove option ${index + 1}`} className={smallIcon}>
                    <Trash2 size={15} aria-hidden />
                  </button>
                </div>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-[1fr_7rem_7rem]">
                <div className="col-span-2 sm:col-span-1">
                  <label htmlFor={`option-label-${index}`} className="sr-only">Option {index + 1} label</label>
                  <input
                    id={`option-label-${index}`}
                    value={row.label}
                    maxLength={OPTION_LABEL_MAX}
                    onChange={(event) => updateRow(index, { label: event.target.value })}
                    placeholder="e.g. 500 g"
                    className="od-input w-full px-3.5 py-2.5 text-sm"
                  />
                  {rowError?.label && <p role="alert" className={errorCls}>{rowError.label}</p>}
                </div>
                <div>
                  <label htmlFor={`option-price-${index}`} className="sr-only">Option {index + 1} price in rupees</label>
                  <input
                    id={`option-price-${index}`}
                    inputMode="decimal"
                    value={row.price}
                    onChange={(event) => updateRow(index, { price: event.target.value })}
                    placeholder="Price ₹"
                    className="od-input w-full px-3.5 py-2.5 text-sm"
                  />
                  {rowError?.price && <p role="alert" className={errorCls}>{rowError.price}</p>}
                </div>
                <div>
                  <label htmlFor={`option-stock-${index}`} className="sr-only">Option {index + 1} stock</label>
                  <input
                    id={`option-stock-${index}`}
                    inputMode="numeric"
                    value={row.stock}
                    onChange={(event) => updateRow(index, { stock: event.target.value })}
                    placeholder="Stock"
                    className="od-input w-full px-3.5 py-2.5 text-sm"
                  />
                  {rowError?.stock && <p role="alert" className={errorCls}>{rowError.stock}</p>}
                </div>
              </div>
            </li>
          )
        })}
      </ul>
      {error && <p role="alert" className={errorCls}>{error}</p>}
      {options.length < MAX_OPTIONS ? (
        <button
          type="button"
          onClick={() => onChange([...options, { label: '', price: '', stock: '' }])}
          className="od-button-secondary mt-3 min-h-11 w-full text-sm"
        >
          <Plus size={15} aria-hidden />
          Add option
        </button>
      ) : (
        <p className="od-muted mt-2 text-xs">You can add up to {MAX_OPTIONS} options.</p>
      )}
      <p className="od-muted mt-2 text-xs">Leave stock blank for no limit.</p>
    </div>
  )
}
```

- [ ] **Step 3: Create `ItemSheet.tsx`**

```tsx
'use client'

import { useEffect, useState, useTransition } from 'react'
import { Loader2, X } from 'lucide-react'

import { createCatalogItem, updateCatalogItem } from '@/app/actions/catalog'
import CatalogItemCard from '@/components/catalog/CatalogItemCard'
import CompactImageUpload from '@/components/CompactImageUpload'
import { catalogItemAction, catalogPriceLine, catalogWhatsAppHref } from '@/lib/catalog/catalog'
import { catalogItemToInput, emptyCatalogItemInput, previewCatalogItem } from '@/lib/catalog/manager'
import type { OwnerCatalogItem } from '@/lib/catalog/types'
import {
  DESCRIPTION_MAX,
  NAME_MAX,
  PRICE_NOTE_MAX,
  validateCatalogItem,
  type CatalogItemInput,
  type PricingMode,
} from '@/lib/catalog/validate'
import type { ShopMode } from '@/lib/selling/shop-mode'

import OptionsEditor from './OptionsEditor'

const labelCls = 'mb-1.5 block text-[11px] font-bold uppercase tracking-[0.04em] text-[var(--od-muted)]'
const inputCls = 'od-input w-full px-3.5 py-2.5 text-sm'
const errorCls = 'mt-1 text-xs font-semibold text-[var(--color-danger-strong,#a33)]'

const PRICING_CHOICES: { value: PricingMode; title: string; hint: string }[] = [
  { value: 'fixed', title: 'One price', hint: 'Customers can buy it online.' },
  { value: 'options', title: 'Options', hint: 'Sizes or packs, each with its own price.' },
  { value: 'none', title: 'No fixed price', hint: 'Customers ask you on WhatsApp.' },
]

function previewNote(shopMode: ShopMode): string {
  return shopMode === 'live'
    ? 'Your shop is live, so customers can buy items that have a price.'
    : 'Customers see WhatsApp buttons until you sell online with live Razorpay keys.'
}

function Field({
  label,
  htmlFor,
  hint,
  error,
  children,
}: {
  label: string
  htmlFor?: string
  hint?: string
  error?: string
  children: React.ReactNode
}) {
  return (
    <div>
      {htmlFor ? (
        <label htmlFor={htmlFor} className={labelCls}>{label}</label>
      ) : (
        <p className={labelCls}>{label}</p>
      )}
      {children}
      {error ? (
        <p role="alert" className={errorCls}>{error}</p>
      ) : hint ? (
        <p className="od-muted mt-1 text-xs">{hint}</p>
      ) : null}
    </div>
  )
}

export default function ItemSheet({
  listingId,
  shopMode,
  whatsappNumber,
  item,
  onClose,
  onSaved,
}: {
  listingId: string
  shopMode: ShopMode
  whatsappNumber: string | null
  item: OwnerCatalogItem | null
  onClose: () => void
  onSaved: (item: OwnerCatalogItem, error: string | null) => void
}) {
  const [input, setInput] = useState<CatalogItemInput>(() => (item ? catalogItemToInput(item) : emptyCatalogItemInput()))
  const [tab, setTab] = useState<'details' | 'preview'>('details')
  const [touched, setTouched] = useState<Partial<Record<keyof CatalogItemInput, boolean>>>({})
  const [submitted, setSubmitted] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [isSaving, startSaving] = useTransition()

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isSaving) onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isSaving, onClose])

  const validation = validateCatalogItem(input)
  const errors = validation.ok ? {} : validation.errors
  const show = (key: keyof CatalogItemInput) => submitted || touched[key] === true

  const update = <K extends keyof CatalogItemInput>(key: K, value: CatalogItemInput[K]) => {
    setInput((previous) => ({ ...previous, [key]: value }))
    setTouched((previous) => ({ ...previous, [key]: true }))
  }

  const choosePricing = (mode: PricingMode) => {
    setInput((previous) => ({
      ...previous,
      pricingMode: mode,
      // Start the options list with one row, carrying over a price already typed.
      options:
        mode === 'options' && previous.options.length === 0
          ? [{ label: '', price: previous.price, stock: '' }]
          : previous.options,
    }))
  }

  const handleSave = () => {
    setSubmitted(true)
    setSaveError(null)
    if (!validation.ok) {
      setTab('details')
      return
    }
    startSaving(async () => {
      const result = item ? await updateCatalogItem(item.id, input) : await createCatalogItem(listingId, input)
      if (result.item) {
        onSaved(result.item, result.error ?? null)
        return
      }
      setSaveError(result.error ?? 'Could not save the item. Please try again.')
    })
  }

  const preview = previewCatalogItem(input, item?.id ?? 'preview')
  const previewAction = catalogItemAction(preview, shopMode, { isOwner: false, isAdmin: false }, Boolean(whatsappNumber))
  const previewWhatsApp =
    previewAction.kind === 'whatsapp' ? catalogWhatsAppHref(whatsappNumber, preview, catalogPriceLine(preview), '') : null

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/40"
      onClick={(event) => {
        if (event.target === event.currentTarget && !isSaving) onClose()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="item-sheet-title"
        className="flex h-full w-full flex-col bg-[var(--od-surface-soft)] md:max-w-lg md:shadow-2xl"
      >
        <header className="flex items-center justify-between gap-3 border-b border-[var(--od-border)] bg-white px-4 py-3">
          <h2 id="item-sheet-title" className="text-base font-extrabold text-[var(--od-ink)]">
            {item ? 'Edit item' : 'Add item'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            aria-label="Close"
            className="inline-flex h-10 w-10 items-center justify-center rounded-full text-[var(--od-muted)] hover:bg-[var(--od-surface-soft)]"
          >
            <X size={18} aria-hidden />
          </button>
        </header>

        <div role="tablist" className="grid grid-cols-2 gap-1 border-b border-[var(--od-border)] bg-white px-4 py-2">
          {(['details', 'preview'] as const).map((value) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={tab === value}
              onClick={() => setTab(value)}
              className={`min-h-10 rounded-lg text-sm font-bold ${
                tab === value ? 'bg-[var(--od-surface-soft)] text-[var(--od-brand-strong)]' : 'text-[var(--od-muted)]'
              }`}
            >
              {value === 'details' ? 'Details' : 'How customers see it'}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4">
          {tab === 'details' ? (
            <div className="space-y-5">
              <Field label="Type">
                <div className="grid grid-cols-2 gap-2">
                  {(['product', 'service'] as const).map((type) => (
                    <button
                      key={type}
                      type="button"
                      aria-pressed={input.type === type}
                      onClick={() => update('type', type)}
                      className={`min-h-11 rounded-xl border text-sm font-bold ${
                        input.type === type
                          ? 'border-[var(--od-brand)] bg-[rgba(192,88,46,0.06)] text-[var(--od-brand-strong)]'
                          : 'border-[var(--od-border)] bg-white text-[var(--od-ink-2)]'
                      }`}
                    >
                      {type === 'product' ? 'Product' : 'Service'}
                    </button>
                  ))}
                </div>
              </Field>

              <Field label="Name" htmlFor="item-name" error={show('name') ? errors.name : undefined}>
                <input
                  id="item-name"
                  value={input.name}
                  maxLength={NAME_MAX}
                  onChange={(event) => update('name', event.target.value)}
                  placeholder={input.type === 'service' ? 'e.g. Home cleaning, 2 hours' : 'e.g. Alphonso mangoes, 1 dozen'}
                  className={inputCls}
                />
              </Field>

              <Field label="Description (optional)" htmlFor="item-description" hint={`${input.description.length}/${DESCRIPTION_MAX}`}>
                <textarea
                  id="item-description"
                  value={input.description}
                  maxLength={DESCRIPTION_MAX}
                  rows={3}
                  onChange={(event) => update('description', event.target.value)}
                  className={`${inputCls} resize-none`}
                />
              </Field>

              <Field label="Photo (optional)">
                <CompactImageUpload
                  value={input.imageUrl}
                  aspect={input.imageAspect}
                  onUpload={(url) => update('imageUrl', url)}
                  onClear={() => update('imageUrl', '')}
                  onAspectChange={(aspect) => update('imageAspect', aspect)}
                />
              </Field>

              <Field label="Pricing">
                <div className="space-y-2">
                  {PRICING_CHOICES.map((choice) => (
                    <label
                      key={choice.value}
                      className={`flex min-h-12 cursor-pointer items-start gap-3 rounded-xl border px-3.5 py-3 ${
                        input.pricingMode === choice.value
                          ? 'border-[var(--od-brand)] bg-[rgba(192,88,46,0.06)]'
                          : 'border-[var(--od-border)] bg-white'
                      }`}
                    >
                      <input
                        type="radio"
                        name="pricing"
                        checked={input.pricingMode === choice.value}
                        onChange={() => choosePricing(choice.value)}
                        className="mt-0.5 h-4 w-4 accent-[var(--od-brand)]"
                      />
                      <span>
                        <span className="block text-sm font-bold text-[var(--od-ink)]">{choice.title}</span>
                        <span className="od-muted block text-xs">{choice.hint}</span>
                      </span>
                    </label>
                  ))}
                </div>
              </Field>

              {input.pricingMode === 'fixed' && (
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Price (₹)" htmlFor="item-price" error={show('price') ? errors.price : undefined}>
                    <input
                      id="item-price"
                      inputMode="decimal"
                      value={input.price}
                      onChange={(event) => update('price', event.target.value)}
                      placeholder="150"
                      className={inputCls}
                    />
                  </Field>
                  <Field
                    label="Stock (optional)"
                    htmlFor="item-stock"
                    hint="Blank means no limit"
                    error={show('stock') ? errors.stock : undefined}
                  >
                    <input
                      id="item-stock"
                      inputMode="numeric"
                      value={input.stock}
                      onChange={(event) => update('stock', event.target.value)}
                      placeholder="No limit"
                      className={inputCls}
                    />
                  </Field>
                </div>
              )}

              {input.pricingMode === 'options' && (
                <OptionsEditor
                  options={input.options}
                  onChange={(next) => update('options', next)}
                  error={show('options') ? errors.options : undefined}
                  rowErrors={show('options') ? errors.optionRows : undefined}
                />
              )}

              {input.pricingMode === 'none' && (
                <Field label="Price note (optional)" htmlFor="item-price-note" hint="e.g. per kilo, or Price on request">
                  <input
                    id="item-price-note"
                    value={input.priceNote}
                    maxLength={PRICE_NOTE_MAX}
                    onChange={(event) => update('priceNote', event.target.value)}
                    className={inputCls}
                  />
                </Field>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {/* inert: the preview's buttons and links must not work */}
              <div inert className="mx-auto max-w-sm">
                <CatalogItemCard item={preview} action={previewAction} whatsappHref={previewWhatsApp} shareUrl={null} />
              </div>
              <p className="od-muted text-center text-xs">{previewNote(shopMode)}</p>
            </div>
          )}
        </div>

        <footer className="space-y-2 border-t border-[var(--od-border)] bg-white px-4 py-3">
          {saveError && <p role="alert" className={errorCls}>{saveError}</p>}
          <div className="flex gap-3">
            <button type="button" onClick={onClose} disabled={isSaving} className="od-button-secondary min-h-12 px-4 text-sm">
              Cancel
            </button>
            <button type="button" onClick={handleSave} disabled={isSaving} className="od-button-primary min-h-12 flex-1 text-sm disabled:opacity-60">
              {isSaving && <Loader2 size={15} className="animate-spin" aria-hidden />}
              {item ? 'Save changes' : 'Add item'}
            </button>
          </div>
        </footer>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Redesign the manager page** — `src/app/my-business/products/[listingId]/page.tsx`

- Imports: replace `import { listOwnerProducts } from '@/app/actions/products'` with `import { listOwnerCatalogItems } from '@/app/actions/catalog'`; add `import { loadShopState } from '@/lib/selling/shop-state'`; change `import { ArrowLeft, Package } from 'lucide-react'` to `import { ArrowLeft } from 'lucide-react'`.
- Listing select: `'id, name, category, approved, owner_id, payments_suspended_at, whatsapp, phone'`.
- Keep the redirect, not-live and suspended branches unchanged. Replace everything from `const products = await listOwnerProducts(listingId)` to the end of the component with:

```tsx
  const [items, shop] = await Promise.all([listOwnerCatalogItems(listingId), loadShopState(listingId)])

  return (
    <div className="od-page min-h-screen py-6 md:py-10">
      <div className="od-shell max-w-2xl space-y-5">
        <Link
          href="/my-business/products"
          className="inline-flex min-h-10 items-center gap-1.5 text-sm font-semibold text-[var(--od-muted)] transition-colors hover:text-[var(--od-brand)]"
        >
          <ArrowLeft size={14} aria-hidden />
          All businesses
        </Link>

        <header>
          <p className="od-eyebrow">{listing.category ?? 'Business'}</p>
          <h1 className="od-section-title mt-1 text-3xl md:text-4xl">{listing.name}</h1>
          <p className="od-muted mt-2 text-sm leading-relaxed">
            Your products and services. Changes show on your business page straight away.
          </p>
        </header>

        <ProductsManager
          listingId={listingId}
          shopMode={shop?.mode ?? 'off'}
          whatsappNumber={listing.whatsapp || listing.phone || null}
          initialItems={items}
        />
      </div>
    </div>
  )
```

- [ ] **Step 5: Admin manager page** — `src/app/admin/products/[listingId]/page.tsx`

- Imports: remove `import { type ListingProduct } from '@/app/actions/products'`; add `import { OWNER_CATALOG_ITEM_SELECT, toCatalogItem, type OwnerCatalogRow } from '@/lib/catalog/catalog'`; change the shop-mode import to `import { deriveSellingStatus, deriveShopMode } from '@/lib/selling/shop-mode'`.
- `AdminListing`: add `whatsapp: string | null` and `phone: string | null`; add `, whatsapp, phone` to the listing select.
- Products query: `.select(OWNER_CATALOG_ITEM_SELECT)` instead of `.select('*')`.
- Replace `const products = (productsData ?? []) as ListingProduct[]` with:

```ts
  const items = ((productsData ?? []) as unknown as OwnerCatalogRow[]).map((row) => toCatalogItem(row))
```

- After `sellingStatus`, add:

```ts
  const shopMode = deriveShopMode({
    approved: listing.approved === true,
    paymentsEnabled: listing.payments_enabled === true,
    suspendedAt: listing.payments_suspended_at,
    verifiedAt: config?.verified_at ?? null,
    keyId: config?.razorpay_key_id ?? null,
  })
```

- The amber notice text becomes: `Customers see these items with WhatsApp buttons. Buy buttons appear once the owner connects live Razorpay keys; with test keys only the owner sees them. You can still add or edit items here.` (keep the `Open payments` link after it).
- Render: `<ProductsManager listingId={listingId} shopMode={shopMode} whatsappNumber={listing.whatsapp || listing.phone || null} initialItems={items} />`.

- [ ] **Step 6: Delete the old actions**

```bash
git rm src/app/actions/products.ts
```

Search `src` for `actions/products`, `listOwnerProducts`, `ListingProduct\b`, `createProduct`, `reorderProducts`: no results.

- [ ] **Step 7: Checks and a look at the screen**

Run: `npx tsc --noEmit`; `npm run lint` (0 errors, 11 warnings); `npm run build`.

On the dev server (Browser pane, signed out), `/my-business/products/<any id>` redirects to login; the manager itself is checked by the owner after deploy (Task 10). Revert `next-env.d.ts` if the dev server changed it.

- [ ] **Step 8: Commit**

```bash
git add -A src
git commit -m "feat(catalog): phone-friendly item manager with options, reordering and a customer preview"
```

---

### Task 9: Stop editing the old list; the checklist counts sellable items

**Files:**
- Modify: `src/app/my-business/edit/[id]/EditListingForm.tsx`, `src/app/my-business/edit/[id]/page.tsx`
- Modify: `src/app/actions/listings.ts`
- Modify: `src/app/my-business/page.tsx`, `src/lib/selling/checklist.ts` (comment only)

**Interfaces:**
- Consumes: `isBuyable` (Task 2); `listing_product_options` (Task 1).
- Produces: `EditListingForm({ listing, catalogItemCount })`; `updateListing` no longer reads or writes `services`.

- [ ] **Step 1: Count items on the edit page** — `src/app/my-business/edit/[id]/page.tsx`

After `if (!listing) notFound()` add:

```ts
  const { count: catalogItemCount } = await supabase
    .from('listing_products')
    .select('id', { count: 'exact', head: true })
    .eq('listing_id', id)
```

and render `<EditListingForm listing={listing} catalogItemCount={catalogItemCount ?? 0} />`.

- [ ] **Step 2: Replace the services tab** — `EditListingForm.tsx`

- `Props` gains `catalogItemCount: number`; destructure it in `EditListingForm({ listing, catalogItemCount }: Props)`.
- Delete: the `Service` interface; the "Services state" block (`initialServices` and `const [services, setServices]`); `addService`, `removeService`, `updateService`; and `fd.set('services', JSON.stringify(services))` in `handleSubmit`.
- Delete the imports that only the services tab used: `CompactImageUpload`, the `MAX_SERVICE_ITEMS` import block, and the whole `@/lib/service-image` import block. Remove any lucide icons that become unused (lint reports them).
- In `tabs`, change `{ id: 'services', label: 'Services', icon: <Briefcase size={15} /> }` to `{ id: 'services', label: 'Items', icon: <Briefcase size={15} /> }`.
- Replace the whole `{/* ── SERVICES / PRICING … */}` `<div className={activeTab === 'services' ? …}>` block with:

```tsx
        {/* ── PRODUCTS & SERVICES ─────────────────────────────────────────── */}
        <div className={activeTab === 'services' ? 'bg-white border border-gray-100 rounded-2xl p-6' : 'hidden'}>
          <h3 className="font-semibold text-gray-800">Products &amp; Services</h3>
          <p className="mt-1 text-sm leading-relaxed text-gray-500">
            Your products and services now live in the item manager, where you can set prices, options and stock.
          </p>
          <p className="mt-3 text-sm font-semibold text-gray-700">
            {catalogItemCount} {catalogItemCount === 1 ? 'item' : 'items'}
          </p>
          <Link
            href={`/my-business/products/${listing.id}`}
            className="mt-4 inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-brand px-4 text-sm font-semibold text-bg transition-colors hover:bg-brand-strong"
          >
            Manage items
          </Link>
        </div>
```

(`Link` is already imported.)

- [ ] **Step 3: The listing action leaves the old column alone** — `src/app/actions/listings.ts` (`updateListing`)

Delete `const servicesRaw = …`, `let services = []`, `try { services = JSON.parse(servicesRaw) } catch { /* ignore */ }`, `services = normalizeServiceItems(services)`, and change `services, tags,` in the update object to `tags,`. Remove `normalizeServiceItems` from the `@/lib/listing-content` import list. Search the file: `services` must not appear in any database write.

- [ ] **Step 4: The checklist counts items customers can buy** — `src/app/my-business/page.tsx`

Add `import { isBuyable } from '@/lib/catalog/catalog'`. Change the products read to:

```ts
      supabase
        .from('listing_products')
        .select('listing_id, price_paise, options:listing_product_options(id)')
        .eq('is_active', true)
        .in('listing_id', ids),
```

and the counting loop to:

```ts
    const activeItems = new Map<string, number>()
    type ItemRow = { listing_id: string; price_paise: number | null; options: { id: string }[] | null }
    for (const row of (productData ?? []) as unknown as ItemRow[]) {
      // Copied items without a price are enquiries, not something to sell online yet.
      if (!isBuyable({ price_paise: row.price_paise, options: row.options ?? [] })) continue
      activeItems.set(row.listing_id, (activeItems.get(row.listing_id) ?? 0) + 1)
    }
```

In `src/lib/selling/checklist.ts`, document the field: `/** Visible items customers can buy online (a price of at least ₹1, or options). */` above `activeItemCount: number`.

- [ ] **Step 5: Checks**

Run: `npx tsc --noEmit`; `npm run lint` (0 errors, 11 warnings); `npm run test:existing` (only the known failure); `npm run build`.

- [ ] **Step 6: Commit**

```bash
git add "src/app/my-business/edit/[id]" src/app/actions/listings.ts src/app/my-business/page.tsx src/lib/selling/checklist.ts
git commit -m "feat(catalog): listing form links to the item manager and no longer writes the old list"
```

---

### Task 10: Whole-branch verification

**Controller task** (dev server, Supabase connector).

- [ ] **Step 1: Standard checks** — `npx tsc --noEmit`; `npm run lint` (0 errors, 11 warnings); `npm run build`; `npm run test:existing` (only `an override can open a normally closed day` may fail); `npm run test:game` (47/47).

- [ ] **Step 2: Find test subjects** (`execute_sql`)

```sql
select l.subdomain,
       (select count(*) from listing_products p where p.listing_id = l.id and p.legacy_service_index is not null) as copied,
       c.verified_at is not null and c.razorpay_key_id like 'rzp_live_%' as live
from listings l
left join listing_payment_configs c on c.listing_id = l.id
where l.approved and l.subdomain is not null
  and (c.verified_at is not null or exists (select 1 from listing_products p where p.listing_id = l.id and p.legacy_service_index = 0))
order by live desc, copied desc
limit 5;
```

Pick `LIVE_SUB` (a live shop) and `COPIED_SUB` (copied items, not live).

- [ ] **Step 3: Logged-out checks on the dev server** (start it with the Browser pane's `preview_start`; the listing pages redirect the pane to production, so use curl with a Host header)

```bash
curl -s -H "Host: LIVE_SUB.localhost:3000" http://localhost:3000/ | grep -o 'href="/checkout/[^"]*"' | head -3
```
Expected: at least one checkout link.

```bash
curl -s -H "Host: COPIED_SUB.localhost:3000" http://localhost:3000/ | grep -o 'Products &amp; Services\|Order on WhatsApp\|Book on WhatsApp\|/checkout/' | sort | uniq -c
```
Expected: the section title and WhatsApp buttons, no `/checkout/`.

```bash
curl -s -o /dev/null -w "%{http_code} %{redirect_url}\n" -H "Host: COPIED_SUB.localhost:3000" http://localhost:3000/s/0
```
Expected: `308 https://COPIED_SUB.ourdahanu.in/p/<uuid>`.

```bash
curl -s -H "Host: LIVE_SUB.localhost:3000" http://localhost:3000/ | grep -c "rzp_"
```
Expected: `0`.

Open one copied item's `/p/<uuid>` with a Host header and confirm the price line, photo and WhatsApp button render. Stop the dev server and revert `next-env.d.ts` if it changed.

- [ ] **Step 4: Advisors** — `get_advisors` (security): nothing new beyond the pre-existing warnings listed in the piece-1 PR.

- [ ] **Step 5: Owner checklist for after deploy** (goes in the PR description, done by the site owner)
  - Add an item with three options, one with stock 0; check the preview; save.
  - On a phone: move items up and down, hide one, delete one; no page reloads.
  - Practice purchase of an option on test keys: the label shows on the success screen, the order, and the notification; option stock is unchanged (test order).
  - Open an old `/s/0` link; it lands on the copied item.
  - Edit listing → Items tab links to the manager; saving the listing leaves the catalog unchanged.

