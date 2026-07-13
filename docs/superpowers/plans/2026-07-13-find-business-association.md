# Find ↔ Business Page Association Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let an admin link a find-directory professional to an approved OurDahanu business listing; linked professionals render as premium, "Verified by OurDahanu" cards that sort first and link to the business page.

**Architecture:** One nullable FK (`find_professionals.business_listing_id → listings.id`) is the whole association. The cached find read layer embeds the linked listing and exposes `business` (only when the listing is approved). Admin picks the listing via a searchable combobox backed by a new server action. Public cards branch on `p.business` into a premium surface.

**Tech Stack:** Next.js 16.2.1 (App Router, `'use cache'`, server actions), React 19, Supabase (`@supabase/ssr` + service-role admin client + public client), Tailwind v4, lucide-react.

## Global Constraints

- **This is NOT the Next.js you know** — the find data layer uses `'use cache'` + `cacheLife`/`cacheTag`; server actions are `'use server'` files that may export ONLY async functions (never re-export types from them).
- **No test framework** (no jest/vitest, no `typecheck` script). Verify with `npx tsc --noEmit`, `npm run build`, and running the app on `find.localhost:3000`. Do NOT add a test runner.
- **Supabase is LIVE production.** Apply the migration via the Supabase MCP `apply_migration`; write it additively (`add column if not exists`). Never delete rows.
- **Association = premium + verified.** A professional is premium iff `business_listing_id` is set AND the referenced listing has `approved = true`. No separate verified flag.
- **Business page URL:** reuse `getCanonicalListingUrl(id, subdomain)` from `@/lib/listing-url` — returns `https://<subdomain>.ourdahanu.in` or `https://ourdahanu.in/listings/<id>`.
- **Cache:** all admin write paths call `revalidateFindCache()` (already wired for existing fields); reads stay under the `find-directory` tag.
- **Design-system tokens only** for the premium card: `--od-gold`, `--color-cream`, `--color-sand`, `--od-brand-strong`, `--od-border`, `--color-success-strong` (no new hexes).
- **Commit** after each task; end commit messages with:
  `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`
- Do NOT commit `.superpowers/`, `next-env.d.ts`, or unrelated `package.json`/lock churn.

---

## File Structure

**Create:**
- `supabase/add_find_business_association.sql` — column + FK + index.
- `src/app/admin/find/BusinessPicker.tsx` — client combobox for choosing a listing.

**Modify:**
- `src/lib/find/types.ts` — `FindProfessional.business_listing_id`; `LinkedBusiness` type; `ProfessionalWithStats.business`.
- `src/lib/data/find.ts` — embed the listing in `getFindDirectory` + `getProfessionalById`; premium-first sort in `getApprovedProfessionals`.
- `src/app/actions/admin-find.ts` — `searchBusinessListings`; `businessListingId` in `AdminProfessionalFields` + validate/persist.
- `src/app/admin/find/EditProfessionalForm.tsx` — checkbox + `BusinessPicker`.
- `src/app/find/find-ui.tsx` — `businessHref`, `PremiumBadge`, `VisitBusinessLink`.
- `src/app/find/page.tsx` — premium branch in `Card`.
- `src/app/find/p/[id]/page.tsx` — premium badge + visit-business block.

---

## Task 1: Migration, types, and business URL helper

**Files:**
- Create: `supabase/add_find_business_association.sql`
- Modify: `src/lib/find/types.ts`
- Modify: `src/app/find/find-ui.tsx`

**Interfaces:**
- Produces: column `find_professionals.business_listing_id`; types `LinkedBusiness`, `FindProfessional.business_listing_id`, `ProfessionalWithStats.business`; `businessHref(b: LinkedBusiness): string`.

- [ ] **Step 1: Write the migration**

Create `supabase/add_find_business_association.sql`:

