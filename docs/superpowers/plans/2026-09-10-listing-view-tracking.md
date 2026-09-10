# Listing Views and Contact Clicks Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Record how many people view a business listing and how many tap to call or WhatsApp it, and show the owner those numbers in My Business.

**Architecture:** A client-side beacon posts events to an API route, because listing pages are cached and a render-time counter would only see cache misses. Events land in a `listing_events` table whose unique index enforces one-per-visitor-per-day in the database rather than trusting the client. The owner reads aggregates through an ownership-checked server action.

**Tech Stack:** Next.js 16.2.1 App Router with Cache Components, React 19, Supabase (live production), `node:test` via `tsx --test`, Tailwind.

## Global Constraints

Copied from `docs/superpowers/specs/2026-09-10-listing-views-and-contact-clicks-design.md`. Every task's requirements implicitly include this section.

- **The database is LIVE PRODUCTION.** Migrations are additive only — no `DROP`, `DELETE`, `TRUNCATE`, or `UPDATE` of existing rows. Apply via the Supabase MCP `apply_migration` and commit an identical `.sql` copy under `supabase/`.
- **Dedupe is a database constraint, never a client-side hope.** The unique index on `(listing_id, kind, visitor_key, day)` is the enforcement. A `23505` from an insert is **success**, not an error.
- **All three kinds dedupe per visitor per day** — a person can produce one view, one phone tap and one WhatsApp tap in a day, but not two WhatsApp taps.
- **The owner's own views never count.** Excluded server-side in the route, by comparing the signed-in user against the listing's `owner_id`.
- **`day` is the IST date**, from `getIndiaToday()` in `src/lib/india-time.ts`. Never UTC — that would roll the counter at 5:30am local and split one evening across two days.
- **`visitor_key` carries no PII.** A random per-browser id in `localStorage`, sent only to this endpoint.
- Writes go through `createAdminClient()` (service role); every call site handles it returning `null`.
- New test files must be registered in the explicit list in `package.json`'s `test:existing` — the runner does not glob.
- `npx tsc --noEmit` is clean (exit 0) and must stay clean — no casts, `any`, or `@ts-ignore`.
- Lint baseline on `main` is **0 errors** / 11 warnings. A task adds zero problems of either kind.

**Note:** the Supabase MCP connector was disconnected at the time of writing. Task 1 needs it; if it is still unavailable, report BLOCKED rather than improvising.

---

### Task 1: `listing_events` table

**Files:**
- Create: `supabase/add_listing_events.sql`
- Modify: `src/lib/database.types.ts` (add the new table)

**Interfaces:**
- Produces: table `listing_events` with columns `id, listing_id, kind, visitor_key, day, created_at`.

- [ ] **Step 1: Write the migration**

Create `supabase/add_listing_events.sql`:

```sql
-- Per-listing view and contact-tap events, deduped to one per visitor per day.
-- Additive only: no existing table or row is touched.
CREATE TABLE IF NOT EXISTS listing_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('view', 'phone', 'whatsapp')),
  -- Random per-browser identifier from localStorage. No PII: it exists only
  -- to answer "have we already counted this person today".
  visitor_key text NOT NULL,
  -- IST date, not UTC. A UTC day would roll over at 5:30am local time and
  -- split a single evening's browsing across two days.
  day date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- The dedupe itself. A client that fires twice, or someone calling the
-- endpoint in a loop, collides here and the duplicate is discarded.
CREATE UNIQUE INDEX IF NOT EXISTS idx_listing_events_daily
  ON listing_events (listing_id, kind, visitor_key, day);

-- Serves the owner's month aggregates and the retention prune.
CREATE INDEX IF NOT EXISTS idx_listing_events_listing_day
  ON listing_events (listing_id, day DESC);

ALTER TABLE listing_events ENABLE ROW LEVEL SECURITY;

-- No policy of any kind. Owners read aggregates through an ownership-checked
-- server action, and writes go through the service-role client, which
-- bypasses RLS. With RLS on and no policies, anon and authenticated clients
-- can neither read nor write this table directly.
```

Note there is deliberately **no** `GRANT` and **no** policy here — unlike `appointment_date_overrides`, nothing about this table is public.

- [ ] **Step 2: Apply it**

Apply the exact file contents through the Supabase MCP `apply_migration` tool, name `add_listing_events`, project `slmbqngmxketyxjauxxk`.

