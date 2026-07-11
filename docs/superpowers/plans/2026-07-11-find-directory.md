# find.ourdahanu.in Professionals Directory — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a standalone `find.ourdahanu.in` directory of local professionals where logged-in users submit entries and rate them, and admins moderate both — all inside the existing OurDahanu Next.js app.

**Architecture:** A new `/find` route segment served on the `find.` subdomain via `src/proxy.ts` rewrite (own layout/branding). Two new Supabase tables (`find_professionals`, `find_ratings`), both with a `pending|approved|rejected` moderation status. Public reads via the SSR Supabase client; user submissions/ratings via server actions; all admin status changes via the service-role admin client, admin-gated. Admin UI lives in the existing `/admin` panel.

**Tech Stack:** Next.js 16.2.1 (App Router, Server Components, `proxy.ts` middleware), React 19, Supabase (`@supabase/ssr` + `@supabase/supabase-js`), Tailwind CSS v4, lucide-react icons.

## Global Constraints

- **This is NOT the Next.js you know** — before writing routing/`proxy.ts` code, read the relevant guides in `node_modules/next/dist/docs/`. Heed deprecation notices (per AGENTS.md).
- **No test framework exists** in this repo. Verify each task with `npm run build`, `npm run lint`, `npx tsc --noEmit`, and manual browser checks on `find.localhost:3000`. Do NOT add jest/vitest.
- **Reserved-subdomain lists must stay in sync** across three files: `src/lib/subdomain.ts` (`RESERVED_SUBDOMAINS`), `src/proxy.ts` (inline regex literals in `export const config` — pure literals only, no variable references), and `src/app/api/check-subdomain/route.ts` (`RESERVED` set).
- **Service-role client** is `createAdminClient()` from `@/lib/supabase/admin-client` — server-only, may return `null` if env missing; always null-check.
- **Admin gating** uses `requireAdmin(supabase)` / `getUserRole(supabase)` from `@/app/actions/admin`.
- **SSR client** is `await createClient()` from `@/lib/supabase/server`; current user via `supabase.auth.getUser()`.
- **Server actions** start with `'use server'` and return `{ error?: string }`-shaped objects (see `src/app/actions/listing-interactions.ts` for the established pattern), not thrown errors, for user-facing validation failures.
- **Commit** after each task. End commit messages with the Co-Authored-By trailer:
  `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`

---

## File Structure

**Create:**
- `supabase/add_find_directory.sql` — tables, indexes, RLS.
- `src/lib/find/professions.ts` — shared `PROFESSIONS` constant + helpers.
- `src/lib/find/types.ts` — shared TypeScript types.
- `src/lib/data/find.ts` — public read queries (list, detail, averages).
- `src/app/find/layout.tsx` — standalone Find header/footer/branding.
- `src/app/find/page.tsx` — landing: search + profession filter + list.
- `src/app/find/FindSearchControls.tsx` — client component for search/filter inputs.
- `src/app/find/submit/page.tsx` — submit-a-professional page (login-gated).
- `src/app/find/submit/SubmitProfessionalForm.tsx` — client form component.
- `src/app/find/p/[id]/page.tsx` — professional detail + approved ratings + rating form.
- `src/app/find/p/[id]/RatingForm.tsx` — client rating form component.
- `src/app/actions/find.ts` — user server actions: `submitProfessional`, `submitRating`.
- `src/app/actions/admin-find.ts` — admin server actions: approve/reject/edit/create professional, approve/reject rating.
- `src/app/admin/find/page.tsx` — admin moderation UI (professionals + ratings tabs).
- `src/app/admin/find/EditProfessionalForm.tsx` — client edit form for a submission.

**Modify:**
- `src/lib/subdomain.ts` — add `'find'` to `RESERVED_SUBDOMAINS`.
- `src/proxy.ts` — add `'find'` to inline regexes + rewrite `find` host → `/find/*`.
- `src/app/api/check-subdomain/route.ts` — add `'find'` to `RESERVED`.
- `src/app/admin/page.tsx` — add a "Find Directory" quick-action link to `/admin/find`.

---

## Task 1: Database migration, shared professions, and types

**Files:**
- Create: `supabase/add_find_directory.sql`
- Create: `src/lib/find/professions.ts`
- Create: `src/lib/find/types.ts`

**Interfaces:**
- Produces:
  - `PROFESSIONS: readonly string[]` and `isValidProfession(p: string): boolean` from `professions.ts`.
  - Types `FindProfessional`, `FindRating`, `ModerationStatus`, `ProfessionalWithStats` from `types.ts`.
  - Tables `find_professionals`, `find_ratings` in Supabase.

- [ ] **Step 1: Write the migration SQL**

Create `supabase/add_find_directory.sql`:

```sql
-- find.ourdahanu.in — professionals directory + moderated ratings
-- Both tables use a pending|approved|rejected moderation status.

create table if not exists find_professionals (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text not null,
  whatsapp boolean not null default false,
  profession text not null,
  profession_other text,
  locality text,
  note text,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  is_active boolean not null default true,
  submitted_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists find_ratings (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null references find_professionals(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  rating int not null check (rating between 1 and 5),
  comment text not null,
  used_service boolean not null default false,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (professional_id, user_id)
);

create index if not exists find_professionals_public_idx
  on find_professionals (status, is_active, profession);
create index if not exists find_ratings_professional_idx
  on find_ratings (professional_id, status);
create index if not exists find_ratings_pending_idx
  on find_ratings (status, created_at desc);

alter table find_professionals enable row level security;
alter table find_ratings enable row level security;

-- Professionals: public sees approved+active; users see their own submissions.
create policy "Find approved professionals are public" on find_professionals
  for select using ((status = 'approved' and is_active = true) or auth.uid() = submitted_by);
-- Users may submit; must be pending and owned by them.
create policy "Users can submit professionals" on find_professionals
  for insert with check (auth.uid() = submitted_by and status = 'pending');

-- Ratings: public sees approved; users see their own.
create policy "Find approved ratings are public" on find_ratings
  for select using (status = 'approved' or auth.uid() = user_id);
-- Users insert their own rating (forced pending).
create policy "Users can submit ratings" on find_ratings
  for insert with check (auth.uid() = user_id and status = 'pending');
-- Users update their own rating (forced pending on resubmit).
create policy "Users can update own ratings" on find_ratings
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id and status = 'pending');

-- Note: all admin status changes / edits go through the service-role client,
-- which bypasses RLS, so no admin policies are needed here.
```

- [ ] **Step 2: Apply the migration**

Apply via the Supabase MCP `apply_migration` tool (name: `add_find_directory`) OR paste into the Supabase SQL editor. Confirm both tables exist:

Run (Supabase SQL editor or MCP `execute_sql`):
```sql
select table_name from information_schema.tables
where table_name in ('find_professionals','find_ratings');
```
Expected: two rows returned.

- [ ] **Step 3: Write the shared professions constant**

Create `src/lib/find/professions.ts`:

```ts
// Single source of truth for the professions dropdown, public filter, and
// server-side validation. Keep 'Other' last.
export const PROFESSIONS = [
  'Electrician',
  'Plumber',
  'Carpenter',
  'Painter',
  'Doctor',
  'Tutor/Teacher',
  'Mechanic',
  'Mason',
  'Welder',
  'Tailor',
  'Beautician',
  'Cook/Caterer',
  'Driver',
  'Gardener',
  'Cleaner/Housekeeping',
  'AC/Appliance Repair',
  'Photographer',
  'Priest/Pujari',
  'Other',
] as const

export type Profession = (typeof PROFESSIONS)[number]

export function isValidProfession(p: string): p is Profession {
  return (PROFESSIONS as readonly string[]).includes(p)
}
```

- [ ] **Step 4: Write the shared types**

Create `src/lib/find/types.ts`:

```ts
export type ModerationStatus = 'pending' | 'approved' | 'rejected'

export interface FindProfessional {
  id: string
  name: string
  phone: string
  whatsapp: boolean
  profession: string
  profession_other: string | null
  locality: string | null
  note: string | null
  status: ModerationStatus
  is_active: boolean
  submitted_by: string | null
  created_at: string
  updated_at: string
}

export interface FindRating {
  id: string
  professional_id: string
  user_id: string
  rating: number
  comment: string
  used_service: boolean
  status: ModerationStatus
  created_at: string
  updated_at: string
}

// Public-facing professional plus computed rating aggregates.
export interface ProfessionalWithStats extends FindProfessional {
  avg_rating: number // 0 when no approved ratings
  rating_count: number
}
```

- [ ] **Step 5: Type-check and commit**

Run: `npx tsc --noEmit`
Expected: no new errors from the added files.

```bash
git add supabase/add_find_directory.sql src/lib/find/professions.ts src/lib/find/types.ts
git commit -m "feat(find): add DB migration, professions constant, and types

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: Subdomain reservation and proxy routing

**Files:**
- Modify: `src/lib/subdomain.ts` — `RESERVED_SUBDOMAINS`
- Modify: `src/proxy.ts` — inline regexes + rewrite logic
- Modify: `src/app/api/check-subdomain/route.ts` — `RESERVED`

**Interfaces:**
- Produces: `find.ourdahanu.in/<path>` (and `find.localhost:3000/<path>`) rewrites to `/find/<path>`; `find` is excluded from business-subdomain handling everywhere.

- [ ] **Step 1: Read the Next.js proxy/middleware docs**

Read the routing/middleware guide under `node_modules/next/dist/docs/` (search for the file covering `proxy` / middleware and rewrites) to confirm the correct API for this version before editing `src/proxy.ts`.

- [ ] **Step 2: Reserve `find` in subdomain.ts**

In `src/lib/subdomain.ts`, add `'find'` to the `RESERVED_SUBDOMAINS` set (append to the existing list, e.g. after `'cdn'`):

```ts
export const RESERVED_SUBDOMAINS = new Set([
  'www', 'admin', 'api', 'app', 'mail', 'shop', 'news', 'events',
  'jobs', 'forum', 'classifieds', 'emergency', 'dashboard', 'login',
  'profile', 'search', 'about', 'listings', 'my-business', 'offline',
  'auth', 'static', 'assets', 'media', 'cdn', 'find',
])
```

- [ ] **Step 3: Reserve `find` in check-subdomain route**

In `src/app/api/check-subdomain/route.ts`, add `'find'` to the `RESERVED` set the same way (append after `'cdn'`).

- [ ] **Step 4: Add `find` to the proxy matcher regexes and add rewrite logic**

In `src/proxy.ts`:

(a) In every inline regex literal inside `export const config` (there are four `matcher` entries), add `find|` into the negative-lookahead alternation so `find` is treated as reserved. Each occurrence currently reads:
`(?!(?:www|admin|...|cdn)\\.)` → change to `(?!(?:www|admin|...|cdn|find)\\.)`.

(b) Add a matcher entry so the `find` host is caught for ALL paths, and add rewrite handling at the top of the `proxy` function. Add this matcher object to the `matcher` array (pure inline literal — no shared references):

```ts
    {
      // find.ourdahanu.in — standalone professionals directory
      source: '/:path*',
      has: [
        {
          type: 'header',
          key: 'host',
          value: '(?:find\\.ourdahanu\\.in|find\\.localhost(?::\\d+)?)',
        },
      ],
    },
```

(c) At the very start of the `proxy` function body (before the existing `getBusinessSubdomain` logic), add the `find` host handling:

```ts
export function proxy(request: NextRequest) {
  const host = request.headers.get('host') || ''

  // find.ourdahanu.in → /find/* (standalone directory, own layout)
  const findHost = host.split(':')[0].toLowerCase()
  if (findHost === 'find.ourdahanu.in' || findHost === 'find.localhost') {
    const url = request.nextUrl.clone()
    if (!url.pathname.startsWith('/find')) {
      url.pathname = url.pathname === '/' ? '/find' : `/find${url.pathname}`
    }
    return NextResponse.rewrite(url)
  }

  const subdomain = getBusinessSubdomain(host)
  // ...existing logic unchanged below...
```

- [ ] **Step 5: Build and manually verify routing**

Run: `npm run build`
Expected: build succeeds (no "Invalid segment configuration export detected" error — that means an inline regex was broken).

Manual: `npm run dev`, then visit `http://find.localhost:3000/` in a browser.
Expected: it serves the `/find` route (after Task 3 this shows the Find landing; before Task 3 it 404s the `/find` segment — acceptable at this step, the point is no redirect to a business listing and no crash). Also visit `http://organic.localhost:3000/` (or any business subdomain) and confirm business routing still works.

- [ ] **Step 6: Commit**

```bash
git add src/lib/subdomain.ts src/proxy.ts src/app/api/check-subdomain/route.ts
git commit -m "feat(find): reserve 'find' subdomain and rewrite it to /find

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3: Find data layer and standalone layout

**Files:**
- Create: `src/lib/data/find.ts`
- Create: `src/app/find/layout.tsx`

**Interfaces:**
- Consumes: `createClient` from `@/lib/supabase/server`; types from `@/lib/find/types`.
- Produces:
  - `getApprovedProfessionals(opts?: { q?: string; profession?: string }): Promise<ProfessionalWithStats[]>`
  - `getProfessionalById(id: string): Promise<ProfessionalWithStats | null>` (approved+active only)
  - `getApprovedRatings(professionalId: string): Promise<FindRating[]>`

- [ ] **Step 1: Write the data layer**

Create `src/lib/data/find.ts`:

```ts
import { createClient } from '@/lib/supabase/server'
import type { FindRating, ProfessionalWithStats } from '@/lib/find/types'

// Aggregate approved ratings into avg + count per professional id.
async function statsFor(
  supabase: Awaited<ReturnType<typeof createClient>>,
  ids: string[],
): Promise<Map<string, { avg: number; count: number }>> {
  const map = new Map<string, { avg: number; count: number }>()
  if (ids.length === 0) return map
  const { data } = await supabase
    .from('find_ratings')
    .select('professional_id, rating')
    .eq('status', 'approved')
    .in('professional_id', ids)
  for (const row of data ?? []) {
    const cur = map.get(row.professional_id) ?? { avg: 0, count: 0 }
    cur.avg += row.rating
    cur.count += 1
    map.set(row.professional_id, cur)
  }
  for (const [, v] of map) v.avg = v.count ? v.avg / v.count : 0
  return map
}

export async function getApprovedProfessionals(
  opts: { q?: string; profession?: string } = {},
): Promise<ProfessionalWithStats[]> {
  const supabase = await createClient()
  let query = supabase
    .from('find_professionals')
    .select('*')
    .eq('status', 'approved')
    .eq('is_active', true)
    .order('created_at', { ascending: false })

  if (opts.profession && opts.profession !== 'All') {
    query = query.eq('profession', opts.profession)
  }
  if (opts.q && opts.q.trim()) {
    const term = `%${opts.q.trim()}%`
    query = query.or(`name.ilike.${term},note.ilike.${term},locality.ilike.${term}`)
  }

  const { data } = await query
  const rows = data ?? []
  const stats = await statsFor(supabase, rows.map((r) => r.id))
  return rows.map((r) => ({
    ...r,
    avg_rating: stats.get(r.id)?.avg ?? 0,
    rating_count: stats.get(r.id)?.count ?? 0,
  }))
}

export async function getProfessionalById(
  id: string,
): Promise<ProfessionalWithStats | null> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('find_professionals')
    .select('*')
    .eq('id', id)
    .eq('status', 'approved')
    .eq('is_active', true)
    .maybeSingle()
  if (!data) return null
  const stats = await statsFor(supabase, [id])
  return {
    ...data,
    avg_rating: stats.get(id)?.avg ?? 0,
    rating_count: stats.get(id)?.count ?? 0,
  }
}

