# Find ↔ Business Page Association (Premium Professionals)

**Date:** 2026-07-13
**Status:** Design approved, ready for implementation plan

## Summary

Let an admin associate a find-directory professional with an existing OurDahanu
business listing ("business page", e.g. `jigarchheda.ourdahanu.in`). An
associated professional is treated as **premium + verified by OurDahanu**: it
renders as an elevated card (distinct from the plain cards of unlinked
professionals), links out to its business page, and sorts ahead of unlinked
professionals in the public directory. The association is the single source of
the premium/verified status — there is no separate "verified" flag.

## Goals

- Admin can link/unlink a professional to any **approved** business listing from
  the `/admin/find` edit form, via a searchable business picker.
- A linked professional shows a premium, "Verified by OurDahanu" card on the
  find landing and detail pages, with a link to the business page and (when the
  listing has one) the business logo as the avatar.
- Unlinked professionals are unchanged (plain cards).
- Linked professionals sort first in the public directory.

## Non-Goals (YAGNI)

- No separate/independent "verified" toggle (association drives it).
- No free-text business URLs (must be a real approved listing).
- No user-facing self-service linking (admin only).
- No listing-side changes (the listings feature is untouched).
- No real-time invalidation when a linked listing is renamed/unapproved — the
  find cache's hourly staleness window is acceptable (see Caching).

## Data Model

Add one nullable column to `find_professionals`:

```sql
alter table find_professionals
  add column if not exists business_listing_id uuid
    references listings(id) on delete set null;
create index if not exists find_professionals_business_idx
  on find_professionals (business_listing_id);
```

- `ON DELETE SET NULL`: deleting the linked listing reverts the professional to
  a basic card with no dangling reference.
- A professional is "premium" iff `business_listing_id` is set AND the referenced
  listing is `approved = true`. The read layer treats a missing/unapproved
  linked listing as unlinked (graceful degrade).

`FindProfessional` type gains `business_listing_id: string | null`. A new
`LinkedBusiness` shape (`{ id, name, subdomain: string | null, image_url: string | null }`)
is attached to `ProfessionalWithStats` as `business: LinkedBusiness | null`.

## Read Layer (`src/lib/data/find.ts`)

`getFindDirectory()` and `getProfessionalById()` embed the linked listing via
the new FK (PostgREST embedding), selecting only `id, name, subdomain,
image_url, approved`. In JS, `business` is set to that listing **only when
`approved`**, else `null`. This is one extra embedded select on the existing
cached queries — no additional round trips, and it stays inside the
`find-directory` cache unit.

Sorting in `getApprovedProfessionals`: premium (business !== null) professionals
sort **before** unlinked ones; within each group the existing `top` / `new`
ordering applies.

## Admin Flow (`/admin/find`)

**Edit form (`EditProfessionalForm.tsx`):**
- New checkbox **"Has an OurDahanu business page"**. Off → link cleared on save.
  On → reveals the business picker.
- **BusinessPicker** (new client component): a searchable combobox. Typing
  queries approved listings; results show `name` + `subdomain`
  (e.g. "Epitome Financial · jigarchheda.ourdahanu.in"); selecting one sets the
  chosen `business_listing_id`. Pre-populated with the current link when editing.
  Client-side debounced (~250ms); shows the currently-selected business as a
  removable chip.

**Server actions (`admin-find.ts`):**
- New `searchBusinessListings(query: string)`: admin-gated; returns up to 10
  `{ id, name, subdomain }` for `approved` listings matching the query
  (`name ilike %query%`), ordered by name. Empty/short query returns `[]`.
- `AdminProfessionalFields` gains `businessListingId: string | null`.
  `updateProfessional` / `createProfessionalAsAdmin` persist it. Validation:
  when non-null it must reference a real `approved` listing, else return an
  error. `validateFields`/`toRow` updated accordingly.
- All admin write paths continue to call `revalidateFindCache()`.

## Public Card Treatment

**Basic card (unlinked)** — unchanged from today.

**Premium card (linked)** — same data, elevated surface:
- Gold-tinted border + subtle cream/gold background (design-system tokens:
  `--od-gold`, `--color-cream`, `--color-sand`).
- "Verified by OurDahanu" badge (shield/check icon, brand/gold).
- Business logo (`business.image_url`) as the avatar when present, else the
  existing `Monogram`.
- A **"Visit {business.name} →"** link opening the business page —
  `https://{subdomain}.ourdahanu.in` when a subdomain exists, else
  `https://ourdahanu.in/listings/{id}` — alongside Call/WhatsApp.

Implemented by branching inside the existing `Card` (landing) and the detail
header on `p.business`. The detail page (`/find/p/[id]`) gets the same badge +
"Visit business page" block, and its `generateMetadata` may note the verified
business.

Card structure is factored so the premium/basic branch is readable (a small
`PremiumBadge` + `VisitBusinessLink` in `find-ui.tsx`, reused by both pages).

## Caching / Invalidation

- Reads stay under the `find-directory` cache tag (unchanged mechanism).
- Admin `updateProfessional` (the only way to change a link) already invalidates
  via `revalidateFindCache()`.
- A linked listing being renamed/unapproved/deleted on the *listings* side is
  not wired to invalidate the find cache; the hourly `PUBLIC_CONTENT_CACHE`
  stale window absorbs it. (Delete still degrades correctly via the FK on the
  next regen.) Documented as accepted.

## Error Handling

- `searchBusinessListings`: admin-gated; returns `[]` on empty/short query or DB
  error (never throws to the client).
- `updateProfessional`/`createProfessionalAsAdmin`: reject a `businessListingId`
  that doesn't match an approved listing with a clear error, before writing.
- Read layer: a link whose listing is missing or unapproved renders as basic
  (no error surfaced to visitors).

## Testing / Verification

No test framework beyond `npx tsc --noEmit` + `npm run build` + running the app
(project convention). Plus:
- Migration applied to Supabase and verified (`business_listing_id` column + FK +
  index).
- Live `find.localhost:3000`: with a professional linked (set via DB or admin),
  confirm the premium card renders (badge, business link resolves to the right
  subdomain, logo/monogram fallback), it sorts before unlinked ones, and the
  detail page shows the verified block. Unlinked professionals unchanged.
- Admin: `searchBusinessListings` returns matches; saving a link persists and
  the public card updates after `revalidateFindCache`.
- The admin form is auth-gated (verify via build + a manual pass after deploy,
  per prior admin-gated work).