If the Supabase connector is unavailable, **stop and report BLOCKED**. Do not hand-run SQL another way.

- [ ] **Step 3: Verify**

Through the Supabase MCP `execute_sql` tool:

```sql
select count(*) as rows from listing_events;
select indexname from pg_indexes where tablename = 'listing_events';
select relrowsecurity from pg_class where relname = 'listing_events';
```

Expected: `rows` is 0; indexes include `idx_listing_events_daily` and `idx_listing_events_listing_day`; `relrowsecurity` is `true`.

- [ ] **Step 4: Add the table to the generated types**

Add a `listing_events` entry to `src/lib/database.types.ts` by hand, in the same style as its neighbours, with `Row` / `Insert` / `Update` and a `Relationships` entry for the `listing_id` foreign key (Postgres names it `listing_events_listing_id_fkey`).

Do **not** regenerate the whole file — a previous task on this repo found the generator introduces unrelated churn and drops the header. Add only this table's block.

- [ ] **Step 5: Typecheck and commit**

Run: `npx tsc --noEmit`
Expected: clean, exit 0.

```bash
git add supabase/add_listing_events.sql src/lib/database.types.ts
git commit -m "feat(analytics): add listing_events table"
```

---

### Task 2: Month windows and aggregate shaping

The two pure functions the owner-facing numbers are built from. Everything else in this feature is I/O; this is where the logic lives, so it gets real tests.

**Files:**
- Create: `src/lib/listing-stats.ts`
- Create: `src/lib/listing-stats.test.ts`
- Modify: `package.json`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `type ListingEventKind = 'view' | 'phone' | 'whatsapp'`
  - `type MonthWindows = { currentStart: string; previousStart: string; previousEnd: string }`
  - `monthWindows(today: string): MonthWindows`
  - `type ListingEventRow = { listing_id: string; kind: ListingEventKind; day: string }`
  - `type ListingStats = { views: number; phone: number; whatsapp: number; previousViews: number }`
  - `summariseListingEvents(rows: ListingEventRow[], windows: MonthWindows): Record<string, ListingStats>`
  - `EMPTY_LISTING_STATS: ListingStats`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/listing-stats.test.ts`:

```ts
import { test } from 'node:test'
import assert from 'node:assert/strict'

import {
  EMPTY_LISTING_STATS,
  monthWindows,
  summariseListingEvents,
  type ListingEventRow,
} from './listing-stats'

test('month windows for a mid-month day', () => {
  assert.deepEqual(monthWindows('2026-09-10'), {
    currentStart: '2026-09-01',
    previousStart: '2026-08-01',
    previousEnd: '2026-08-31',
  })
})

test('month windows on the first of the month', () => {
  assert.deepEqual(monthWindows('2026-09-01'), {
    currentStart: '2026-09-01',
    previousStart: '2026-08-01',
    previousEnd: '2026-08-31',
  })
})

test('month windows roll back across a year boundary', () => {
  assert.deepEqual(monthWindows('2026-01-15'), {
    currentStart: '2026-01-01',
    previousStart: '2025-12-01',
    previousEnd: '2025-12-31',
  })
})

test('month windows handle a 30-day previous month', () => {
  assert.deepEqual(monthWindows('2026-05-04'), {
    currentStart: '2026-05-01',
    previousStart: '2026-04-01',
    previousEnd: '2026-04-30',
  })
})

test('month windows handle February in a non-leap year', () => {
  assert.deepEqual(monthWindows('2026-03-20'), {
    currentStart: '2026-03-01',
    previousStart: '2026-02-01',
    previousEnd: '2026-02-28',
  })
})

test('month windows handle February in a leap year', () => {
  assert.deepEqual(monthWindows('2028-03-20'), {
    currentStart: '2028-03-01',
    previousStart: '2028-02-01',
    previousEnd: '2028-02-29',
  })
})

const W = monthWindows('2026-09-10')

function row(over: Partial<ListingEventRow> = {}): ListingEventRow {
  return { listing_id: 'L1', kind: 'view', day: '2026-09-05', ...over }
}

test('counts each kind separately for the current month', () => {
  const out = summariseListingEvents(
    [
      row({ kind: 'view' }),
      row({ kind: 'view', day: '2026-09-06' }),
      row({ kind: 'phone' }),
      row({ kind: 'whatsapp' }),
      row({ kind: 'whatsapp', day: '2026-09-07' }),
    ],
    W,
  )
  assert.deepEqual(out.L1, { views: 2, phone: 1, whatsapp: 2, previousViews: 0 })
})

