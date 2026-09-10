# Appointments System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give appointment-based Dahanu businesses a discovery surface at `appointments.ourdahanu.in`, a rebuilt booking UI, and real availability control (multiple daily windows, date overrides, minimum notice).

**Architecture:** Keep the existing engine — Razorpay orders, signature verification, the `create_appointment_booking` RPC, cron reminders, notifications, cancellation, RLS — untouched. Replace the three surfaces the owner objected to: discovery (new subdomain), availability control (new settings shape + overrides table), and the booking widget (one component, three mount points). Pure logic lives in testable `src/lib/*.ts` modules; every UI reads from them.

**Tech Stack:** Next.js 16.2.1 App Router with Cache Components, React 19, Supabase (live production), Razorpay, `node:test` via `tsx --test`, Tailwind.

## Global Constraints

Copied from `docs/superpowers/specs/2026-09-09-appointments-system-design.md`. Every task's requirements implicitly include this section.

- **The database is live production.** Migrations are additive only — no `DROP`, `DELETE`, `TRUNCATE`, or `UPDATE` of existing rows. Apply via the Supabase MCP `apply_migration`, and commit an identical `.sql` copy under `supabase/`.
- **The booking fee is never refunded** — customer-cancelled, business-cancelled, or admin-cancelled. It must be labelled "non-refundable" wherever the amount is shown before payment.
- **The fee stays admin-controlled** per business via `updateAppointmentAdminSettings`. Business owners must not be able to change `appointments_enabled` or `appointment_booking_fee`.
- **Enabling a business stays admin-only.** No self-serve enable.
- **Bookings confirm instantly.** No pending/accept state; `status` starts at `'confirmed'`.
- **Do not touch the capacity path.** `create_appointment_booking` already serializes with `pg_advisory_xact_lock` and is correct. Do not add a `seat_index` column, and do not replace the RPC.
- **Do not rewrite the Razorpay or payment-recovery logic.** It handles money and is battle-tested. Task 9 moves it between files verbatim.
- **New test files must be added to the explicit list** in `package.json`'s `test:existing` script — the runner does not glob.
- **Times are `HH:MM` 24-hour strings**; dates are `YYYY-MM-DD`; the timezone is always `Asia/Kolkata`.
- **Per-business booking pages are `noindex`** with a canonical to the business's own subdomain. The directory index is indexable.
- Lint baseline on `main` is 61 problems / 34 errors. A task adds zero new ones.

---

### Task 1: Availability settings model

Widen `AppointmentSettings` so each weekday holds an array of windows, and add `min_notice_minutes`. The normaliser must accept both the old and new JSON shapes so no data migration is needed and stale rows keep working.

**Files:**
- Modify: `src/lib/listing-content.ts:10-40` (types + defaults), `src/lib/listing-content.ts:307-345` (`normalizeAppointmentSettings`)
- Create: `src/lib/appointment-settings.test.ts`
- Modify: `package.json` (add the test file to `test:existing`)

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces:
  - `type AppointmentDayWindow = { start: string; end: string }` (unchanged shape)
  - `type AppointmentSettings = { slot_duration: number; capacity: number; buffer_minutes: number; advance_days: number; min_notice_minutes: number; availability: Record<AppointmentWeekday, AppointmentDayWindow[]> }`
  - `MAX_WINDOWS_PER_DAY = 3`
  - `normalizeAppointmentSettings(value: unknown): AppointmentSettings | null` — unchanged signature, new return shape.
  - `DEFAULT_APPOINTMENT_SETTINGS` with every weekday `[]` and `min_notice_minutes: 0`.

- [ ] **Step 1: Write the failing tests**

Create `src/lib/appointment-settings.test.ts`:

```ts
import { test } from 'node:test'
import assert from 'node:assert/strict'

import {
  DEFAULT_APPOINTMENT_SETTINGS,
  MAX_WINDOWS_PER_DAY,
  normalizeAppointmentSettings,
} from './listing-content'

test('returns null for non-object input', () => {
  assert.equal(normalizeAppointmentSettings(null), null)
  assert.equal(normalizeAppointmentSettings('nope'), null)
})

test('reads the new array shape', () => {
  const out = normalizeAppointmentSettings({
    availability: { mon: [{ start: '09:00', end: '13:00' }, { start: '16:00', end: '19:00' }] },
  })
  assert.deepEqual(out?.availability.mon, [
    { start: '09:00', end: '13:00' },
    { start: '16:00', end: '19:00' },
  ])
  assert.deepEqual(out?.availability.tue, [])
})

test('upgrades the legacy single-window shape to a one-element array', () => {
  const out = normalizeAppointmentSettings({
    availability: { mon: { start: '09:00', end: '18:00' }, tue: null },
  })
  assert.deepEqual(out?.availability.mon, [{ start: '09:00', end: '18:00' }])
  assert.deepEqual(out?.availability.tue, [])
})

test('drops windows whose end is not after start', () => {
  const out = normalizeAppointmentSettings({
    availability: { mon: [{ start: '10:00', end: '10:00' }, { start: '12:00', end: '11:00' }] },
  })
  assert.deepEqual(out?.availability.mon, [])
})

test('drops malformed times', () => {
  const out = normalizeAppointmentSettings({
    availability: { mon: [{ start: '9am', end: '18:00' }, { start: '25:00', end: '26:00' }] },
  })
  assert.deepEqual(out?.availability.mon, [])
})

test('sorts windows by start time', () => {
  const out = normalizeAppointmentSettings({
    availability: { mon: [{ start: '16:00', end: '19:00' }, { start: '09:00', end: '13:00' }] },
  })
  assert.deepEqual(out?.availability.mon, [
    { start: '09:00', end: '13:00' },
    { start: '16:00', end: '19:00' },
  ])
})

test('drops a window that overlaps the one before it', () => {
  const out = normalizeAppointmentSettings({
    availability: { mon: [{ start: '09:00', end: '13:00' }, { start: '12:00', end: '15:00' }] },
  })
  assert.deepEqual(out?.availability.mon, [{ start: '09:00', end: '13:00' }])
})

test('caps windows per day', () => {
  const out = normalizeAppointmentSettings({
    availability: {
      mon: [
        { start: '07:00', end: '08:00' },
        { start: '09:00', end: '10:00' },
        { start: '11:00', end: '12:00' },
        { start: '13:00', end: '14:00' },
      ],
    },
  })
  assert.equal(out?.availability.mon.length, MAX_WINDOWS_PER_DAY)
})

test('defaults min_notice_minutes to 0 when absent', () => {
  const out = normalizeAppointmentSettings({ availability: {} })
  assert.equal(out?.min_notice_minutes, 0)
})

test('clamps min_notice_minutes into range', () => {
  assert.equal(normalizeAppointmentSettings({ min_notice_minutes: -5 })?.min_notice_minutes, 0)
  assert.equal(normalizeAppointmentSettings({ min_notice_minutes: 99999 })?.min_notice_minutes, 1440)
  assert.equal(normalizeAppointmentSettings({ min_notice_minutes: 120 })?.min_notice_minutes, 120)
})

test('keeps existing numeric clamps', () => {
  const out = normalizeAppointmentSettings({ slot_duration: 5, capacity: 999, advance_days: 0 })
  assert.equal(out?.slot_duration, 15)
  assert.equal(out?.capacity, 20)
  assert.equal(out?.advance_days, 1)
})

test('default settings have every day closed and no notice', () => {
  assert.equal(DEFAULT_APPOINTMENT_SETTINGS.min_notice_minutes, 0)
  for (const day of ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const) {
    assert.deepEqual(DEFAULT_APPOINTMENT_SETTINGS.availability[day], [])
  }
})
```

- [ ] **Step 2: Register the test file**

In `package.json`, append ` src/lib/appointment-settings.test.ts` to the end of the `test:existing` command string.

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npm run test:existing`
Expected: FAIL — `MAX_WINDOWS_PER_DAY` is not exported.

- [ ] **Step 4: Update the types and defaults**

In `src/lib/listing-content.ts`, replace the `AppointmentSettings` type and `DEFAULT_APPOINTMENT_SETTINGS` (lines 17-40) with:

```ts
export type AppointmentSettings = {
  slot_duration: number
  capacity: number
  buffer_minutes: number
  advance_days: number
  min_notice_minutes: number
  availability: Record<AppointmentWeekday, AppointmentDayWindow[]>
}

