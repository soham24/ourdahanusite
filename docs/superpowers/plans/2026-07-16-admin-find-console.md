# Admin Find Console Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild `/admin/find` so read cost stays constant (a handful of small indexed queries) and DOM size stays constant (compact rows, one expanded edit form at a time) regardless of how large the Find directory grows, while adding server-side search/filter and wiring up the previously-orphaned "add professional as admin" action.

**Architecture:** URL-driven filters (`tab`, `status`, `q`, `profession`, `page`) parsed by a server component (`page.tsx`) that runs exactly 3 reads per load: one RPC for all segment counts, one paginated+filtered query for the active tab, one `profiles` lookup scoped to just that page's rows. Client components (`FindToolbar`, `ProfessionalList`, `RatingsList`) render from server-provided props; row-level quick actions (approve/reject) mutate local state directly (no re-fetch), while the heavier "expand to edit" form path calls `router.refresh()` after a save, which client components pick up via a `useEffect` that resyncs local state whenever the server passes fresh props.

**Tech Stack:** Next.js 16 App Router (server components + `'use server'` actions), Supabase (service-role admin client, Postgres `pg_trgm` for search), Tailwind CSS, lucide-react icons. No test framework in this project — verification is `tsc --noEmit`, `eslint`, `npm run build`, and manual browser QA (see Global Constraints).

## Global Constraints

- No test framework in this repo — every task's "test cycle" is `npx tsc --noEmit`, `npx eslint <files>`, and (for the final task) `npm run build`. Manual QA in a real, signed-in-as-admin browser session replaces automated UI tests.
- Supabase project `slmbqngmxketyxjauxxk` is **live production** — the migration in Task 1 is additive-only (new extension, new indexes, new function); it does not alter or drop any existing column, row, or index.
- `src/lib/database.types.ts` is auto-generated — never hand-edit it; regenerate via the `generate_typescript_types` MCP tool whenever the schema changes (Task 1).
- Follow existing code style exactly: no comments unless explaining a non-obvious WHY, Tailwind utility classes inline, `'use client'` only on components that need interactivity.
- `/admin/find` is not under the `find.*` subdomain rewrite (that only applies to `find.ourdahanu.in` / `find.localhost`) — it is a normal path route, so `http://localhost:3000/admin/find` works in local dev without the "find subdomain dev-preview stuck loader" issue that affects the public find pages.

---

### Task 1: Database migration — search indexes + counts RPC + regenerated types

**Files:**
- Migration: applied via the `apply_migration` MCP tool (project `slmbqngmxketyxjauxxk`), no local migration file is tracked in this repo.
- Modify: `src/lib/database.types.ts` (regenerated, do not hand-edit).
- Modify: `src/lib/find/types.ts` — add `AdminFindCounts`.

**Interfaces:**
- Produces: Postgres function `get_admin_find_counts()` returning `jsonb` shaped as `{ pending: number, approved: number, rejected: number, inactive: number, total: number, pending_ratings: number }`.
- Produces: TypeScript type `AdminFindCounts` in `src/lib/find/types.ts`, consumed by `FindToolbar.tsx` (Task 6) and `page.tsx` (Task 8).
- Produces: GIN trigram indexes on `find_professionals(name)`, `find_professionals(phone)`, `find_professionals(locality)`, enabling fast `ilike '%q%'` search at scale.

- [ ] **Step 1: Apply the migration**

Call the `apply_migration` MCP tool with `project_id: "slmbqngmxketyxjauxxk"`, `name: "add_admin_find_search_and_counts"`, and this `query`:

```sql
create extension if not exists pg_trgm;

create index if not exists find_professionals_name_trgm_idx
  on public.find_professionals using gin (name gin_trgm_ops);
create index if not exists find_professionals_phone_trgm_idx
  on public.find_professionals using gin (phone gin_trgm_ops);
create index if not exists find_professionals_locality_trgm_idx
  on public.find_professionals using gin (locality gin_trgm_ops);

create or replace function public.get_admin_find_counts()
returns jsonb
language sql
stable
security definer
set search_path to 'public'
as $$
  select jsonb_build_object(
    'pending', (select count(*)::int from find_professionals where status = 'pending'),
    'approved', (select count(*)::int from find_professionals where status = 'approved'),
    'rejected', (select count(*)::int from find_professionals where status = 'rejected'),
    'inactive', (select count(*)::int from find_professionals where is_active = false),
    'total', (select count(*)::int from find_professionals),
    'pending_ratings', (select count(*)::int from find_ratings where status = 'pending')
  );
$$;
```

- [ ] **Step 2: Verify the function returns correct counts**

Call the `execute_sql` MCP tool with `project_id: "slmbqngmxketyxjauxxk"` and:

```sql
select get_admin_find_counts();
```

Expected (matches current live data, verified before writing this plan):
```json
{"pending": 0, "approved": 64, "rejected": 0, "inactive": 0, "total": 64, "pending_ratings": 1}
```

- [ ] **Step 3: Verify the trigram indexes exist**

```sql
select indexname from pg_indexes
where tablename = 'find_professionals' and indexname like '%trgm%';
```

Expected: 3 rows — `find_professionals_name_trgm_idx`, `find_professionals_phone_trgm_idx`, `find_professionals_locality_trgm_idx`.