test('counts last month views separately and never mixes them in', () => {
  const out = summariseListingEvents(
    [
      row({ kind: 'view', day: '2026-09-02' }),
      row({ kind: 'view', day: '2026-08-15' }),
      row({ kind: 'view', day: '2026-08-16' }),
      row({ kind: 'phone', day: '2026-08-16' }),
    ],
    W,
  )
  assert.deepEqual(out.L1, { views: 1, phone: 0, whatsapp: 0, previousViews: 2 })
})

test('includes the first and last day of each window', () => {
  const out = summariseListingEvents(
    [
      row({ kind: 'view', day: '2026-09-01' }),
      row({ kind: 'view', day: '2026-08-01' }),
      row({ kind: 'view', day: '2026-08-31' }),
    ],
    W,
  )
  assert.equal(out.L1.views, 1)
  assert.equal(out.L1.previousViews, 2)
})

test('ignores events older than last month', () => {
  const out = summariseListingEvents([row({ kind: 'view', day: '2026-07-31' })], W)
  assert.equal(out.L1, undefined)
})

test('keeps listings separate', () => {
  const out = summariseListingEvents(
    [row({ listing_id: 'L1' }), row({ listing_id: 'L2' }), row({ listing_id: 'L2' , day: '2026-09-08' })],
    W,
  )
  assert.equal(out.L1.views, 1)
  assert.equal(out.L2.views, 2)
})

test('returns an empty object for no rows', () => {
  assert.deepEqual(summariseListingEvents([], W), {})
})

test('EMPTY_LISTING_STATS is all zeroes', () => {
  assert.deepEqual(EMPTY_LISTING_STATS, {
    views: 0,
    phone: 0,
    whatsapp: 0,
    previousViews: 0,
  })
})
```

- [ ] **Step 2: Register the test file**

Append ` src/lib/listing-stats.test.ts` to the end of the `test:existing` command string in `package.json`.

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npm run test:existing`
Expected: FAIL — module `./listing-stats` not found.

- [ ] **Step 4: Write the implementation**

Create `src/lib/listing-stats.ts`:

```ts
/**
 * Pure shaping for the owner-facing listing numbers.
 *
 * Kept free of Supabase and `server-only` so the whole of the actual logic
 * in this feature is unit-testable — everything else (the beacon route, the
 * server action, the dashboard line) is I/O around these two functions.
 *
 * All dates are `YYYY-MM-DD` strings in IST. String comparison is safe and
 * intentional: ISO dates sort lexicographically, so `day >= start` is a
 * correct range test without constructing a single Date object.
 */

export type ListingEventKind = 'view' | 'phone' | 'whatsapp'

export type MonthWindows = {
  /** First day of the current month, inclusive. */
  currentStart: string
  /** First day of the previous month, inclusive. */
  previousStart: string
  /** Last day of the previous month, inclusive. */
  previousEnd: string
}

export type ListingEventRow = {
  listing_id: string
  kind: ListingEventKind
  day: string
}

export type ListingStats = {
  views: number
  phone: number
  whatsapp: number
  previousViews: number
}

export const EMPTY_LISTING_STATS: ListingStats = {
  views: 0,
  phone: 0,
  whatsapp: 0,
  previousViews: 0,
}

function pad(value: number): string {
  return String(value).padStart(2, '0')
}

/**
 * The current and previous calendar month, derived from a `YYYY-MM-DD` day.
 *
 * Computed by arithmetic on the parts rather than with Date, so it cannot be
 * perturbed by the server's timezone. The caller supplies the IST day.
 */
export function monthWindows(today: string): MonthWindows {
  const year = Number.parseInt(today.slice(0, 4), 10)
  const month = Number.parseInt(today.slice(5, 7), 10)

  const prevYear = month === 1 ? year - 1 : year
  const prevMonth = month === 1 ? 12 : month - 1

  // Day 0 of a month is the last day of the month before it, which handles
  // 28/29/30/31 without a table. Built in UTC so no local offset applies.
  const lastDayOfPrev = new Date(Date.UTC(year, month - 1, 0)).getUTCDate()

  return {
    currentStart: `${year}-${pad(month)}-01`,
    previousStart: `${prevYear}-${pad(prevMonth)}-01`,
    previousEnd: `${prevYear}-${pad(prevMonth)}-${pad(lastDayOfPrev)}`,
  }
}

/**
 * Fold raw event rows into per-listing totals. Listings with no events in
 * either window are simply absent from the result — the caller substitutes
 * EMPTY_LISTING_STATS so the dashboard can render "no views yet" rather than
 * a row of zeroes.
 */
export function summariseListingEvents(
  rows: ListingEventRow[],
  windows: MonthWindows,
): Record<string, ListingStats> {
  const out: Record<string, ListingStats> = Object.create(null)

  for (const row of rows) {
    const inCurrent = row.day >= windows.currentStart
    const inPrevious = row.day >= windows.previousStart && row.day <= windows.previousEnd
    if (!inCurrent && !inPrevious) continue

    const stats = out[row.listing_id] ?? (out[row.listing_id] = { ...EMPTY_LISTING_STATS })

    if (inCurrent) {
      if (row.kind === 'view') stats.views += 1
      else if (row.kind === 'phone') stats.phone += 1
      else stats.whatsapp += 1
    } else if (row.kind === 'view') {
      stats.previousViews += 1
    }
  }

  return out
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npm run test:existing`
Expected: PASS — all 12 new tests plus every pre-existing test.