const APPOINTMENT_WEEKDAYS: AppointmentWeekday[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']

/** Morning / afternoon / evening is the realistic ceiling for a local clinic. */
export const MAX_WINDOWS_PER_DAY = 3

export const DEFAULT_APPOINTMENT_SETTINGS: AppointmentSettings = {
  slot_duration: 30,
  capacity: 1,
  buffer_minutes: 0,
  advance_days: 30,
  min_notice_minutes: 0,
  availability: {
    mon: [],
    tue: [],
    wed: [],
    thu: [],
    fri: [],
    sat: [],
    sun: [],
  },
}
```

Note the existing `const APPOINTMENT_WEEKDAYS` declaration at line 25 moves into this block — do not leave a duplicate.

- [ ] **Step 5: Rewrite the normaliser**

Replace `normalizeAppointmentSettings` (from `export function normalizeAppointmentSettings` to the end of that function) with:

```ts
/**
 * Accepts both the legacy single-window shape (`{start, end} | null`) and the
 * current array shape. Legacy rows upgrade to a one-element array, so this
 * needs no data migration and a stale row can never break rendering.
 *
 * Windows are sorted by start and any window overlapping its predecessor is
 * dropped, so downstream slot generation can assume disjoint, ordered windows.
 */
export function normalizeAppointmentSettings(value: unknown): AppointmentSettings | null {
  if (!value || typeof value !== 'object') return null

  const source = value as Record<string, unknown>
  const rawAvailability =
    source.availability && typeof source.availability === 'object'
      ? (source.availability as Record<string, unknown>)
      : {}

  const availability = APPOINTMENT_WEEKDAYS.reduce<Record<AppointmentWeekday, AppointmentDayWindow[]>>(
    (result, day) => {
      result[day] = normalizeDayWindows(rawAvailability[day])
      return result
    },
    {} as Record<AppointmentWeekday, AppointmentDayWindow[]>,
  )

  return {
    slot_duration: clampInteger(source.slot_duration, 15, 240, DEFAULT_APPOINTMENT_SETTINGS.slot_duration),
    capacity: clampInteger(source.capacity, 1, 20, DEFAULT_APPOINTMENT_SETTINGS.capacity),
    buffer_minutes: clampInteger(source.buffer_minutes, 0, 60, DEFAULT_APPOINTMENT_SETTINGS.buffer_minutes),
    advance_days: clampInteger(source.advance_days, 1, 90, DEFAULT_APPOINTMENT_SETTINGS.advance_days),
    min_notice_minutes: clampInteger(
      source.min_notice_minutes,
      0,
      1440,
      DEFAULT_APPOINTMENT_SETTINGS.min_notice_minutes,
    ),
    availability,
  }
}
```

- [ ] **Step 6: Add the window normaliser helper**

Immediately above `normalizeAppointmentSettings`, add:

```ts
/**
 * One weekday's windows, from either shape, cleaned into a sorted, disjoint,
 * capped array. Invalid entries are dropped rather than throwing — a bad row
 * should render as "closed", never as a crash.
 */
export function normalizeDayWindows(value: unknown): AppointmentDayWindow[] {
  if (!value) return []

  const entries = Array.isArray(value) ? value : [value]
  const parsed: AppointmentDayWindow[] = []

  for (const entry of entries) {
    if (!entry || typeof entry !== 'object') continue
    const record = entry as Record<string, unknown>
    const start = normalizeTimeString(record.start)
    const end = normalizeTimeString(record.end)
    if (!start || !end) continue
    if (timeStringToMinutes(end) <= timeStringToMinutes(start)) continue
    parsed.push({ start, end })
  }

  parsed.sort((a, b) => timeStringToMinutes(a.start) - timeStringToMinutes(b.start))

  const disjoint: AppointmentDayWindow[] = []
  for (const window of parsed) {
    const previous = disjoint[disjoint.length - 1]
    if (previous && timeStringToMinutes(window.start) < timeStringToMinutes(previous.end)) continue
    disjoint.push(window)
    if (disjoint.length === MAX_WINDOWS_PER_DAY) break
  }

  return disjoint
}
```

- [ ] **Step 7: Run the tests to verify they pass**

Run: `npm run test:existing`
Expected: PASS — all 11 new tests plus every pre-existing test.

- [ ] **Step 8: Typecheck**

Run: `npx tsc --noEmit`
Expected: errors in `src/lib/appointment-slots.ts`, `EditListingForm.tsx`, and `AppointmentBooking.tsx` — all consumers of the old shape. **This is expected**; Tasks 2, 7 and 9 fix them. Confirm no error is inside `src/lib/listing-content.ts` itself.

- [ ] **Step 9: Commit**

```bash
git add src/lib/listing-content.ts src/lib/appointment-settings.test.ts package.json
git commit -m "feat(appointments): multi-window availability and minimum notice in settings"
```

---

### Task 2: Slot generator

Rewrite `generateAvailableSlots` for multiple windows per day, date overrides, and minimum notice — and stop hiding unbookable slots.

**Files:**
- Modify: `src/lib/appointment-slots.ts` (whole file)
- Create: `src/lib/appointment-slots.test.ts`
- Modify: `package.json`

**Interfaces:**
- Consumes: `AppointmentSettings` (arrays + `min_notice_minutes`) and `AppointmentDayWindow` from Task 1.
- Produces:
  - `type AppointmentSlot = { start: string; end: string; available: boolean; remaining: number; reason: 'open' | 'full' | 'too_soon' }`
  - `type AppointmentDateOverride = { override_date: string; closed: boolean; windows: AppointmentDayWindow[] | null }`
  - `generateAvailableSlots(settings: AppointmentSettings | null, bookingDate: string, bookingCounts: Record<string, number>, override?: AppointmentDateOverride | null): AppointmentSlot[]`
  - `resolveWindowsForDate(settings: AppointmentSettings, bookingDate: string, override?: AppointmentDateOverride | null): AppointmentDayWindow[]`
  - `getWeekdayForDate(bookingDate: string): AppointmentWeekday`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/appointment-slots.test.ts`:

```ts
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { generateAvailableSlots, resolveWindowsForDate } from './appointment-slots'
import { DEFAULT_APPOINTMENT_SETTINGS, type AppointmentSettings } from './listing-content'

// 2026-09-14 is a Monday. Every test uses a date far in the future so the
// "today" branch (minimum notice) never fires unless a test opts into it.
const MONDAY = '2026-09-14'
const TUESDAY = '2026-09-15'

function settings(over: Partial<AppointmentSettings> = {}): AppointmentSettings {
  return {
    ...DEFAULT_APPOINTMENT_SETTINGS,
    availability: {
      ...DEFAULT_APPOINTMENT_SETTINGS.availability,
      mon: [{ start: '09:00', end: '11:00' }],
    },
    ...over,
  }
}

test('returns nothing when settings are null', () => {
  assert.deepEqual(generateAvailableSlots(null, MONDAY, {}), [])
})

test('returns nothing on a day with no windows', () => {
  assert.deepEqual(generateAvailableSlots(settings(), TUESDAY, {}), [])
})

test('generates slots across one window', () => {
  const slots = generateAvailableSlots(settings({ slot_duration: 60 }), MONDAY, {})
  assert.deepEqual(slots.map((s) => s.start), ['09:00', '10:00'])
  assert.deepEqual(slots.map((s) => s.end), ['10:00', '11:00'])
})

test('generates slots across two windows in order', () => {
  const config = settings({
    slot_duration: 60,
    availability: {
      ...DEFAULT_APPOINTMENT_SETTINGS.availability,
      mon: [{ start: '09:00', end: '11:00' }, { start: '16:00', end: '18:00' }],
    },
  })
  const slots = generateAvailableSlots(config, MONDAY, {})
  assert.deepEqual(slots.map((s) => s.start), ['09:00', '10:00', '16:00', '17:00'])
})

test('never emits a slot that would run past its window end', () => {
  const config = settings({
    slot_duration: 45,
    availability: {
      ...DEFAULT_APPOINTMENT_SETTINGS.availability,
      mon: [{ start: '09:00', end: '10:00' }],
    },
  })
  assert.deepEqual(generateAvailableSlots(config, MONDAY, {}).map((s) => s.start), ['09:00'])
})

test('adds buffer between slots but not to slot length', () => {
  const config = settings({ slot_duration: 30, buffer_minutes: 15 })
  const slots = generateAvailableSlots(config, MONDAY, {})
  assert.deepEqual(slots.map((s) => s.start), ['09:00', '09:45', '10:30'])
  assert.equal(slots[0].end, '09:30')
})

test('marks a full slot unavailable but still returns it', () => {
  const config = settings({ slot_duration: 60, capacity: 1 })
  const slots = generateAvailableSlots(config, MONDAY, { '09:00': 1 })
  assert.equal(slots[0].available, false)
  assert.equal(slots[0].reason, 'full')
  assert.equal(slots[0].remaining, 0)
  assert.equal(slots[1].available, true)
  assert.equal(slots[1].reason, 'open')
})

test('reports remaining seats for multi-capacity slots', () => {
  const config = settings({ slot_duration: 60, capacity: 3 })
  const slots = generateAvailableSlots(config, MONDAY, { '09:00': 2 })
  assert.equal(slots[0].remaining, 1)
  assert.equal(slots[0].available, true)
})

test('never reports negative remaining', () => {
  const config = settings({ slot_duration: 60, capacity: 1 })
  const slots = generateAvailableSlots(config, MONDAY, { '09:00': 5 })
  assert.equal(slots[0].remaining, 0)
})

test('a closed override yields no slots', () => {
  const slots = generateAvailableSlots(settings({ slot_duration: 60 }), MONDAY, {}, {
    override_date: MONDAY,
    closed: true,
    windows: null,
  })
  assert.deepEqual(slots, [])
})

test('an open override replaces the weekday windows entirely', () => {
  const slots = generateAvailableSlots(settings({ slot_duration: 60 }), MONDAY, {}, {
    override_date: MONDAY,
    closed: false,
    windows: [{ start: '14:00', end: '16:00' }],
  })
  assert.deepEqual(slots.map((s) => s.start), ['14:00', '15:00'])
})

test('an open override with no windows yields no slots', () => {
  const slots = generateAvailableSlots(settings({ slot_duration: 60 }), MONDAY, {}, {
    override_date: MONDAY,
    closed: false,
    windows: null,
  })
  assert.deepEqual(slots, [])
})

test('an override can open a normally closed day', () => {
  const slots = generateAvailableSlots(settings({ slot_duration: 60 }), TUESDAY, {}, {
    override_date: TUESDAY,
    closed: false,
    windows: [{ start: '10:00', end: '12:00' }],
  })
  assert.deepEqual(slots.map((s) => s.start), ['10:00', '11:00'])
})

test('resolveWindowsForDate prefers the override over the weekday', () => {
  const config = settings()
  assert.deepEqual(resolveWindowsForDate(config, MONDAY), [{ start: '09:00', end: '11:00' }])
  assert.deepEqual(
    resolveWindowsForDate(config, MONDAY, { override_date: MONDAY, closed: true, windows: null }),
    [],
  )
})
```

- [ ] **Step 2: Register the test file**

Append ` src/lib/appointment-slots.test.ts` to `test:existing` in `package.json`.

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npm run test:existing`
Expected: FAIL — `resolveWindowsForDate` is not exported.

- [ ] **Step 4: Rewrite the generator**

Replace the whole contents of `src/lib/appointment-slots.ts` with:

```ts
import {
  type AppointmentDayWindow,
  type AppointmentSettings,
  type AppointmentWeekday,
} from '@/lib/listing-content'

/**
 * Why a slot cannot be booked. `full` and `too_soon` slots are still returned
 * so the UI can show them greyed with a reason — a sparse grid and a busy
 * clinic looked identical when unbookable slots were simply omitted.
 */
export type AppointmentSlotReason = 'open' | 'full' | 'too_soon'

export type AppointmentSlot = {
  start: string
  end: string
  available: boolean
  remaining: number
  reason: AppointmentSlotReason
}

export type AppointmentDateOverride = {
  override_date: string
  closed: boolean
  windows: AppointmentDayWindow[] | null
}

const INDIA_TIME_ZONE = 'Asia/Kolkata'
const WEEKDAY_MAP: AppointmentWeekday[] = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']

function timeToMinutes(value: string): number {
  const [hours, minutes] = value.split(':').map((segment) => Number.parseInt(segment, 10))
  return hours * 60 + minutes
}

function minutesToTime(value: number): string {
  const hours = Math.floor(value / 60)
  const minutes = value % 60
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
}

function getIndiaTodayInfo() {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: INDIA_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })

  const parts = formatter.formatToParts(new Date())
  const lookup = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return {
    today: `${lookup.year}-${lookup.month}-${lookup.day}`,
    nowMinutes: Number.parseInt(lookup.hour, 10) * 60 + Number.parseInt(lookup.minute, 10),
  }
}

export function getWeekdayForDate(bookingDate: string): AppointmentWeekday {
  const dayIndex = new Date(`${bookingDate}T12:00:00+05:30`).getUTCDay()
  return WEEKDAY_MAP[dayIndex]
}

/**
 * The windows that actually apply to one date. An override replaces the
 * weekday's normal windows completely rather than merging with them — a
 * business closing for a festival means closed, not "closed plus whatever
 * Monday usually is".
 */
export function resolveWindowsForDate(
  settings: AppointmentSettings,
  bookingDate: string,
  override?: AppointmentDateOverride | null,
): AppointmentDayWindow[] {
  if (override && override.override_date === bookingDate) {
    if (override.closed) return []
    return override.windows ?? []
  }

  return settings.availability[getWeekdayForDate(bookingDate)] ?? []
}

export function generateAvailableSlots(
  settings: AppointmentSettings | null,
  bookingDate: string,
  bookingCounts: Record<string, number>,
  override?: AppointmentDateOverride | null,
): AppointmentSlot[] {
  if (!settings) return []

  const windows = resolveWindowsForDate(settings, bookingDate, override)
  if (windows.length === 0) return []

  const stepMinutes = settings.slot_duration + settings.buffer_minutes
  const { today, nowMinutes } = getIndiaTodayInfo()
  const isToday = bookingDate === today
  const earliestBookable = nowMinutes + settings.min_notice_minutes

  const slots: AppointmentSlot[] = []

  for (const window of windows) {
    const startMinutes = timeToMinutes(window.start)
    const endMinutes = timeToMinutes(window.end)

    for (
      let cursor = startMinutes;
      cursor + settings.slot_duration <= endMinutes;
      cursor += stepMinutes
    ) {
      // Slots already in the past are dropped entirely. Only slots between now
      // and the notice threshold are surfaced as "too soon" — listing every
      // past slot of the day would be noise, not information.
      if (isToday && cursor <= nowMinutes) continue

      const start = minutesToTime(cursor)
      const count = bookingCounts[start] ?? 0
      const remaining = Math.max(settings.capacity - count, 0)
      const tooSoon = isToday && cursor < earliestBookable

      const reason: AppointmentSlotReason =
        remaining <= 0 ? 'full' : tooSoon ? 'too_soon' : 'open'

      slots.push({
        start,
        end: minutesToTime(cursor + settings.slot_duration),
        available: reason === 'open',
        remaining,
        reason,
      })
    }
  }

  return slots
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npm run test:existing`
Expected: PASS — all 14 new tests.

- [ ] **Step 6: Commit**

```bash
git add src/lib/appointment-slots.ts src/lib/appointment-slots.test.ts package.json
git commit -m "feat(appointments): slot generator handles multiple windows, overrides and notice"
```

---

### Task 3: `appointment_date_overrides` migration

Create the table that stores per-date exceptions.

**Files:**
- Create: `supabase/add_appointment_date_overrides.sql`
- Modify: `src/lib/database.types.ts` (regenerate)

**Interfaces:**
- Produces: table `appointment_date_overrides` with columns `id, listing_id, override_date, closed, windows, note, created_at`.

- [ ] **Step 1: Write the migration file**

Create `supabase/add_appointment_date_overrides.sql`:

```sql
-- Per-date exceptions to a business's weekly appointment schedule.
-- Additive only: no existing table or row is touched.
CREATE TABLE IF NOT EXISTS appointment_date_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  override_date date NOT NULL,
  closed boolean NOT NULL DEFAULT true,
  -- When closed = false, the windows that replace the weekday's normal hours.
  -- Shape: [{"start":"HH:MM","end":"HH:MM"}, ...]
  windows jsonb,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT appointment_date_overrides_unique_day UNIQUE (listing_id, override_date)
);

CREATE INDEX IF NOT EXISTS idx_appt_overrides_listing_date
  ON appointment_date_overrides (listing_id, override_date);

ALTER TABLE appointment_date_overrides ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON appointment_date_overrides TO anon, authenticated;

-- Opening hours are public information, but only for listings that are live.
-- All writes go through server actions on the service-role client, so no
-- INSERT/UPDATE/DELETE policy exists by design.
DROP POLICY IF EXISTS "Anyone can read overrides for approved listings" ON appointment_date_overrides;