- [ ] **Step 4: Regenerate `src/lib/database.types.ts`**

Call the `generate_typescript_types` MCP tool with `project_id: "slmbqngmxketyxjauxxk"`, and write its full output over the current contents of `src/lib/database.types.ts` (use the Read tool first, then Write — this file must be read before it can be overwritten).

- [ ] **Step 5: Add the `AdminFindCounts` type**

In `src/lib/find/types.ts`, append at the end of the file:

```ts

export interface AdminFindCounts {
  pending: number
  approved: number
  rejected: number
  inactive: number
  total: number
  pending_ratings: number
}
```

- [ ] **Step 6: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors (this type isn't consumed by anything yet, so this just confirms the file itself is syntactically valid).

- [ ] **Step 7: Commit**

```bash
git add src/lib/database.types.ts src/lib/find/types.ts
git commit -m "feat(admin-find): add search indexes and counts RPC"
```

---

### Task 2: `Pagination` component

**Files:**
- Create: `src/app/admin/find/Pagination.tsx`

**Interfaces:**
- Produces: `Pagination` (default export), a plain server component (no `'use client'` — it renders only `Link`s, no interactivity) with props `{ page: number; pageSize: number; total: number; hrefFor: (page: number) => string }`.
- Consumes: nothing from earlier tasks.

- [ ] **Step 1: Create the component**

```tsx
import Link from 'next/link'
import { ChevronLeft, ChevronRight } from 'lucide-react'

export default function Pagination({
  page,
  pageSize,
  total,
  hrefFor,
}: {
  page: number
  pageSize: number
  total: number
  hrefFor: (page: number) => string
}) {
  if (total === 0) return null

  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const start = (page - 1) * pageSize + 1
  const end = Math.min(page * pageSize, total)

  return (
    <div className="mt-4 flex items-center justify-between text-sm text-gray-500">
      <span>Showing {start}–{end} of {total}</span>
      <div className="flex gap-2">
        <Link
          href={hrefFor(Math.max(1, page - 1))}
          aria-disabled={page <= 1}
          className={`inline-flex items-center gap-1 rounded border border-gray-200 px-2 py-1 ${
            page <= 1 ? 'pointer-events-none opacity-40' : 'hover:bg-gray-50'
          }`}
        >
          <ChevronLeft size={14} /> Prev
        </Link>
        <Link
          href={hrefFor(Math.min(totalPages, page + 1))}
          aria-disabled={page >= totalPages}
          className={`inline-flex items-center gap-1 rounded border border-gray-200 px-2 py-1 ${
            page >= totalPages ? 'pointer-events-none opacity-40' : 'hover:bg-gray-50'
          }`}
        >
          Next <ChevronRight size={14} />
        </Link>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Type-check and lint**

Run: `npx tsc --noEmit && npx eslint src/app/admin/find/Pagination.tsx`
Expected: no errors, no warnings.

- [ ] **Step 3: Commit**

```bash
git add src/app/admin/find/Pagination.tsx
git commit -m "feat(admin-find): add Pagination component"
```

---

### Task 3: `RatingModerationButtons` callback + `RatingsList` component

**Files:**
- Modify: `src/app/admin/find/RatingModerationButtons.tsx`
- Create: `src/app/admin/find/RatingsList.tsx`

**Interfaces:**
- Consumes: `setRatingStatus`, `deleteRating` from `src/app/actions/admin-find.ts` (existing, unchanged signatures).
- Produces: `RatingModerationButtons` gains an optional prop `onActed?: (status: 'approved' | 'rejected') => void`, called after a successful approve/reject (not on delete, which still calls `router.refresh()` directly).
- Produces: `RatingsList` (default export) — client component, props `{ initialRows: AdminPendingRating[]; nameById: Record<string, string> }`. Also exports the `AdminPendingRating` interface, consumed by `page.tsx` (Task 8).

- [ ] **Step 1: Add the `onActed` callback to `RatingModerationButtons`**

Replace the full contents of `src/app/admin/find/RatingModerationButtons.tsx` with:

```tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { setRatingStatus, deleteRating } from '@/app/actions/admin-find'

export default function RatingModerationButtons({
  ratingId,
  onActed,
}: {
  ratingId: string
  onActed?: (status: 'approved' | 'rejected') => void
}) {
  const router = useRouter()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function act(status: 'approved' | 'rejected') {
    setPending(true); setError(null)
    const res = await setRatingStatus(ratingId, status)
    setPending(false)
    if (res.error) { setError(res.error); return }
    onActed?.(status)
  }

  async function remove() {
    if (!window.confirm('Permanently delete this rating? This cannot be undone.')) return
    setPending(true); setError(null)
    const res = await deleteRating(ratingId)
    setPending(false)
    if (res.error) { setError(res.error); return }
    router.refresh()
  }

  return (
    <div className="mt-3 flex items-center gap-2">
      <button disabled={pending} onClick={() => act('approved')} className="rounded bg-green-600 px-3 py-1 text-xs font-semibold text-white disabled:opacity-60">Approve</button>
      <button disabled={pending} onClick={() => act('rejected')} className="rounded bg-red-600 px-3 py-1 text-xs font-semibold text-white disabled:opacity-60">Reject</button>
      <button disabled={pending} onClick={remove} className="ml-auto rounded border border-red-300 px-3 py-1 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-60">Delete</button>
      {error && <span className="text-xs text-red-700">{error}</span>}
    </div>
  )
}
```

(The only change from the current file: the new `onActed` prop, and `act()` calling it on success instead of doing nothing.)

- [ ] **Step 2: Create `RatingsList`**

```tsx
'use client'

import { useEffect, useState } from 'react'
import { Star } from 'lucide-react'
import RatingModerationButtons from './RatingModerationButtons'

export interface AdminPendingRating {
  id: string
  user_id: string
  rating: number
  comment: string
  created_at: string
  find_professionals: { name: string } | null
}

export default function RatingsList({
  initialRows,
  nameById,
}: {
  initialRows: AdminPendingRating[]
  nameById: Record<string, string>
}) {
  const [rows, setRows] = useState(initialRows)

  useEffect(() => { setRows(initialRows) }, [initialRows])

  if (rows.length === 0) {
    return <p className="text-sm text-gray-500">No pending ratings.</p>
  }

  return (
    <ul className="space-y-3">
      {rows.map((r) => (
        <li key={r.id} className="rounded-lg border border-gray-200 bg-white p-4">
          <div className="flex items-center justify-between">
            <span className="font-semibold">{r.find_professionals?.name ?? 'Unknown'}</span>
            <span className="flex items-center gap-0.5">
              {[1, 2, 3, 4, 5].map((n) => (
                <Star key={n} size={13} className={n <= r.rating ? 'text-amber-400 fill-amber-400' : 'text-gray-200 fill-gray-200'} />
              ))}
            </span>
          </div>
          <p className="text-xs text-gray-500">by {nameById[r.user_id] ?? 'Unknown user'}</p>
          <p className="mt-2 text-sm text-gray-700">{r.comment}</p>
          <RatingModerationButtons
            ratingId={r.id}
            onActed={() => setRows((cur) => cur.filter((x) => x.id !== r.id))}
          />
        </li>
      ))}
    </ul>
  )
}
```

The `useEffect` resync is the key mechanism throughout this plan: whenever the server re-renders `page.tsx` (a filter/page navigation, or a `router.refresh()` from elsewhere) and passes a new `initialRows` array, this effect replaces local state with the fresh server truth. Between navigations, `act()`'s local `setRows` filter gives instant feedback without waiting for a round trip.

- [ ] **Step 3: Type-check and lint**

Run: `npx tsc --noEmit && npx eslint src/app/admin/find/RatingModerationButtons.tsx src/app/admin/find/RatingsList.tsx`
Expected: no errors, no warnings.

- [ ] **Step 4: Commit**

```bash
git add src/app/admin/find/RatingModerationButtons.tsx src/app/admin/find/RatingsList.tsx
git commit -m "feat(admin-find): add RatingsList with optimistic moderation"
```

---

### Task 4: `EditProfessionalForm` callback + `ProfessionalList` component

**Files:**
- Modify: `src/app/admin/find/EditProfessionalForm.tsx`
- Create: `src/app/admin/find/ProfessionalList.tsx`

**Interfaces:**
- Consumes: `setProfessionalStatus` from `src/app/actions/admin-find.ts` (existing).
- Produces: `EditProfessionalForm` gains an optional prop `onSaved?: () => void`, called after a successful save, save-and-approve, or inline reject (not delete, which is unaffected and keeps calling `router.refresh()` on its own). Save and save-and-approve now also call `router.refresh()`, which they did not do before.
- Produces: `ProfessionalList` (default export) — client component, props `{ initialRows: AdminProfessionalRow[]; nameById: Record<string, string> }`. Also exports the `AdminProfessionalRow` interface, consumed by `page.tsx` (Task 8).

- [ ] **Step 1: Add `onSaved` and `router.refresh()` to `EditProfessionalForm`**

In `src/app/admin/find/EditProfessionalForm.tsx`, change the component signature (currently line 10):

```tsx
export default function EditProfessionalForm({ pro, businessLabel }: { pro: FindProfessional; businessLabel?: string | null }) {
```

to:

```tsx
export default function EditProfessionalForm({
  pro,
  businessLabel,
  onSaved,
}: {
  pro: FindProfessional
  businessLabel?: string | null
  onSaved?: () => void
}) {
```

Change `save()` (currently lines 45–51):

```tsx
  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null); setMsg(null); setPending(true)
    const res = await updateProfessional(pro.id, fields(new FormData(e.currentTarget)))
    setPending(false)
    if (res.error) setError(res.error); else setMsg('Saved.')
  }
```

to:

```tsx
  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null); setMsg(null); setPending(true)
    const res = await updateProfessional(pro.id, fields(new FormData(e.currentTarget)))
    setPending(false)
    if (res.error) { setError(res.error); return }
    setMsg('Saved.')
    router.refresh()
    onSaved?.()
  }
