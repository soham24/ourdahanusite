# Admin Find Console Redesign

**Date:** 2026-07-16
**Status:** Design approved, ready for implementation plan

## Summary

`/admin/find` currently fetches and renders **every** row of both
`find_professionals` and `find_ratings` on every load, with a full edit form
mounted per professional. That's fine at ~65 professionals today, but the
directory is expected to grow into the thousands. This redesign moves to
**paginated, indexed, filtered server queries** (fixed read cost regardless of
directory size) plus a **compact-row / expand-to-edit UI** (fixed DOM cost),
with row-level quick actions and optimistic updates so routine moderation
never re-fetches the whole page.

## Goals

- Reads per page load stay constant (a handful of small queries) whether the
  directory has 65 rows or 65,000.
- DOM stays small: rows render as compact list items; the full edit form
  mounts only for the one row currently expanded.
- Moderators can filter by status and profession, and search by
  name/phone/locality, entirely server-side.
- Routine actions (approve/reject) update the UI without a full page
  re-fetch.
- Wire up the existing but unused `createProfessionalAsAdmin` action behind
  an "Add professional" form.
- View state (tab, status, search, profession, page) lives in the URL —
  shareable and back-button friendly.

## Non-Goals (YAGNI)

- No infinite scroll (unlike the public `/find` page) — classic Prev/Next
  pagination is fine for an admin console and is simpler to reason about
  with filters.
- No bulk actions (multi-select approve/reject) — not requested, adds
  meaningful UI complexity, revisit if moderation volume demands it later.
- No change to the public `/find` pages, submit flow, or the ratings
  data model.
- No change to `RatingModerationButtons` or `BusinessPicker` internals
  beyond what's needed to fit the new list shape.

## Current State (verified in DB)

- `find_professionals`: 64 approved rows today; indexes already exist on
  `(status, is_active)` and a GIN index on `professions`. **No index** on
  `name`/`phone`/`locality` — search today isn't indexed at all because
  there is no search.
- `find_ratings`: 14 approved, 1 pending; already has a
  `(status, created_at desc)` index — pending-ratings pagination is already
  indexed.
- `pg_trgm` extension is **not** installed.

## Architecture

### URL-driven state

All view state lives in `searchParams` on `/admin/find` — no client-side
data fetching on first paint:

```
/admin/find?tab=professionals&status=pending&q=ramesh&profession=Plumber&page=2
/admin/find?tab=ratings&page=1
```

Defaults: `tab=professionals`; `status` defaults to `pending` if the pending
count > 0, else `approved`; `page` defaults to `1`; `q` and `profession`
default to empty/unset.

### Reads per page load (fixed cost)

1. **One counts query** — a new Postgres function `get_admin_find_counts()`
   returning `{ pending, approved, rejected, inactive, total, pending_ratings }`
   in a single round trip. Powers every segment badge on every tab, so it
   runs unconditionally.
2. **One page query** for whichever tab is active:
   - Professionals: `find_professionals` filtered by `status` (and `q`,
     `profession` if set), joined to `listings` for the business label,
     ordered `created_at desc`, `range(offset, offset+24)`, with
     `count: 'exact'` on the same query for the pagination total.
   - Ratings: `find_ratings` filtered by `status='pending'`, joined to
     `find_professionals(name)`, same paging shape.
3. **One `profiles` lookup** for just the `submitted_by` (or rating
   `user_id`) values on that page of ≤25 rows — never the whole directory.

Total: 3 queries per load, independent of directory size.

### Search & filter indexing

A migration:
- Enables the `pg_trgm` extension.
- Adds GIN trigram indexes on `find_professionals(name)`,
  `find_professionals(phone)`, `find_professionals(locality)` so `ilike
  '%q%'` across those three columns stays fast at scale.
- The profession filter reuses the existing
  `find_professionals_professions_gin` index (`professions @> ARRAY[...]`).
- Search query shape: `.or('name.ilike.%q%,phone.ilike.%q%,locality.ilike.%q%')`
  combined with `.eq('status', ...)` and optional `.contains('professions',
  [profession])`.

### UI structure

**`page.tsx` (server component)** — parses `searchParams`, runs the 3 reads
described above, renders:

- **`FindToolbar`** (client) — status segments (Pending / Approved /
  Rejected / Inactive / All) each showing its count badge from
  `get_admin_find_counts()`; a debounced (350ms) search input; a profession
  `<select>`; and an "Add professional" button that reveals a collapsed
  create form. Every control updates the URL via `router.replace` (no push,
  so filter changes don't spam browser history) and triggers a fresh server
  render.
- **`ProfessionalList`** (client) — receives the current page's rows as
  props (server-rendered initial data, no client fetch on load). Renders
  each as a **compact row**: status badge, name, profession chips (first 2
  + "+N more"), locality, phone, submitted-by, relative date, and — for
  pending rows — inline Approve/Reject buttons. Clicking a row expands it
  in place to mount the existing `EditProfessionalForm`; only one row is
  expanded at a time (accordion behavior, plain `useState<string | null>`
  for the open row id).
- **`Pagination`** — "Showing 26–50 of 1,204" + Prev/Next links that carry
  the current filters forward in the URL.
- **Ratings tab** reuses the same compact-row / pagination shell; rows show
  professional name, stars, comment, submitter name, and keep the existing
  `RatingModerationButtons`.

### Avoiding full-page refetch on action

`ProfessionalList` and the ratings list hold their page of rows in local
state, seeded from the server-rendered props. Quick actions
(`setProfessionalStatus`, `setRatingStatus`) update local state directly:
- Approve/reject *within* the currently-filtered status segment (e.g.
  rejecting while viewing "Pending") removes the row from local state and
  decrements the toolbar's pending badge count (also held in local state,
  seeded from the server count).
- Saving an edit via `EditProfessionalForm` now calls `router.refresh()`
  after a successful save (today's form updates only its own local
  `msg`/`error` state and never refreshes). This is a deliberate change:
  edits can move a row out of the current filter (e.g. changing status
  indirectly isn't possible here, but changing profession/locality can
  affect a profession-filtered or search-filtered view), so a server
  re-fetch on save — not just on delete — keeps the list correct. The row
  collapses back to its compact form after a successful save.
- Server actions (`admin-find.ts`) drop the redundant
  `revalidatePath('/admin/find')` call — the page has no cache directive
  and is re-rendered per request already, so this revalidation was a no-op.
  `revalidateFindCache()` (for the public `/find` pages) is unaffected.

### New: Add professional form

A small collapsed form component wired to the existing
`createProfessionalAsAdmin` action (currently orphaned — no caller
anywhere in the codebase). Reuses the same field set as
`EditProfessionalForm` (name, phone, WhatsApp, professions, locality, note,
business link) via a shared fields sub-component, submits, and on success
appends the new row to the top of the current list (if it matches the
current filter) or shows a toast-style confirmation and clears the form.

## Files

- **Modify:** `src/app/admin/find/page.tsx` — rewritten: parse
  searchParams, run 3 reads, render shell.
- **New:** `src/app/admin/find/FindToolbar.tsx` — segments, search,
  profession filter, add-professional trigger.
- **New:** `src/app/admin/find/ProfessionalList.tsx` — compact rows +
  expand-to-edit + optimistic quick actions.
- **New:** `src/app/admin/find/RatingsList.tsx` — compact rows + optimistic
  quick actions for the ratings tab (extracted from the current inline
  `<ul>` in `page.tsx`).
- **New:** `src/app/admin/find/Pagination.tsx` — Prev/Next + range label.
- **New:** `src/app/admin/find/AddProfessionalForm.tsx` — wraps
  `createProfessionalAsAdmin`.
- **Modify:** `src/app/admin/find/EditProfessionalForm.tsx` — minor:
  becomes the "expanded" content of a row rather than always-rendered;
  field-sharing extracted if it reduces duplication with
  `AddProfessionalForm`, otherwise left as-is (YAGNI — don't force a shared
  abstraction if the two forms diverge enough that it's not a clean fit).
- **Unchanged:** `src/app/admin/find/BusinessPicker.tsx`,
  `src/app/admin/find/RatingModerationButtons.tsx`.
- **Modify:** `src/app/actions/admin-find.ts` — remove redundant
  `revalidatePath('/admin/find')` calls; no signature changes.
- **New migration:** enable `pg_trgm`; add trigram GIN indexes on
  `find_professionals(name, phone, locality)`; add
  `get_admin_find_counts()` SQL function.

## Testing

No test framework in this project (per established project convention) —
verification is `npx tsc --noEmit`, `npx eslint <touched files>`,
`npm run build`, and live verification on the deployed admin page (the
find-subdomain dev preview is known to get stuck on a loader in the
in-app browser preview, so this must be checked post-deploy in a real
browser, consistent with prior sessions' findings).