```sql
-- Associate a find professional with an OurDahanu business listing.
-- Nullable; ON DELETE SET NULL so removing a listing reverts the professional
-- to a basic card with no dangling reference.
alter table find_professionals
  add column if not exists business_listing_id uuid
    references listings(id) on delete set null;

create index if not exists find_professionals_business_idx
  on find_professionals (business_listing_id);
```

- [ ] **Step 2: Apply + verify the migration**

Apply via Supabase MCP `apply_migration` (name: `add_find_business_association`, project `slmbqngmxketyxjauxxk`). Load the tools first:
`ToolSearch select:mcp__563fcecc-ab5b-42a7-91c8-1f45fd6e27f4__apply_migration,mcp__563fcecc-ab5b-42a7-91c8-1f45fd6e27f4__execute_sql`
Then verify:
```sql
select column_name from information_schema.columns
where table_name='find_professionals' and column_name='business_listing_id';
```
Expected: one row. If MCP is unavailable, commit the file and report DONE_WITH_CONCERNS (migration not applied).

- [ ] **Step 3: Update types**

In `src/lib/find/types.ts`, add `business_listing_id` to `FindProfessional` (after `submitted_by`):

```ts
  submitted_by: string | null
  business_listing_id: string | null
  created_at: string
```

Add the `LinkedBusiness` type and `business` on `ProfessionalWithStats` (replace the existing `ProfessionalWithStats` block):

```ts
// Minimal shape of the linked business page, resolved at read time.
export interface LinkedBusiness {
  id: string
  name: string
  subdomain: string | null
  image_url: string | null
}

// Public-facing professional plus computed rating aggregates and the linked
// business (null unless linked to an APPROVED listing).
export interface ProfessionalWithStats extends FindProfessional {
  avg_rating: number // 0 when no approved ratings
  rating_count: number
  business: LinkedBusiness | null
}
```

- [ ] **Step 4: Add the business URL helper**

In `src/app/find/find-ui.tsx`, add near `telHref` (and add the import at the top of the file with the other imports):

```ts
import { getCanonicalListingUrl } from '@/lib/listing-url'
import type { LinkedBusiness } from '@/lib/find/types'
```

```ts
/** Canonical URL of a linked business page (its subdomain, or the /listings
 *  fallback) — reuses the same helper the listings feature uses. */
export function businessHref(b: LinkedBusiness): string {
  return getCanonicalListingUrl(b.id, b.subdomain)
}
```

- [ ] **Step 5: Type-check and commit**