- [ ] **Step 6: Commit**

```bash
git add src/lib/listing-stats.ts src/lib/listing-stats.test.ts package.json
git commit -m "feat(analytics): month windows and listing event aggregation"
```

---

### Task 3: The beacon endpoint

**Files:**
- Create: `src/app/api/listings/[id]/track/route.ts`
- Modify: `supabase/add_listing_events.sql`
- Modify: `src/lib/database.types.ts` (register the RPC)

**Interfaces:**
- Consumes: `getIndiaToday()` from `@/lib/india-time`; `createAdminClient` from `@/lib/supabase/admin-client`; `createClient` from `@/lib/supabase/server`; `rateLimit`, `tooManyRequests` from `@/lib/rate-limit`.
- Produces: `POST /api/listings/<id>/track` accepting `{ kind: 'view'|'phone'|'whatsapp', visitorKey: string }`, always returning 204 on success.

- [ ] **Step 1: Write the route**

Create `src/app/api/listings/[id]/track/route.ts`:

```ts
import { NextResponse } from 'next/server'

import { getIndiaToday } from '@/lib/india-time'
import { rateLimit, tooManyRequests } from '@/lib/rate-limit'
import { createAdminClient } from '@/lib/supabase/admin-client'
import { createClient } from '@/lib/supabase/server'

const KINDS = new Set(['view', 'phone', 'whatsapp'])
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Records one listing view or contact tap.
 *
 * Always answers 204, even when nothing was written. This endpoint is called
 * by a fire-and-forget beacon on a page a customer is reading; there is no UI
 * to show an error to, and a failure here must never be visible to them.
 * "Nothing was written" is the normal case — a repeat visit on the same day
 * is expected to collide with the unique index.
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id: listingId } = await context.params
  if (!UUID.test(listingId)) return new NextResponse(null, { status: 204 })

  let kind = ''
  let visitorKey = ''
  try {
    const body = (await request.json()) as { kind?: string; visitorKey?: string }
    kind = String(body.kind ?? '')
    visitorKey = String(body.visitorKey ?? '').trim().slice(0, 64)
  } catch {
    return new NextResponse(null, { status: 204 })
  }

  if (!KINDS.has(kind) || visitorKey.length < 8) {
    return new NextResponse(null, { status: 204 })
  }

  // Cheap ceiling on a single abuser. The unique index is the real defence
  // against inflated counts; this just stops someone burning invocations.
  const rl = rateLimit(`track:${visitorKey}`, 60, 60 * 1000)
  if (!rl.ok) return tooManyRequests(rl.resetAt)

  const adminClient = createAdminClient()
  if (!adminClient) return new NextResponse(null, { status: 204 })

  // The owner must never move their own numbers. The first thing an owner
  // does with a view counter is open their own listing and watch it; if it
  // climbs, they stop believing the contact figures too.
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (user) {
    const { data: listing } = await adminClient
      .from('listings')
      .select('owner_id')
      .eq('id', listingId)
      .maybeSingle()
    if (listing?.owner_id === user.id) {
      return new NextResponse(null, { status: 204 })
    }
  }

  const { error } = await adminClient.from('listing_events').insert({
    listing_id: listingId,
    kind,
    visitor_key: visitorKey,
    day: getIndiaToday(),
  })

  // 23505 is the unique index doing its job: this visitor already counted for
  // this kind today. That is success, not an error.
  const isDuplicate = error?.code === '23505'
  if (error && !isDuplicate) {
    console.error('[listing-events] insert failed', error.message)
    return new NextResponse(null, { status: 204 })
  }

  // Lifetime counter, incremented only for genuinely new events so it stays
  // consistent with the event rows. It exists so the dashboard tile stops
  // reading zero immediately, and so lifetime history survives the retention
  // prune of old event rows.
  if (!isDuplicate && kind === 'view') {
    await adminClient.rpc('increment_listing_views', { p_listing_id: listingId })
  }

  return new NextResponse(null, { status: 204 })
}
```