export async function getApprovedRatings(
  professionalId: string,
): Promise<FindRating[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('find_ratings')
    .select('*')
    .eq('professional_id', professionalId)
    .eq('status', 'approved')
    .order('created_at', { ascending: false })
  return data ?? []
}
```

- [ ] **Step 2: Write the standalone layout**

Create `src/app/find/layout.tsx` (own header/footer so it reads as its own site; Tailwind classes, no dependency on the main site chrome):

```tsx
import Link from 'next/link'
import { Search } from 'lucide-react'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Find — Trusted Local Professionals in Dahanu',
  description:
    'Find rated local professionals in Dahanu — electricians, plumbers, doctors, tutors and more. Real ratings from real customers.',
}

export default function FindLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <Link href="/find" className="flex items-center gap-2 font-bold text-lg">
            <Search size={20} className="text-[var(--od-brand,#c0582e)]" />
            <span>Find<span className="text-[var(--od-brand,#c0582e)]">Dahanu</span></span>
          </Link>
          <Link
            href="/find/submit"
            className="rounded-md bg-[var(--od-brand,#c0582e)] px-3 py-1.5 text-sm font-semibold text-white hover:opacity-90"
          >
            Add a professional
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>
      <footer className="mt-12 border-t border-gray-200 py-6 text-center text-xs text-gray-500">
        FindDahanu · part of OurDahanu · ratings are moderated before they appear
      </footer>
    </div>
  )
}
```

- [ ] **Step 3: Type-check, build, commit**

Run: `npx tsc --noEmit` then `npm run build`
Expected: both succeed.

```bash
git add src/lib/data/find.ts src/app/find/layout.tsx
git commit -m "feat(find): add data layer and standalone layout

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 4: Find landing page (list + search + filter)

**Files:**
- Create: `src/app/find/page.tsx`
- Create: `src/app/find/FindSearchControls.tsx`

**Interfaces:**
- Consumes: `getApprovedProfessionals` from `@/lib/data/find`; `PROFESSIONS` from `@/lib/find/professions`; `ProfessionalWithStats` type.
- Produces: the `/find` landing view driven by `?q=` and `?profession=` search params.

- [ ] **Step 1: Write the client search controls**

Create `src/app/find/FindSearchControls.tsx`:

```tsx
'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useState } from 'react'
import { PROFESSIONS } from '@/lib/find/professions'

export default function FindSearchControls() {
  const router = useRouter()
  const params = useSearchParams()
  const [q, setQ] = useState(params.get('q') ?? '')
  const profession = params.get('profession') ?? 'All'

  function apply(next: { q?: string; profession?: string }) {
    const sp = new URLSearchParams(params.toString())
    if (next.q !== undefined) {
      if (next.q) sp.set('q', next.q)
      else sp.delete('q')
    }
    if (next.profession !== undefined) {
      if (next.profession && next.profession !== 'All') sp.set('profession', next.profession)
      else sp.delete('profession')
    }
    router.push(`/find?${sp.toString()}`)
  }

  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row">
      <form
        className="flex-1"
        onSubmit={(e) => {
          e.preventDefault()
          apply({ q })
        }}
      >
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by name, area, or keyword…"
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
        />
      </form>
      <select
        value={profession}
        onChange={(e) => apply({ profession: e.target.value })}
        className="rounded-md border border-gray-300 px-3 py-2 text-sm"
      >
        <option value="All">All professions</option>
        {PROFESSIONS.map((p) => (
          <option key={p} value={p}>{p}</option>
        ))}
      </select>
    </div>
  )
}
```

- [ ] **Step 2: Write the landing page**

Create `src/app/find/page.tsx` (Server Component; reads search params, renders list). Includes a small inline star display and a professional card.

