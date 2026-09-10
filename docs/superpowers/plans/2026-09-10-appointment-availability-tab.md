# Appointment Availability Tab Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move weekly hours and slot settings out of the listing editor and onto `/my-business/appointments`, so everything an owner does about appointments lives on one page.

**Architecture:** The appointments page gains a page-level business selector and a third tab. The settings editor becomes its own client component with its own server action, instead of riding along inside the whole-listing form submit. The old tab and its write path are then deleted so only one writer touches `appointment_settings`.

**Tech Stack:** Next.js 16.2.1 App Router with Cache Components, React 19, Supabase (live production), Tailwind, `node:test` via `tsx --test`.

## Global Constraints

Copied from `docs/superpowers/specs/2026-09-10-appointment-availability-relocation-design.md`. Every task's requirements implicitly include this section.

- **This is a relocation, not a redesign.** The controls, their ranges and their behaviour are identical to what exists today. Do not add, remove or restyle a control.
- **`appointments_enabled` and `appointment_booking_fee` stay admin-only**, set at `/admin/appointments`. No owner-facing control for either may appear anywhere in this work.
- **The client is never the validator.** `saveAppointmentSettings` must run its input through `normalizeAppointmentSettings` server-side before writing. Downstream slot generation assumes windows arrive sorted, non-overlapping and capped.
- **Every successful write calls `revalidateAppointmentsCache(listingId)`.** `getAppointmentDirectory` and `getBookableListingBySubdomain` are tagged `appointments` and cached 24 hours; without it the directory advertises stale hours for a day.
- **Writes go through `createAdminClient()`** (service role), matching the existing appointment write paths, and every call site must handle it returning `null`.
- **Exactly one writer to `appointment_settings`** when this is done. Two forms writing one JSONB column is how they drift.
- The database is **LIVE PRODUCTION**. No migrations, no schema changes, no destructive SQL. Read-only queries only while testing.
- Times are `HH:MM` 24-hour strings; dates are `YYYY-MM-DD`; the timezone is always `Asia/Kolkata`.
- A `'use server'` file may only export async functions and types.
- `npx tsc --noEmit` is currently clean (exit 0) and must stay clean — no casts, `any`, or `@ts-ignore`.
- Lint baseline on `main` is 61 problems / 34 errors. A task adds zero new ones.
- The test suite is 92 passing. This work adds no new tests (see each task's Testing note) and must not break any.

---

### Task 1: Server layer — shared access check, widened listings, new save action

Extract the ownership check both action files need, widen `getMyAppointmentListings` to carry each listing's settings, and add the write path the new tab will use.

**Files:**
- Create: `src/lib/appointment-access.ts`
- Create: `src/app/actions/appointment-settings.ts`
- Modify: `src/app/actions/appointment-overrides.ts` — delete the local `requireListingAccess` (around lines 52-76), import the shared one, widen `getMyAppointmentListings`

**Interfaces:**
- Consumes: `normalizeAppointmentSettings`, `type AppointmentSettings` from `@/lib/listing-content`; `revalidateAppointmentsCache` from `@/lib/cache-tags`; `createAdminClient` from `@/lib/supabase/admin-client`; `createClient` from `@/lib/supabase/server`; `getUserRole` from `@/app/actions/admin`.
- Produces:
  - `requireListingAccess(listingId: string): Promise<{ error: string } | { userId: string }>` from `@/lib/appointment-access`
  - `type OwnerAppointmentListing = { id: string; name: string; appointment_settings: unknown }`
  - `getMyAppointmentListings(): Promise<{ error?: string; listings: OwnerAppointmentListing[] }>` — unchanged name and shape apart from the new field
  - `saveAppointmentSettings(listingId: string, settings: AppointmentSettings): Promise<{ error?: string; saved?: boolean }>`

- [ ] **Step 1: Create the shared access check**

The identical check is needed by two action files. It lives in a plain `server-only` module rather than a `'use server'` one, because a `'use server'` export becomes a callable endpoint and this is an internal helper.

Create `src/lib/appointment-access.ts`:

```ts
import 'server-only'

import { getUserRole } from '@/app/actions/admin'
import { createAdminClient } from '@/lib/supabase/admin-client'
import { createClient } from '@/lib/supabase/server'

/**
 * Owner-or-admin access to one listing. Appointment settings and date
 * overrides both decide when customers can book, so both are gated at the
 * same bar as editing the listing itself.
 */
export async function requireListingAccess(
  listingId: string,
): Promise<{ error: string } | { userId: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Please sign in first.' }

  const { role } = await getUserRole(supabase)
  const isAdmin = role === 'admin' || role === 'moderator'

  const reader = createAdminClient() ?? supabase
  const { data: listing } = await reader
    .from('listings')
    .select('id, owner_id')
    .eq('id', listingId)
    .maybeSingle()

  if (!listing) return { error: 'Business not found.' }
  if (!isAdmin && listing.owner_id !== user.id) return { error: 'Access denied.' }

  return { userId: user.id }
}
```

- [ ] **Step 2: Point `appointment-overrides.ts` at the shared check**

In `src/app/actions/appointment-overrides.ts`, delete the local `async function requireListingAccess(...)` definition entirely, and add to the imports:

```ts
import { requireListingAccess } from '@/lib/appointment-access'
```

Then remove any import that the deletion leaves unused. Check `getUserRole` specifically — if the deleted function was its only consumer in that file, its import must go, or lint fails and the baseline moves.

Every existing call site (`getUpcomingOverrides`, `saveAppointmentDateOverride`, `deleteAppointmentDateOverride`) keeps working unchanged — the signature and return shape are identical.

- [ ] **Step 3: Widen `getMyAppointmentListings`**

In the same file, change the type and the query so each listing carries its settings:

```ts
export type OwnerAppointmentListing = {
  id: string
  name: string
  /** Raw JSONB; the consumer normalises it. May be null for a never-configured listing. */
  appointment_settings: unknown
}
```

and inside `getMyAppointmentListings`, change the `.select('id, name')` to `.select('id, name, appointment_settings')`, and the mapping to:

```ts
  return {
    listings: ((data ?? []) as Array<{
      id: string
      name: string
      appointment_settings: unknown
    }>).map((row) => ({
      id: row.id,
      name: row.name,
      appointment_settings: row.appointment_settings,
    })),
  }
```

One query still, one round trip. `ScheduleTab` ignores the new field.

- [ ] **Step 4: Create the save action**

Create `src/app/actions/appointment-settings.ts`:

```ts
'use server'

import { requireListingAccess } from '@/lib/appointment-access'
import { revalidateAppointmentsCache } from '@/lib/cache-tags'
import {
  normalizeAppointmentSettings,
  type AppointmentSettings,
} from '@/lib/listing-content'
import { createAdminClient } from '@/lib/supabase/admin-client'

export async function saveAppointmentSettings(
  listingId: string,
  settings: AppointmentSettings,
): Promise<{ error?: string; saved?: boolean }> {
  const access = await requireListingAccess(listingId)
  if ('error' in access) return { error: access.error }

  // Normalise server-side. The client is never the validator: every slot
  // computation downstream assumes windows are sorted, non-overlapping and
  // capped, and this is the only place that guarantees it.
  const normalized = normalizeAppointmentSettings(settings)
  if (!normalized) return { error: 'Those settings could not be read. Please try again.' }

  const adminClient = createAdminClient()
  if (!adminClient) return { error: 'Server configuration error.' }

  const { error } = await adminClient
    .from('listings')
    .update({
      appointment_settings: normalized,
      updated_at: new Date().toISOString(),
    })
    .eq('id', listingId)

  if (error) return { error: error.message }

  revalidateAppointmentsCache(listingId)
  return { saved: true }
}
```

This action deliberately does **not** touch `appointments_enabled` or `appointment_booking_fee`. Both stay admin-only.

- [ ] **Step 5: Typecheck and lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: typecheck clean (exit 0). Lint at 61 problems / 34 errors.

If lint reports a new unused-import error in `appointment-overrides.ts`, Step 2's cleanup was incomplete — remove the import rather than suppressing it.

- [ ] **Step 6: Run the suite**

Run: `npm run test:existing`
Expected: 92 passing. No test targets these files (both are I/O-bound), but the run confirms nothing else broke.

- [ ] **Step 7: Commit**

```bash
git add src/lib/appointment-access.ts src/app/actions/appointment-settings.ts src/app/actions/appointment-overrides.ts
git commit -m "feat(appointments): shared listing access check and a settings save action"
```

---

### Task 2: `AvailabilityTab` component

Lift the settings editor out of the listing form into a standalone tab that owns its draft state and saves itself.

**Files:**
- Create: `src/app/my-business/appointments/AvailabilityTab.tsx`
- Reference (read, do not modify): `src/app/my-business/edit/[id]/EditListingForm.tsx:578-787` — the JSX being moved, and `:252-303` — the five helpers

**Interfaces:**
- Consumes: `saveAppointmentSettings(listingId, settings)` (Task 1); `DEFAULT_APPOINTMENT_SETTINGS`, `MAX_WINDOWS_PER_DAY`, `normalizeAppointmentSettings`, `type AppointmentDayWindow`, `type AppointmentSettings`, `type AppointmentWeekday` from `@/lib/listing-content`.
- Produces: default export `AvailabilityTab` with props `{ listingId: string; listingName: string; rawSettings: unknown; onSaved: () => void }`. Task 3 mounts it and supplies `onSaved`.

- [ ] **Step 1: Create the component**

Create `src/app/my-business/appointments/AvailabilityTab.tsx`. The controls are moved verbatim from `EditListingForm`; only the surrounding shell, the state seeding and the save are new.

```tsx
'use client'

import { useEffect, useState, useTransition } from 'react'
import { Loader2, Save } from 'lucide-react'

import { saveAppointmentSettings } from '@/app/actions/appointment-settings'
import {
  DEFAULT_APPOINTMENT_SETTINGS,
  MAX_WINDOWS_PER_DAY,
  normalizeAppointmentSettings,
  type AppointmentDayWindow,
  type AppointmentSettings,
  type AppointmentWeekday,
} from '@/lib/listing-content'

const APPOINTMENT_DAYS: Array<{ key: AppointmentWeekday; label: string }> = [
  { key: 'mon', label: 'Monday' },
  { key: 'tue', label: 'Tuesday' },
  { key: 'wed', label: 'Wednesday' },
  { key: 'thu', label: 'Thursday' },
  { key: 'fri', label: 'Friday' },
  { key: 'sat', label: 'Saturday' },
  { key: 'sun', label: 'Sunday' },
]

function readSettings(raw: unknown): AppointmentSettings {
  let parsed: unknown = null
  try {
    if (raw && typeof raw === 'object') parsed = raw
    else if (typeof raw === 'string') parsed = JSON.parse(raw)
  } catch {
    parsed = null
  }
  return normalizeAppointmentSettings(parsed) ?? DEFAULT_APPOINTMENT_SETTINGS
}

type Props = {
  listingId: string
  listingName: string
  rawSettings: unknown
  /**
   * Called after a successful save so the page can refresh its cached
   * listings. Without it the page still holds the pre-save settings, and
   * switching business away and back re-seeds this editor from stale values.
   */
  onSaved: () => void
}

export default function AvailabilityTab({
  listingId,
  listingName,
  rawSettings,
  onSaved,
}: Props) {
  const [settings, setSettings] = useState<AppointmentSettings>(() => readSettings(rawSettings))
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState('')
  const [savedAt, setSavedAt] = useState(0)

  // Re-seed when the owner switches business. Carrying one business's
  // half-finished hours across to another is how the wrong schedule gets saved.
  useEffect(() => {
    setSettings(readSettings(rawSettings))
    setError('')
    setSavedAt(0)
  }, [listingId, rawSettings])

  const setDayWindows = (day: AppointmentWeekday, windows: AppointmentDayWindow[]) => {
    setSettings((current) => ({
      ...current,
      availability: { ...current.availability, [day]: windows },
    }))
  }

  const toggleDay = (day: AppointmentWeekday, isOpen: boolean) => {
    setDayWindows(day, isOpen ? [{ start: '09:00', end: '18:00' }] : [])
  }

  const updateWindow = (
    day: AppointmentWeekday,
    index: number,
    field: 'start' | 'end',
    value: string,
  ) => {
    setSettings((current) => {
      const windows = current.availability[day].map((window, i) =>
        i === index ? { ...window, [field]: value } : window,
      )
      return { ...current, availability: { ...current.availability, [day]: windows } }
    })
  }

  const addWindow = (day: AppointmentWeekday) => {
    setSettings((current) => {
      const windows = current.availability[day]
      if (windows.length >= MAX_WINDOWS_PER_DAY) return current
      const last = windows[windows.length - 1]
      const nextStart = last ? last.end : '09:00'
      return {
        ...current,
        availability: {
          ...current.availability,
          [day]: [...windows, { start: nextStart, end: '21:00' }],
        },
      }
    })
  }

  const removeWindow = (day: AppointmentWeekday, index: number) => {
    setSettings((current) => ({
      ...current,
      availability: {
        ...current.availability,
        [day]: current.availability[day].filter((_, i) => i !== index),
      },
    }))
  }

  const save = () => {
    setError('')
    startTransition(async () => {
      const result = await saveAppointmentSettings(listingId, settings)
      if (result.error) {
        setError(result.error)
        return
      }
      setSavedAt(Date.now())
      onSaved()
    })
  }

  return (
    <div className="space-y-5 rounded-2xl border border-[#eee2d7] bg-white p-5">
      <div>
        <h2 className="text-base font-bold text-[#2d160b]">When can people book?</h2>
        <p className="mt-1 text-[12px] text-[#7b6254]">
          These are {listingName}&apos;s regular hours. Use the Schedule tab to close a
          specific date.
        </p>
      </div>

      {/* Slot duration */}
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 mb-3">Slot duration</p>
        <div className="grid grid-cols-3 gap-2.5">
          {[15, 30, 60].map((duration) => (
            <button
              key={duration}
              type="button"
              onClick={() => setSettings((c) => ({ ...c, slot_duration: duration }))}
              className={`rounded-xl border-2 py-4 text-center transition-all ${
                settings.slot_duration === duration
                  ? 'border-brand bg-surface-soft'
                  : 'border-gray-100 bg-gray-50 hover:border-brand/30'
              }`}
            >
              <div className={`text-2xl font-bold leading-none ${settings.slot_duration === duration ? 'text-brand' : 'text-gray-800'}`}>
                {duration}
              </div>
              <div className={`text-[11px] mt-1 ${settings.slot_duration === duration ? 'text-brand' : 'text-gray-400'}`}>
                min
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Capacity + Buffer */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-gray-100 bg-gray-50/50 p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 mb-4">Capacity / slot</p>
          <div className="flex items-center justify-between gap-1">
            <button
              type="button"
              aria-label="Decrease capacity"
              onClick={() => setSettings((c) => ({ ...c, capacity: Math.max(1, c.capacity - 1) }))}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 bg-white text-lg font-bold text-gray-600 transition-colors hover:border-brand hover:text-brand"
            >
              −
            </button>
            <span className="text-3xl font-bold text-gray-900">{settings.capacity}</span>
            <button
              type="button"
              aria-label="Increase capacity"
              onClick={() => setSettings((c) => ({ ...c, capacity: Math.min(20, c.capacity + 1) }))}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 bg-white text-lg font-bold text-gray-600 transition-colors hover:border-brand hover:text-brand"
            >
              +
            </button>
          </div>
          <p className="mt-2 text-center text-[10px] text-gray-400">max 20 people</p>
        </div>

        <div className="rounded-xl border border-gray-100 bg-gray-50/50 p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 mb-3">Buffer time</p>
          <div className="grid grid-cols-2 gap-1.5">
            {[0, 5, 10, 15].map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setSettings((c) => ({ ...c, buffer_minutes: m }))}
                className={`rounded-lg border py-1.5 text-[11px] font-medium transition-colors ${
                  settings.buffer_minutes === m
                    ? 'border-brand bg-surface-soft text-brand'
                    : 'border-gray-200 bg-white text-gray-500 hover:border-brand/40'
                }`}
              >
                {m === 0 ? 'None' : `${m} min`}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Advance booking window */}
      <div className="rounded-xl border border-gray-100 bg-gray-50/50 p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Advance booking window</p>
          <span className="text-base font-bold text-gray-900">{settings.advance_days} days</span>
        </div>
        <input
          type="range"
          min="1"
          max="90"
          step="1"
          aria-label="Advance booking window in days"
          value={settings.advance_days}
          onChange={(event) =>
            setSettings((c) => ({
              ...c,
              advance_days: Math.max(1, Math.min(90, Number(event.target.value))),
            }))
          }
          className="w-full accent-brand"
        />
        <div className="flex justify-between text-[10px] text-gray-400 mt-1">
          <span>1 day</span>
          <span>30 days</span>
          <span>90 days</span>
        </div>
      </div>

      {/* Minimum notice */}
      <div className="rounded-xl border border-gray-100 bg-gray-50/50 p-4">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 mb-1">Minimum notice</p>
        <p className="text-[11px] text-gray-400 mb-3">
          How soon before a slot someone can still book it.
        </p>
        <div className="grid grid-cols-4 gap-1.5">
          {[0, 60, 120, 240].map((minutes) => (
            <button
              key={minutes}
              type="button"
              onClick={() => setSettings((c) => ({ ...c, min_notice_minutes: minutes }))}
              className={`rounded-lg border py-1.5 text-[11px] font-medium transition-colors ${
                settings.min_notice_minutes === minutes
                  ? 'border-brand bg-surface-soft text-brand'
                  : 'border-gray-200 bg-white text-gray-500 hover:border-brand/40'
              }`}
            >
              {minutes === 0 ? 'None' : minutes === 60 ? '1 hour' : `${minutes / 60} hours`}
            </button>
          ))}
        </div>
      </div>

      {/* Weekly schedule */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Weekly schedule</p>
            <p className="text-[11px] text-gray-400 mt-0.5">
              Add a second slot for a lunch break — e.g. 9–1 and 4–7.
            </p>
          </div>
          <span className="text-[11px] text-gray-400">
            {APPOINTMENT_DAYS.filter(({ key }) => settings.availability[key].length > 0).length} days open
          </span>
        </div>
        <div className="space-y-2">
          {APPOINTMENT_DAYS.map(({ key, label }) => {
            const windows = settings.availability[key]
            const isOpen = windows.length > 0

            return (
              <div key={key} className="rounded-xl border border-gray-100 bg-white px-3 py-2.5">
                <div className="flex items-center gap-2">
                  <span className="w-7 shrink-0 text-xs font-semibold text-gray-700">{label.slice(0, 3)}</span>
                  <div className="flex-1" />
                  <button
                    type="button"
                    onClick={() => toggleDay(key, !isOpen)}
                    className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                      isOpen ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                    }`}
                  >
                    {isOpen ? 'Open' : 'Closed'}
                  </button>
                </div>

                {isOpen && (
                  <div className="mt-2 space-y-1.5">
                    {windows.map((window, index) => (
                      <div key={index} className="flex items-center gap-1.5">
                        <input
                          type="time"
                          aria-label={`${label} window ${index + 1} start`}
                          value={window.start}
                          onChange={(event) => updateWindow(key, index, 'start', event.target.value)}
                          className="flex-1 min-w-0 px-2 py-1.5 border border-gray-200 rounded-lg focus:outline-none focus:border-brand text-xs text-center bg-white"
                        />
                        <span className="shrink-0 text-gray-400 text-xs">–</span>
                        <input
                          type="time"
                          aria-label={`${label} window ${index + 1} end`}
                          value={window.end}
                          onChange={(event) => updateWindow(key, index, 'end', event.target.value)}
                          className="flex-1 min-w-0 px-2 py-1.5 border border-gray-200 rounded-lg focus:outline-none focus:border-brand text-xs text-center bg-white"
                        />
                        {windows.length > 1 && (
                          <button
                            type="button"
                            aria-label={`Remove ${label} window ${index + 1}`}
                            onClick={() => removeWindow(key, index)}
                            className="shrink-0 rounded-lg border border-gray-200 px-2 py-1.5 text-xs text-gray-400 hover:border-red-200 hover:text-red-500"
                          >
                            ×
                          </button>
                        )}
                      </div>
                    ))}
                    {windows.length < MAX_WINDOWS_PER_DAY && (
                      <button
                        type="button"
                        onClick={() => addWindow(key)}
                        className="text-[11px] font-semibold text-brand hover:underline"
                      >
                        + Add another time range
                      </button>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {error && <p className="text-xs font-semibold text-red-600">{error}</p>}

      <div className="flex items-center gap-3">
        <button
          type="button"
          disabled={isPending}
          onClick={save}
          className="flex items-center justify-center gap-1.5 rounded-xl bg-brand px-5 py-2.5 text-sm font-semibold text-white transition-colors disabled:opacity-60"
        >
          {isPending ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
          Save availability
        </button>
        {savedAt > 0 && !isPending && (
          <span className="text-xs font-semibold text-green-700">Saved</span>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Typecheck and lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: typecheck clean. Lint at 61 problems / 34 errors.

The component is not mounted yet — Task 3 does that. An unmounted component still typechecks, so this step genuinely gates the work.

- [ ] **Step 3: Commit**

```bash
git add src/app/my-business/appointments/AvailabilityTab.tsx
git commit -m "feat(appointments): standalone availability editor component"
```

---

### Task 3: Page-level business selector and the third tab

Hoist the business selector out of `ScheduleTab` to the page, add the Availability tab, and scope Bookings to the selected business.

**Files:**
- Modify: `src/app/my-business/appointments/page.tsx` — state, selector, tab strip, bookings filter, tab mounts
- Modify: `src/app/my-business/appointments/ScheduleTab.tsx` — take `listingId` / `listingName` as props, drop its own listings state, fetch, selector and guards

**Interfaces:**
- Consumes: `getMyAppointmentListings()` returning `{ id, name, appointment_settings }[]` (Task 1); `AvailabilityTab` with props `{ listingId, listingName, rawSettings, onSaved }` (Task 2).
- Produces: `ScheduleTab` now takes `{ listingId: string; listingName: string }`.

- [ ] **Step 1: Convert `ScheduleTab` to props**

In `src/app/my-business/appointments/ScheduleTab.tsx`:

Change the signature to:

```tsx
type Props = {
  listingId: string
  listingName: string
}

export default function ScheduleTab({ listingId, listingName }: Props) {
```

Then delete, in order:

- the four state declarations `listings`, `listingsLoading`, `listingsError`, `listingId`
- the first `useEffect` (the one calling `getMyAppointmentListings`)
- the `if (listingsLoading)`, `if (listingsError)` and `if (listings.length === 0)` early returns
- the `const selectedListing = ...` and `const listingName = ...` lines — `listingName` is now a prop
- the entire `{listings.length > 1 && ( ... )}` selector block at the top of the returned JSX

Keep everything else exactly as it is. The second `useEffect` still keys on `[listingId]` — it now reacts to the prop instead of local state, which is what makes switching business reload that business's overrides.

Finally remove `getMyAppointmentListings` and `type OwnerAppointmentListing` from the imports if nothing else in the file uses them, along with any now-unused `useState` import members. An unused import is a lint error.

- [ ] **Step 2: Add page state and the selector**

In `src/app/my-business/appointments/page.tsx`, add to the imports:

```tsx
import AvailabilityTab from './AvailabilityTab'
import {
  getMyAppointmentListings,
  type OwnerAppointmentListing,
} from '@/app/actions/appointment-overrides'
```

Change the tab state line to include the new tab:

```tsx
  const [tab, setTab] = useState<'bookings' | 'availability' | 'schedule'>('bookings')
```

and immediately after it add:

```tsx
  const [listings, setListings] = useState<OwnerAppointmentListing[]>([])
  const [listingsLoading, setListingsLoading] = useState(true)
  const [listingId, setListingId] = useState('')

  useEffect(() => {
    getMyAppointmentListings().then((result) => {
      setListings(result.listings)
      if (result.listings.length > 0) setListingId(result.listings[0].id)
      setListingsLoading(false)
    })
  }, [])

  const selectedListing = listings.find((listing) => listing.id === listingId) ?? null

  // Re-read after a save so the cached settings this page hands to the editor
  // do not go stale. Without it, switching business away and back would show
  // the owner their pre-save hours.
  const refreshListings = async () => {
    const result = await getMyAppointmentListings()
    setListings(result.listings)
  }
```

- [ ] **Step 3: Scope the bookings arrays to the selected business**

The page already holds every owned listing's appointments. Filter that array once, and let every existing derived value read from the filtered copy so the tiles cannot disagree with the list beneath them.

Immediately after the `applyPatch` definition, add:

```tsx
  // Scope every booking view to the selected business. When the owner has no
  // appointment-enabled listing there is nothing to scope by, so historical
  // bookings still show rather than silently vanishing.
  const scopedAppointments = useMemo(
    () => (listingId ? appointments.filter((a) => a.listing_id === listingId) : appointments),
    [appointments, listingId],
  )
```

Then change every `useMemo` that currently reads `appointments` — `todayAppointments`, `upcomingAppointments`, `nextAppointment`, `recentActivity`, `completedCount`, `cancelledCount`, `bookedValue` — to read `scopedAppointments` instead, updating each dependency array to match. Leave `applyPatch` reading `setAppointments` as it is: it patches the source array, and the filtered view recomputes from it.

- [ ] **Step 4: Render the selector and the three tabs**

Replace the existing tab-strip `<div className="flex gap-2">…</div>` block, and the two lines that follow it (`{tab === 'schedule' && <ScheduleTab />}` and its sibling fallback if present), with:

```tsx
      {listings.length > 1 && (
        <label className="block text-[11px] font-semibold uppercase tracking-wide text-gray-500">
          Business
          <select
            value={listingId}
            onChange={(event) => setListingId(event.target.value)}
            className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm font-normal normal-case tracking-normal text-gray-800"
          >
            {listings.map((listing) => (
              <option key={listing.id} value={listing.id}>
                {listing.name}
              </option>
            ))}
          </select>
        </label>
      )}

      <div className="flex gap-2">
        {(['bookings', 'availability', 'schedule'] as const).map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`rounded-full px-4 py-2 text-xs font-semibold transition-colors ${
              tab === id ? 'bg-brand text-white' : 'border border-[#e5d3c2] bg-white text-[#7b6254]'
            }`}
          >
            {id === 'bookings' ? 'Bookings' : id === 'availability' ? 'Availability' : 'Schedule'}
          </button>
        ))}
      </div>

      {tab !== 'bookings' && !listingsLoading && !selectedListing && (
        <p className="rounded-2xl border border-dashed border-[#e5d3c2] p-6 text-center text-xs text-[#9b7c69]">
          Appointments are not enabled for any of your businesses yet.
        </p>
      )}

      {tab === 'availability' && selectedListing && (
        <AvailabilityTab
          listingId={selectedListing.id}
          listingName={selectedListing.name}
          rawSettings={selectedListing.appointment_settings}
          onSaved={refreshListings}
        />
      )}

      {tab === 'schedule' && selectedListing && (
        <ScheduleTab listingId={selectedListing.id} listingName={selectedListing.name} />
      )}
```

Ensure `useMemo` and `useEffect` are both in the `react` import at the top of the file — the file already imports `useEffect`, `useMemo`, `useState` and `useTransition`, so no change should be needed, but confirm rather than assume.

- [ ] **Step 5: Typecheck, lint and build**

Run: `npx tsc --noEmit && npm run lint && npm run build`
Expected: typecheck clean; lint at 61 problems / 34 errors; build succeeds.

- [ ] **Step 6: Verify what can be verified without signing in**

The owner pages require Google OAuth and this repo has no dev bypass, so an unauthenticated check confirms only that the route compiles and renders its signed-out state. Start the dev server with the Browser pane's `preview_start` using the `dev` launch config, open `http://localhost:3000/my-business/appointments`, and report exactly what you observe — including if it redirects to sign-in. **Do not fabricate a result you did not see.** The signed-in round trip is the site owner's to perform.

- [ ] **Step 7: Commit**

```bash
git add src/app/my-business/appointments/page.tsx src/app/my-business/appointments/ScheduleTab.tsx
git commit -m "feat(appointments): page-level business selector and availability tab"
```

---

### Task 4: Remove the old editor path

Delete the Appointments tab from the listing form and the now-dead write path, leaving exactly one writer to `appointment_settings`.

**Files:**
- Modify: `src/app/my-business/edit/[id]/EditListingForm.tsx` — tab list, tab JSX, state, helpers, submit line, imports
- Modify: `src/app/actions/listings.ts` — `updateListing`'s `appointment_settings` handling

**Interfaces:**
- Consumes: nothing. This task only removes.
- Produces: nothing. After it, `saveAppointmentSettings` (Task 1) is the sole writer.

- [ ] **Step 1: Strip the tab out of `EditListingForm`**

In `src/app/my-business/edit/[id]/EditListingForm.tsx`, delete each of the following:

1. `'appointments'` from the `TabId` union on line 66, leaving
   `type TabId = 'basic' | 'contact' | 'services' | 'branding' | 'media' | 'extras'`
2. The `APPOINTMENT_DAYS` constant near line 71
3. `const appointmentsEnabled = listing.appointments_enabled === true` near line 94
4. The `initialAppointmentSettings` IIFE and the `appointmentSettings` state, around lines 210-223
5. The five helpers `setDayWindows`, `toggleAppointmentDay`, `updateAppointmentWindow`, `addAppointmentWindow`, `removeAppointmentWindow`, around lines 252-303
6. The `if (appointmentsEnabled) { fd.set('appointment_settings', …) }` block in `handleSubmit`, around lines 323-325
7. The spread entry in the `tabs` array, around lines 340-342:
   ```tsx
   ...(appointmentsEnabled
     ? [{ id: 'appointments' as const, label: 'Appointments', icon: <Calendar size={15} /> }]
     : []),
   ```
8. The entire tab body — the `<div className={activeTab === 'appointments' ? … : 'hidden'}>` element beginning at line 578 and everything through its closing `</div>`, immediately before the `activeTab === 'services'` div at line 788

- [ ] **Step 2: Remove the imports that deletion orphaned**

From the `@/lib/listing-content` import block (lines 19-27), remove `DEFAULT_APPOINTMENT_SETTINGS`, `MAX_WINDOWS_PER_DAY`, `normalizeAppointmentSettings`, `type AppointmentDayWindow`, `type AppointmentSettings` and `type AppointmentWeekday`, keeping `MAX_SERVICE_ITEMS`, which the services tab still uses.

From the `lucide-react` import on line 9, remove `Calendar` — the tab entry was its only consumer.

Verify with:

```bash
grep -n "Calendar\|AppointmentSettings\|AppointmentWeekday\|AppointmentDayWindow\|MAX_WINDOWS_PER_DAY\|DEFAULT_APPOINTMENT_SETTINGS\|normalizeAppointmentSettings\|appointmentsEnabled\|appointment_settings" "src/app/my-business/edit/[id]/EditListingForm.tsx"
```

Expected: no output. Any remaining hit is either a missed deletion or an import that will now fail lint.

- [ ] **Step 3: Remove the dead write path from `updateListing`**

In `src/app/actions/listings.ts`, delete each of:

1. The `appointment_settingsRaw` declaration, lines 292-294
2. `let appointment_settings = null` on line 306
3. The parse block at lines 315-317:
   ```ts
   if (appointment_settingsRaw !== null) {
     try { appointment_settings = JSON.parse(appointment_settingsRaw) } catch { /* ignore */ }
   }
   ```
4. The normalise assignment at lines 327-329
5. The `appointmentFields` const at lines 343-346 and the `...appointmentFields,` spread inside the `db.from('listings').update({ … })` call
6. The trailing invalidation at lines 368-370:
   ```ts
   if (appointment_settingsRaw !== null) {
     revalidateAppointmentsCache(id)
   }
   ```

Then remove `revalidateAppointmentsCache` from that file's imports **only if** nothing else in `listings.ts` calls it — check with `grep -n "revalidateAppointmentsCache" src/app/actions/listings.ts` after the deletions and remove the import when the only remaining hit is the import line itself. Do the same for `normalizeAppointmentSettings`.

This is the step that satisfies the "exactly one writer" constraint. `saveAppointmentSettings` now owns the column, and it carries the cache invalidation that used to live here.

- [ ] **Step 4: Confirm there is exactly one writer**

Run:

```bash
grep -rn "appointment_settings" src/app/actions/ src/app/my-business/
```

Expected: hits only in `src/app/actions/appointment-settings.ts` (the update), `src/app/actions/appointment-overrides.ts` (the `select` and the `OwnerAppointmentListing` type), and `src/app/my-business/appointments/AvailabilityTab.tsx` (the `rawSettings` prop). **No hit in `listings.ts` and none in `EditListingForm.tsx`.**

- [ ] **Step 5: Typecheck, lint, test and build**

Run: `npx tsc --noEmit && npm run lint && npm run test:existing && npm run build`
Expected: typecheck clean; lint at 61 problems / 34 errors; 92 tests passing; build succeeds.

- [ ] **Step 6: Confirm the listing editor still saves**

Deleting a tab from a shared form risks breaking the form. Start the dev server via the Browser pane if it is not already running and load `http://localhost:3000/my-business/edit/60d3c182-2655-44e0-96bf-92cfef168734`. It will redirect to sign-in — record that. The signed-in check belongs to the site owner; note in your report that the listing editor's own save path needs one real round trip before this ships, because this task edits `handleSubmit`.

- [ ] **Step 7: Commit**

```bash
git add "src/app/my-business/edit/[id]/EditListingForm.tsx" src/app/actions/listings.ts
git commit -m "refactor(appointments): remove the old availability editor and its write path"
```

---

## Post-implementation checks

Not tasks — what to confirm before this merges.

- [ ] `npx tsc --noEmit` clean, `npm run lint` at 61 problems / 34 errors, `npm run test:existing` 92 passing, `npm run build` succeeds.
- [ ] `grep -rn "appointment_settings" src/app/actions/` shows a write in `appointment-settings.ts` only.
- [ ] **The site owner performs one signed-in round trip**, which no agent can: open `/my-business/appointments`, change a weekly window on the test listing, click Save availability, reload the page and confirm it persisted, then confirm `appointments.ourdahanu.in` reflects the new hours (this exercises the `revalidateAppointmentsCache` call).
- [ ] **The site owner confirms the listing editor still saves**, since Task 4 edits its `handleSubmit`: open `/my-business/edit/<id>`, change the tagline, save, reload.
- [ ] The Appointments tab no longer appears in the listing editor, and Availability appears on the appointments page.