```

Change `saveAndApprove()` (currently lines 53–60):

```tsx
  async function saveAndApprove(formEl: HTMLFormElement) {
    setError(null); setMsg(null); setPending(true)
    const upd = await updateProfessional(pro.id, fields(new FormData(formEl)))
    if (upd.error) { setPending(false); setError(upd.error); return }
    const res = await setProfessionalStatus(pro.id, 'approved')
    setPending(false)
    if (res.error) setError(res.error); else setMsg('Approved and live.')
  }
```

to:

```tsx
  async function saveAndApprove(formEl: HTMLFormElement) {
    setError(null); setMsg(null); setPending(true)
    const upd = await updateProfessional(pro.id, fields(new FormData(formEl)))
    if (upd.error) { setPending(false); setError(upd.error); return }
    const res = await setProfessionalStatus(pro.id, 'approved')
    setPending(false)
    if (res.error) { setError(res.error); return }
    setMsg('Approved and live.')
    router.refresh()
    onSaved?.()
  }
```

Change the inline Reject button's `onClick` (currently inside the JSX, one line):

```tsx
            onClick={async () => { setPending(true); const r = await setProfessionalStatus(pro.id, 'rejected'); setPending(false); if (r.error) setError(r.error); else setMsg('Rejected.') }}
```

to:

```tsx
            onClick={async () => {
              setPending(true)
              const r = await setProfessionalStatus(pro.id, 'rejected')
              setPending(false)
              if (r.error) { setError(r.error); return }
              setMsg('Rejected.')
              router.refresh()
              onSaved?.()
            }}