```tsx
import Link from 'next/link'
import { Suspense } from 'react'
import { Star, MapPin, Phone } from 'lucide-react'
import { getApprovedProfessionals } from '@/lib/data/find'
import type { ProfessionalWithStats } from '@/lib/find/types'
import FindSearchControls from './FindSearchControls'

function Stars({ value }: { value: number }) {
  const rounded = Math.round(value)
  return (
    <span className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} size={14}
          className={n <= rounded ? 'text-amber-400 fill-amber-400' : 'text-gray-200 fill-gray-200'} />
      ))}
    </span>
  )
}

function professionLabel(p: ProfessionalWithStats) {
  return p.profession === 'Other' && p.profession_other ? p.profession_other : p.profession
}

function Card({ p }: { p: ProfessionalWithStats }) {
  return (
    <Link href={`/find/p/${p.id}`}
      className="block rounded-lg border border-gray-200 bg-white p-4 shadow-sm hover:shadow-md">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="font-bold text-gray-950">{p.name}</h2>
          <p className="text-sm text-[var(--od-brand,#c0582e)] font-medium">{professionLabel(p)}</p>
        </div>
        <div className="text-right">
          <Stars value={p.avg_rating} />
          <p className="mt-0.5 text-xs text-gray-500">
            {p.rating_count > 0 ? `${p.avg_rating.toFixed(1)} · ${p.rating_count} rating${p.rating_count > 1 ? 's' : ''}` : 'No ratings yet'}
          </p>
        </div>
      </div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-600">
        {p.locality && <span className="flex items-center gap-1"><MapPin size={12} />{p.locality}</span>}
        <span className="flex items-center gap-1"><Phone size={12} />{p.phone}</span>
      </div>
      {p.note && <p className="mt-2 line-clamp-2 text-sm text-gray-600">{p.note}</p>}
    </Link>
  )
}

async function ProfessionalList({ q, profession }: { q?: string; profession?: string }) {
  const pros = await getApprovedProfessionals({ q, profession })
  if (pros.length === 0) {
    return <p className="py-12 text-center text-gray-500">No professionals found. Try a different search, or add one.</p>
  }
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {pros.map((p) => <Card key={p.id} p={p} />)}
    </div>
  )
}

export default async function FindHomePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; profession?: string }>
}) {
  const { q, profession } = await searchParams
  return (
    <div>
      <h1 className="mb-1 text-2xl font-bold">Trusted local professionals in Dahanu</h1>
      <p className="mb-5 text-sm text-gray-600">Browse and rate — every rating is verified by a moderator.</p>
      <Suspense fallback={null}>
        <FindSearchControls />
      </Suspense>
      <Suspense fallback={<p className="py-12 text-center text-gray-500">Loading…</p>}>
        <ProfessionalList q={q} profession={profession} />
      </Suspense>
    </div>
  )
}
```

- [ ] **Step 3: Build and manually verify**

Run: `npm run build` then `npm run dev`.
Manual: insert one approved test row via Supabase SQL, then visit `http://find.localhost:3000/`:
```sql
insert into find_professionals (name, phone, profession, locality, status, is_active)
values ('Test Electrician', '9999999999', 'Electrician', 'Dahanu East', 'approved', true);
```
Expected: the card appears; changing the profession filter to "Plumber" hides it; searching "Test" shows it.

- [ ] **Step 4: Commit**

```bash
git add src/app/find/page.tsx src/app/find/FindSearchControls.tsx
git commit -m "feat(find): landing page with search and profession filter

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 5: Professional detail page (info + approved ratings)

**Files:**
- Create: `src/app/find/p/[id]/page.tsx`
- (RatingForm added in Task 7; this task renders a placeholder note where it will go.)

**Interfaces:**
- Consumes: `getProfessionalById`, `getApprovedRatings` from `@/lib/data/find`.
- Produces: `/find/p/[id]` detail view. Exports nothing consumed elsewhere.

- [ ] **Step 1: Write the detail page**

Create `src/app/find/p/[id]/page.tsx`:

```tsx
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { Star, MapPin, Phone, MessageCircle, ArrowLeft } from 'lucide-react'
import { getProfessionalById, getApprovedRatings } from '@/lib/data/find'
import type { ProfessionalWithStats } from '@/lib/find/types'

function Stars({ value, size = 16 }: { value: number; size?: number }) {
  const rounded = Math.round(value)
  return (
    <span className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} size={size}
          className={n <= rounded ? 'text-amber-400 fill-amber-400' : 'text-gray-200 fill-gray-200'} />
      ))}
    </span>
  )
}

function professionLabel(p: ProfessionalWithStats) {
  return p.profession === 'Other' && p.profession_other ? p.profession_other : p.profession
}