CREATE POLICY "Anyone can read overrides for approved listings" ON appointment_date_overrides
  FOR SELECT USING (
    EXISTS (
      SELECT 1
      FROM listings
      WHERE listings.id = appointment_date_overrides.listing_id
        AND listings.approved = true
    )
  );
```

- [ ] **Step 2: Apply the migration**

Apply the exact contents of that file through the Supabase MCP `apply_migration` tool with name `add_appointment_date_overrides`, project `slmbqngmxketyxjauxxk`.

- [ ] **Step 3: Verify the table exists and is empty**

Run this through the Supabase MCP `execute_sql` tool:

```sql
select count(*) as rows from appointment_date_overrides;
select indexname from pg_indexes where tablename = 'appointment_date_overrides';
```

Expected: `rows` is 0; indexes include `appointment_date_overrides_unique_day` and `idx_appt_overrides_listing_date`.

- [ ] **Step 4: Regenerate database types**

Use the Supabase MCP `generate_typescript_types` tool for project `slmbqngmxketyxjauxxk` and write the result to `src/lib/database.types.ts`.

**Then restore the file's original header comment if the generator dropped it** — check `git diff src/lib/database.types.ts` and confirm the only changes are the new table plus any header the generator omitted. If the diff shows unrelated churn, keep only the `appointment_date_overrides` addition.

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: the same pre-existing consumer errors from Task 1 (EditListingForm, AppointmentBooking) and nothing new from `database.types.ts`.

- [ ] **Step 6: Commit**

```bash
git add supabase/add_appointment_date_overrides.sql src/lib/database.types.ts
git commit -m "feat(appointments): add appointment_date_overrides table"
```

---

### Task 4: Override conflict detection

A pure function answering "which confirmed bookings would this override strand?" — used by the owner UI before an override is saved.

**Files:**
- Create: `src/lib/appointment-conflicts.ts`
- Create: `src/lib/appointment-conflicts.test.ts`
- Modify: `package.json`

**Interfaces:**
- Consumes: `AppointmentDayWindow` (Task 1).
- Produces:
  - `type ConflictCandidate = { id: string; slot_start: string; status: string }`
  - `findOverrideConflicts(appointments: ConflictCandidate[], override: { closed: boolean; windows: AppointmentDayWindow[] | null }): string[]` — returns the ids of confirmed appointments that would fall outside the new hours, in input order.

- [ ] **Step 1: Write the failing tests**

Create `src/lib/appointment-conflicts.test.ts`:

```ts
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { findOverrideConflicts, type ConflictCandidate } from './appointment-conflicts'

function appointment(over: Partial<ConflictCandidate> = {}): ConflictCandidate {
  return { id: 'a1', slot_start: '10:00', status: 'confirmed', ...over }
}

test('a closed override conflicts with every confirmed booking', () => {
  const ids = findOverrideConflicts(
    [appointment({ id: 'a1' }), appointment({ id: 'a2', slot_start: '15:00' })],
    { closed: true, windows: null },
  )
  assert.deepEqual(ids, ['a1', 'a2'])
})

test('ignores bookings that are already cancelled', () => {
  const ids = findOverrideConflicts(
    [appointment({ id: 'a1', status: 'cancelled' }), appointment({ id: 'a2' })],
    { closed: true, windows: null },
  )
  assert.deepEqual(ids, ['a2'])
})

test('ignores completed and no-show bookings', () => {
  const ids = findOverrideConflicts(
    [appointment({ id: 'a1', status: 'completed' }), appointment({ id: 'a2', status: 'no_show' })],
    { closed: true, windows: null },
  )
  assert.deepEqual(ids, [])
})

test('keeps bookings that still fall inside the new windows', () => {
  const ids = findOverrideConflicts([appointment({ slot_start: '10:00' })], {
    closed: false,
    windows: [{ start: '09:00', end: '12:00' }],
  })
  assert.deepEqual(ids, [])
})

test('flags bookings that fall outside the new windows', () => {
  const ids = findOverrideConflicts(
    [appointment({ id: 'a1', slot_start: '08:00' }), appointment({ id: 'a2', slot_start: '14:00' })],
    { closed: false, windows: [{ start: '09:00', end: '12:00' }] },
  )
  assert.deepEqual(ids, ['a1', 'a2'])
})

test('a booking exactly at a window end is outside it', () => {
  const ids = findOverrideConflicts([appointment({ slot_start: '12:00' })], {
    closed: false,
    windows: [{ start: '09:00', end: '12:00' }],
  })
  assert.deepEqual(ids, ['a1'])
})

test('a booking exactly at a window start is inside it', () => {
  const ids = findOverrideConflicts([appointment({ slot_start: '09:00' })], {
    closed: false,
    windows: [{ start: '09:00', end: '12:00' }],
  })
  assert.deepEqual(ids, [])
})

test('a booking inside any one of several windows is kept', () => {
  const ids = findOverrideConflicts([appointment({ slot_start: '17:00' })], {
    closed: false,
    windows: [{ start: '09:00', end: '12:00' }, { start: '16:00', end: '19:00' }],
  })
  assert.deepEqual(ids, [])
})

test('an open override with no windows conflicts with everything', () => {
  const ids = findOverrideConflicts([appointment()], { closed: false, windows: null })
  assert.deepEqual(ids, ['a1'])
})

test('tolerates seconds in slot_start as Postgres returns them', () => {
  const ids = findOverrideConflicts([appointment({ slot_start: '10:00:00' })], {
    closed: false,
    windows: [{ start: '09:00', end: '12:00' }],
  })
  assert.deepEqual(ids, [])
})
```

- [ ] **Step 2: Register the test file**

Append ` src/lib/appointment-conflicts.test.ts` to `test:existing` in `package.json`.

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npm run test:existing`
Expected: FAIL — module `./appointment-conflicts` not found.

- [ ] **Step 4: Write the implementation**

Create `src/lib/appointment-conflicts.ts`:

```ts
import type { AppointmentDayWindow } from '@/lib/listing-content'

export type ConflictCandidate = {
  id: string
  slot_start: string
  status: string
}

function toMinutes(value: string): number {
  const [hours, minutes] = value.slice(0, 5).split(':').map((part) => Number.parseInt(part, 10))
  return hours * 60 + minutes
}

/**
 * Which confirmed bookings a proposed date override would strand.
 *
 * The owner is shown these before the override saves and must decide what
 * happens to them. Nothing here resolves the conflict — either choice
 * (cancel the customers, or keep them and close only free slots) is wrong
 * some of the time, so a human makes it.
 */
export function findOverrideConflicts(
  appointments: ConflictCandidate[],
  override: { closed: boolean; windows: AppointmentDayWindow[] | null },
): string[] {
  const live = appointments.filter((appointment) => appointment.status === 'confirmed')
  if (override.closed) return live.map((appointment) => appointment.id)

  const windows = override.windows ?? []

  return live
    .filter((appointment) => {
      const startMinutes = toMinutes(appointment.slot_start)
      return !windows.some(
        (window) => startMinutes >= toMinutes(window.start) && startMinutes < toMinutes(window.end),
      )
    })
    .map((appointment) => appointment.id)
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npm run test:existing`
Expected: PASS — all 10 new tests.

- [ ] **Step 6: Commit**

```bash
git add src/lib/appointment-conflicts.ts src/lib/appointment-conflicts.test.ts package.json
git commit -m "feat(appointments): detect bookings stranded by a date override"
```

---

### Task 5: Override data layer and owner actions

Read overrides for slot generation, and let an owner add or remove them with explicit conflict handling.

**Files:**
- Create: `src/lib/data/appointment-overrides.ts`
- Create: `src/app/actions/appointment-overrides.ts`

**Interfaces:**
- Consumes: `AppointmentDateOverride` (Task 2), `findOverrideConflicts` (Task 4), `normalizeDayWindows` (Task 1), `revalidateAppointmentsCache` from `@/lib/cache-tags`, `cancelAppointment` is **not** reused — cancellation here writes directly, see Step 4.
- Produces:
  - `getOverridesForListing(listingId: string, fromDate: string, toDate: string): Promise<AppointmentDateOverride[]>`
  - `getOverrideMap(listingId, fromDate, toDate): Promise<Record<string, AppointmentDateOverride>>` keyed by `override_date`
  - `getOverridesForListings(listingIds: string[], fromDate, toDate): Promise<Record<string, Record<string, AppointmentDateOverride>>>` keyed by listing then date — used by the directory in Task 11
  - `listUpcomingOverrides(listingId: string, fromDate: string): Promise<AppointmentOverrideRecord[]>` where `AppointmentOverrideRecord = AppointmentDateOverride & { id: string; note: string | null }`
  - `getUpcomingOverrides(listingId: string): Promise<{ error?: string; overrides: AppointmentOverrideRecord[] }>` — the access-checked server action wrapper the UI calls
  - `saveAppointmentDateOverride(input: SaveOverrideInput): Promise<SaveOverrideResult>`
  - `deleteAppointmentDateOverride(overrideId: string): Promise<{ error?: string }>`
  - `type SaveOverrideInput = { listingId: string; overrideDate: string; closed: boolean; windows: AppointmentDayWindow[] | null; note: string | null; resolution?: 'cancel_conflicts' | 'keep_conflicts' }`
  - `type SaveOverrideResult = { error?: string; conflicts?: OverrideConflict[]; saved?: boolean }`
  - `type OverrideConflict = { id: string; slot_start: string; user_name: string }`

- [ ] **Step 1: Write the data layer**

Create `src/lib/data/appointment-overrides.ts`:

```ts
import 'server-only'

import type { AppointmentDateOverride } from '@/lib/appointment-slots'
import { normalizeDayWindows } from '@/lib/listing-content'
import { createAdminClient } from '@/lib/supabase/admin-client'
import { createPublicClient } from '@/lib/supabase/public'

export type AppointmentOverrideRecord = AppointmentDateOverride & {
  id: string
  note: string | null
}

type OverrideRow = {
  id: string
  listing_id: string
  override_date: string
  closed: boolean | null
  windows: unknown
  note: string | null
}

function getOverrideReader() {
  return createAdminClient() ?? createPublicClient()
}

function toRecord(row: OverrideRow): AppointmentOverrideRecord {
  const windows = normalizeDayWindows(row.windows)
  return {
    id: row.id,
    override_date: row.override_date,
    closed: row.closed !== false,
    windows: windows.length > 0 ? windows : null,
    note: row.note,
  }
}

/**
 * Overrides are read on every slot query, so this is deliberately NOT cached
 * with `use cache` — an owner closing tomorrow must take effect immediately,
 * and the row count per business is tiny.
 */
export async function getOverridesForListing(
  listingId: string,
  fromDate: string,
  toDate: string,
): Promise<AppointmentOverrideRecord[]> {
  try {
    const supabase = getOverrideReader()
    const { data } = await supabase
      .from('appointment_date_overrides')
      .select('id, listing_id, override_date, closed, windows, note')
      .eq('listing_id', listingId)
      .gte('override_date', fromDate)
      .lte('override_date', toDate)
      .order('override_date', { ascending: true })

    return ((data ?? []) as OverrideRow[]).map(toRecord)
  } catch {
    return []
  }
}

export async function getOverrideMap(
  listingId: string,
  fromDate: string,
  toDate: string,
): Promise<Record<string, AppointmentOverrideRecord>> {
  const rows = await getOverridesForListing(listingId, fromDate, toDate)
  const map: Record<string, AppointmentOverrideRecord> = Object.create(null)
  for (const row of rows) map[row.override_date] = row
  return map
}

/** One query for many listings — the directory scans every enabled business. */
export async function getOverridesForListings(
  listingIds: string[],
  fromDate: string,
  toDate: string,
): Promise<Record<string, Record<string, AppointmentOverrideRecord>>> {
  const byListing: Record<string, Record<string, AppointmentOverrideRecord>> = Object.create(null)
  if (listingIds.length === 0) return byListing

  try {
    const supabase = getOverrideReader()
    const { data } = await supabase
      .from('appointment_date_overrides')
      .select('id, listing_id, override_date, closed, windows, note')
      .in('listing_id', listingIds)
      .gte('override_date', fromDate)
      .lte('override_date', toDate)

    for (const row of (data ?? []) as OverrideRow[]) {
      const bucket = byListing[row.listing_id] ?? (byListing[row.listing_id] = Object.create(null))
      bucket[row.override_date] = toRecord(row)
    }
  } catch {
    // Fall through to an empty map — a failed override read must never make a
    // business look open when it is closed, but it also must not crash the
    // directory. Callers treat "no override" as "normal weekly hours".
  }

  return byListing
}

export async function listUpcomingOverrides(
  listingId: string,
  fromDate: string,
): Promise<AppointmentOverrideRecord[]> {
  return getOverridesForListing(listingId, fromDate, '2099-12-31')
}
```