```

`remove()` is unchanged — it already calls `router.refresh()` and doesn't need `onSaved` (the row disappearing from the list on refresh is enough).

- [ ] **Step 2: Create `ProfessionalList`**

```tsx
'use client'

import { useEffect, useState } from 'react'
import type { FindProfessional } from '@/lib/find/types'
import { setProfessionalStatus } from '@/app/actions/admin-find'
import EditProfessionalForm from './EditProfessionalForm'

export interface AdminProfessionalRow extends FindProfessional {
  business: { name: string; subdomain: string | null } | null
}

function businessLabelOf(business: AdminProfessionalRow['business']): string | null {
  if (!business) return null
  return business.subdomain ? `${business.name} · ${business.subdomain}.ourdahanu.in` : business.name
}

export default function ProfessionalList({
  initialRows,
  nameById,
}: {
  initialRows: AdminProfessionalRow[]
  nameById: Record<string, string>
}) {
  const [rows, setRows] = useState(initialRows)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [errorById, setErrorById] = useState<Record<string, string>>({})

  useEffect(() => { setRows(initialRows) }, [initialRows])

  async function quickAction(id: string, status: 'approved' | 'rejected') {
    setPendingId(id)
    setErrorById((cur) => ({ ...cur, [id]: '' }))
    const res = await setProfessionalStatus(id, status)
    setPendingId(null)
    if (res.error) {
      setErrorById((cur) => ({ ...cur, [id]: res.error! }))
      return
    }
    setRows((cur) => cur.map((r) => (r.id === id ? { ...r, status } : r)))
  }

  if (rows.length === 0) {
    return <p className="text-sm text-gray-500">No professionals in this view.</p>
  }

  return (
    <ul className="space-y-2">
      {rows.map((p) => {
        const isExpanded = expandedId === p.id
        const chips = p.professions.slice(0, 2)
        const extra = p.professions.length - chips.length
        return (
          <li key={p.id} className="rounded-lg border border-gray-200 bg-white">
            <button
              type="button"
              onClick={() => setExpandedId(isExpanded ? null : p.id)}
              className="flex w-full flex-wrap items-center gap-2 px-3 py-2.5 text-left text-sm"
            >
              <span className={`rounded px-2 py-0.5 text-xs font-semibold ${
                p.status === 'pending' ? 'bg-amber-100 text-amber-800'
                : p.status === 'approved' ? 'bg-green-100 text-green-800'
                : 'bg-red-100 text-red-800'}`}>{p.status}</span>
              {!p.is_active && <span className="rounded bg-gray-200 px-2 py-0.5 text-xs text-gray-700">inactive</span>}
              <span className="font-semibold text-gray-900">{p.name}</span>
              <span className="text-xs text-gray-500">
                {chips.join(', ')}{extra > 0 ? ` +${extra}` : ''}
              </span>
              {p.locality && <span className="text-xs text-gray-400">{p.locality}</span>}
              <span className="text-xs text-gray-400">{p.phone}</span>
              <span className="ml-auto text-xs text-gray-400">
                {p.submitted_by ? nameById[p.submitted_by] ?? 'Unknown user' : 'Added by admin'}
              </span>
            </button>
            {errorById[p.id] && <p className="px-3 pb-2 text-xs text-red-700">{errorById[p.id]}</p>}
            {p.status === 'pending' && !isExpanded && (
              <div className="flex gap-2 border-t border-gray-100 px-3 py-2">
                <button
                  type="button"
                  disabled={pendingId === p.id}
                  onClick={() => quickAction(p.id, 'approved')}
                  className="rounded bg-green-600 px-3 py-1 text-xs font-semibold text-white disabled:opacity-60"
                >
                  Approve
                </button>
                <button
                  type="button"
                  disabled={pendingId === p.id}
                  onClick={() => quickAction(p.id, 'rejected')}
                  className="rounded bg-red-600 px-3 py-1 text-xs font-semibold text-white disabled:opacity-60"
                >
                  Reject
                </button>
              </div>
            )}
            {isExpanded && (
              <div className="border-t border-gray-100">
                <EditProfessionalForm
                  pro={p}
                  businessLabel={businessLabelOf(p.business)}
                  onSaved={() => setExpandedId(null)}
                />
              </div>
            )}
          </li>
        )
      })}
    </ul>
  )
}
```

- [ ] **Step 3: Type-check and lint**

Run: `npx tsc --noEmit && npx eslint src/app/admin/find/EditProfessionalForm.tsx src/app/admin/find/ProfessionalList.tsx`
Expected: no errors, no warnings.

- [ ] **Step 4: Commit**

```bash
git add src/app/admin/find/EditProfessionalForm.tsx src/app/admin/find/ProfessionalList.tsx
git commit -m "feat(admin-find): add ProfessionalList with compact rows and quick actions"
```

---

### Task 5: `AddProfessionalForm` component

**Files:**
- Create: `src/app/admin/find/AddProfessionalForm.tsx`

**Interfaces:**
- Consumes: `createProfessionalAsAdmin`, `type AdminProfessionalFields` from `src/app/actions/admin-find.ts` (existing, currently unused anywhere in the app); `BusinessPicker` from `./BusinessPicker.tsx` (existing, unchanged); `PROFESSIONS`, `professionMarathi` from `src/lib/find/professions.ts` (existing).
- Produces: `AddProfessionalForm` (default export) — client component, props `{ onDone: () => void }`.

- [ ] **Step 1: Create the component**

```tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { PROFESSIONS, professionMarathi } from '@/lib/find/professions'
import { createProfessionalAsAdmin, type AdminProfessionalFields } from '@/app/actions/admin-find'
import BusinessPicker from './BusinessPicker'