export default async function ProfessionalDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const pro = await getProfessionalById(id)
  if (!pro) notFound()
  const ratings = await getApprovedRatings(id)

  return (
    <div>
      <Link href="/find" className="mb-4 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800">
        <ArrowLeft size={14} /> Back to directory
      </Link>

      <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">{pro.name}</h1>
            <p className="text-[var(--od-brand,#c0582e)] font-medium">{professionLabel(pro)}</p>
          </div>
          <div className="text-right">
            <Stars value={pro.avg_rating} />
            <p className="mt-1 text-xs text-gray-500">
              {pro.rating_count > 0 ? `${pro.avg_rating.toFixed(1)} from ${pro.rating_count} rating${pro.rating_count > 1 ? 's' : ''}` : 'No ratings yet'}
            </p>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm text-gray-700">
          <a href={`tel:${pro.phone}`} className="flex items-center gap-1 hover:underline">
            <Phone size={14} /> {pro.phone}
          </a>
          {pro.whatsapp && (
            <a href={`https://wa.me/${pro.phone.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1 text-green-600 hover:underline">
              <MessageCircle size={14} /> WhatsApp
            </a>
          )}
          {pro.locality && <span className="flex items-center gap-1"><MapPin size={14} /> {pro.locality}</span>}
        </div>
        {pro.note && <p className="mt-3 text-sm text-gray-600">{pro.note}</p>}
      </div>

      {/* RATING FORM SLOT — replaced in Task 7 with <RatingForm professionalId={pro.id} /> */}
      <div id="rating-form-slot" className="mt-6" />

      <section className="mt-8">
        <h2 className="mb-3 text-lg font-bold">Ratings</h2>
        {ratings.length === 0 ? (
          <p className="text-sm text-gray-500">No approved ratings yet. Be the first to rate.</p>
        ) : (
          <ul className="space-y-3">
            {ratings.map((r) => (
              <li key={r.id} className="rounded-lg border border-gray-200 bg-white p-4">
                <Stars value={r.rating} size={13} />
                <p className="mt-2 text-sm text-gray-700">{r.comment}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
```

- [ ] **Step 2: Build and manually verify**

Run: `npm run build` then `npm run dev`.
Manual: click the test card from Task 4 → confirm the detail page renders name, profession, phone, and "No approved ratings yet".

- [ ] **Step 3: Commit**

```bash
git add src/app/find/p/[id]/page.tsx
git commit -m "feat(find): professional detail page with approved ratings

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 6: Submit-a-professional flow (page + server action)

**Files:**
- Create: `src/app/actions/find.ts` (with `submitProfessional`; `submitRating` added in Task 7)
- Create: `src/app/find/submit/page.tsx`
- Create: `src/app/find/submit/SubmitProfessionalForm.tsx`

**Interfaces:**
- Consumes: `createClient` from `@/lib/supabase/server`; `isValidProfession` from `@/lib/find/professions`; `rateLimit`, `getClientIp` from `@/lib/rate-limit`.
- Produces: `submitProfessional(input: SubmitProfessionalInput): Promise<{ error?: string; ok?: boolean }>` and its `SubmitProfessionalInput` type, from `@/app/actions/find`.

- [ ] **Step 1: Write the `submitProfessional` server action**

Create `src/app/actions/find.ts`:

```ts
'use server'

import { createClient } from '@/lib/supabase/server'
import { isValidProfession } from '@/lib/find/professions'
import { getClientIp, rateLimit } from '@/lib/rate-limit'
import { headers } from 'next/headers'

export interface SubmitProfessionalInput {
  name: string
  phone: string
  whatsapp: boolean
  profession: string
  professionOther?: string
  locality?: string
  note?: string
}

export async function submitProfessional(
  input: SubmitProfessionalInput,
): Promise<{ error?: string; ok?: boolean }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Please log in to add a professional.' }

  const ip = getClientIp(new Request('http://x', { headers: await headers() }))
  const limit = rateLimit(`find-submit:${user.id}:${ip}`, 5, 60 * 60 * 1000)
  if (!limit.ok) return { error: 'Too many submissions. Please try again later.' }

  const name = input.name?.trim()
  const phone = input.phone?.trim()
  const profession = input.profession?.trim()
  if (!name) return { error: 'Name is required.' }
  if (!phone || phone.replace(/\D/g, '').length < 7) return { error: 'A valid phone number is required.' }
  if (!profession || !isValidProfession(profession)) return { error: 'Please select a valid profession.' }
  const professionOther = profession === 'Other' ? (input.professionOther?.trim() || null) : null
  if (profession === 'Other' && !professionOther) return { error: 'Please describe the profession.' }

  const { error } = await supabase.from('find_professionals').insert({
    name,
    phone,
    whatsapp: !!input.whatsapp,
    profession,
    profession_other: professionOther,
    locality: input.locality?.trim() || null,
    note: input.note?.trim() || null,
    status: 'pending',
    submitted_by: user.id,
  })
  if (error) return { error: error.message }
  return { ok: true }
}
```

Note on `headers()`/IP: if constructing a `Request` from `headers()` is awkward in this Next version, fall back to `rateLimit(`find-submit:${user.id}`, 5, 3600000)` keyed on user id alone — the per-user cap is the important guard. Confirm the approach against the `next/dist/docs` headers guide.

- [ ] **Step 2: Write the client form**

Create `src/app/find/submit/SubmitProfessionalForm.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { PROFESSIONS } from '@/lib/find/professions'
import { submitProfessional } from '@/app/actions/find'

export default function SubmitProfessionalForm() {
  const router = useRouter()
  const [profession, setProfession] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const [pending, setPending] = useState(false)

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setPending(true)
    const fd = new FormData(e.currentTarget)
    const res = await submitProfessional({
      name: String(fd.get('name') || ''),
      phone: String(fd.get('phone') || ''),
      whatsapp: fd.get('whatsapp') === 'on',
      profession: String(fd.get('profession') || ''),
      professionOther: String(fd.get('professionOther') || ''),
      locality: String(fd.get('locality') || ''),
      note: String(fd.get('note') || ''),
    })
    setPending(false)
    if (res.error) { setError(res.error); return }
    setDone(true)
  }

  if (done) {
    return (
      <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-800">
        Thanks! Your submission will appear once a moderator approves it.
        <button onClick={() => router.push('/find')} className="ml-2 underline">Back to directory</button>
      </div>
    )
  }

  const inputCls = 'w-full rounded-md border border-gray-300 px-3 py-2 text-sm'
  return (
    <form onSubmit={onSubmit} className="space-y-3">
      {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      <input name="name" placeholder="Full name *" className={inputCls} required />
      <input name="phone" placeholder="Phone number *" className={inputCls} required />
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="whatsapp" /> This number is on WhatsApp
      </label>
      <select name="profession" value={profession} onChange={(e) => setProfession(e.target.value)} className={inputCls} required>
        <option value="">Select profession *</option>
        {PROFESSIONS.map((p) => <option key={p} value={p}>{p}</option>)}
      </select>
      {profession === 'Other' && (
        <input name="professionOther" placeholder="Describe the profession *" className={inputCls} />
      )}
      <input name="locality" placeholder="Area / locality in Dahanu" className={inputCls} />
      <textarea name="note" placeholder="Short note (optional)" rows={3} className={inputCls} />
      <button disabled={pending} className="rounded-md bg-[var(--od-brand,#c0582e)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
        {pending ? 'Submitting…' : 'Submit for review'}
      </button>
    </form>
  )
}
```

- [ ] **Step 3: Write the submit page (login gate)**

Create `src/app/find/submit/page.tsx`:

```tsx
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import SubmitProfessionalForm from './SubmitProfessionalForm'

export default async function SubmitPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  return (
    <div className="mx-auto max-w-lg">
      <h1 className="mb-1 text-2xl font-bold">Add a professional</h1>
      <p className="mb-5 text-sm text-gray-600">Suggest someone useful. A moderator reviews every submission before it goes live.</p>
      {user ? (
        <SubmitProfessionalForm />
      ) : (
        <div className="rounded-lg border border-gray-200 bg-white p-5 text-center">
          <p className="mb-3 text-sm text-gray-700">Please log in to add a professional.</p>
          <Link href="/login" className="rounded-md bg-[var(--od-brand,#c0582e)] px-4 py-2 text-sm font-semibold text-white">Log in</Link>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Build and manually verify**

Run: `npm run build` then `npm run dev`.
Manual: log out → `http://find.localhost:3000/find/submit` shows the login gate. Log in → submit the form → see the success message. Confirm a `pending` row exists:
```sql
select name, status, submitted_by from find_professionals order by created_at desc limit 3;
```
Expected: a new `pending` row with your user id. It should NOT appear on `/find`.

- [ ] **Step 5: Commit**

```bash
git add src/app/actions/find.ts src/app/find/submit/page.tsx src/app/find/submit/SubmitProfessionalForm.tsx
git commit -m "feat(find): user submission flow for professionals

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 7: Rating flow (server action + form on detail page)

**Files:**
- Modify: `src/app/actions/find.ts` (add `submitRating`)
- Create: `src/app/find/p/[id]/RatingForm.tsx`
- Modify: `src/app/find/p/[id]/page.tsx` (render the form; show user's own pending state)

**Interfaces:**
- Consumes: `createClient`, `submitRating`; user via `supabase.auth.getUser()`.
- Produces: `submitRating(input: SubmitRatingInput): Promise<{ error?: string; ok?: boolean }>` and `SubmitRatingInput` from `@/app/actions/find`.

- [ ] **Step 1: Add the `submitRating` server action**

Append to `src/app/actions/find.ts`:

```ts
export interface SubmitRatingInput {
  professionalId: string
  rating: number
  comment: string
  usedService: boolean
}

export async function submitRating(
  input: SubmitRatingInput,
): Promise<{ error?: string; ok?: boolean }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Please log in to rate.' }

  const limit = rateLimit(`find-rate:${user.id}`, 20, 60 * 60 * 1000)
  if (!limit.ok) return { error: 'Too many ratings. Please try again later.' }

  const rating = Number(input.rating)
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) return { error: 'Please choose 1–5 stars.' }
  const comment = input.comment?.trim()
  if (!comment) return { error: 'Please describe your experience.' }
  if (!input.usedService) return { error: 'Please confirm you have used this service.' }

  // Verify the professional exists and is live.
  const { data: pro } = await supabase
    .from('find_professionals')
    .select('id')
    .eq('id', input.professionalId)
    .eq('status', 'approved')
    .eq('is_active', true)
    .maybeSingle()
  if (!pro) return { error: 'Professional not found.' }

  // One rating per user per professional — upsert resets to pending.
  const { error } = await supabase.from('find_ratings').upsert(
    {
      professional_id: input.professionalId,
      user_id: user.id,
      rating,
      comment,
      used_service: true,
      status: 'pending',
    },
    { onConflict: 'professional_id,user_id' },
  )
  if (error) return { error: error.message }
  return { ok: true }
}
```

- [ ] **Step 2: Write the client rating form**

Create `src/app/find/p/[id]/RatingForm.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { Star } from 'lucide-react'
import { submitRating } from '@/app/actions/find'

export default function RatingForm({
  professionalId,
  alreadyRated,
}: {
  professionalId: string
  alreadyRated: boolean
}) {
  const [rating, setRating] = useState(0)
  const [hover, setHover] = useState(0)
  const [used, setUsed] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const [pending, setPending] = useState(false)

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setPending(true)
    const fd = new FormData(e.currentTarget)
    const res = await submitRating({
      professionalId,
      rating,
      comment: String(fd.get('comment') || ''),
      usedService: used,
    })
    setPending(false)
    if (res.error) { setError(res.error); return }
    setDone(true)
  }

  if (done) {
    return (
      <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-800">
        Thanks — your rating will appear once a moderator approves it.
      </div>
    )
  }

  return (
    <form onSubmit={onSubmit} className="rounded-lg border border-gray-200 bg-white p-4">
      <h3 className="font-bold">{alreadyRated ? 'Update your rating' : 'Rate this professional'}</h3>
      {alreadyRated && (
        <p className="mt-1 text-xs text-gray-500">You already rated this professional. Submitting again replaces your rating and returns it to review.</p>
      )}
      {error && <p className="mt-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      <div className="mt-3 flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button type="button" key={n} onClick={() => setRating(n)}
            onMouseEnter={() => setHover(n)} onMouseLeave={() => setHover(0)} aria-label={`${n} stars`}>
            <Star size={26} className={n <= (hover || rating) ? 'text-amber-400 fill-amber-400' : 'text-gray-300 fill-gray-200'} />
          </button>
        ))}
      </div>
      <textarea name="comment" rows={3} required placeholder="Describe your experience — you must have used this service."
        className="mt-3 w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
      <label className="mt-2 flex items-start gap-2 text-sm text-gray-700">
        <input type="checkbox" checked={used} onChange={(e) => setUsed(e.target.checked)} className="mt-0.5" />
        I confirm I have personally used this service.
      </label>
      <button disabled={pending} className="mt-3 rounded-md bg-[var(--od-brand,#c0582e)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
        {pending ? 'Submitting…' : 'Submit rating'}
      </button>
    </form>
  )
}
```

- [ ] **Step 3: Wire the form into the detail page**

In `src/app/find/p/[id]/page.tsx`:

(a) Add imports at the top:
```tsx
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import RatingForm from './RatingForm'
```
(`Link` is already imported — do not duplicate.)

(b) In the component, after `const ratings = await getApprovedRatings(id)`, determine the current user and whether they already rated:
```tsx
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  let alreadyRated = false
  if (user) {
    const { data: mine } = await supabase
      .from('find_ratings')
      .select('id')
      .eq('professional_id', id)
      .eq('user_id', user.id)
      .maybeSingle()
    alreadyRated = !!mine
  }
```

(c) Replace the `{/* RATING FORM SLOT ... */}` placeholder block with:
```tsx
      <div className="mt-6">
        {user ? (
          <RatingForm professionalId={pro.id} alreadyRated={alreadyRated} />
        ) : (
          <div className="rounded-lg border border-gray-200 bg-white p-4 text-center text-sm">
            <p className="mb-2 text-gray-700">Log in to rate this professional.</p>
            <Link href="/login" className="rounded-md bg-[var(--od-brand,#c0582e)] px-4 py-2 font-semibold text-white">Log in</Link>
          </div>
        )}
      </div>
```

- [ ] **Step 4: Build and manually verify**

Run: `npm run build` then `npm run dev`.
Manual: as a logged-in user, open an approved professional, pick stars, type a comment, tick the checkbox, submit → success message. Confirm a `pending` rating row exists and does NOT show in the public ratings list nor change the average. Try submitting without the checkbox → inline error. Submit again for the same professional → confirm it updates the existing row (still one row, back to pending):
```sql
select rating, status, count(*) from find_ratings group by rating, status;
```

- [ ] **Step 5: Commit**

```bash
git add src/app/actions/find.ts src/app/find/p/[id]/RatingForm.tsx src/app/find/p/[id]/page.tsx
git commit -m "feat(find): moderated rating flow with mandatory confirmation

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 8: Admin server actions

**Files:**
- Create: `src/app/actions/admin-find.ts`

**Interfaces:**
- Consumes: `createClient` from `@/lib/supabase/server`; `createAdminClient` from `@/lib/supabase/admin-client`; `requireAdmin` from `@/app/actions/admin`; `isValidProfession` from `@/lib/find/professions`; `revalidatePath` from `next/cache`.
- Produces (all `Promise<{ error?: string; ok?: boolean }>`):
  - `setProfessionalStatus(id: string, status: 'approved' | 'rejected')`
  - `updateProfessional(id: string, fields: AdminProfessionalFields)`
  - `createProfessionalAsAdmin(fields: AdminProfessionalFields)`
  - `setProfessionalActive(id: string, isActive: boolean)`
  - `setRatingStatus(id: string, status: 'approved' | 'rejected')`
  - Type `AdminProfessionalFields`.

- [ ] **Step 1: Write the admin actions**

Create `src/app/actions/admin-find.ts`:

```ts
'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin-client'
import { requireAdmin } from '@/app/actions/admin'
import { isValidProfession } from '@/lib/find/professions'

export interface AdminProfessionalFields {
  name: string
  phone: string
  whatsapp: boolean
  profession: string
  professionOther?: string
  locality?: string
  note?: string
}

type Result = { error?: string; ok?: boolean }

function validateFields(f: AdminProfessionalFields): string | null {
  if (!f.name?.trim()) return 'Name is required.'
  if (!f.phone?.trim()) return 'Phone is required.'
  if (!isValidProfession(f.profession?.trim())) return 'Invalid profession.'
  if (f.profession.trim() === 'Other' && !f.professionOther?.trim()) return 'Describe the profession.'
  return null
}

function toRow(f: AdminProfessionalFields) {
  const profession = f.profession.trim()
  return {
    name: f.name.trim(),
    phone: f.phone.trim(),
    whatsapp: !!f.whatsapp,
    profession,
    profession_other: profession === 'Other' ? (f.professionOther?.trim() || null) : null,
    locality: f.locality?.trim() || null,
    note: f.note?.trim() || null,
  }
}

async function admin() {
  const supabase = await createClient()
  await requireAdmin(supabase) // redirects if not admin
  const db = createAdminClient()
  if (!db) throw new Error('Service role not configured')
  return db
}

export async function setProfessionalStatus(id: string, status: 'approved' | 'rejected'): Promise<Result> {
  const db = await admin()
  const { error } = await db.from('find_professionals')
    .update({ status, updated_at: new Date().toISOString() }).eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/admin/find')
  return { ok: true }
}

export async function updateProfessional(id: string, fields: AdminProfessionalFields): Promise<Result> {
  const invalid = validateFields(fields)
  if (invalid) return { error: invalid }
  const db = await admin()
  const { error } = await db.from('find_professionals')
    .update({ ...toRow(fields), updated_at: new Date().toISOString() }).eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/admin/find')
  return { ok: true }
}

export async function createProfessionalAsAdmin(fields: AdminProfessionalFields): Promise<Result> {
  const invalid = validateFields(fields)
  if (invalid) return { error: invalid }
  const db = await admin()
  const { error } = await db.from('find_professionals')
    .insert({ ...toRow(fields), status: 'approved', is_active: true })
  if (error) return { error: error.message }
  revalidatePath('/admin/find')
  return { ok: true }
}

export async function setProfessionalActive(id: string, isActive: boolean): Promise<Result> {
  const db = await admin()
  const { error } = await db.from('find_professionals')
    .update({ is_active: isActive, updated_at: new Date().toISOString() }).eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/admin/find')
  return { ok: true }
}

export async function setRatingStatus(id: string, status: 'approved' | 'rejected'): Promise<Result> {
  const db = await admin()
  const { error } = await db.from('find_ratings')
    .update({ status, updated_at: new Date().toISOString() }).eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/admin/find')
  return { ok: true }
}
```

- [ ] **Step 2: Type-check and commit**

Run: `npx tsc --noEmit`
Expected: no errors.

```bash
git add src/app/actions/admin-find.ts
git commit -m "feat(find): admin server actions for moderation

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 9: Admin moderation UI + admin nav link

**Files:**
- Create: `src/app/admin/find/page.tsx`
- Create: `src/app/admin/find/EditProfessionalForm.tsx`
- Modify: `src/app/admin/page.tsx` (add quick-action link to `/admin/find`)

**Interfaces:**
- Consumes: admin actions from `@/app/actions/admin-find`; `createClient`, `createAdminClient`, `requireAdmin`; `PROFESSIONS`.
- Produces: `/admin/find` moderation page with `?tab=professionals|ratings`.

- [ ] **Step 1: Write the edit form client component**

Create `src/app/admin/find/EditProfessionalForm.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { PROFESSIONS } from '@/lib/find/professions'
import { updateProfessional, setProfessionalStatus, type AdminProfessionalFields } from '@/app/actions/admin-find'
import type { FindProfessional } from '@/lib/find/types'

export default function EditProfessionalForm({ pro }: { pro: FindProfessional }) {
  const [profession, setProfession] = useState(pro.profession)
  const [error, setError] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  function fields(fd: FormData): AdminProfessionalFields {
    return {
      name: String(fd.get('name') || ''),
      phone: String(fd.get('phone') || ''),
      whatsapp: fd.get('whatsapp') === 'on',
      profession: String(fd.get('profession') || ''),
      professionOther: String(fd.get('professionOther') || ''),
      locality: String(fd.get('locality') || ''),
      note: String(fd.get('note') || ''),
    }
  }

  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null); setMsg(null); setPending(true)
    const res = await updateProfessional(pro.id, fields(new FormData(e.currentTarget)))
    setPending(false)
    if (res.error) setError(res.error); else setMsg('Saved.')
  }

  async function saveAndApprove(formEl: HTMLFormElement) {
    setError(null); setMsg(null); setPending(true)
    const upd = await updateProfessional(pro.id, fields(new FormData(formEl)))
    if (upd.error) { setPending(false); setError(upd.error); return }
    const res = await setProfessionalStatus(pro.id, 'approved')
    setPending(false)
    if (res.error) setError(res.error); else setMsg('Approved and live.')
  }

  const cls = 'w-full rounded border border-gray-300 px-2 py-1 text-sm'
  return (
    <form onSubmit={save} className="space-y-2 rounded-lg border border-gray-200 bg-white p-3">
      {error && <p className="rounded bg-red-50 px-2 py-1 text-xs text-red-700">{error}</p>}
      {msg && <p className="rounded bg-green-50 px-2 py-1 text-xs text-green-700">{msg}</p>}
      <div className="grid grid-cols-2 gap-2">
        <input name="name" defaultValue={pro.name} placeholder="Name" className={cls} />
        <input name="phone" defaultValue={pro.phone} placeholder="Phone" className={cls} />
        <select name="profession" defaultValue={pro.profession} onChange={(e) => setProfession(e.target.value)} className={cls}>
          {PROFESSIONS.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        {profession === 'Other' && (
          <input name="professionOther" defaultValue={pro.profession_other ?? ''} placeholder="Other profession" className={cls} />
        )}
        <input name="locality" defaultValue={pro.locality ?? ''} placeholder="Locality" className={cls} />
        <label className="flex items-center gap-2 text-xs">
          <input type="checkbox" name="whatsapp" defaultChecked={pro.whatsapp} /> WhatsApp
        </label>
      </div>
      <textarea name="note" defaultValue={pro.note ?? ''} placeholder="Note" rows={2} className={cls} />
      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={pending} className="rounded bg-gray-800 px-3 py-1 text-xs font-semibold text-white disabled:opacity-60">Save changes</button>
        {pro.status !== 'approved' && (
          <button type="button" disabled={pending}
            onClick={(e) => saveAndApprove(e.currentTarget.closest('form') as HTMLFormElement)}
            className="rounded bg-green-600 px-3 py-1 text-xs font-semibold text-white disabled:opacity-60">
            Save &amp; take live
          </button>
        )}
        {pro.status !== 'rejected' && (
          <button type="button" disabled={pending}
            onClick={async () => { setPending(true); const r = await setProfessionalStatus(pro.id, 'rejected'); setPending(false); if (r.error) setError(r.error); else setMsg('Rejected.') }}
            className="rounded bg-red-600 px-3 py-1 text-xs font-semibold text-white disabled:opacity-60">
            Reject
          </button>
        )}
      </div>
    </form>
  )
}
```

- [ ] **Step 2: Write the admin moderation page**

Create `src/app/admin/find/page.tsx`. It uses the service-role client (via `createAdminClient`) to read ALL rows (pending included), after admin-gating. Rating approve/reject buttons are inline client handlers via a small client wrapper defined in the same file.

```tsx
import Link from 'next/link'
import { ArrowLeft, Star } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin-client'
import { requireAdmin } from '@/app/actions/admin'
import type { FindProfessional, FindRating } from '@/lib/find/types'
import EditProfessionalForm from './EditProfessionalForm'
import RatingModerationButtons from './RatingModerationButtons'