- [ ] **Step 2: Add the increment function to the migration**

The route calls an RPC so the counter increments atomically — a read-then-write from the route would lose concurrent views.

Append to `supabase/add_listing_events.sql`:

```sql
-- Atomic lifetime view counter. A read-then-write from the application would
-- drop concurrent increments; this cannot.
CREATE OR REPLACE FUNCTION public.increment_listing_views(p_listing_id uuid)
RETURNS void
LANGUAGE sql
AS $$
  UPDATE listings
  SET views = COALESCE(views, 0) + 1
  WHERE id = p_listing_id;
$$;
```

Apply **just this function** through the Supabase MCP `apply_migration` tool, name `add_increment_listing_views`. The `CREATE TABLE IF NOT EXISTS` statements from Task 1 are idempotent, so re-applying the whole file is also safe — but a separate named migration reads better in the history.

Then verify:

```sql
select proname from pg_proc where proname = 'increment_listing_views';
```

- [ ] **Step 3: Register the RPC in the generated types**

`supabase.rpc()` is typed against the `Functions` block in
`src/lib/database.types.ts`. Without an entry there the call in the route is a
type error and Step 4 will fail. Add one to that block (it starts at line 2204,
entries in alphabetical order, so this goes after `get_*` and before
`is_*`-style neighbours — match the surrounding ordering):

```ts
      increment_listing_views: {
        Args: { p_listing_id: string }
        Returns: undefined
      }
```

`Returns: undefined` is what the generator emits for a `RETURNS void`
function — check a neighbouring void function in the block and match it
exactly rather than guessing.

- [ ] **Step 4: Typecheck and lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: typecheck clean; lint at 0 errors / 11 warnings.

- [ ] **Step 5: Commit**

```bash
git add "src/app/api/listings/[id]/track/route.ts" supabase/add_listing_events.sql src/lib/database.types.ts
git commit -m "feat(analytics): beacon endpoint for listing views and contact taps"
```

---

### Task 4: The client tracker

One component records the view on mount and catches contact taps by **event delegation** — so no existing button, in `ListingHero` or `ListingSidebar` or anywhere else, needs to be modified or wrapped.

**Files:**
- Create: `src/components/listings/ListingTracker.tsx`
- Modify: `src/app/listings/[id]/page.tsx` (mount it)

**Interfaces:**
- Consumes: `POST /api/listings/<id>/track` (Task 3).
- Produces: default export `ListingTracker` with props `{ listingId: string }`.

- [ ] **Step 1: Write the component**

Create `src/components/listings/ListingTracker.tsx`:

```tsx
'use client'

import { useEffect } from 'react'

const VISITOR_KEY_STORAGE = 'ourdahanu:visitor-key/v1'

/**
 * A random per-browser identifier, created once and reused.
 *
 * No PII and no fingerprinting: it exists only so the server can answer
 * "have we already counted this person today". A cleared or blocked
 * localStorage yields a fresh key, which slightly over-counts — the correct
 * direction to err, since the alternative is identifying people.
 */
function getVisitorKey(): string | null {
  try {
    const existing = window.localStorage.getItem(VISITOR_KEY_STORAGE)
    if (existing && existing.length >= 8) return existing
    const created = crypto.randomUUID()
    window.localStorage.setItem(VISITOR_KEY_STORAGE, created)
    return created
  } catch {
    // Private mode or blocked storage: skip tracking rather than inventing a
    // new key on every page load, which would inflate every number.
    return null
  }
}

function send(listingId: string, kind: 'view' | 'phone' | 'whatsapp', visitorKey: string): void {
  const body = JSON.stringify({ kind, visitorKey })
  const url = `/api/listings/${listingId}/track`

  // sendBeacon survives the page being unloaded by a tel:/wa.me navigation,
  // which a plain fetch does not. Falling back to keepalive fetch covers the
  // browsers that lack it.
  try {
    if (navigator.sendBeacon) {
      navigator.sendBeacon(url, new Blob([body], { type: 'application/json' }))
      return
    }
  } catch {
    // fall through
  }
  void fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
    keepalive: true,
  }).catch(() => {})
}

/**
 * Records a view on mount, and contact taps by delegation.
 *
 * Delegation rather than wrapping each button: it catches every `tel:` and
 * `wa.me` link on the page, including ones added later, without threading a
 * prop through the hero, the sidebar and the services list.
 */
export default function ListingTracker({ listingId }: { listingId: string }) {
  useEffect(() => {
    const visitorKey = getVisitorKey()
    if (!visitorKey) return

    send(listingId, 'view', visitorKey)

    const onClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null
      const anchor = target?.closest?.('a[href]') as HTMLAnchorElement | null
      if (!anchor) return

      const href = anchor.getAttribute('href') ?? ''

      if (href.startsWith('tel:')) {
        send(listingId, 'phone', visitorKey)
        return
      }

      // wa.me/<number> is contacting this business. wa.me/?text=… with no
      // number is the "share this listing" link — a different action, and
      // counting it as an enquiry would overstate the number the owner is
      // being asked to trust.
      if (href.includes('wa.me/')) {
        const path = href.split('wa.me/')[1] ?? ''
        const hasNumber = /^\d/.test(path)
        if (hasNumber) send(listingId, 'whatsapp', visitorKey)
      }
    }

    document.addEventListener('click', onClick, true)
    return () => document.removeEventListener('click', onClick, true)
  }, [listingId])

  return null
}
```

- [ ] **Step 2: Mount it on the listing page**

In `src/app/listings/[id]/page.tsx`, add to the imports:

```tsx
import ListingTracker from '@/components/listings/ListingTracker'
```

and render it inside the existing `<ListingViewerProvider listingId={listingId}>` wrapper, as its first child:

```tsx
      <ListingTracker listingId={listingId} />
```

It renders `null`, so its position affects nothing visually — but it must be inside the provider so it mounts on every listing view, including subdomain renders.

- [ ] **Step 3: Typecheck, lint and build**

Run: `npx tsc --noEmit && npm run lint && npm run build`
Expected: typecheck clean; lint 0 errors / 11 warnings; build succeeds.

- [ ] **Step 4: Verify a real view is recorded**

Start the dev server with the Browser pane (`preview_start`, `dev` launch config) and load a real business listing — `http://nisargfarm.localhost:3000/` works and needs no sign-in.

Then check, through the Supabase MCP `execute_sql` tool:

```sql
select listing_id, kind, day, created_at from listing_events order by created_at desc limit 5;
select name, views from listings where subdomain = 'nisargfarm';
```

Expected: one `view` row, and `listings.views` incremented by one.

**Then reload the page and run the same query again.** The row count must **not** increase — that is the dedupe working. Report both results.

- [ ] **Step 5: Commit**

```bash
git add src/components/listings/ListingTracker.tsx "src/app/listings/[id]/page.tsx"
git commit -m "feat(analytics): record listing views and contact taps client-side"
```

---

### Task 5: Show the owner their numbers

**Files:**
- Create: `src/app/actions/listing-stats.ts`
- Modify: `src/app/my-business/page.tsx`

**Interfaces:**
- Consumes: `monthWindows`, `summariseListingEvents`, `EMPTY_LISTING_STATS`, `type ListingStats` (Task 2); `getIndiaToday()` from `@/lib/india-time`.
- Produces: `getMyListingStats(listingIds: string[]): Promise<Record<string, ListingStats>>`.

- [ ] **Step 1: Write the server action**

Create `src/app/actions/listing-stats.ts`:

```ts
'use server'

import { getIndiaToday } from '@/lib/india-time'
import {
  monthWindows,
  summariseListingEvents,
  type ListingEventRow,
  type ListingStats,
} from '@/lib/listing-stats'
import { createAdminClient } from '@/lib/supabase/admin-client'
import { createClient } from '@/lib/supabase/server'

/**
 * This month's and last month's numbers for listings the caller owns.
 *
 * Ownership is re-checked here against the database rather than trusted from
 * the caller's list of ids — otherwise anyone could ask for anyone's numbers
 * by passing someone else's listing id.
 */
export async function getMyListingStats(
  listingIds: string[],
): Promise<Record<string, ListingStats>> {
  if (listingIds.length === 0) return {}

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return {}

  const adminClient = createAdminClient()
  if (!adminClient) return {}

  const { data: owned } = await adminClient
    .from('listings')
    .select('id')
    .eq('owner_id', user.id)
    .in('id', listingIds)

  const ownedIds = ((owned ?? []) as Array<{ id: string }>).map((row) => row.id)
  if (ownedIds.length === 0) return {}

  const windows = monthWindows(getIndiaToday())

  const { data } = await adminClient
    .from('listing_events')
    .select('listing_id, kind, day')
    .in('listing_id', ownedIds)
    .gte('day', windows.previousStart)

  return summariseListingEvents((data ?? []) as ListingEventRow[], windows)
}
```

- [ ] **Step 2: Load the stats in My Business**

`src/app/my-business/page.tsx` is a server component. Add to its imports:

```tsx
import { getMyListingStats } from '@/app/actions/listing-stats'
import { EMPTY_LISTING_STATS } from '@/lib/listing-stats'
```

After `listings` is populated (just below the `totalViews` calculation around line 174), add:

```tsx
    const listingStats = listings.length > 0
      ? await getMyListingStats(listings.map((l) => l.id))
      : {}
```

Declare `listingStats` alongside the other `let` declarations near line 161 so it is in scope where the JSX uses it:

```tsx
  let listingStats: Record<string, import('@/lib/listing-stats').ListingStats> = {}
```

- [ ] **Step 3: Render one line per listing**

In the listing card, immediately after the closing `</div>` of the existing rating/reviews/expiry row (the `flex flex-wrap items-center gap-3 mt-1.5 text-xs text-gray-400` block around line 351), insert:

```tsx
                      {(() => {
                        const stats = listingStats[listing.id] ?? EMPTY_LISTING_STATS
                        const hasAny = stats.views > 0 || stats.phone > 0 || stats.whatsapp > 0
                        if (!hasAny) {
                          return (
                            <p className="mt-1.5 text-xs text-gray-400">
                              No views yet this month
                            </p>
                          )
                        }
                        return (
                          <p className="mt-1.5 text-xs text-gray-600">
                            <span className="font-semibold text-gray-900">{stats.views}</span> views this month
                            {stats.whatsapp > 0 && <> · <span className="font-semibold text-gray-900">{stats.whatsapp}</span> WhatsApp</>}
                            {stats.phone > 0 && <> · <span className="font-semibold text-gray-900">{stats.phone}</span> calls</>}
                            {stats.previousViews > 0 && (
                              <span className="text-gray-400"> · last month {stats.previousViews}</span>
                            )}
                          </p>
                        )
                      })()}
```

A listing with no events reads "No views yet this month" rather than a row of zeroes — three zeroes look like a broken feature, one honest sentence does not.

- [ ] **Step 4: Typecheck, lint, test and build**

Run: `npx tsc --noEmit && npm run lint && npm run test:existing && npm run build`
Expected: typecheck clean; lint 0 errors / 11 warnings; tests passing; build succeeds.

- [ ] **Step 5: Verify in the browser**

My Business requires a Google sign-in that this environment cannot complete — earlier tasks on this repo confirmed `/my-business/edit/<id>` redirects an anonymous visitor to the homepage. Attempt it via the Browser pane and **report exactly what you observe**. Do not fabricate a signed-in result.

Note clearly in your report that a signed-in check by the site owner is required: the numbers must appear on the listing card, and must match what a `select` against `listing_events` says.

- [ ] **Step 6: Commit**

```bash
git add src/app/actions/listing-stats.ts src/app/my-business/page.tsx
git commit -m "feat(analytics): show owners their monthly views and contacts"
```

---

### Task 6: Retention and the privacy sentence

**Files:**
- Modify: `src/app/api/cron/listing-expiry/route.ts`
- Modify: `src/app/privacy/page.tsx`