- [ ] **Step 2: Write the owner actions**

Create `src/app/actions/appointment-overrides.ts`:

```ts
'use server'

import { getUserRole } from '@/app/actions/admin'
import { findOverrideConflicts } from '@/lib/appointment-conflicts'
import { revalidateAppointmentsCache } from '@/lib/cache-tags'
import {
  listUpcomingOverrides,
  type AppointmentOverrideRecord,
} from '@/lib/data/appointment-overrides'
import {
  normalizeDayWindows,
  normalizeInlineText,
  type AppointmentDayWindow,
} from '@/lib/listing-content'
import { createAdminClient } from '@/lib/supabase/admin-client'
import { createClient } from '@/lib/supabase/server'

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/

export type OverrideConflict = {
  id: string
  slot_start: string
  user_name: string
}

export type SaveOverrideInput = {
  listingId: string
  overrideDate: string
  closed: boolean
  windows: AppointmentDayWindow[] | null
  note: string | null
  resolution?: 'cancel_conflicts' | 'keep_conflicts'
}

export type SaveOverrideResult = {
  error?: string
  conflicts?: OverrideConflict[]
  saved?: boolean
}

function getIndiaToday(): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  const parts = formatter.formatToParts(new Date())
  const lookup = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return `${lookup.year}-${lookup.month}-${lookup.day}`
}

/**
 * Owner-or-admin access to one listing. Overrides change when customers can
 * book, so this is the same bar as editing the listing itself.
 */
async function requireListingAccess(listingId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Please sign in first.' as const }

  const { role } = await getUserRole(supabase)
  const isAdmin = role === 'admin' || role === 'moderator'

  const reader = createAdminClient() ?? supabase
  const { data: listing } = await reader
    .from('listings')
    .select('id, owner_id')
    .eq('id', listingId)
    .maybeSingle()

  if (!listing) return { error: 'Business not found.' as const }
  if (!isAdmin && listing.owner_id !== user.id) return { error: 'Access denied.' as const }

  return { userId: user.id }
}

export async function getUpcomingOverrides(
  listingId: string,
): Promise<{ error?: string; overrides: AppointmentOverrideRecord[] }> {
  const access = await requireListingAccess(listingId)
  if ('error' in access) return { error: access.error, overrides: [] }

  return { overrides: await listUpcomingOverrides(listingId, getIndiaToday()) }
}

export async function saveAppointmentDateOverride(
  input: SaveOverrideInput,
): Promise<SaveOverrideResult> {
  const access = await requireListingAccess(input.listingId)
  if ('error' in access) return { error: access.error }

  if (!DATE_REGEX.test(input.overrideDate)) {
    return { error: 'Please choose a valid date.' }
  }
  if (input.overrideDate < getIndiaToday()) {
    return { error: 'Choose today or a future date.' }
  }

  const windows = input.closed ? null : normalizeDayWindows(input.windows)
  if (!input.closed && (!windows || windows.length === 0)) {
    return { error: 'Add at least one time window, or mark the day closed.' }
  }

  const adminClient = createAdminClient()
  if (!adminClient) return { error: 'Server configuration error.' }

  const { data: existing } = await adminClient
    .from('appointments')
    .select('id, slot_start, status, user_name')
    .eq('listing_id', input.listingId)
    .eq('booking_date', input.overrideDate)

  const candidates = (existing ?? []) as Array<{
    id: string
    slot_start: string
    status: string
    user_name: string
  }>

  const conflictIds = findOverrideConflicts(candidates, {
    closed: input.closed,
    windows: windows ?? null,
  })

  // First call reports the conflicts and changes nothing. The owner decides,
  // then calls again with a resolution.
  if (conflictIds.length > 0 && !input.resolution) {
    const byId = new Map(candidates.map((row) => [row.id, row]))
    return {
      conflicts: conflictIds.map((id) => {
        const row = byId.get(id)
        return {
          id,
          slot_start: (row?.slot_start ?? '').slice(0, 5),
          user_name: row?.user_name ?? 'Customer',
        }
      }),
    }
  }

  const { error: upsertError } = await adminClient
    .from('appointment_date_overrides')
    .upsert(
      {
        listing_id: input.listingId,
        override_date: input.overrideDate,
        closed: input.closed,
        windows: windows,
        note: normalizeInlineText(input.note ?? '', 80),
      },
      { onConflict: 'listing_id,override_date' },
    )

  if (upsertError) return { error: upsertError.message }

  if (conflictIds.length > 0 && input.resolution === 'cancel_conflicts') {
    const { error: cancelError } = await adminClient
      .from('appointments')
      .update({
        status: 'cancelled',
        cancelled_by: 'owner',
        cancellation_reason: 'Business closed this date',
      })
      .in('id', conflictIds)

    if (cancelError) return { error: cancelError.message }
  }

  revalidateAppointmentsCache(input.listingId)
  return { saved: true }
}

export async function deleteAppointmentDateOverride(
  overrideId: string,
): Promise<{ error?: string }> {
  const adminClient = createAdminClient()
  if (!adminClient) return { error: 'Server configuration error.' }

  const { data: row } = await adminClient
    .from('appointment_date_overrides')
    .select('id, listing_id')
    .eq('id', overrideId)
    .maybeSingle()

  if (!row) return { error: 'That date is no longer in your schedule.' }

  const access = await requireListingAccess(row.listing_id as string)
  if ('error' in access) return { error: access.error }

  const { error } = await adminClient
    .from('appointment_date_overrides')
    .delete()
    .eq('id', overrideId)

  if (error) return { error: error.message }

  revalidateAppointmentsCache(row.listing_id as string)
  return {}
}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors in the two new files. The Task 1 consumer errors in `EditListingForm.tsx` / `AppointmentBooking.tsx` are still expected.

- [ ] **Step 4: Verify the cancellation path is deliberate**

Confirm by reading that `saveAppointmentDateOverride` writes `status: 'cancelled'` directly rather than calling `cancelAppointment`. This is intentional: `cancelAppointment` re-checks per-appointment permissions and only handles one id, while this is a bulk owner-initiated close. Customers are notified in Task 8, where the UI knows the business name.

- [ ] **Step 5: Commit**

```bash
git add src/lib/data/appointment-overrides.ts src/app/actions/appointment-overrides.ts
git commit -m "feat(appointments): read date overrides and let owners manage them"
```

---

### Task 6: Wire overrides and notice into the booking paths

Make every server-side slot computation override-aware so the pre-check, the payment route, and the RPC all agree.

**Files:**
- Modify: `src/lib/data/appointments.ts` (add `getSlotsForDate`)
- Modify: `src/app/actions/appointments.ts:115-137` (`resolveLiveSlots`), `:167-191` (`getAvailableSlotsForDate`), `:394-410` (`cancelAppointment` notice window)
- Modify: `src/app/api/razorpay/create-appointment-order/route.ts:80-90`

**Interfaces:**
- Consumes: `generateAvailableSlots(settings, date, counts, override)` (Task 2), `getOverrideMap` (Task 5).
- Produces: `getSlotsForDate(listingId: string, settings: AppointmentSettings, bookingDate: string): Promise<AppointmentSlot[]>` exported from `src/lib/data/appointments.ts` — the single place that combines counts + overrides + generation.

- [ ] **Step 1: Add the shared slot resolver**

In `src/lib/data/appointments.ts`, add these imports at the top alongside the existing ones:

```ts
import { generateAvailableSlots, type AppointmentSlot } from '@/lib/appointment-slots'
import { getOverrideMap } from '@/lib/data/appointment-overrides'
```

Then append this function to the end of the file:

```ts
/**
 * The one place that turns settings + a date into slots. Every caller — the
 * booking pre-check, the Razorpay order route, and the directory — goes
 * through here so they cannot disagree about whether a slot exists.
 */
export async function getSlotsForDate(
  listingId: string,
  settings: AppointmentSettings,
  bookingDate: string,
): Promise<AppointmentSlot[]> {
  const [counts, overrides] = await Promise.all([
    getAppointmentCountsForDate(listingId, bookingDate),
    getOverrideMap(listingId, bookingDate, bookingDate),
  ])

  return generateAvailableSlots(settings, bookingDate, counts, overrides[bookingDate] ?? null)
}
```

- [ ] **Step 2: Use it in `resolveLiveSlots`**

In `src/app/actions/appointments.ts`, replace the last three lines of `resolveLiveSlots` (the `const counts = ...` / `const slots = ...` / `return` block) with:

```ts
  const slots = await getSlotsForDate(listingId, config.appointment_settings, bookingDate)
  return { config, slots }
```

Update that file's import from `@/lib/data/appointments` to include `getSlotsForDate`, and remove `getAppointmentCountsForDate` from it if nothing else in the file uses it. Remove the now-unused `generateAvailableSlots` import if it has no other caller in the file.

- [ ] **Step 3: Use it in `getAvailableSlotsForDate`**

Replace the last block of `getAvailableSlotsForDate` (the `const counts = ...` through the closing `}`) with:

```ts
  return {
    slots: await getSlotsForDate(listingId, settings.appointment_settings, normalizedDate),
  }
```

- [ ] **Step 4: Use it in the Razorpay order route**

In `src/app/api/razorpay/create-appointment-order/route.ts`, replace these two lines:

```ts
  const counts = await getAppointmentCountsForDate(listingId, bookingDate)
  const slots = generateAvailableSlots(config.appointment_settings, bookingDate, counts)
```

with:

```ts
  const slots = await getSlotsForDate(listingId, config.appointment_settings, bookingDate)
```

Then change the import block so it reads:

```ts
import {
  getLiveAppointmentBookingConfig,
  getSlotsForDate,
} from '@/lib/data/appointments'
```

and delete the now-unused `import { generateAvailableSlots } from '@/lib/appointment-slots'` line.

- [ ] **Step 5: Enforce the customer cancellation window**

The spec allows a customer to cancel only up to the business's minimum-notice
threshold; after that they must phone. Owners and admins keep cancelling at any
time.

In `src/app/actions/appointments.ts`, inside `cancelAppointment`, immediately
after the `if (appointment.status !== 'confirmed')` guard, insert:

```ts
  // Customers lose the ability to cancel once the notice window closes.
  // Cancelling five minutes before is functionally a no-show, and the business
  // finds out from an empty chair rather than from the app. Owners and admins
  // are deliberately exempt.
  if (!isAdmin && !isOwner) {
    const settings = await getCachedAppointmentSettings(appointment.listing_id)
    const noticeMinutes = settings?.appointment_settings?.min_notice_minutes ?? 0
    const slotTime = getAppointmentInstant(
      appointment.booking_date,
      appointment.slot_start.slice(0, 5),
    ).getTime()

    if (slotTime - Date.now() < noticeMinutes * 60_000) {
      return {
        error: 'It is too late to cancel online. Please phone the business directly.',
      }
    }
  }