Run: `npx tsc --noEmit`
Expected: no new errors. (`find-ui.tsx` referencing `LinkedBusiness` compiles; `businessHref` unused-until-Task-5 is fine — it's exported.)

```bash
git add supabase/add_find_business_association.sql src/lib/find/types.ts src/app/find/find-ui.tsx
git commit -m "feat(find): add business_listing_id column, types, and businessHref

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: Read layer — embed listing + premium-first sort

**Files:**
- Modify: `src/lib/data/find.ts`

**Interfaces:**
- Consumes: `LinkedBusiness`, `ProfessionalWithStats.business` (Task 1); `PROFESSIONAL_COLUMNS`, `getFindDirectory`, `getApprovedProfessionals`, `getProfessionalById` (existing).
- Produces: every `ProfessionalWithStats` returned by the read layer has `business: LinkedBusiness | null`; premium professionals sort first.

- [ ] **Step 1: Add business_listing_id to the column constant + embed in getFindDirectory**

In `src/lib/data/find.ts`, update `PROFESSIONAL_COLUMNS` (add `business_listing_id`):

```ts
const PROFESSIONAL_COLUMNS =
  'id, name, phone, whatsapp, professions, profession_other, locality, note, status, is_active, submitted_by, business_listing_id, created_at, updated_at'
```

In `getFindDirectory`, change the professionals select to embed the listing, and normalize `business`. Replace the professionals fetch + `rows` line:

```ts
  const supabase = createPublicClient()
  const { data } = await supabase
    .from('find_professionals')
    .select(`${PROFESSIONAL_COLUMNS}, business:listings(id, name, subdomain, image_url, approved)`)
    .eq('status', 'approved')
    .eq('is_active', true)
    .order('created_at', { ascending: false })

  type RawBusiness = { id: string; name: string; subdomain: string | null; image_url: string | null; approved: boolean } | null
  const rows = ((data ?? []) as unknown as (ProfessionalWithStats & { business: RawBusiness })[]).map((r) => ({
    ...r,
    // Only surface the link when the listing is approved (live); otherwise basic.
    business: r.business && r.business.approved
      ? { id: r.business.id, name: r.business.name, subdomain: r.business.subdomain, image_url: r.business.image_url }
      : null,
  }))
  if (rows.length === 0) return []
```

The final `return rows.map(...)` already spreads `...r`, so `business` flows through unchanged — no edit needed there beyond confirming it spreads `r`.

- [ ] **Step 2: Premium-first sort in getApprovedProfessionals**

In `getApprovedProfessionals`, the final sort currently orders by `top`/`new`. Wrap it so premium floats first. Replace the `return [...pros].sort(...)` block:

```ts
  const sort: FindSort = opts.sort === 'new' ? 'new' : 'top'
  return [...pros].sort((a, b) => {
    // Premium (business-linked) professionals always rank first.
    const ap = a.business ? 0 : 1
    const bp = b.business ? 0 : 1
    if (ap !== bp) return ap - bp
    if (sort === 'top') {
      if (b.avg_rating !== a.avg_rating) return b.avg_rating - a.avg_rating
      if (b.rating_count !== a.rating_count) return b.rating_count - a.rating_count
    }
    return b.created_at.localeCompare(a.created_at)
  })
```

- [ ] **Step 3: Embed the listing in getProfessionalById**

In `getProfessionalById`, change its select to include the embed and normalize `business`. Replace the fetch + the `pro` construction so the returned object has `business`:

```ts
  const supabase = createPublicClient()
  const { data } = await supabase
    .from('find_professionals')
    .select(`${PROFESSIONAL_COLUMNS}, business:listings(id, name, subdomain, image_url, approved)`)
    .eq('id', id)
    .eq('status', 'approved')
    .eq('is_active', true)
    .maybeSingle()
  if (!data) return null

  type RawBusiness = { id: string; name: string; subdomain: string | null; image_url: string | null; approved: boolean } | null
  const raw = data as unknown as ProfessionalWithStats & { business: RawBusiness }
  const business = raw.business && raw.business.approved
    ? { id: raw.business.id, name: raw.business.name, subdomain: raw.business.subdomain, image_url: raw.business.image_url }
    : null
```

Then the existing ratings aggregation stays, and the final return becomes:

```ts
  return { ...raw, business, avg_rating: count ? sum / count : 0, rating_count: count }
```

(Confirm the ratings query in this function still uses `id`; only the professional fetch and the return object change.)

- [ ] **Step 4: Type-check, build**

Run: `npx tsc --noEmit` then `npm run build`
Expected: both pass. (Every `ProfessionalWithStats` now carries `business`; the pages in Tasks 5 rely on it but reading it as possibly-null is safe before those tasks — build still passes because `business` is defined on the type.)

- [ ] **Step 5: Commit**

```bash
git add src/lib/data/find.ts
git commit -m "feat(find): resolve linked business in read layer, sort premium first

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3: Admin actions — business search + persist the link

**Files:**
- Modify: `src/app/actions/admin-find.ts`

**Interfaces:**
- Consumes: `admin()` helper, `AdminProfessionalFields`, `validateFields`, `toRow`, `updateProfessional`, `createProfessionalAsAdmin` (existing).
- Produces:
  - `searchBusinessListings(query: string): Promise<{ id: string; name: string; subdomain: string | null }[]>`
  - `AdminProfessionalFields.businessListingId: string | null`
  - `updateProfessional`/`createProfessionalAsAdmin` persist `business_listing_id`, validating it references an approved listing.

- [ ] **Step 1: Add businessListingId to the fields interface**

In `src/app/actions/admin-find.ts`, add to `AdminProfessionalFields`:

```ts
export interface AdminProfessionalFields {
  name: string
  phone: string
  whatsapp: boolean
  professions: string[]
  professionOther?: string
  locality?: string
  note?: string
  businessListingId?: string | null
}
```

- [ ] **Step 2: Add the async validation + row helpers**

`validateFields` is synchronous, but validating the listing needs a DB call, so add a separate async check used by the write actions. Add after `toRow`:

```ts
// Returns an error string if the businessListingId is set but not a real,
// approved listing; null when valid or unset.
async function validateBusinessListing(
  db: NonNullable<ReturnType<typeof createAdminClient>>,
  businessListingId: string | null | undefined,
): Promise<string | null> {
  if (!businessListingId) return null
  const { data } = await db.from('listings').select('id, approved').eq('id', businessListingId).maybeSingle()
  if (!data) return 'The selected business page was not found.'
  if (!(data as { approved: boolean }).approved) return 'The selected business page is not approved yet.'
  return null
}
```

Update `toRow` to include the column (add `business_listing_id` to the returned object):

```ts
    locality: f.locality?.trim() || null,
    note: f.note?.trim() || null,
    business_listing_id: f.businessListingId ?? null,
  }
}
```

- [ ] **Step 3: Add the search action**

Add near the other exports:

```ts
export async function searchBusinessListings(
  query: string,
): Promise<{ id: string; name: string; subdomain: string | null }[]> {
  const q = query.trim()
  if (q.length < 2) return []
  const db = await admin()
  const term = `%${q.replace(/[%_,()]/g, ' ').trim()}%`
  const { data } = await db
    .from('listings')
    .select('id, name, subdomain')
    .eq('approved', true)
    .ilike('name', term)
    .order('name', { ascending: true })
    .limit(10)
  return (data ?? []) as { id: string; name: string; subdomain: string | null }[]
}
```

- [ ] **Step 4: Enforce the listing check in the write actions**

In `updateProfessional`, after `const db = await admin()` and before the update, add:

```ts
  const invalidBusiness = await validateBusinessListing(db, fields.businessListingId)
  if (invalidBusiness) return { error: invalidBusiness }
```

Do the same in `createProfessionalAsAdmin` (after `const db = await admin()`). `toRow` already writes `business_listing_id`, so the `insert`/`update` payloads carry it automatically.

- [ ] **Step 5: Type-check, build, commit**

Run: `npx tsc --noEmit` then `npm run build`
Expected: pass.

```bash
git add src/app/actions/admin-find.ts
git commit -m "feat(admin/find): business search action + persist/validate the link

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 4: Admin UI — checkbox + business combobox

**Files:**
- Create: `src/app/admin/find/BusinessPicker.tsx`
- Modify: `src/app/admin/find/EditProfessionalForm.tsx`

**Interfaces:**
- Consumes: `searchBusinessListings`, `AdminProfessionalFields.businessListingId` (Task 3); `FindProfessional.business_listing_id` (Task 1).
- Produces: `BusinessPicker` controlled component; `EditProfessionalForm` sends `businessListingId` on save.

- [ ] **Step 1: Create BusinessPicker**

Create `src/app/admin/find/BusinessPicker.tsx`:

```tsx
'use client'

import { useEffect, useRef, useState } from 'react'
import { Search, X } from 'lucide-react'
import { searchBusinessListings } from '@/app/actions/admin-find'

type Listing = { id: string; name: string; subdomain: string | null }

export default function BusinessPicker({
  value,
  initialLabel,
  onChange,
}: {
  value: string | null
  initialLabel?: string | null
  onChange: (id: string | null, label: string | null) => void
}) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Listing[]>([])
  const [open, setOpen] = useState(false)
  const [label, setLabel] = useState<string | null>(initialLabel ?? null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current)
    if (query.trim().length < 2) { setResults([]); return }
    timer.current = setTimeout(async () => {
      setResults(await searchBusinessListings(query))
      setOpen(true)
    }, 250)
    return () => { if (timer.current) clearTimeout(timer.current) }
  }, [query])

  const cls = 'w-full rounded border border-gray-300 px-2 py-1 text-sm'

  if (value) {
    return (
      <div className="flex items-center gap-2 rounded border border-[var(--od-border)] bg-[var(--color-surface-2)] px-2 py-1 text-sm">
        <span className="min-w-0 flex-1 truncate font-semibold">{label ?? 'Selected business'}</span>
        <button
          type="button"
          onClick={() => { onChange(null, null); setLabel(null); setQuery('') }}
          className="shrink-0 rounded p-0.5 text-gray-500 hover:bg-gray-100"
          aria-label="Remove business page"
        >
          <X size={14} />
        </button>
      </div>
    )
  }

  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-gray-400">
        <Search size={14} />
      </span>
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => results.length && setOpen(true)}
        placeholder="Search business pages…"
        className={`${cls} pl-7`}
      />
      {open && results.length > 0 && (
        <ul className="absolute z-10 mt-1 max-h-56 w-full overflow-auto rounded border border-gray-200 bg-white shadow-md">
          {results.map((r) => (
            <li key={r.id}>
              <button
                type="button"
                onClick={() => {
                  const lbl = r.subdomain ? `${r.name} · ${r.subdomain}.ourdahanu.in` : r.name
                  onChange(r.id, lbl); setLabel(lbl); setOpen(false); setQuery('')
                }}
                className="flex w-full flex-col items-start px-2 py-1.5 text-left text-sm hover:bg-gray-50"
              >
                <span className="font-semibold">{r.name}</span>
                {r.subdomain && <span className="text-xs text-gray-500">{r.subdomain}.ourdahanu.in</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Wire the checkbox + picker into EditProfessionalForm**

In `src/app/admin/find/EditProfessionalForm.tsx`:

(a) Add imports at top:

```tsx
import BusinessPicker from './BusinessPicker'
```

(b) Add state (near the existing `professions` state):

```tsx
  const [businessId, setBusinessId] = useState<string | null>(pro.business_listing_id ?? null)
  const [hasBusiness, setHasBusiness] = useState<boolean>(!!pro.business_listing_id)
```

(c) In the `fields(fd)` builder, add `businessListingId`:

```tsx
      note: String(fd.get('note') || ''),
      businessListingId: hasBusiness ? businessId : null,
```

(d) Add the checkbox + picker UI just before the `<textarea name="note" …>` (so it sits in the form body). Insert:

```tsx
      <div className="rounded border border-gray-300 p-2">
        <label className="flex items-center gap-2 text-xs font-medium">
          <input
            type="checkbox"
            checked={hasBusiness}
            onChange={(e) => { setHasBusiness(e.target.checked); if (!e.target.checked) setBusinessId(null) }}
          />
          Has an OurDahanu business page (premium + verified)
        </label>
        {hasBusiness && (
          <div className="mt-2">
            <BusinessPicker
              value={businessId}
              onChange={(id) => setBusinessId(id)}
            />
          </div>
        )}
      </div>
```

Note: when editing an already-linked professional, `pro.business_listing_id` is set so `hasBusiness` starts true and `businessId` is preselected; the picker renders its selected-chip state (label defaults to "Selected business" until re-searched — acceptable; admins see the checkbox is on and can remove/replace).

- [ ] **Step 3: Type-check, build**

Run: `npx tsc --noEmit` then `npm run build`
Expected: pass. (`pro.business_listing_id` exists on `FindProfessional` from Task 1.)

- [ ] **Step 4: Commit**

```bash
git add src/app/admin/find/BusinessPicker.tsx src/app/admin/find/EditProfessionalForm.tsx
git commit -m "feat(admin/find): business-page checkbox + searchable picker

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 5: Public premium card + detail page

**Files:**
- Modify: `src/app/find/find-ui.tsx`
- Modify: `src/app/find/page.tsx`
- Modify: `src/app/find/p/[id]/page.tsx`

**Interfaces:**
- Consumes: `businessHref` (Task 1), `ProfessionalWithStats.business` (Tasks 1–2).
- Produces: `PremiumBadge`, `VisitBusinessLink`, `BusinessAvatar` in `find-ui.tsx`; premium branch in landing `Card` and detail header.

- [ ] **Step 1: Add shared premium UI pieces**

In `src/app/find/find-ui.tsx`, add (import `ShieldCheck`, `ExternalLink` from lucide-react at the top import line; `Star` is already imported):

```tsx
import { ShieldCheck, ExternalLink, Star } from 'lucide-react'
```

Add these components (near `Monogram`):

```tsx
/** Business logo avatar for premium cards; falls back to the monogram. */
export function BusinessAvatar({
  business,
  name,
  size = 'md',
}: {
  business: LinkedBusiness
  name: string
  size?: 'md' | 'lg'
}) {
  const cls = size === 'lg' ? 'h-16 w-16 rounded-[20px]' : 'h-11 w-11 rounded-[14px]'
  if (!business.image_url) return <Monogram name={name} size={size} />
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={business.image_url}
      alt=""
      aria-hidden
      className={`${cls} shrink-0 object-cover ring-1 ring-[var(--od-gold)]`}
    />
  )
}

/** "Verified by OurDahanu" pill for premium (business-linked) professionals. */
export function PremiumBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-[var(--od-gold)]/15 px-2 py-0.5 text-[11px] font-bold text-[var(--od-brand-strong)]">
      <ShieldCheck size={12} className="text-[var(--od-gold)]" aria-hidden />
      Verified by OurDahanu
    </span>
  )
}

/** Link out to the linked business page. */
export function VisitBusinessLink({ business, className = '' }: { business: LinkedBusiness; className?: string }) {
  return (
    <a
      href={businessHref(business)}
      target="_blank"
      rel="noopener noreferrer"
      className={`flex items-center justify-center gap-1.5 rounded-xl border border-[var(--od-gold)] bg-[var(--od-gold)]/10 py-2 text-sm font-bold text-[var(--od-brand-strong)] transition-colors hover:bg-[var(--od-gold)]/20 active:scale-[0.98] ${className}`}
    >
      <ExternalLink size={14} aria-hidden /> Visit {business.name}
    </a>
  )
}
```

Also export a premium surface class used by both pages:

```tsx
/** Premium card surface — gold border + warm sheen, distinct from od-card. */
export const premiumCardClass =
  'relative flex flex-col rounded-[var(--od-radius)] border border-[var(--od-gold)] bg-gradient-to-br from-[var(--color-cream)]/50 to-white p-4 shadow-[0_10px_30px_rgba(200,136,30,0.12)] sm:p-5'
```

- [ ] **Step 2: Premium branch in the landing Card**

In `src/app/find/page.tsx`, update the imports from `find-ui`:

```tsx
import {
  BusinessAvatar,
  chipOff,
  chipOn,
  GoldStars,
  Monogram,
  Mr,
  premiumCardClass,
  PremiumBadge,
  professionLabels,
  telHref,
  VisitBusinessLink,
  waHref,
} from './find-ui'
```

Replace the `Card` function's outer `<article>` opening and the avatar/badge area so premium cards differ. Change the `<article className="od-card od-card-hover relative flex flex-col p-4 sm:p-5">` line to:

```tsx
    <article className={p.business ? premiumCardClass : 'od-card od-card-hover relative flex flex-col p-4 sm:p-5'}>
```

Immediately after the stretched `<Link … absolute inset-0 …>` element, add the badge for premium (above the header row):

```tsx
      {p.business && (
        <div className="relative z-10 mb-2">
          <PremiumBadge />
        </div>
      )}
```

Replace `<Monogram name={p.name} />` in the header with:

```tsx
        {p.business ? <BusinessAvatar business={p.business} name={p.name} /> : <Monogram name={p.name} />}
```

In the contact-button row (the `<div className="relative z-10 mt-4 flex gap-2 border-t …">`), add the visit link at the end (after the WhatsApp block, still inside that div):

```tsx
        {p.business && <VisitBusinessLink business={p.business} className="flex-1" />}
```

- [ ] **Step 3: Premium treatment on the detail page**

In `src/app/find/p/[id]/page.tsx`, import the pieces:

```tsx
import { BusinessAvatar, GoldStars, Monogram, Mr, PremiumBadge, professionLabels, telHref, timeAgo, VisitBusinessLink, waHref } from '../../find-ui'
```

In the header card, replace `<Monogram name={pro.name} size="lg" />` with:

```tsx
          {pro.business ? <BusinessAvatar business={pro.business} name={pro.name} size="lg" /> : <Monogram name={pro.name} size="lg" />}
```

Add the badge directly under the `<h1>{pro.name}</h1>` name (before the profession chips `<div>`):

```tsx
            {pro.business && <div className="mt-1"><PremiumBadge /></div>}
```

Add the visit-business button inside the contact button row (after the WhatsApp block, inside `<div className="mt-4 flex flex-col gap-2 sm:flex-row">`):

```tsx
          {pro.business && <VisitBusinessLink business={pro.business} className="h-11 flex-1" />}
```

Give the premium detail card a gold border: change the header card's `<div className="od-card relative p-5 sm:p-6">` to:

```tsx
      <div className={`relative p-5 sm:p-6 ${pro.business ? premiumCardClass.replace('flex flex-col ', '') : 'od-card'}`}>
```

(Import `premiumCardClass` too in the same `find-ui` import line.)

- [ ] **Step 4: Type-check, build**

Run: `npx tsc --noEmit` then `npm run build`
Expected: both pass.

- [ ] **Step 5: Runtime verification**

Pick an existing professional and link it via SQL to an approved listing to see the premium card (use a real listing id from the design exploration, e.g. Epitome Financial `15672428-535a-46c9-a931-3b1fe0618124`):

```sql
update find_professionals set business_listing_id = '15672428-535a-46c9-a931-3b1fe0618124'
where name ilike '%Jigar%';
```

Run `npm run dev`, open `http://find.localhost:3000/`:
- The linked professional shows the premium card (gold border, "Verified by OurDahanu" badge, "Visit …" button) and sorts to the top.
- Its detail page shows the badge + visit button; the visit link resolves to `https://jigarchheda.ourdahanu.in`.
- Other professionals are unchanged (plain cards).

Then revert the test link so prod data is clean (unless the user wants it kept):

```sql
update find_professionals set business_listing_id = null where name ilike '%Jigar%';
```

- [ ] **Step 6: Commit**

```bash
git add src/app/find/find-ui.tsx src/app/find/page.tsx "src/app/find/p/[id]/page.tsx"
git commit -m "feat(find): premium verified card for business-linked professionals

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Post-implementation notes

- **Admin edit-form preselected label:** when opening an already-linked professional, the picker shows a generic "Selected business" chip (the id is known, the name isn't fetched on load). This is acceptable; if a nicer label is wanted later, the admin page can pass the linked business name into `EditProfessionalForm` (it already can embed `business:listings(name)` on the professionals query).
- **Listing-side staleness:** a linked listing renamed/unapproved on the listings side isn't wired to invalidate the find cache; the hourly stale window absorbs it (documented in the spec).
- **DNS/deploy:** no infra changes — the migration is the only external step and is applied in Task 1.