**Interfaces:**
- Consumes: `addIndiaDays` from `@/lib/india-time`, `getIndiaToday` from the same module.
- Produces: nothing other tasks consume.

- [ ] **Step 1: Prune old events in the existing cron**

`src/app/api/cron/listing-expiry/route.ts` already authenticates with `Bearer ${CRON_SECRET}` and already builds an `adminClient`. Add the prune near the end of its `GET`, before it returns its summary:

```ts
  // Retention: listing_events exists to answer "this month vs last month",
  // so anything older than 180 days is dead weight on a free-tier database.
  // listings.views keeps the lifetime figure, so pruning never makes a
  // business's history appear to shrink.
  const eventCutoff = addIndiaDays(getIndiaToday(), -180)
  const { error: pruneError } = await adminClient
    .from('listing_events')
    .delete()
    .lt('day', eventCutoff)

  if (pruneError) {
    console.error('[cron:listing-expiry] listing_events prune failed', pruneError.message)
  }
```

That file does **not** currently import from `@/lib/india-time` — verified, it
imports only `next/server`, the admin client, the appointment reminders and the
notification engine. Add a new import line alongside those:

```ts
import { addIndiaDays, getIndiaToday } from '@/lib/india-time'
```

This is the one place in this feature that issues a `DELETE`. Its filter is `day < <today − 180 days>` and it touches only `listing_events` — never `listings`, never anything else.

Note the cron runs **weekly** (`vercel.json` declares `0 0 * * 1`, Mondays at
00:00 UTC), so a row lives at most 187 days rather than exactly 180. That is a
retention floor, not a guarantee.

- [ ] **Step 2: Correct the stale schedule comment on that route**

The file's header comment currently opens:

```
 * Daily cron job — Listing Expiry & Reminder System
 *
 * Vercel runs this at 00:30 UTC (6:00am IST) every day.
```

`vercel.json` says `0 0 * * 1`. Both the frequency and the time are wrong, and
this plan's retention maths depends on the real schedule — leaving the comment
would hand the next reader a contradiction. Replace those two lines with:

```
 * Weekly cron job — Listing Expiry & Reminder System
 *
 * Vercel runs this at 00:00 UTC on Mondays (5:30am IST), per `vercel.json`.
```

Change only the comment. Do not touch the schedule itself — expiry reminders
have been running on it, and changing cadence is a product decision, not a
side effect of adding a prune.

- [ ] **Step 3: Name the identifier in the privacy policy**

`src/app/privacy/page.tsx` has an "Analytics" section (around line 91) that currently names Google Analytics and Vercel Analytics. Add one sentence to that section:

```tsx
          <p>We also count how many people view each business listing and how many
            tap to call or message it, so business owners can see how their listing is
            performing. To avoid counting the same person twice in a day, your browser
            stores a random identifier that is not linked to your name, email, or account.</p>
```

Plain language on purpose: this page is read by shopkeepers and customers, not lawyers. The claim must be true — the identifier really is random, really is unlinked, and really is used only for daily de-duplication.

- [ ] **Step 4: Typecheck, lint and build**

Run: `npx tsc --noEmit && npm run lint && npm run build`
Expected: typecheck clean; lint 0 errors / 11 warnings; build succeeds.

- [ ] **Step 5: Verify the privacy copy renders**

Load `http://localhost:3000/privacy` in the Browser pane — it is public. Confirm the new sentence appears in the Analytics section and reads correctly. Report what you saw.

- [ ] **Step 6: Commit**

```bash
git add src/app/api/cron/listing-expiry/route.ts src/app/privacy/page.tsx
git commit -m "feat(analytics): prune old events and disclose the visitor identifier"
```

---

## Post-implementation checks

Not tasks — what to confirm before this merges.

- [ ] `npx tsc --noEmit` clean, `npm run lint` at 0 errors / 11 warnings, `npm run test:existing` passing, `npm run build` succeeds.
- [ ] Loading a listing page inserts exactly one `view` row; **reloading inserts none**.
- [ ] `listings.views` increments alongside the first view and not on the repeat.
- [ ] **The site owner confirms, signed in**, that My Business shows the numbers and that they match a `select` against `listing_events`.
- [ ] **The site owner confirms the owner-exclusion works**: open your own listing while signed in, and check no row appears for it.
- [ ] Tapping the WhatsApp *share* link records nothing; tapping the WhatsApp *enquiry* link records one `whatsapp`.