export default function AddProfessionalForm({ onDone }: { onDone: () => void }) {
  const router = useRouter()
  const [professions, setProfessions] = useState<string[]>([])
  const [businessId, setBusinessId] = useState<string | null>(null)
  const [hasBusiness, setHasBusiness] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  function toggle(p: string) {
    setProfessions((cur) => cur.includes(p) ? cur.filter((x) => x !== p) : [...cur, p])
  }

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null); setMsg(null); setPending(true)
    const fd = new FormData(e.currentTarget)
    const fields: AdminProfessionalFields = {
      name: String(fd.get('name') || ''),
      phone: String(fd.get('phone') || ''),
      whatsapp: fd.get('whatsapp') === 'on',
      professions,
      professionOther: String(fd.get('professionOther') || ''),
      locality: String(fd.get('locality') || ''),
      note: String(fd.get('note') || ''),
      businessListingId: hasBusiness ? businessId : null,
    }
    const res = await createProfessionalAsAdmin(fields)
    setPending(false)
    if (res.error) { setError(res.error); return }
    setMsg('Added.')
    router.refresh()
    setTimeout(onDone, 600)
  }

  const cls = 'w-full rounded border border-gray-300 px-2 py-1 text-sm'
  return (
    <form onSubmit={submit} className="space-y-2 rounded-lg border border-gray-200 bg-gray-50 p-3">
      {error && <p className="rounded bg-red-50 px-2 py-1 text-xs text-red-700">{error}</p>}
      {msg && <p className="rounded bg-green-50 px-2 py-1 text-xs text-green-700">{msg}</p>}
      <div className="grid grid-cols-2 gap-2">
        <input name="name" placeholder="Name" className={cls} />
        <input name="phone" placeholder="Phone" className={cls} />
        <input name="locality" placeholder="Locality" className={cls} />
        <label className="flex items-center gap-2 text-xs">
          <input type="checkbox" name="whatsapp" /> WhatsApp
        </label>
      </div>
      <fieldset className="rounded border border-gray-300 p-2">
        <legend className="px-1 text-xs font-medium">Professions * (pick one or more)</legend>
        <div className="grid grid-cols-2 gap-1">
          {PROFESSIONS.map((p) => (
            <label key={p} className="flex items-center gap-2 text-xs">
              <input type="checkbox" checked={professions.includes(p)} onChange={() => toggle(p)} />
              {p}{' '}
              <span lang="mr" className="font-[family-name:var(--font-devanagari)] text-gray-500">
                {professionMarathi(p)}
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      {professions.includes('Other') && (
        <input name="professionOther" placeholder="Other profession" className={cls} />
      )}
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
            <BusinessPicker value={businessId} onChange={(id) => setBusinessId(id)} />
          </div>
        )}
      </div>
      <textarea name="note" placeholder="Note" rows={2} className={cls} />
      <div className="flex gap-2">
        <button type="submit" disabled={pending} className="rounded bg-gray-800 px-3 py-1 text-xs font-semibold text-white disabled:opacity-60">
          Add professional
        </button>
        <button type="button" onClick={onDone} className="rounded border border-gray-300 px-3 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-50">
          Cancel
        </button>
      </div>
    </form>
  )
}
```

On success this calls `router.refresh()` (re-running `page.tsx`'s 3 reads, which is cheap and constant-cost — not the old full-table fetch) and then collapses itself after a short delay so the "Added." message is visible. If the new professional matches the current filter, it will appear in the list once the refresh lands.

- [ ] **Step 2: Type-check and lint**

Run: `npx tsc --noEmit && npx eslint src/app/admin/find/AddProfessionalForm.tsx`
Expected: no errors, no warnings.

- [ ] **Step 3: Commit**

```bash
git add src/app/admin/find/AddProfessionalForm.tsx
git commit -m "feat(admin-find): add AddProfessionalForm, wiring up createProfessionalAsAdmin"
```

---

### Task 6: `FindToolbar` component

**Files:**
- Create: `src/app/admin/find/FindToolbar.tsx`

**Interfaces:**
- Consumes: `AdminFindCounts` from `src/lib/find/types.ts` (Task 1); `PROFESSIONS` from `src/lib/find/professions.ts`; `AddProfessionalForm` from `./AddProfessionalForm.tsx` (Task 5).
- Produces: `FindToolbar` (default export) — client component, props `{ status: string; q: string; profession: string; counts: AdminFindCounts; currentQuery: string }`. `currentQuery` is a URL query string (built by `page.tsx`) containing every *other* active filter, so this component can override one field at a time without needing `useSearchParams()`.

- [ ] **Step 1: Create the component**

```tsx
'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Plus } from 'lucide-react'
import { PROFESSIONS } from '@/lib/find/professions'
import type { AdminFindCounts } from '@/lib/find/types'
import AddProfessionalForm from './AddProfessionalForm'

