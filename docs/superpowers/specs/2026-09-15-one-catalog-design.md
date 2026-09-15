# One Catalog Design

**Date:** 2026-09-15
**Status:** Design approved by the site owner, ready for an implementation plan
**Part of:** `2026-09-15-commerce-usability-roadmap.md` (piece 2 of 4)

## Summary

Every business has one list of products and services. The 87 items in the old "Services & Products" list are copied into the shop's item table once, inside the migration. Items can have up to 6 options, each with its own price and stock, or no fixed price with a short price note. The business page shows one section where each item offers Buy or Book when the shop is live, and WhatsApp otherwise. Owners manage items in a redesigned, phone-friendly item manager that saves without reloading and previews the customer's view.

## Goals

- Customers see one list of items per business, never two look-alike sections.
- An owner edits every item in one place, comfortably on a phone.
- Nothing an owner already entered is lost: every old item appears in the new list with its name, description, photo, photo shape and price.
- Old shared links (`/s/<number>`) keep working.
- An item can never be sold online for less than ₹1, and an item with no fixed price can never be sold online.
- A captured payment is always saved when the item or option is renamed, repriced, hidden or deleted during payment (as in piece 1).

## Non-goals

- Basket, several items per payment, delivery or pickup, sign-in at Pay (piece 3).
- Order steps, refunds, the owner Orders screen redesign (piece 4).
- Removing `listings.services` from the database, or changing the mobile endpoints that still read it (`/api/razorpay/create-product-order`, `placeOrder`/`resolveListingService` in `src/app/actions/orders.ts`, `/api/v1/orders`).
- Telegram delivery, `/shop`.

## Decisions made with the owner

| Topic | Decision |
|---|---|
| Old list after the copy | Frozen: copied once, never synced, left in the database for the mobile app |
| Photo shape | Each item keeps its own shape (square, portrait or landscape) |
| Choosing an option | On the checkout page |
| How the copy runs | Inside the database migration |

## Current behaviour this replaces

- The business page has a "Services & Products" card (`ServicesSection`, reading `listings.services`, WhatsApp only, pagination of 10, `/s/{index}` share links) and a separate Shop card (`listing_products`).
- `getCachedListingDetail` loads `listing_products` only when `payments_enabled` is true (`src/lib/data/listing-detail.ts:136-140`), so an item is invisible unless the business sells online.
- `/p/[productId]` offers only "Order on WhatsApp".
- `/s/[index]` renders the old item from `listings.services[index]` (`src/lib/data/service-detail.ts`).
- `listing_products.price_paise` is `NOT NULL CHECK (price_paise >= 0)`, so ₹0 items are accepted and checkout then fails with "Minimum order amount is ₹1."
- `ProductsManager` calls `location.reload()` after saves, reorders by drag and drop (desktop only), and has no preview.
- `EditListingForm` edits the old list in its services tab, and `updateListing` in `src/app/actions/listings.ts` normalises and writes `services` on every save.
- The page's keywords metadata uses the old list's names (`src/app/listings/[id]/page.tsx:58-64`).

Live data on 2026-09-15: 87 old items on 20 approved listings. Prices: 41 plain numbers (for example "₹150", "1399/-", "374.25"), 32 empty, 14 text ("1000 per kilo", "3000 and above", "Price on request"). Photo shapes: 30 unset, 23 square, 26 portrait, 8 landscape. Types: 53 product, 34 service. 2 items have no name. At most 20 items on one listing. No existing `listing_products` row has a price under ₹1. Only Nisarg Bee Farm has both old items (9) and shop items (2), with no names in common.

## Design

### 1. Data

One additive migration, `supabase/add_one_catalog.sql`, run in a single transaction.

**`listing_products` gains:**

| Column | Type | Notes |
|---|---|---|
| `price_note` | `text NULL` | `CHECK (char_length(price_note) <= 32)`. Shown when there is no fixed price ("per kilo", "Price on request") |
| `image_aspect` | `text NOT NULL DEFAULT 'square'` | `CHECK (image_aspect IN ('square','portrait','landscape'))` |
| `legacy_service_index` | `integer NULL` | Position in `listings.services` the row was copied from. Unique per listing (partial unique index where not null). Used by `/s/` redirects and to make the copy idempotent |

**`price_paise` becomes optional:** drop `NOT NULL`; replace `listing_products_price_paise_check` with `CHECK (price_paise IS NULL OR price_paise >= 100)`. No fixed price means the item cannot be bought online.