```

`getCachedAppointmentSettings` is already imported in this file, and
`getAppointmentInstant` and the `isAdmin` / `isOwner` booleans are already
defined above this point in `cancelAppointment`.

Note this is a no-op for every business until an owner sets a non-zero notice,
because `min_notice_minutes` defaults to `0` (Task 1).

- [ ] **Step 6: Typecheck and lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: typecheck shows only the Task 1 UI-consumer errors (`EditListingForm.tsx`, `AppointmentBooking.tsx`). Lint shows no new problems versus the 61-problem baseline.

- [ ] **Step 7: Commit**

```bash
git add src/lib/data/appointments.ts src/app/actions/appointments.ts src/app/api/razorpay/create-appointment-order/route.ts
git commit -m "feat(appointments): override-aware slot resolver and a customer cancellation window"
```

---

### Task 7: Weekly schedule editor with multiple windows

Update the owner's Appointments tab for arrays of windows and add the minimum-notice control.

**Files:**
- Modify: `src/app/my-business/edit/[id]/EditListingForm.tsx` — helpers near `:252-290`, schedule UI near `:660-710`, plus a new notice control after the advance-booking slider

**Interfaces:**
- Consumes: `AppointmentSettings` with `availability: Record<AppointmentWeekday, AppointmentDayWindow[]>` and `MAX_WINDOWS_PER_DAY` (Task 1).
- Produces: nothing other tasks consume.

- [ ] **Step 1: Replace the day helpers**

In `EditListingForm.tsx`, replace `toggleAppointmentDay` and `updateAppointmentDay` with these four helpers:

```ts
  const setDayWindows = (day: AppointmentWeekday, windows: AppointmentDayWindow[]) => {
    setAppointmentSettings((current) => ({
      ...current,
      availability: { ...current.availability, [day]: windows },
    }))
  }

  const toggleAppointmentDay = (day: AppointmentWeekday, isOpen: boolean) => {
    setDayWindows(day, isOpen ? [{ start: '09:00', end: '18:00' }] : [])
  }

  const updateAppointmentWindow = (
    day: AppointmentWeekday,
    index: number,
    field: 'start' | 'end',
    value: string,
  ) => {
    setAppointmentSettings((current) => {
      const windows = current.availability[day].map((window, i) =>
        i === index ? { ...window, [field]: value } : window,
      )
      return { ...current, availability: { ...current.availability, [day]: windows } }
    })
  }

  const addAppointmentWindow = (day: AppointmentWeekday) => {
    setAppointmentSettings((current) => {
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

  const removeAppointmentWindow = (day: AppointmentWeekday, index: number) => {
    setAppointmentSettings((current) => ({
      ...current,
      availability: {
        ...current.availability,
        [day]: current.availability[day].filter((_, i) => i !== index),
      },
    }))
  }
```

- [ ] **Step 2: Update the imports**

In the import from `@/lib/listing-content`, add `MAX_WINDOWS_PER_DAY` and `type AppointmentDayWindow` alongside the existing `AppointmentSettings` / `AppointmentWeekday` / `DEFAULT_APPOINTMENT_SETTINGS` / `normalizeAppointmentSettings` entries.

- [ ] **Step 3: Replace the weekly-schedule block**

Replace the whole `{/* Weekly schedule */}` div (from `<div>` containing "Weekly schedule" through its closing `</div>`) with:

```tsx
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
                  {APPOINTMENT_DAYS.filter(({ key }) => appointmentSettings.availability[key].length > 0).length} days open
                </span>
              </div>
              <div className="space-y-2">
                {APPOINTMENT_DAYS.map(({ key, label }) => {
                  const windows = appointmentSettings.availability[key]
                  const isOpen = windows.length > 0

                  return (
                    <div key={key} className="rounded-xl border border-gray-100 bg-white px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <span className="w-7 shrink-0 text-xs font-semibold text-gray-700">{label.slice(0, 3)}</span>
                        <div className="flex-1" />
                        <button
                          type="button"
                          onClick={() => toggleAppointmentDay(key, !isOpen)}
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
                                onChange={(event) => updateAppointmentWindow(key, index, 'start', event.target.value)}
                                className="flex-1 min-w-0 px-2 py-1.5 border border-gray-200 rounded-lg focus:outline-none focus:border-brand text-xs text-center bg-white"
                              />
                              <span className="shrink-0 text-gray-400 text-xs">–</span>
                              <input
                                type="time"
                                aria-label={`${label} window ${index + 1} end`}
                                value={window.end}
                                onChange={(event) => updateAppointmentWindow(key, index, 'end', event.target.value)}
                                className="flex-1 min-w-0 px-2 py-1.5 border border-gray-200 rounded-lg focus:outline-none focus:border-brand text-xs text-center bg-white"
                              />
                              {windows.length > 1 && (
                                <button
                                  type="button"
                                  aria-label={`Remove ${label} window ${index + 1}`}
                                  onClick={() => removeAppointmentWindow(key, index)}
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
                              onClick={() => addAppointmentWindow(key)}
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
```

- [ ] **Step 4: Add the minimum-notice control**

Immediately after the closing `</div>` of the "Advance booking window" block, insert:

```tsx
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
                    onClick={() => setAppointmentSettings((c) => ({ ...c, min_notice_minutes: minutes }))}
                    className={`rounded-lg border py-1.5 text-[11px] font-medium transition-colors ${
                      appointmentSettings.min_notice_minutes === minutes
                        ? 'border-brand bg-surface-soft text-brand'
                        : 'border-gray-200 bg-white text-gray-500 hover:border-brand/40'
                    }`}
                  >
                    {minutes === 0 ? 'None' : minutes === 60 ? '1 hour' : `${minutes / 60} hours`}
                  </button>
                ))}
              </div>
            </div>
```

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: `EditListingForm.tsx` is now clean. `AppointmentBooking.tsx` errors remain (Task 9).

- [ ] **Step 6: Verify in the browser**

Start the preview with the `dev` launch config, sign in as the owner of the test listing, open `/my-business/edit/60d3c182-2655-44e0-96bf-92cfef168734`, and open the Appointments tab.

Confirm: Monday shows one time range; "+ Add another time range" adds a second; the × removes it; the add link disappears at three ranges; Minimum notice selects.

Save the form, then verify persistence:

```sql
select appointment_settings from listings where id = '60d3c182-2655-44e0-96bf-92cfef168734';
```

Expected: `availability.mon` is an array of objects, and `min_notice_minutes` is present.

- [ ] **Step 7: Commit**

```bash
git add src/app/my-business/edit/\[id\]/EditListingForm.tsx
git commit -m "feat(appointments): let owners set multiple daily windows and minimum notice"
```

---

### Task 8: Owner Schedule tab for date overrides

Give owners a list of upcoming closures with an add form and explicit conflict resolution.

**Files:**
- Create: `src/app/my-business/appointments/ScheduleTab.tsx`
- Modify: `src/app/my-business/appointments/page.tsx` (add tab switching, mount the new component)

**Interfaces:**
- Consumes: `getUpcomingOverrides`, `saveAppointmentDateOverride`, `deleteAppointmentDateOverride`, `type OverrideConflict` (Task 5); `getMyBusinessAppointments` (existing) for the listing picker.
- Produces: nothing other tasks consume.

- [ ] **Step 1: Create the Schedule tab component**

Create `src/app/my-business/appointments/ScheduleTab.tsx`:

```tsx
'use client'

import { useEffect, useState, useTransition } from 'react'
import { CalendarOff, Loader2, Plus, Trash2 } from 'lucide-react'

import {
  deleteAppointmentDateOverride,
  getUpcomingOverrides,
  saveAppointmentDateOverride,
  type OverrideConflict,
} from '@/app/actions/appointment-overrides'
import type { AppointmentOverrideRecord } from '@/lib/data/appointment-overrides'

type Props = {
  listingId: string
  listingName: string
}

function formatOverrideDate(value: string): string {
  return new Date(`${value}T12:00:00+05:30`).toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export default function ScheduleTab({ listingId, listingName }: Props) {
  const [overrides, setOverrides] = useState<AppointmentOverrideRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState('')

  const [date, setDate] = useState('')
  const [note, setNote] = useState('')
  const [closed, setClosed] = useState(true)
  const [start, setStart] = useState('10:00')
  const [end, setEnd] = useState('13:00')
  const [conflicts, setConflicts] = useState<OverrideConflict[] | null>(null)

  useEffect(() => {
    getUpcomingOverrides(listingId).then((result) => {
      if (result.error) setError(result.error)
      else setOverrides(result.overrides)
      setLoading(false)
    })
  }, [listingId])

  const reload = async () => {
    const result = await getUpcomingOverrides(listingId)
    if (!result.error) setOverrides(result.overrides)
  }

  const submit = (resolution?: 'cancel_conflicts' | 'keep_conflicts') => {
    if (!date) {
      setError('Pick a date first.')
      return
    }

    setError('')
    startTransition(async () => {
      const result = await saveAppointmentDateOverride({
        listingId,
        overrideDate: date,
        closed,
        windows: closed ? null : [{ start, end }],
        note: note.trim() || null,
        resolution,
      })

      if (result.error) {
        setError(result.error)
        return
      }

      if (result.conflicts && result.conflicts.length > 0) {
        setConflicts(result.conflicts)
        return
      }

      setConflicts(null)
      setDate('')
      setNote('')
      await reload()
    })
  }

  const remove = (overrideId: string) => {
    startTransition(async () => {
      const result = await deleteAppointmentDateOverride(overrideId)
      if (result.error) {
        setError(result.error)
        return
      }
      await reload()
    })
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-[#eee2d7] bg-white p-5">
        <h2 className="text-base font-bold text-[#2d160b]">Closed days &amp; special hours</h2>
        <p className="mt-1 text-[12px] text-[#7b6254]">
          Overrides your weekly schedule for one date. {listingName} stays open normally on every
          other day.
        </p>

        <div className="mt-4 space-y-3">
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
              Date
              <input
                type="date"
                value={date}
                onChange={(event) => setDate(event.target.value)}
                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm font-normal normal-case tracking-normal text-gray-800"
              />
            </label>
            <label className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
              Reason (optional)
              <input
                type="text"
                value={note}
                maxLength={80}
                placeholder="Diwali"
                onChange={(event) => setNote(event.target.value)}
                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm font-normal normal-case tracking-normal text-gray-800"
              />
            </label>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setClosed(true)}
              className={`flex-1 rounded-lg border py-2 text-xs font-semibold ${closed ? 'border-brand bg-surface-soft text-brand' : 'border-gray-200 text-gray-500'}`}
            >
              Closed all day
            </button>
            <button
              type="button"
              onClick={() => setClosed(false)}
              className={`flex-1 rounded-lg border py-2 text-xs font-semibold ${!closed ? 'border-brand bg-surface-soft text-brand' : 'border-gray-200 text-gray-500'}`}
            >
              Different hours
            </button>
          </div>

          {!closed && (
            <div className="flex items-center gap-2">
              <input
                type="time"
                aria-label="Special hours start"
                value={start}
                onChange={(event) => setStart(event.target.value)}
                className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-center text-sm"
              />
              <span className="text-gray-400">–</span>
              <input
                type="time"
                aria-label="Special hours end"
                value={end}
                onChange={(event) => setEnd(event.target.value)}
                className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-center text-sm"
              />
            </div>
          )}

          {conflicts && conflicts.length > 0 && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
              <p className="text-xs font-bold text-amber-900">
                {conflicts.length} booking{conflicts.length === 1 ? '' : 's'} on this date fall
                outside the new hours
              </p>
              <ul className="mt-2 space-y-1">
                {conflicts.map((conflict) => (
                  <li key={conflict.id} className="text-[12px] text-amber-900">
                    {conflict.slot_start} · {conflict.user_name}
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-[11px] text-amber-800">
                Booking fees are not refunded. Please phone these customers either way.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => submit('cancel_conflicts')}
                  className="rounded-lg bg-amber-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-60"
                >
                  Cancel these bookings
                </button>
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => submit('keep_conflicts')}
                  className="rounded-lg border border-amber-300 px-3 py-2 text-xs font-semibold text-amber-900 disabled:opacity-60"
                >
                  Keep them, close the rest
                </button>
                <button
                  type="button"
                  onClick={() => setConflicts(null)}
                  className="rounded-lg px-3 py-2 text-xs font-semibold text-amber-800"
                >
                  Back
                </button>
              </div>
            </div>
          )}

          {error && <p className="text-xs font-semibold text-red-600">{error}</p>}

          {!conflicts && (
            <button
              type="button"
              disabled={isPending}
              onClick={() => submit()}
              className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-brand py-2.5 text-sm font-semibold text-white disabled:opacity-60"
            >
              {isPending ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
              Add to schedule
            </button>
          )}
        </div>
      </section>

      <section>
        <h3 className="mb-3 text-sm font-bold text-[#2d160b]">Upcoming changes</h3>
        {loading ? (
          <p className="text-xs text-[#9b7c69]">Loading…</p>
        ) : overrides.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[#e5d3c2] p-6 text-center">
            <CalendarOff size={20} className="mx-auto text-[#c9ab97]" aria-hidden />
            <p className="mt-2 text-xs text-[#9b7c69]">
              No closures planned. Your weekly schedule applies to every date.
            </p>
          </div>
        ) : (
          <ul className="space-y-2">
            {overrides.map((override) => (
              <li
                key={override.id}
                className="flex items-center gap-3 rounded-xl border border-[#eee2d7] bg-white px-4 py-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-bold text-[#2d160b]">
                    {formatOverrideDate(override.override_date)}
                  </p>
                  <p className="text-[12px] text-[#7b6254]">
                    {override.closed
                      ? 'Closed all day'
                      : (override.windows ?? [])
                          .map((window) => `${window.start}–${window.end}`)
                          .join(', ')}
                    {override.note ? ` · ${override.note}` : ''}
                  </p>
                </div>
                <button
                  type="button"
                  aria-label={`Remove ${formatOverrideDate(override.override_date)}`}
                  disabled={isPending}
                  onClick={() => remove(override.id)}
                  className="shrink-0 rounded-lg border border-gray-200 p-2 text-gray-400 hover:border-red-200 hover:text-red-500 disabled:opacity-60"
                >
                  <Trash2 size={13} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
```

- [ ] **Step 2: Add tab switching to the owner page**

In `src/app/my-business/appointments/page.tsx`:

Add to the imports:

```tsx
import ScheduleTab from './ScheduleTab'
```

Inside `MyBusinessAppointmentsPage`, after the existing `const [errorMessage, setErrorMessage] = useState('')` line, add:

```tsx
  const [tab, setTab] = useState<'bookings' | 'schedule'>('bookings')
```

Immediately after the closing `</section>` of the "Owner Inbox" header block, insert the tab strip:

```tsx
      <div className="flex gap-2">
        {(['bookings', 'schedule'] as const).map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`rounded-full px-4 py-2 text-xs font-semibold transition-colors ${
              tab === id ? 'bg-brand text-white' : 'border border-[#e5d3c2] bg-white text-[#7b6254]'
            }`}
          >
            {id === 'bookings' ? 'Bookings' : 'Schedule'}
          </button>
        ))}
      </div>

      {tab === 'schedule' && appointments[0]?.listing_id && (
        <ScheduleTab
          listingId={appointments[0].listing_id}
          listingName={appointments[0].listing?.name ?? 'Your business'}
        />
      )}

      {tab === 'schedule' && !appointments[0]?.listing_id && (
        <p className="rounded-2xl border border-dashed border-[#e5d3c2] p-6 text-center text-xs text-[#9b7c69]">
          Your schedule appears here once appointments are enabled for your business.
        </p>
      )}
```

Then wrap each of the three existing `<section>` blocks (Today, Upcoming, Recent Activity) so they only render on the bookings tab — change each opening tag from `<section>` to `{tab === 'bookings' && (<section>` and each matching close to `</section>)}`. Keep the header section outside the condition.

- [ ] **Step 3: Typecheck and lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: no errors in the two files; lint at baseline.

- [ ] **Step 4: Verify in the browser**

With the dev preview running and signed in as the test listing's owner, open `/my-business/appointments` and click **Schedule**.

Confirm: adding a future date as "Closed all day" appears in Upcoming changes; adding a date that already has a confirmed booking shows the amber conflict panel with the customer's name and time; "Keep them, close the rest" saves without cancelling; the trash button removes an entry.

Verify one save landed:

```sql
select override_date, closed, windows, note from appointment_date_overrides order by override_date;
```

- [ ] **Step 5: Commit**

```bash
git add src/app/my-business/appointments/ScheduleTab.tsx src/app/my-business/appointments/page.tsx
git commit -m "feat(appointments): owner schedule tab for closures and special hours"
```

---

### Task 9: Rebuild the booking widget

Split the 853-line widget into three files and redesign the slot presentation, so it can mount anywhere and shows why a slot is unbookable.

**Files:**
- Create: `src/components/appointments/SlotPicker.tsx`, `src/components/appointments/BookingDetailsForm.tsx`, `src/components/appointments/BookingWidget.tsx`
- Delete: `src/app/listings/[id]/AppointmentBooking.tsx`
- Modify: `src/app/listings/[id]/components/ListingContent.tsx:11` and `:186-196`

**Interfaces:**
- Consumes: `AppointmentSlot` with `reason` (Task 2), `getAvailableSlotsForDate` and `bookAppointment` (existing actions).
- Produces: `BookingWidget` with props `{ listingId: string; listingName: string; bookingFee: number; appointmentSettings: AppointmentSettings; isLoggedIn: boolean; userName: string; userPhone: string; userEmail: string; signInHref?: string }` — Task 11 mounts this on the appointments subdomain.

- [ ] **Step 1: Extract the slot picker**

Create `src/components/appointments/SlotPicker.tsx`:

```tsx
'use client'

import type { AppointmentSlot } from '@/lib/appointment-slots'

type Props = {
  slots: AppointmentSlot[]
  selectedStart: string | null
  loading: boolean
  onSelect: (slot: AppointmentSlot) => void
}

function periodOf(slot: AppointmentSlot): 'Morning' | 'Afternoon' | 'Evening' {
  const hour = Number.parseInt(slot.start.slice(0, 2), 10)
  if (hour < 12) return 'Morning'
  if (hour < 16) return 'Afternoon'
  return 'Evening'
}

function labelFor(value: string): string {
  const hour = Number.parseInt(value.slice(0, 2), 10)
  const minute = value.slice(3, 5)
  const suffix = hour >= 12 ? 'PM' : 'AM'
  const display = hour % 12 === 0 ? 12 : hour % 12
  return `${display}:${minute} ${suffix}`
}

/**
 * Unbookable slots are rendered greyed with a reason rather than omitted. A
 * clinic that is fully booked and one that barely opens produced identical
 * sparse grids when full slots were simply dropped.
 */
export default function SlotPicker({ slots, selectedStart, loading, onSelect }: Props) {
  if (loading) {
    return (
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4" aria-hidden>
        {Array.from({ length: 8 }).map((_, index) => (
          <div key={index} className="h-11 animate-pulse rounded-xl bg-[var(--color-gray-100)]" />
        ))}
      </div>
    )
  }

  if (slots.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-[var(--od-border)] px-4 py-6 text-center text-sm text-[var(--od-muted)]">
        Closed on this date. Try another day.
      </p>
    )
  }

  const groups: Array<{ period: string; items: AppointmentSlot[] }> = []
  for (const slot of slots) {
    const period = periodOf(slot)
    const last = groups[groups.length - 1]
    if (last && last.period === period) last.items.push(slot)
    else groups.push({ period, items: [slot] })
  }

  return (
    <div className="space-y-4">
      {groups.map((group) => (
        <div key={`${group.period}-${group.items[0].start}`}>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[var(--od-muted)]">
            {group.period}
          </p>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {group.items.map((slot) => {
              const isSelected = slot.start === selectedStart
              return (
                <button
                  key={slot.start}
                  type="button"
                  disabled={!slot.available}
                  onClick={() => onSelect(slot)}
                  aria-label={
                    slot.available
                      ? labelFor(slot.start)
                      : `${labelFor(slot.start)} — ${slot.reason === 'full' ? 'full' : 'too soon'}`
                  }
                  className={`rounded-xl border px-2 py-2 text-center transition-colors ${
                    isSelected
                      ? 'border-[var(--od-brand)] bg-[var(--od-brand)] text-white'
                      : slot.available
                        ? 'border-[var(--od-border)] bg-white text-[var(--od-ink)] hover:border-[var(--od-brand)]'
                        : 'cursor-not-allowed border-[var(--od-border)] bg-[var(--color-gray-100)] text-[var(--od-muted)]'
                  }`}
                >
                  <span className="block text-[13px] font-semibold">{labelFor(slot.start)}</span>
                  {!slot.available && (
                    <span className="block text-[10px]">
                      {slot.reason === 'full' ? 'Full' : 'Too soon'}
                    </span>
                  )}
                  {slot.available && slot.remaining > 1 && (
                    <span className="block text-[10px] text-[var(--od-muted)]">
                      {slot.remaining} left
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 2: Extract the details form**

Create `src/components/appointments/BookingDetailsForm.tsx`:

```tsx
'use client'

type Props = {
  name: string
  phone: string
  notes: string
  fieldErrors: { name?: string; phone?: string }
  disabled: boolean
  onChange: (patch: { name?: string; phone?: string; notes?: string }) => void
}

export default function BookingDetailsForm({
  name,
  phone,
  notes,
  fieldErrors,
  disabled,
  onChange,
}: Props) {
  return (
    <div className="space-y-3">
      <label className="block">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--od-muted)]">
          Your name
        </span>
        <input
          type="text"
          value={name}
          disabled={disabled}
          maxLength={80}
          onChange={(event) => onChange({ name: event.target.value })}
          className="mt-1 w-full rounded-xl border border-[var(--od-border)] px-3 py-2.5 text-sm"
        />
        {fieldErrors.name && (
          <span className="mt-1 block text-xs font-semibold text-red-600">{fieldErrors.name}</span>
        )}
      </label>

      <label className="block">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--od-muted)]">
          Phone
        </span>
        <input
          type="tel"
          inputMode="numeric"
          value={phone}
          disabled={disabled}
          maxLength={15}
          onChange={(event) => onChange({ phone: event.target.value })}
          className="mt-1 w-full rounded-xl border border-[var(--od-border)] px-3 py-2.5 text-sm"
        />
        {fieldErrors.phone && (
          <span className="mt-1 block text-xs font-semibold text-red-600">{fieldErrors.phone}</span>
        )}
      </label>

      <label className="block">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--od-muted)]">
          Anything they should know? (optional)
        </span>
        <textarea
          value={notes}
          disabled={disabled}
          maxLength={500}
          rows={2}
          onChange={(event) => onChange({ notes: event.target.value })}
          className="mt-1 w-full resize-none rounded-xl border border-[var(--od-border)] px-3 py-2.5 text-sm"
        />
      </label>
    </div>
  )
}
```

- [ ] **Step 3: Create the orchestrator**

Create `src/components/appointments/BookingWidget.tsx` by copying `src/app/listings/[id]/AppointmentBooking.tsx` in full, then applying these changes:

1. Rename the default export to `BookingWidget`.
2. Add `signInHref?: string` to `Props`; default it to `/login` in the destructure.
3. Delete the local `getSlotPeriod` and `formatSlotLabel` helpers — `SlotPicker` owns them now.
4. Import the two new components:

```tsx
import BookingDetailsForm from '@/components/appointments/BookingDetailsForm'
import SlotPicker from '@/components/appointments/SlotPicker'
```

Replace the existing slot grid JSX (the block that maps over `slots` rendering
time buttons) with exactly:

```tsx
        <SlotPicker
          slots={slots}
          selectedStart={selectedSlot?.start ?? null}
          loading={status === 'loading-slots'}
          onSelect={(slot) => {
            setSelectedSlot(slot)
            setStep('details')
          }}
        />
```

Replace the inline name / phone / notes inputs with exactly:

```tsx
        <BookingDetailsForm
          name={name}
          phone={phone}
          notes={notes}
          fieldErrors={fieldErrors}
          disabled={status === 'processing'}
          onChange={(patch) => {
            if (patch.name !== undefined) setName(patch.name)
            if (patch.phone !== undefined) setPhone(patch.phone)
            if (patch.notes !== undefined) setNotes(patch.notes)
          }}
        />
```
5. Show the fee **before** slot selection: render this immediately under the widget heading, above the date strip:

```tsx
        {bookingFee > 0 ? (
          <p className="rounded-xl border border-[var(--od-border)] bg-[var(--color-surface-2)] px-3 py-2 text-xs text-[var(--od-ink-2)]">
            <strong className="font-bold">₹{bookingFee} booking fee</strong> — non-refundable, paid
            now to hold your slot.
          </p>
        ) : (
          <p className="rounded-xl border border-[var(--od-border)] bg-[var(--color-surface-2)] px-3 py-2 text-xs text-[var(--od-ink-2)]">
            <strong className="font-bold">Free to book.</strong>
          </p>
        )}
```

6. Repeat the fee line immediately above the confirm button so it is visible at the moment of payment, and add this to the `status === 'success'` confirmation screen, under the booked date and time:

```tsx
          {bookingFee > 0 && (
            <p className="text-xs text-[var(--od-muted)]">
              ₹{bookingFee} booking fee paid. Booking fees are not refunded — to change this
              appointment, contact {listingName} directly.
            </p>
          )}
```
7. Change the sign-in prompt so it appears only after a slot is chosen, linking to `` `${signInHref}?redirect=${encodeURIComponent(pathname)}` ``.

**Do not modify** `submitBooking`, `handleConfirm`, the Razorpay options object, `capturedRef`, `persistRecoveryDraft` / `updateRecoveryDraft` / `clearRecoveryDraft`, `attemptWithRetry`, or the `status === 'recovery'` early return. Move them across byte-for-byte. They handle captured payments and are the highest-risk code in the file.

- [ ] **Step 4: Delete the old widget and repoint the mount**

```bash
git rm src/app/listings/\[id\]/AppointmentBooking.tsx
```

In `src/app/listings/[id]/components/ListingContent.tsx`, change line 11 from

```tsx
import AppointmentBooking from '../AppointmentBooking'
```

to

```tsx
import BookingWidget from '@/components/appointments/BookingWidget'
```

and change the JSX at line 187 from `<AppointmentBooking` to `<BookingWidget` (props are unchanged).

- [ ] **Step 5: Typecheck and lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: clean typecheck — this is the task that clears the last Task 1 consumer errors. Lint at the 61-problem baseline.

- [ ] **Step 6: Verify a real booking end to end**

With the dev preview running, open `http://soham.localhost:3000/` (the test listing's subdomain), signed in.

Confirm: the fee line shows before any slot is picked; unbookable slots render greyed with "Full" or "Too soon"; picking a slot and confirming completes a booking.

Then check the row landed:

```sql
select booking_date, slot_start, status, payment_status, booking_fee
from appointments order by created_at desc limit 1;
```

- [ ] **Step 7: Commit**

```bash
git add src/components/appointments src/app/listings/\[id\]/components/ListingContent.tsx
git commit -m "feat(appointments): rebuild booking widget as three mountable components"
```

---

### Task 10: Reserve the `appointments` subdomain

Route `appointments.ourdahanu.in` to `/appointments/*` and stop a business claiming that subdomain.

**Files:**
- Modify: `src/lib/subdomain.ts:5-10`
- Modify: `src/proxy.ts` — the `find` rewrite branch area, and all five host regexes plus a new matcher in `export const config`

**Interfaces:**
- Produces: requests to `appointments.ourdahanu.in/<path>` rewrite to `/appointments/<path>`; `getBusinessSubdomain('appointments.ourdahanu.in')` returns `null`.

- [ ] **Step 1: Reserve the prefix**

In `src/lib/subdomain.ts`, change the `RESERVED_SUBDOMAINS` set to include `'appointments'`:

```ts
export const RESERVED_SUBDOMAINS = new Set([
  'www', 'admin', 'api', 'app', 'mail', 'shop', 'news', 'events',
  'jobs', 'forum', 'classifieds', 'emergency', 'dashboard', 'login',
  'profile', 'search', 'about', 'listings', 'my-business', 'offline',
  'auth', 'static', 'assets', 'media', 'cdn', 'find', 'appointments',
])
```

- [ ] **Step 2: Check no business already holds it**

Run through the Supabase MCP `execute_sql` tool:

```sql
select id, name, subdomain from listings where subdomain = 'appointments';
```

Expected: zero rows. **If any row comes back, stop and report it** — reserving the prefix would break a live business page.

- [ ] **Step 3: Add the rewrite branch**

In `src/proxy.ts`, immediately after the closing brace of the `find` host block (the `if (findHost === 'find.ourdahanu.in' || findHost === 'find.localhost') { … }` block), insert:

```ts
  // appointments.ourdahanu.in → /appointments/* (standalone booking directory,
  // own layout). Same shape as the find branch above.
  if (findHost === 'appointments.ourdahanu.in' || findHost === 'appointments.localhost') {
    const pathname = request.nextUrl.pathname
    const isInternalOrAsset =
      pathname.startsWith('/_next') ||
      pathname.startsWith('/api') ||
      /\.[^/]+$/.test(pathname)
    if (isInternalOrAsset) {
      return NextResponse.next()
    }
    const url = request.nextUrl.clone()
    if (!url.pathname.startsWith('/appointments')) {
      url.pathname = url.pathname === '/' ? '/appointments' : `/appointments${url.pathname}`
    }
    return NextResponse.rewrite(url)
  }
```

- [ ] **Step 4: Update every host regex**

In `export const config`, there are **five** matcher entries whose `value` is the long negative-lookahead regex. In each of the five, change the lookahead group ending `|cdn|find)` to `|cdn|find|appointments)`.

Then add a sixth matcher entry after the `find` one:

```ts
    {
      // appointments.ourdahanu.in — standalone booking directory
      source: '/:path*',
      has: [
        {
          type: 'header',
          key: 'host',
          value: '(?:appointments\\.ourdahanu\\.in|appointments\\.localhost(?::\\d+)?)',
        },
      ],
    },
```

- [ ] **Step 5: Verify the two lists agree**

Run:

```bash
grep -c "cdn|find|appointments" src/proxy.ts
```

Expected: `5`. If it prints anything else, a regex was missed — the comment at the top of `src/lib/subdomain.ts` exists precisely because these two places drift apart silently.

- [ ] **Step 6: Add a regression test for the reserved prefix**

Create `src/lib/subdomain.test.ts` — a new file, not an addition to `auth-regression.test.ts`, which covers cookie scope rather than host parsing:

```ts
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { getBusinessSubdomain } from './subdomain'

test('reads a real business subdomain', () => {
  assert.equal(getBusinessSubdomain('dradidx.ourdahanu.in'), 'dradidx')
  assert.equal(getBusinessSubdomain('dradidx.localhost:3000'), 'dradidx')
})

test('never treats a reserved prefix as a business', () => {
  for (const reserved of ['find', 'appointments', 'www', 'admin', 'shop']) {
    assert.equal(getBusinessSubdomain(`${reserved}.ourdahanu.in`), null, reserved)
    assert.equal(getBusinessSubdomain(`${reserved}.localhost:3000`), null, reserved)
  }
})

test('returns null for the bare domain', () => {
  assert.equal(getBusinessSubdomain('ourdahanu.in'), null)
  assert.equal(getBusinessSubdomain('localhost:3000'), null)
  assert.equal(getBusinessSubdomain(''), null)
  assert.equal(getBusinessSubdomain(null), null)
})
```

Append ` src/lib/subdomain.test.ts` to `test:existing` in `package.json`.

- [ ] **Step 7: Run the tests**

Run: `npm run test:existing`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/lib/subdomain.ts src/lib/subdomain.test.ts src/proxy.ts package.json
git commit -m "feat(appointments): reserve and route the appointments subdomain"
```

---

### Task 11: The appointments directory

Build the public directory: an indexable index listing bookable businesses with their next free slots, plus per-business `noindex` booking pages.

**Files:**
- Create: `src/lib/data/appointment-directory.ts`, `src/app/appointments/layout.tsx`, `src/app/appointments/DirectoryList.tsx`, `src/app/appointments/page.tsx`, `src/app/appointments/[subdomain]/page.tsx`

**Interfaces:**
- Consumes: `getSlotsForDate` is **not** used here (it is per-date and would issue one query per day per business); this task batches instead. Uses `generateAvailableSlots` + `getOverridesForListings` (Task 5) + `normalizeAppointmentSettings` (Task 1) + `BookingWidget` (Task 9).
- Produces:
  - `type AppointmentDirectoryEntry = { listingId: string; name: string; subdomain: string | null; category: string | null; imageUrl: string | null; bookingFee: number; nextSlots: Array<{ date: string; start: string }>; hasAvailability: boolean }`
  - `getAppointmentDirectory(): Promise<AppointmentDirectoryEntry[]>`
  - `getBookableListingBySubdomain(subdomain: string)` for the detail page.

- [ ] **Step 1: Write the directory data layer**

Create `src/lib/data/appointment-directory.ts`:

```ts
import 'server-only'

import { cacheLife, cacheTag } from 'next/cache'

import { generateAvailableSlots } from '@/lib/appointment-slots'
import { CACHE_TAGS } from '@/lib/cache-tags'
import { PUBLIC_CONTENT_CACHE } from '@/lib/cache-policy'
import { getOverridesForListings } from '@/lib/data/appointment-overrides'
import { logCacheRegeneration } from '@/lib/isr-debug'
import { normalizeAppointmentSettings, type AppointmentSettings } from '@/lib/listing-content'
import { createPublicClient } from '@/lib/supabase/public'

/**
 * How many days forward the directory looks for a free slot. Capped so a
 * business with advance_days: 90 cannot make this page 90x more expensive
 * than its neighbours.
 */
const DIRECTORY_LOOKAHEAD_DAYS = 14
const SLOTS_SHOWN = 3

export type AppointmentDirectorySlot = { date: string; start: string }

export type AppointmentDirectoryEntry = {
  listingId: string
  name: string
  subdomain: string | null
  category: string | null
  imageUrl: string | null
  bookingFee: number
  nextSlots: AppointmentDirectorySlot[]
  hasAvailability: boolean
}

type BookableRow = {
  id: string
  name: string
  subdomain: string | null
  category: string | null
  image_thumb_url: string | null
  image_url: string | null
  appointment_booking_fee: number | string | null
  appointment_settings: unknown
}

function getIndiaToday(): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  const parts = formatter.formatToParts(new Date())
  const lookup = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return `${lookup.year}-${lookup.month}-${lookup.day}`
}

function addDays(dateString: string, days: number): string {
  const base = new Date(`${dateString}T12:00:00+05:30`)
  base.setUTCDate(base.getUTCDate() + days)
  return base.toISOString().slice(0, 10)
}

function toNumber(value: number | string | null | undefined): number {
  const parsed = typeof value === 'number' ? value : Number.parseFloat(String(value ?? '0'))
  return Number.isFinite(parsed) ? parsed : 0
}

async function fetchBookableRows(): Promise<BookableRow[]> {
  const supabase = createPublicClient()
  const { data } = await supabase
    .from('listings')
    .select(
      'id, name, subdomain, category, image_thumb_url, image_url, appointment_booking_fee, appointment_settings',
    )
    .eq('approved', true)
    .eq('appointments_enabled', true)
    .order('name', { ascending: true })

  return (data ?? []) as BookableRow[]
}

export async function getAppointmentDirectory(): Promise<AppointmentDirectoryEntry[]> {
  'use cache'

  cacheLife(PUBLIC_CONTENT_CACHE)
  cacheTag(CACHE_TAGS.appointments)
  logCacheRegeneration({ scope: 'appointments:directory', tags: [CACHE_TAGS.appointments] })

  const rows = await fetchBookableRows()
  if (rows.length === 0) return []

  const today = getIndiaToday()
  const horizon = addDays(today, DIRECTORY_LOOKAHEAD_DAYS)
  const listingIds = rows.map((row) => row.id)

  const supabase = createPublicClient()
  const [{ data: bookings }, overridesByListing] = await Promise.all([
    supabase
      .from('appointments')
      .select('listing_id, booking_date, slot_start')
      .in('listing_id', listingIds)
      .eq('status', 'confirmed')
      .gte('booking_date', today)
      .lte('booking_date', horizon),
    getOverridesForListings(listingIds, today, horizon),
  ])

  // listingId -> date -> "HH:MM" -> count
  const counts: Record<string, Record<string, Record<string, number>>> = Object.create(null)
  for (const row of (bookings ?? []) as Array<{
    listing_id: string
    booking_date: string
    slot_start: string
  }>) {
    const byDate = counts[row.listing_id] ?? (counts[row.listing_id] = Object.create(null))
    const bySlot = byDate[row.booking_date] ?? (byDate[row.booking_date] = Object.create(null))
    const start = row.slot_start.slice(0, 5)
    bySlot[start] = (bySlot[start] ?? 0) + 1
  }

  const entries: AppointmentDirectoryEntry[] = rows.map((row) => {
    const settings: AppointmentSettings | null = normalizeAppointmentSettings(row.appointment_settings)
    const nextSlots: AppointmentDirectorySlot[] = []

    if (settings) {
      const days = Math.min(settings.advance_days, DIRECTORY_LOOKAHEAD_DAYS)
      for (let offset = 0; offset <= days && nextSlots.length < SLOTS_SHOWN; offset += 1) {
        const date = addDays(today, offset)
        const slots = generateAvailableSlots(
          settings,
          date,
          counts[row.id]?.[date] ?? {},
          overridesByListing[row.id]?.[date] ?? null,
        )
        for (const slot of slots) {
          if (!slot.available) continue
          nextSlots.push({ date, start: slot.start })
          if (nextSlots.length === SLOTS_SHOWN) break
        }
      }
    }

    return {
      listingId: row.id,
      name: row.name,
      subdomain: row.subdomain,
      category: row.category,
      imageUrl: row.image_thumb_url || row.image_url || null,
      bookingFee: toNumber(row.appointment_booking_fee),
      nextSlots,
      hasAvailability: nextSlots.length > 0,
    }
  })

  // Businesses with nothing free sort last but are never hidden — a clinic that
  // forgot to set its hours must stay visible, or nobody finds out.
  return entries.sort((a, b) => {
    if (a.hasAvailability !== b.hasAvailability) return a.hasAvailability ? -1 : 1
    return a.name.localeCompare(b.name)
  })
}

export type BookableListing = {
  id: string
  name: string
  subdomain: string | null
  category: string | null
  bookingFee: number
  settings: AppointmentSettings
}

export async function getBookableListingBySubdomain(
  subdomain: string,
): Promise<BookableListing | null> {
  'use cache'

  cacheLife(PUBLIC_CONTENT_CACHE)
  cacheTag(CACHE_TAGS.appointments)

  const supabase = createPublicClient()
  const { data } = await supabase
    .from('listings')
    .select('id, name, subdomain, category, appointment_booking_fee, appointment_settings')
    .eq('subdomain', subdomain)
    .eq('approved', true)
    .eq('appointments_enabled', true)
    .maybeSingle()

  const row = data as BookableRow | null
  if (!row) return null

  const settings = normalizeAppointmentSettings(row.appointment_settings)
  if (!settings) return null

  return {
    id: row.id,
    name: row.name,
    subdomain: row.subdomain,
    category: row.category,
    bookingFee: toNumber(row.appointment_booking_fee),
    settings,
  }
}
```

- [ ] **Step 2: Create the layout**

Create `src/app/appointments/layout.tsx`:

```tsx
import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Book an Appointment in Dahanu',
  description:
    'Book appointments with clinics, dentists, salons and tutors in Dahanu. See the next free slot and book online.',
}

export default function AppointmentsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="od-page flex min-h-dvh flex-col text-[var(--od-ink)]">
      <a
        href="#appointments-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-white focus:px-3 focus:py-2 focus:text-sm focus:font-semibold"
      >
        Skip to content
      </a>

      <header className="sticky top-0 z-40 border-b border-[var(--od-border)] bg-[rgba(250,250,247,0.88)] backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
          <Link href="/appointments" className="flex items-baseline">
            <span className="font-display text-[1.4rem] leading-none">Book</span>
            <span className="font-display text-[1.4rem] italic leading-none text-[var(--od-brand)]">
              Dahanu
            </span>
          </Link>
          <a
            href="https://ourdahanu.in/listings"
            className="text-xs font-bold text-[var(--od-brand)] transition-colors hover:text-[var(--od-brand-strong)]"
          >
            All businesses →
          </a>
        </div>
      </header>

      <main
        id="appointments-content"
        className="mx-auto w-full max-w-5xl flex-1 scroll-mt-14 px-4 pb-16 pt-6"
      >
        {children}
      </main>

      <footer className="border-t border-[var(--od-border)] bg-[var(--color-surface-2)]">
        <div className="warli-divider opacity-70" aria-hidden />
        <div className="mx-auto flex max-w-5xl flex-col items-center gap-1.5 px-4 py-6 text-center">
          <p className="text-xs text-[var(--od-muted)]">
            Booking fees are non-refundable. Cancellations are handled by the business.
          </p>
          <a
            href="https://ourdahanu.in"
            className="text-xs font-bold text-[var(--od-brand)] transition-colors hover:text-[var(--od-brand-strong)]"
          >
            Part of OurDahanu →
          </a>
        </div>
      </footer>
    </div>
  )
}
```

- [ ] **Step 3: Create the filterable directory list**

The spec calls for a category filter and explicitly no search. Create
`src/app/appointments/DirectoryList.tsx`:

```tsx
'use client'

import { useMemo, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { CalendarClock } from 'lucide-react'

import type { AppointmentDirectoryEntry } from '@/lib/data/appointment-directory'

function formatSlotDate(value: string): string {
  return new Date(`${value}T12:00:00+05:30`).toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })
}

function formatTime(value: string): string {
  const hour = Number.parseInt(value.slice(0, 2), 10)
  const minute = value.slice(3, 5)
  const suffix = hour >= 12 ? 'PM' : 'AM'
  return `${hour % 12 === 0 ? 12 : hour % 12}:${minute} ${suffix}`
}

export default function DirectoryList({ entries }: { entries: AppointmentDirectoryEntry[] }) {
  const [category, setCategory] = useState<string | null>(null)

  const categories = useMemo(() => {
    const seen = new Map<string, number>()
    for (const entry of entries) {
      if (!entry.category) continue
      seen.set(entry.category, (seen.get(entry.category) ?? 0) + 1)
    }
    return [...seen.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
  }, [entries])

  const visible = category ? entries.filter((entry) => entry.category === category) : entries

  return (
    <>
      {categories.length > 1 && (
        <div className="mt-6 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setCategory(null)}
            className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
              category === null
                ? 'border-[var(--od-brand)] bg-[var(--od-brand)] text-white'
                : 'border-[var(--od-border)] bg-white text-[var(--od-ink-2)]'
            }`}
          >
            All ({entries.length})
          </button>
          {categories.map(([label, count]) => (
            <button
              key={label}
              type="button"
              onClick={() => setCategory(label)}
              className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                category === label
                  ? 'border-[var(--od-brand)] bg-[var(--od-brand)] text-white'
                  : 'border-[var(--od-border)] bg-white text-[var(--od-ink-2)]'
              }`}
            >
              {label} ({count})
            </button>
          ))}
        </div>
      )}

      <ul className="mt-6 grid gap-3 md:grid-cols-2">
        {visible.map((entry) => (
          <li key={entry.listingId} className="od-card p-5">
            <div className="flex items-start gap-3">
              {entry.imageUrl ? (
                <Image
                  src={entry.imageUrl}
                  alt=""
                  width={44}
                  height={44}
                  className="h-11 w-11 shrink-0 rounded-[14px] object-cover"
                />
              ) : (
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] bg-[var(--color-gray-100)]">
                  <CalendarClock size={18} className="text-[var(--od-muted)]" aria-hidden />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <h2 className="truncate text-[15px] font-bold">{entry.name}</h2>
                <p className="mt-0.5 text-xs text-[var(--od-muted)]">
                  {entry.category ?? 'Appointments'}{' '}
                  {entry.bookingFee > 0 ? `· ₹${entry.bookingFee} to book` : '· Free to book'}
                </p>
              </div>
            </div>

            <div className="mt-4">
              {entry.hasAvailability ? (
                <div className="flex flex-wrap gap-1.5">
                  {entry.nextSlots.map((slot) => (
                    <span
                      key={`${slot.date}-${slot.start}`}
                      className="rounded-lg border border-[var(--od-border)] bg-white px-2.5 py-1 text-[11px] font-semibold"
                    >
                      {formatSlotDate(slot.date)} · {formatTime(slot.start)}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-[var(--od-muted)]">
                  No slots available in the next two weeks.
                </p>
              )}
            </div>

            {entry.subdomain && (
              <Link
                href={`/appointments/${entry.subdomain}`}
                className="od-button-primary mt-4 flex w-full items-center justify-center py-2.5 text-sm"
              >
                {entry.hasAvailability ? 'Book a slot' : 'See schedule'}
              </Link>
            )}
          </li>
        ))}
      </ul>
    </>
  )
}
```

The chip strip hides itself when every business shares one category — with four
clinics and a salon at launch, a filter offering a single option is furniture.

- [ ] **Step 4: Create the index page**

Create `src/app/appointments/page.tsx`:

```tsx
import type { Metadata } from 'next'

import DirectoryList from './DirectoryList'
import { getAppointmentDirectory } from '@/lib/data/appointment-directory'
import { buildAbsoluteUrl } from '@/lib/site'

export const metadata: Metadata = {
  title: 'Book an Appointment in Dahanu',
  description:
    'Book appointments with clinics, dentists, salons and tutors in Dahanu. See the next free slot and book online.',
  alternates: { canonical: buildAbsoluteUrl('/appointments') },
}

export default async function AppointmentsDirectoryPage() {
  const entries = await getAppointmentDirectory()

  return (
    <div>
      <section className="relative -mx-4 -mt-6 overflow-hidden border-b border-[var(--od-border)] bg-[var(--color-surface-2)] px-4 pb-7 pt-9 sm:pb-9 sm:pt-11">
        <div className="warli-bg absolute inset-0 opacity-60" aria-hidden />
        <div className="relative mx-auto max-w-2xl text-center">
          <p className="od-eyebrow">Dahanu appointments</p>
          <h1 className="mt-2 text-balance font-display text-4xl leading-[1.08] sm:text-5xl">
            Book a slot, <em className="text-[var(--od-brand)]">skip the queue</em>.
          </h1>
          <p className="mx-auto mt-3 max-w-md text-balance text-sm leading-relaxed text-[var(--od-muted)] sm:text-[15px]">
            Clinics, dentists, salons and tutors in Dahanu — pick a time that works and book it
            online.
          </p>
        </div>
      </section>

      {entries.length === 0 ? (
        <p className="mt-10 rounded-2xl border border-dashed border-[var(--od-border)] px-4 py-10 text-center text-sm text-[var(--od-muted)]">
          No businesses are taking online bookings yet. Check back soon.
        </p>
      ) : (
        <DirectoryList entries={entries} />
      )}
    </div>
  )
}
```

- [ ] **Step 5: Create the per-business booking page**

Create `src/app/appointments/[subdomain]/page.tsx`:

```tsx
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import BookingWidget from '@/components/appointments/BookingWidget'
import { getBookableListingBySubdomain } from '@/lib/data/appointment-directory'
import { createClient } from '@/lib/supabase/server'

type Props = { params: Promise<{ subdomain: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { subdomain } = await params
  const listing = await getBookableListingBySubdomain(subdomain)
  if (!listing) return { title: 'Appointment not available' }

  return {
    title: `Book an appointment with ${listing.name}`,
    description: `Pick a time and book online with ${listing.name} in Dahanu.`,
    // This page substantially duplicates the business's own subdomain, which is
    // already indexed. It exists to be shared on WhatsApp, not crawled — five
    // near-identical pages is the exact pattern that triggered the AdSense
    // "low value content" rejection.
    robots: { index: false, follow: true },
    alternates: { canonical: `https://${subdomain}.ourdahanu.in` },
  }
}

export default async function AppointmentBookingPage({ params }: Props) {
  const { subdomain } = await params
  const listing = await getBookableListingBySubdomain(subdomain)
  if (!listing) notFound()

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  let viewerName = ''
  let viewerPhone = ''
  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name, phone')
      .eq('id', user.id)
      .maybeSingle()
    viewerName = (profile?.full_name as string | null) ?? ''
    viewerPhone = (profile?.phone as string | null) ?? ''
  }

  return (
    <div className="mx-auto max-w-xl">
      <header className="mb-5">
        <h1 className="font-display text-3xl leading-tight">{listing.name}</h1>
        <p className="mt-1 text-sm text-[var(--od-muted)]">
          {listing.category ?? 'Appointments'} ·{' '}
          <a
            href={`https://${subdomain}.ourdahanu.in`}
            className="font-semibold text-[var(--od-brand)]"
          >
            View full profile →
          </a>
        </p>
      </header>

      <BookingWidget
        listingId={listing.id}
        listingName={listing.name}
        bookingFee={listing.bookingFee}
        appointmentSettings={listing.settings}
        isLoggedIn={!!user}
        userName={viewerName}
        userPhone={viewerPhone}
        userEmail={user?.email ?? ''}
        signInHref="https://ourdahanu.in/login"
      />
    </div>
  )
}
```

- [ ] **Step 6: Confirm the profile column names**

Run through the Supabase MCP `execute_sql` tool:

```sql
select column_name from information_schema.columns
where table_schema = 'public' and table_name = 'profiles'
  and column_name in ('full_name', 'phone', 'name');
```

If `full_name` does not exist, use whichever of `name` / `phone` does and adjust Step 5's select accordingly. **Do not guess.**

- [ ] **Step 7: Typecheck, lint and build**

Run: `npx tsc --noEmit && npm run lint && npm run build`
Expected: all clean; lint at the 61-problem baseline.

- [ ] **Step 8: Verify both pages in the browser**

With the dev preview running, open `http://appointments.localhost:3000/`.

Confirm: the hero renders; the test listing appears with next-slot chips; "Book a slot" navigates to `/appointments/soham`; the booking widget renders there and shows the fee line.

Check the noindex is real:

```bash
curl -s http://appointments.localhost:3000/soham | grep -i "noindex\|canonical"
```

Expected: a `noindex` robots meta and a canonical pointing at `https://soham.ourdahanu.in`.

- [ ] **Step 9: Commit**

```bash
git add src/lib/data/appointment-directory.ts src/app/appointments
git commit -m "feat(appointments): appointments.ourdahanu.in directory and booking pages"
```

---

## Post-implementation checks

Not tasks — the things to confirm before this branch merges.

- [ ] `npm run test:existing` passes, including all four new test files (`appointment-settings`, `appointment-slots`, `appointment-conflicts`, `subdomain`).
- [ ] `npm run build` succeeds.
- [ ] `npm run lint` reports no more than the 61-problem baseline.
- [ ] `grep -c "cdn|find|appointments" src/proxy.ts` prints `5`.
- [ ] A real booking completes on `soham.localhost:3000` and writes one `appointments` row.
- [ ] Abandoning the Razorpay modal writes **no** appointment row.
- [ ] The owner can close a date, and that date then shows no slots in the booking widget.
- [x] **No Vercel/DNS action required** — verified the project already has
      `*.ourdahanu.in` attached as a wildcard domain, so the subdomain resolves
      and reaches the project already. An earlier version of this plan wrongly
      said a record had to be added by hand.
- [ ] Rollout order: test listing only → DR.ADIDX GLOW AND SMILE (`dradidx`) → the remaining three.