export default async function AdminFindPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>
}) {
  const supabase = await createClient()
  await requireAdmin(supabase)
  const db = createAdminClient()
  if (!db) return <p className="p-6 text-red-600">Service role key not configured.</p>

  const { tab = 'professionals' } = await searchParams

  const { data: pros } = await db
    .from('find_professionals')
    .select('*')
    .order('status', { ascending: true }) // pending sorts before approved/rejected alphabetically? see note
    .order('created_at', { ascending: false })
  // Pending first regardless of alpha order:
  const professionals = (pros ?? []).sort((a, b) =>
    (a.status === 'pending' ? 0 : 1) - (b.status === 'pending' ? 0 : 1),
  ) as FindProfessional[]

  const { data: ratingRows } = await db
    .from('find_ratings')
    .select('*, find_professionals(name)')
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
  const ratings = (ratingRows ?? []) as (FindRating & { find_professionals: { name: string } | null })[]

  const tabCls = (t: string) =>
    `rounded-md px-3 py-1.5 text-sm font-semibold ${tab === t ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-700'}`

  return (
    <div className="mx-auto max-w-4xl p-4">
      <Link href="/admin" className="mb-3 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800">
        <ArrowLeft size={14} /> Admin
      </Link>
      <h1 className="mb-4 text-2xl font-bold">Find Directory</h1>
      <div className="mb-4 flex gap-2">
        <Link href="/admin/find?tab=professionals" className={tabCls('professionals')}>Professionals</Link>
        <Link href="/admin/find?tab=ratings" className={tabCls('ratings')}>
          Pending ratings{ratings.length ? ` (${ratings.length})` : ''}
        </Link>
      </div>

      {tab === 'ratings' ? (
        ratings.length === 0 ? (
          <p className="text-sm text-gray-500">No pending ratings.</p>
        ) : (
          <ul className="space-y-3">
            {ratings.map((r) => (
              <li key={r.id} className="rounded-lg border border-gray-200 bg-white p-4">
                <div className="flex items-center justify-between">
                  <span className="font-semibold">{r.find_professionals?.name ?? 'Unknown'}</span>
                  <span className="flex items-center gap-0.5">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <Star key={n} size={13} className={n <= r.rating ? 'text-amber-400 fill-amber-400' : 'text-gray-200 fill-gray-200'} />
                    ))}
                  </span>
                </div>
                <p className="mt-2 text-sm text-gray-700">{r.comment}</p>
                <RatingModerationButtons ratingId={r.id} />
              </li>
            ))}
          </ul>
        )
      ) : (
        <ul className="space-y-4">
          {professionals.map((p) => (
            <li key={p.id}>
              <div className="mb-1 flex items-center gap-2 text-xs">
                <span className={`rounded px-2 py-0.5 font-semibold ${
                  p.status === 'pending' ? 'bg-amber-100 text-amber-800'
                  : p.status === 'approved' ? 'bg-green-100 text-green-800'
                  : 'bg-red-100 text-red-800'}`}>{p.status}</span>
                {!p.is_active && <span className="rounded bg-gray-200 px-2 py-0.5 text-gray-700">inactive</span>}
              </div>
              <EditProfessionalForm pro={p} />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
```

Note on ordering: the `.order('status')` line is redundant with the JS sort — keep only the JS `sort` that puts `pending` first, and remove the misleading `.order('status', ...)` call when implementing.

- [ ] **Step 3: Write the rating moderation buttons client component**

Create `src/app/admin/find/RatingModerationButtons.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { setRatingStatus } from '@/app/actions/admin-find'

export default function RatingModerationButtons({ ratingId }: { ratingId: string }) {
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function act(status: 'approved' | 'rejected') {
    setPending(true); setError(null)
    const res = await setRatingStatus(ratingId, status)
    setPending(false)
    if (res.error) setError(res.error)
  }

  return (
    <div className="mt-3 flex items-center gap-2">
      <button disabled={pending} onClick={() => act('approved')} className="rounded bg-green-600 px-3 py-1 text-xs font-semibold text-white disabled:opacity-60">Approve</button>
      <button disabled={pending} onClick={() => act('rejected')} className="rounded bg-red-600 px-3 py-1 text-xs font-semibold text-white disabled:opacity-60">Reject</button>
      {error && <span className="text-xs text-red-700">{error}</span>}
    </div>
  )
}
```

(Add `RatingModerationButtons` to the imports of `page.tsx` — already referenced there.)

- [ ] **Step 4: Add the admin nav link**

In `src/app/admin/page.tsx`, add a quick-action entry pointing to `/admin/find` in the quick-actions list (the array with entries like `href: '/admin/roles'` around lines 276–302). Match the existing object shape used by neighboring entries (label/href/icon/etc.). Example entry to add:

```tsx
{ label: 'Find Directory', href: '/admin/find', icon: Search, /* match sibling fields */ },
```

Ensure `Search` (or a suitable lucide icon already imported) is imported at the top of the file; reuse an existing imported icon if adding a new import is undesirable.

- [ ] **Step 5: Build and full end-to-end verification**

Run: `npm run build` then `npm run dev`.

Manual end-to-end (the acceptance test for the whole feature):
1. As a user, submit a professional (Task 6) → it is `pending`, not on `/find`.
2. As admin, open `/admin/find` → the pending professional appears first; edit a field, click **Save & take live** → it now appears on `find.localhost:3000/find`.
3. As a user, rate the now-live professional (Task 7) → `pending`, hidden, average unchanged.
4. As admin, `/admin/find?tab=ratings` → **Approve** → the rating now shows on the detail page and the average reflects it.
5. Reject a different pending rating → it never appears publicly.
6. Deactivate a professional via edit form (`Save changes` after unchecking is not available — use `setProfessionalActive`; if not surfaced in UI, verify via the action) → it disappears from `/find`.
7. Confirm business subdomains and the main site still route correctly.

Run: `npm run lint`
Expected: no new lint errors.

- [ ] **Step 6: Commit**

```bash
git add src/app/admin/find/page.tsx src/app/admin/find/EditProfessionalForm.tsx src/app/admin/find/RatingModerationButtons.tsx src/app/admin/page.tsx
git commit -m "feat(find): admin moderation UI and nav link

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Post-implementation notes

- **Deactivate control:** Task 9's edit form does not expose the active/inactive toggle in the UI; `setProfessionalActive` exists for it. If you want an in-UI toggle, add a button wired to `setProfessionalActive` in `EditProfessionalForm.tsx` (small follow-up, kept out of the core plan to avoid scope creep).
- **DNS/Vercel:** For production, `find.ourdahanu.in` must be added as a domain/alias in Vercel and DNS pointed to Vercel (wildcard `*.ourdahanu.in` likely already covers it — verify). This is a deploy-config step, not code.
- **Caching:** Reads use the default SSR client without explicit cache tags; admin `revalidatePath('/admin/find')` refreshes the admin view. If public `/find` pages appear stale after approval, add `revalidatePath('/find')` (and the detail path) to the relevant admin actions.