**New table `listing_product_options`:**

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid PK DEFAULT gen_random_uuid()` | |
| `product_id` | `uuid NOT NULL` | FK `listing_products(id) ON DELETE CASCADE` |
| `label` | `text NOT NULL` | `CHECK (char_length(label) BETWEEN 1 AND 40)` |
| `price_paise` | `integer NOT NULL` | `CHECK (price_paise >= 100)` |
| `quantity_in_stock` | `integer NULL` | `CHECK (quantity_in_stock IS NULL OR quantity_in_stock >= 0)`; null means no limit |
| `sort_order` | `integer NOT NULL DEFAULT 0` | |
| `created_at`, `updated_at` | `timestamptz NOT NULL DEFAULT now()` | |

Index on `(product_id, sort_order)`. The 6-option limit is enforced by the server action (the only writer). RLS on, with two SELECT policies mirroring `listing_products`: the public reads options of active items on approved listings; owners read options of their own items. No write policies, and `INSERT, UPDATE, DELETE, TRUNCATE` are revoked from `anon` and `authenticated`. Server code writes with the service-role client, as the product actions already do.

When an item has options, each option's price and stock apply and the item's own `price_paise` and `quantity_in_stock` are ignored (the manager saves them as null).

**`orders` gains:** `product_option_id uuid NULL` (FK `listing_product_options(id) ON DELETE SET NULL`) and `option_label text NULL` (`CHECK (char_length(option_label) <= 40)`).

**New function `decrement_option_stock(p_option_id uuid, p_quantity integer) RETURNS boolean`:** same shape as `decrement_product_stock` (`LANGUAGE plpgsql`, `SET search_path = ''`, no active filter, never below 0, returns whether a row changed). `EXECUTE` revoked from `anon` and `authenticated`.

**The one-time copy** (same migration, after the schema changes):

- For every listing whose `services` is a JSON array (approved or not, so a listing approved later keeps its items), each element with a non-blank name becomes a `listing_products` row:
  - `name`: trimmed, first 80 characters; `description`: trimmed, first 280 characters, null when blank.
  - `type`: `service` when the old type is `service`, otherwise `product`.
  - `image_url` and `image_thumb_url`: the old image, null when blank.
  - `image_aspect`: the old aspect when it is square, portrait or landscape; otherwise `landscape` (how unset items render today).
  - **Price:** the text is trimmed; if it matches an optional `₹` or `Rs`/`Rs.`, a number with at most two decimals (commas allowed), and an optional `/-`, and the amount is at least ₹1, it becomes `price_paise` (for example "374.25" → 37425) and `price_note` is null. Otherwise `price_paise` is null and `price_note` is the trimmed text cut to 32 characters, or null when blank.
  - `quantity_in_stock` null, `is_active` true.
  - `sort_order`: after the listing's existing items, in the old list's order.
  - `legacy_service_index`: the element's position (0-based).
- Elements with a blank name are skipped. Listings that already have any row with `legacy_service_index` set are skipped entirely, so running the migration again copies nothing.
- `listings.services` is not changed.

**Checks around applying (Supabase connector):**

- Before: counts of old items, named items, and listings with items (expected 87 / 85 / 20 on approved listings; the check also counts unapproved listings), and confirmation that no `listing_products` row has `legacy_service_index` yet.
- After: copied rows equal named old items; on approved listings, 41 rows with a price and 14 with a note from text, the rest with neither; every copied row's name, description, image and aspect match its source element; a second run of the copy statement inside a rolled-back transaction inserts 0 rows.
- Security: in rolled-back transactions with `SET LOCAL ROLE anon` and `authenticated` (with JWT claims), options are readable only for active items on approved listings, writes are refused, and `decrement_option_stock` cannot be executed. Advisors show no new warnings.

### 2. What customers see

**Loading:** `getCachedListingDetail` loads the catalog (active items ordered by `sort_order`, each with its options ordered by `sort_order`) for every approved listing, not only when payments are enabled. `ListingProductPublic` gains `price_note`, `image_aspect` and `options`. `fetchProductAndListing` (`/p/`) loads the same fields.

**One section on the business page:** "Products & Services" replaces both the old card and the Shop card, keeping `id="services"` so the page navigation link still jumps to it. It shows when the listing has at least one active item. One column on phones, two on wider screens. The first 8 items show, then a "Show all N items" button. The owner-only test-mode banner from piece 1 stays.

**Item card** (`CatalogItemCard`, shared by the business page, `/p/` and the manager preview):

- Photo in its own shape; Product or Service badge; name; description cut to 3 lines.
- Price line, from `catalogPriceLine(item)`: "₹150" for a fixed price; "From ₹180" when there are options (lowest option price); otherwise the price note, or "Ask for price" when there is none.
- Share button copying the item's `/p/<id>` link.
- One action, from `catalogItemAction(item, shopMode, viewer)`:
  - **Buy** (product) or **Book** (service), linking to `/checkout/<id>`, when `canBuyFromShop(shopMode, viewer)` is true and the item is buyable and in stock.
  - **Sold out**, disabled, when it would be Buy or Book but the item's stock is 0, or every option's stock is 0.
  - **Order on WhatsApp** (product) or **Book on WhatsApp** (service) in every other case, prefilled with the item name and its `/p/` link, using the listing's WhatsApp number or, failing that, its phone number, as today. With neither number, no action button is shown.
- An item is **buyable** when it has options, or when it has no options and `price_paise >= 100`.

**`/p/[productId]`:** the photo in its shape, the price line, the full description, the option labels with their prices ("Sold out" beside empty ones), the same action as the card, and a link back to the business.

**`/s/[index]`:** looks up the item with that `legacy_service_index` on the host's listing and permanently redirects to `/p/<id>`. If the index is not a whole number or no item matches, it returns the not-found page. `fetchListingAndService` and the old page's rendering are removed.

**Keywords metadata:** `src/app/listings/[id]/page.tsx` builds keywords from catalog item names instead of `listings.services`.

**Removed from the web page:** `ServicesSection`, `OrderModal`, and the old Shop card markup in `ListingContent`. `ListingContent` and `ListingNavigation` stop taking the `services` prop.

### 3. Choosing an option and paying

**Checkout page (`/checkout/[productId]`):**

- The page loads the item with its options.
- Items that are not buyable redirect to `/p/<id>`.
- Items with options show an option list above the quantity: one row per option with label and price. The first option in stock is preselected (`firstAvailableOptionId(options)`). Sold-out options show "Sold out" and cannot be picked. Price, total and the quantity limit (the option's stock, or 99 when unlimited) follow the chosen option.
- Items without options behave as today.
- When the item, or every option, is sold out, the page shows "Sold out" and Pay is disabled.

**`POST /api/razorpay/create-marketplace-order`:**

- Body: `{ productId, quantity, optionId? }`. Existing callers that send no `optionId` for an item without options behave as today.
- Reads the item and its options with the service-role client.
- If the item has options: `optionId` is required ("Choose an option.", 400) and must belong to the item (404 otherwise). Unit price and stock come from that option.
- If the item has no options: `price_paise` must be set ("This item can't be bought online.", 422). Unit price and stock come from the item.
- Stock shortfall: "Only N left." (409), or "That option just sold out. Please pick another." (409) when the option's stock is 0.
- Razorpay order notes add `option_id` and `option_label`. The payment intent payload adds `option_id`, `option_label` and keeps `product_price_paise` as the unit price actually charged. The response adds `optionLabel`.

**Saving the order (`placeMarketplaceOrder`):**

- Accepts `option_id` from the form. The amount and unit price come from the payment intent, as in piece 1; the option label comes from the intent, falling back to the option row, so renaming, repricing or deleting an option during payment never refuses a captured payment.
- The Razorpay notes check also compares `option_id`.
- Inserts `product_option_id` (null if the option no longer exists) and `option_label`.
- Stock: for real orders, `decrement_option_stock` when the bought option has a stock limit, otherwise `decrement_product_stock` when the item has one, as today. A failed decrement is handled exactly as item stock is today. Test orders skip both.

**Where the option label shows:** `orderLineLabel(name, optionLabel, quantity)` gives "Honey — 500 g ×2" (or "Honey ×2" with no option). It is used on the checkout success screen, the "payment didn't save" WhatsApp message, the owner's and the customer's order pages, and the `order.placed` notification text.

### 4. The item manager (`/my-business/products/[listingId]`)

Redesigned in the `od-` design system and built phone-first. The page keeps piece 1's gates (a suspended business sees the pause; owners can add items before connecting Razorpay).

**List:**

- Each row: photo in its shape; name with a Product or Service tag; price line ("₹150", "From ₹180 · 3 options", "No fixed price · WhatsApp only"); stock ("12 left", "Sold out", or nothing when unlimited; for items with options, the total across options, or "Sold out" when all are 0).
- Controls: a **Visible** switch, **↑** and **↓** buttons, **Edit**, and **Delete** behind a confirmation. Drag and drop is removed.
- Every change updates the list immediately and saves in the background. The server actions return the saved item (or the new order), and the list uses that result. No `location.reload()`. On failure the change is undone and a short plain-language error shows on that row.
- Above the list, when any active item is not buyable: "N items have no fixed price. Customers can only ask about them on WhatsApp. Add a price to sell them online."
- Empty state: one **Add your first item** button.

**Add / Edit sheet** (full screen on phones, side panel from `md` up):

- **Type:** Product or Service.
- **Name** (80 characters) and **Description** (600 characters).
- **Photo:** `CompactImageUpload` with its Square, Portrait and Landscape choice. The uploaded URL is saved as both `image_url` and `image_thumb_url`, and the choice as `image_aspect`. New items default to square.
- **Pricing**, one of three:
  1. **One price:** price in rupees (at least ₹1, up to the existing ₹10 crore cap) and optional stock (blank means no limit).
  2. **Options:** 1 to 6 rows, each with a label (up to 40 characters, unique within the item, ignoring case), a price (at least ₹1) and optional stock; add, remove, ↑ and ↓ per row.
  3. **No fixed price:** optional price note (up to 32 characters). Customers use WhatsApp.
- **Preview tab** ("How customers see it"): renders `CatalogItemCard` with the unsaved values and the listing's current shop mode.
- Field errors show as the owner types and on save. The Save button is disabled while saving; if saving fails, the sheet stays open with the owner's input intact.

**Validation:** `validateCatalogItem(input)` in `src/lib/catalog/validate.ts` is a pure function used by the sheet and by the server actions. It returns normalised values or per-field errors.

**Server actions (`src/app/actions/products.ts`):**

- `createProduct` and `updateProduct` accept the pricing mode, price, stock, price note, image aspect and an options array. They validate with `validateCatalogItem`, then write the item.
- For options, they update rows whose id belongs to this item, insert rows without an id, and delete this item's rows that are no longer listed. Only that item's options are touched. The item's `price_paise` and `quantity_in_stock` are null when options exist, and `price_note` is null unless the mode is "No fixed price".
- `reorderProducts` and `toggleProductActive` return the saved state.
- All of them keep revalidating the public listing, as today.

**Sell online checklist:** the "Add an item" step counts active items that are buyable, so copied items with no price do not tick it.

### 5. The listing form and the old flows

- **`EditListingForm`:** the services tab becomes a card, "Your products and services now live in the item manager", with a **Manage items** link to `/my-business/products/<id>` and the number of items.
- **`updateListing`** no longer reads or writes `services`, so saving the listing never touches the frozen list. `normalizeServiceItems` stays for the mobile flows that still read it.
- The submit form never edited the old list and is unchanged.
- **Kept, reading the frozen column:** `create-product-order`, `placeOrder` and `resolveListingService`, and `/api/v1/orders`.
- **Other consumers of `price_paise` updated for null:** `ProductCard` (replaced by `CatalogItemCard`), `/admin/products` and `/admin/products/[listingId]`, `/my-business/products`, `/my-business`, and the checkout page.

## Error handling

| Situation | Behaviour |
|---|---|
| Copy fails partway | The migration is one transaction; nothing is applied |
| Migration run again | No listing is copied twice (listing-level skip on `legacy_service_index`) |
| Manager save fails | Change undone, plain error on the row or in the sheet, input kept |
| Option sold out or removed while the customer is at checkout | 409 with "That option just sold out. Please pick another."; the picker reloads the item |
| Item loses its price while the customer is at checkout | 422 "This item can't be bought online."; the page links to the item |
| Option renamed, repriced or deleted after Razorpay created the order | The order saves with the intent's price and label; `product_option_id` is null if deleted |
| Option stock runs out between creating the Razorpay order and saving | Same as item stock today (`src/app/actions/marketplace-orders.ts:205-217`): the save returns "Sorry — this item just went out of stock." and the buyer sees the existing recovery screen with WhatsApp. Refunding that payment belongs to piece 4 |
| `/s/` link with no copied item | Not-found page |

## Testing

**Unit tests** (`node:test` via `tsx`, added to `test:existing` in `package.json`), in `src/lib/catalog/catalog.test.ts`:

- `validateCatalogItem`: each pricing mode; ₹0 and ₹0.50 rejected; more than 6 options rejected; duplicate labels (ignoring case) rejected; blank name rejected; lengths trimmed and capped; options mode clears item price and stock; note mode clears price.
- `catalogPriceLine`: fixed price, options (lowest price), note, no note.
- `catalogItemAction`: Buy and Book per type and shop mode (live, test for owner, test for visitor, off), Sold out for item stock 0 and for all options at 0, WhatsApp for unbuyable items, no button without a number.
- `firstAvailableOptionId`: first in stock, skipping sold out, null when all sold out.
- `orderLineLabel`: with and without an option.

**Database checks:** the before and after checks and security checks in section 1. The price rule is checked against the expected counts (41 prices, 14 notes from text).

**Standard checks:** `npx tsc --noEmit`; `npm run lint` at the 0 errors / 11 warnings baseline; `npm run build`; `npm run test:existing` (only the known clock-dependent appointment test may fail); `npm run test:game`.

**Dev server, logged out** (`curl` with a `Host: <sub>.localhost:3000` header): the live organic shop shows Buy on its items; a business with copied items and no payments shows them with WhatsApp; an old `/s/0` link redirects to `/p/<id>`; no Razorpay key ids in the HTML.

**After deploy, signed in as an owner (the site owner's checklist):** add an item with three options and one sold out; reorder and hide items on a phone; check the preview; make a practice purchase of an option on test keys and see the label on the order and notification with option stock unchanged; open an old `/s/` link.