const SEGMENTS: { key: string; label: string }[] = [
  { key: 'pending', label: 'Pending' },
  { key: 'approved', label: 'Approved' },
  { key: 'rejected', label: 'Rejected' },
  { key: 'inactive', label: 'Inactive' },
  { key: 'all', label: 'All' },
]

function buildHref(currentQuery: string, overrides: Record<string, string>) {
  const params = new URLSearchParams(currentQuery)
  for (const [key, value] of Object.entries(overrides)) {
    if (value) params.set(key, value); else params.delete(key)
  }
  return `/admin/find?${params.toString()}`
}

function countFor(counts: AdminFindCounts, key: string): number {
  if (key === 'pending') return counts.pending
  if (key === 'approved') return counts.approved
  if (key === 'rejected') return counts.rejected
  if (key === 'inactive') return counts.inactive
  return counts.total
}

export default function FindToolbar({
  status,
  q,
  profession,
  counts,
  currentQuery,
}: {
  status: string
  q: string
  profession: string
  counts: AdminFindCounts
  currentQuery: string
}) {
  const router = useRouter()
  const [query, setQuery] = useState(q)
  const [showAdd, setShowAdd] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => { setQuery(q) }, [q])

  function onSearchChange(value: string) {
    setQuery(value)
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      router.replace(buildHref(currentQuery, { q: value }))
    }, 350)
  }

  return (
    <div className="mb-4 space-y-3">
      <div className="flex flex-wrap gap-2">
        {SEGMENTS.map((s) => (
          <Link
            key={s.key}
            href={buildHref(currentQuery, { status: s.key })}
            replace
            className={`rounded-md px-3 py-1.5 text-sm font-semibold ${
              status === s.key ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-700'
            }`}
          >
            {s.label} ({countFor(counts, s.key)})
          </Link>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={query}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search name, phone, locality…"
          className="w-56 rounded border border-gray-300 px-2 py-1.5 text-sm"
        />
        <select
          value={profession}
          onChange={(e) => router.replace(buildHref(currentQuery, { profession: e.target.value }))}
          className="rounded border border-gray-300 px-2 py-1.5 text-sm"
        >
          <option value="">All professions</option>
          {PROFESSIONS.map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => setShowAdd((v) => !v)}
          className="ml-auto inline-flex items-center gap-1 rounded bg-gray-800 px-3 py-1.5 text-sm font-semibold text-white"
        >
          <Plus size={14} /> Add professional
        </button>
      </div>
      {showAdd && <AddProfessionalForm onDone={() => setShowAdd(false)} />}
    </div>
  )
}
```

`currentQuery` deliberately never includes `page` — every filter change (segment, search, profession) is meant to reset back to page 1, which happens naturally because `buildHref` starts from a query string that never has `page` in it.

- [ ] **Step 2: Type-check and lint**

Run: `npx tsc --noEmit && npx eslint src/app/admin/find/FindToolbar.tsx`
Expected: no errors, no warnings.

- [ ] **Step 3: Commit**

```bash
git add src/app/admin/find/FindToolbar.tsx
git commit -m "feat(admin-find): add FindToolbar with segments, search, and profession filter"
```

---

### Task 7: Remove redundant `revalidatePath` calls in `admin-find.ts`

**Files:**
- Modify: `src/app/actions/admin-find.ts`

**Interfaces:**
- No signature changes to any exported function.

`/admin/find` (both the current version and the Task 8 rewrite) reads via cookie-based auth (`requireAdmin`) and has no `'use cache'` directive, so Next.js already treats it as fully dynamic — it is never served from the Full Route Cache, which makes `revalidatePath('/admin/find')` a no-op on every call site in this file. Removing it doesn't change behavior; it just stops paying for a revalidation that does nothing.

- [ ] **Step 1: Remove the 7 no-op calls**

In `src/app/actions/admin-find.ts`, delete the line `revalidatePath('/admin/find')` from each of these 7 functions (leave every other line, including `revalidateFindCache()`, untouched):
- `setProfessionalStatus`
- `updateProfessional`
- `createProfessionalAsAdmin`
- `setProfessionalActive`
- `setRatingStatus`
- `deleteProfessional`
- `deleteRating`

After this change, `revalidatePath` will have no remaining call sites in the file — remove its import too:

```ts
import { revalidatePath } from 'next/cache'
```

- [ ] **Step 2: Type-check and lint**

Run: `npx tsc --noEmit && npx eslint src/app/actions/admin-find.ts`
Expected: no errors, no warnings (confirms the `revalidatePath` import removal didn't leave a dangling reference).

- [ ] **Step 3: Commit**

```bash
git add src/app/actions/admin-find.ts
git commit -m "chore(admin-find): remove no-op revalidatePath calls"
```

---

### Task 8: Rewrite `page.tsx` — final integration

**Files:**
- Modify (full rewrite): `src/app/admin/find/page.tsx`

**Interfaces:**
- Consumes: `AdminFindCounts` (Task 1), `Pagination` (Task 2), `RatingsList` + `AdminPendingRating` (Task 3), `ProfessionalList` + `AdminProfessionalRow` (Task 4), `FindToolbar` (Task 6), `get_admin_find_counts` RPC (Task 1).
- Produces: the rendered `/admin/find` page — nothing downstream consumes this file.

- [ ] **Step 1: Replace the full contents of `src/app/admin/find/page.tsx`**

```tsx
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin-client'
import { requireAdmin } from '@/app/actions/admin'
import type { AdminFindCounts } from '@/lib/find/types'
import FindToolbar from './FindToolbar'
import ProfessionalList, { type AdminProfessionalRow } from './ProfessionalList'
import RatingsList, { type AdminPendingRating } from './RatingsList'
import Pagination from './Pagination'

const PAGE_SIZE = 25

const PROFESSIONAL_COLUMNS =
  'id, name, phone, whatsapp, professions, profession_other, locality, note, status, is_active, submitted_by, business_listing_id, created_at, updated_at'

const STATUS_FILTERS = new Set(['pending', 'approved', 'rejected', 'inactive', 'all'])

export default async function AdminFindPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; status?: string; q?: string; profession?: string; page?: string }>
}) {
  const supabase = await createClient()
  await requireAdmin(supabase)
  const db = createAdminClient()
  if (!db) return <p className="p-6 text-red-600">Service role key not configured.</p>

  const params = await searchParams
  const tab = params.tab === 'ratings' ? 'ratings' : 'professionals'
  const q = (params.q ?? '').trim()
  const profession = params.profession ?? ''
  const page = Math.max(1, parseInt(params.page ?? '1', 10) || 1)
  const offset = (page - 1) * PAGE_SIZE

  const { data: countsRaw } = await db.rpc('get_admin_find_counts')
  const counts = (countsRaw ?? {
    pending: 0, approved: 0, rejected: 0, inactive: 0, total: 0, pending_ratings: 0,
  }) as AdminFindCounts

  const status = params.status && STATUS_FILTERS.has(params.status)
    ? params.status
    : (counts.pending > 0 ? 'pending' : 'approved')

  const nameById = new Map<string, string>()
  async function loadNames(ids: Set<string>) {
    if (ids.size === 0) return
    const { data } = await db!
      .from('profiles')
      .select('id, full_name, email')
      .in('id', Array.from(ids))
    for (const row of data ?? []) {
      nameById.set(row.id, row.full_name || row.email || 'Unknown user')
    }
  }

  let professionals: AdminProfessionalRow[] = []
  let ratings: AdminPendingRating[] = []
  let total = 0

  if (tab === 'ratings') {
    const { data, count } = await db
      .from('find_ratings')
      .select('id, user_id, rating, comment, created_at, find_professionals(name)', { count: 'exact' })
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1)
    ratings = (data ?? []) as unknown as AdminPendingRating[]
    total = count ?? 0
    await loadNames(new Set(ratings.map((r) => r.user_id).filter(Boolean)))
  } else {
    let query = db
      .from('find_professionals')
      .select(`${PROFESSIONAL_COLUMNS}, business:listings(name, subdomain)`, { count: 'exact' })

    if (status === 'inactive') query = query.eq('is_active', false)
    else if (status !== 'all') query = query.eq('status', status)

    if (profession) query = query.contains('professions', [profession])
    if (q) {
      const pattern = `%${q.replace(/[%_,()]/g, ' ').trim()}%`
      query = query.or(`name.ilike.${pattern},phone.ilike.${pattern},locality.ilike.${pattern}`)
    }

    const { data, count } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1)

    professionals = (data ?? []) as unknown as AdminProfessionalRow[]
    total = count ?? 0
    await loadNames(new Set(professionals.map((p) => p.submitted_by).filter((v): v is string => !!v)))
  }

  const qp = new URLSearchParams()
  if (tab !== 'professionals') qp.set('tab', tab)
  if (status && status !== 'pending') qp.set('status', status)
  if (q) qp.set('q', q)
  if (profession) qp.set('profession', profession)
  const currentQuery = qp.toString()

  function hrefFor(targetPage: number) {
    const p = new URLSearchParams(currentQuery)
    if (targetPage > 1) p.set('page', String(targetPage)); else p.delete('page')
    return `/admin/find?${p.toString()}`
  }

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
          Pending ratings{counts.pending_ratings ? ` (${counts.pending_ratings})` : ''}
        </Link>
      </div>

      {tab === 'ratings' ? (
        <>
          <RatingsList initialRows={ratings} nameById={Object.fromEntries(nameById)} />
          <Pagination page={page} pageSize={PAGE_SIZE} total={total} hrefFor={hrefFor} />
        </>
      ) : (
        <>
          <FindToolbar status={status} q={q} profession={profession} counts={counts} currentQuery={currentQuery} />
          <ProfessionalList
            initialRows={professionals}
            nameById={Object.fromEntries(nameById)}
          />
          <Pagination page={page} pageSize={PAGE_SIZE} total={total} hrefFor={hrefFor} />
        </>
      )}
    </div>
  )
}
```

A few things worth understanding about this file, since it's the integration point for everything else in this plan:

- `counts` (from the RPC) is the *only* source of truth for every badge number, on both tabs — including `pending_ratings`, which used to be computed as `ratings.length` when on the ratings tab. That would have been wrong once ratings are paginated (`ratings.length` would only ever be ≤25), so it's important this stays wired to `counts.pending_ratings`.
- `business_listing_id` is now included in `PROFESSIONAL_COLUMNS` — the old query omitted it, which meant `EditProfessionalForm`'s "has a business page" checkbox was always initializing from `undefined` rather than the real value. Confirm this didn't regress anything during manual QA (Step 3).
- The `q` sanitization (`replace(/[%_,()]/g, ' ')`) matches the existing pattern in `searchBusinessListings` (`src/app/actions/admin-find.ts`) — commas and parens would otherwise break the `.or(...)` filter syntax.
- No `key` prop is used on `ProfessionalList`/`RatingsList` — their internal `useEffect(() => setRows(initialRows), [initialRows])` (Tasks 3–4) is what keeps them in sync across navigations and refreshes; a `key` would force a full remount and lose transient UI state (like which row is expanded) unnecessarily.

- [ ] **Step 2: Type-check, lint, and build**

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `npx eslint src/app/admin/find/page.tsx`
Expected: no errors, no warnings.

Run: `rm -rf .next && npm run build`
Expected: build succeeds; `/admin/find` and `/admin/find?tab=ratings` still appear in the route table as dynamic routes (no change in routing shape from before this plan).

- [ ] **Step 3: Manual QA in a real browser**

This page requires an authenticated admin session (Google OAuth), which cannot be scripted — sign in manually.

1. Start the dev server (`npm run dev`) and open `http://localhost:3000/admin/find` signed in as an admin.
2. Confirm the Professionals tab defaults to the **Approved** segment (there are 0 pending professionals today) and shows a **64** count on Approved, matching Task 1's verified baseline.
3. Click through **Pending / Approved / Rejected / Inactive / All** — confirm the URL updates (`?status=...`), the list changes, and the page does not flash a full reload (Next.js client-side navigation).
4. Type into the search box (try a known professional's name substring) — confirm results narrow down after ~350ms without a page reload, and the URL picks up `?q=...`.
5. Pick a profession from the dropdown — confirm the list narrows to that profession and the URL picks up `?profession=...`.
6. Click a row to expand it, confirm `EditProfessionalForm` renders with the correct pre-filled values (including whether "Has an OurDahanu business page" is checked correctly for a professional you know is linked), make a small edit (e.g. append a character to the note), save, and confirm the row collapses and the edit persisted after the page refresh.
7. On a row with status `approved`, use "Reject" inside the expanded form; confirm the row's badge updates.
8. Switch to the **Pending ratings** tab; if there's at least one pending rating (there is — 1, per Task 1's baseline), click Approve or Reject and confirm the row disappears immediately without a full page reload.
9. Click **Add professional**, fill in name/phone/at least one profession, submit, confirm a success message appears and the form collapses; then confirm the new professional now appears when the **All** segment is selected.
10. Resize the browser to a narrow (mobile) width and confirm the toolbar and rows wrap sensibly rather than overflowing horizontally.

- [ ] **Step 4: Commit**

```bash
git add src/app/admin/find/page.tsx
git commit -m "feat(admin-find): rewrite page.tsx with pagination, search, and filters"
```

---

## Self-Review Notes

- **Spec coverage:** every bullet in the "UI structure," "Reads per page load," "Search & filter indexing," and "Add professional form" sections of the design doc maps to a task above. The one deliberate, called-out deviation from the literal spec text is in Task 3/4: badge counts refresh on next navigation rather than being optimistically decremented client-side (the spec's "decrements the toolbar's pending badge count" line) — the simpler, self-contained per-list optimistic row removal was chosen instead of introducing a new shared-state shell component solely to keep a badge number live for a few hundred milliseconds. Row-level optimism (the actual perceptible UX win) is preserved.
- **Placeholder scan:** no TBD/TODO markers; every step has literal, complete code.
- **Type consistency:** `AdminFindCounts` (Task 1) is used identically in `page.tsx` and `FindToolbar.tsx`; `AdminProfessionalRow` (Task 4) and `AdminPendingRating` (Task 3) are each defined once and imported by `page.tsx`; `onSaved`/`onActed` callback signatures match between the child components (Tasks 3–4) and their call sites in `ProfessionalList`/`RatingsList`.
