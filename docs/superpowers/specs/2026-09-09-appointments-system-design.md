# Appointments System — Design

**Status:** approved, ready for implementation planning
**Date:** 2026-09-09

## Goal

Give Dahanu's appointment-based businesses — clinics, dentists, salons, tutors —
a way for customers to find them and book a slot online, and give OurDahanu a
discovery surface at `appointments.ourdahanu.in` where every bookable business
is listed with its next free slots.

## Why this is needed

An appointment system already exists in the codebase and has never been used.
Verified against production on 2026-09-09:

- Exactly **one** listing has `appointments_enabled = true`: the owner's own
  test listing, "Soham Railkar".
- All **five** rows in `appointments` are the owner's own test bookings, from
  April and June 2026.

So there is no production data to preserve and no migration risk. Whether to
keep or delete the existing code is purely an engineering question.

Meanwhile the platform already carries the businesses this is for, none of them
enabled: **DR.ADIDX GLOW AND SMILE** (`dradidx`), **Rajput Dental Clinic**,
**Dr.Mansi's Homeopathy Clinic**, and **Nails by Mishka**. The `find` directory
adds tutors and dance teachers.

### What the existing system already does

Roughly 1,800 lines across 39 files:

| Capability | Where |
|---|---|
| Admin enables appointments per business | `src/app/actions/appointments.ts:577` |
| Admin sets booking fee (₹0 = free) | same action, `appointment_booking_fee` |
| Owner sets slot duration, capacity, buffer, days-ahead, weekly hours | `EditListingForm.tsx` Appointments tab |
| Slot generation | `src/lib/appointment-slots.ts` |
| Booking + Razorpay payment | `bookAppointment`, `create-appointment-order` |
| Cancellation by user / owner / admin | `cancelAppointment` |
| Reminders to both parties, deduped | `src/lib/cron/appointment-reminders.ts` |
| Notifications | `src/lib/notifications/templates.ts` |
| Customer / owner / admin dashboards | `/dashboard`, `/my-business`, `/admin` |
| Mobile API | `/api/v1/appointments` |

Two things the owner asked for **already exist**: the booking fee is already
admin-controlled per business with ₹0 meaning free, and enabling a business is
already admin-only.

### What is actually missing

1. **Discovery.** Nothing lists bookable businesses. A customer must already
   know the business and land on its page.
2. **Availability control.** One window per weekday only. No date-specific
   closures (Diwali), no second window (morning + evening OPD), no breaks.
3. **The booking UI.** One 853-line component welded into the listing page,
   unable to render anywhere else.

## Decisions

Confirmed with the site owner before designing:

- **Approach: keep the engine, replace the surfaces.** The complaints are about
  discovery, availability and UI — none of them touch payment, reminders,
  notifications, cancellation or RLS. Rewriting webhook signature verification
  and reminder dedupe to arrive at identical behaviour is where subtle bugs
  come from.
- **The booking fee goes to OurDahanu**, into the same Razorpay account as the
  ₹210 listing fee. No payouts, no Razorpay Route, no per-business KYC.
- **The fee is never refunded** — including when the business cancels. It is a
  booking fee, not a deposit.
- **Admin-only enabling stays.** The owner keeps curation; the directory stays
  small and correct.
- **Bookings confirm instantly.** No accept/decline queue.

## Architecture

### 1. Availability model

`listings.appointment_settings` (JSONB) changes shape:

```jsonc
{
  "slot_duration": 30,        // unchanged
  "capacity": 1,              // unchanged
  "buffer_minutes": 0,        // unchanged
  "advance_days": 30,         // unchanged
  "min_notice_minutes": 120,  // NEW
  "availability": {           // CHANGED: array of windows per weekday
    "mon": [{ "start": "09:00", "end": "13:00" },
            { "start": "16:00", "end": "19:00" }],
    "sun": []
  }
}
```

Each weekday becomes an **array** of windows. Morning + evening OPD becomes
expressible, and a lunch break is the gap between two windows — no separate
"break" concept is needed.

`min_notice_minutes` is new: how close to a slot a customer may still book it.
Today a customer can book a 9:10 slot at 9:05. `DEFAULT_APPOINTMENT_SETTINGS`
(`src/lib/listing-content.ts:27`) gains `min_notice_minutes: 0`, and the
normaliser defaults any row missing the field to `0` — preserving exactly
today's behaviour for anything not explicitly configured. A business opts into
notice by setting it; nobody's existing setup changes silently.

`normalizeAppointmentSettings` (`src/lib/listing-content.ts:307`) accepts
**both** the old single-window shape (`{start, end} | null`) and the new array,
normalising the old form to a one-element array. No data migration is required
and a stale row cannot break rendering.

### 2. `appointment_date_overrides` — date exceptions

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | `gen_random_uuid()` |
| `listing_id` | uuid NOT NULL | FK → `listings(id)` `ON DELETE CASCADE` |
| `override_date` | date NOT NULL | the exceptional day |
| `closed` | boolean NOT NULL | `true` = closed all day |
| `windows` | jsonb NULL | when `closed = false`, the windows that apply instead |
| `note` | text NULL | "Diwali", shown to the owner only |
| `created_at` | timestamptz NOT NULL | `DEFAULT now()` |

`UNIQUE (listing_id, override_date)` — one exception per business per day.
Index on `(listing_id, override_date)` for the generator's lookup.

A table rather than more JSONB because the owner manages these as a growing
list, and because "who is closed tomorrow" becomes a query rather than a scan.

**Precedence:** an override for a date completely replaces that weekday's normal
windows. `closed = true` yields no slots. `closed = false` yields slots from
`windows` only.

### 3. Capacity is already race-safe — no change

An earlier draft of this spec claimed capacity was enforced by an unguarded
read-then-write and proposed a `seat_index` column to fix it. **That was wrong**
and is recorded here so nobody re-introduces the "fix".

`bookAppointment` does check `selectedSlot.available` in application code, but
that is only a fast pre-check for UX. The authoritative insert goes through the
`create_appointment_booking` Postgres function, which opens with:

```sql
PERFORM pg_advisory_xact_lock(
  hashtext(p_listing_id::text || '|' || p_booking_date::text || '|' || p_slot_start::text)
);
```

The lock is transaction-scoped, so two concurrent bookings for the same slot
serialize: the second waits, then counts rows the first has already committed,
and raises `Selected slot is already full` if capacity is reached. The function
also re-reads `capacity` from `listings.appointment_settings` and re-checks
`approved AND appointments_enabled`, so a client cannot smuggle stale settings
past it.

Confirmed as the **only** write path — no `insert` into `appointments` exists
anywhere in `src/`, and the RPC is called from exactly one place
(`src/app/actions/appointments.ts:295`).

`hashtext` collisions between different slots are possible in principle; the
consequence is two unrelated bookings briefly serializing, which is harmless.

**The capacity path needs no work.** The only change this project makes near it
is that the slot generator feeding the pre-check becomes override-aware, so the
pre-check and the RPC continue to agree.

### 4. Booking flow

**One component, three mount points:** `appointments.ourdahanu.in`, the
business's own subdomain (`dradidx.ourdahanu.in`), and the main-site listing
page. Booking completes on whichever surface it started; no cross-subdomain
bounce mid-flow.

The current 853-line `AppointmentBooking.tsx` is replaced and split along real
seams: slot selection (pure, testable), the details form, and the Razorpay
handoff. Today those three share one component and one state blob.

**Steps:** date strip (bounded by `advance_days`, closed days struck through
rather than absent) → slots for that date **grouped by window** with Morning and
Evening headings → name and phone prefilled from profile, optional notes →
payment when the fee is above zero.

**Three rules that fix specific current failures:**

- The fee is shown **before** slot selection, not at the payment step, and
  labelled "non-refundable". Someone should know it costs ₹5 before investing
  effort, and should not discover the refund policy afterward.
- Full slots stay visible, greyed, labelled "Full". The current generator omits
  them entirely, so a busy clinic and a barely-open one render identically.
- Slots inside the minimum-notice window show "Too soon" rather than vanishing,
  for the same reason.

**Sign-in:** booking requires an account. An unauthenticated visitor picks a
slot first, then signs in, and returns to that exact slot. Auth already works
across subdomains — cookies are scoped to `.ourdahanu.in`
(`src/lib/supabase/auth-cookie.ts:17`) with a regression test at
`src/lib/supabase/auth-regression.test.ts:43`. Nothing to build.

### 5. `appointments.ourdahanu.in`

**Mechanics** follow the existing `find` subdomain precedent:

- A rewrite branch in `src/proxy.ts` mapping the host to `/appointments/*`.
- `appointments` added to `RESERVED_SUBDOMAINS` (`src/lib/subdomain.ts:5`)
  **and** to the five inline host regexes in `src/proxy.ts`'s
  `export const config`. Those regexes cannot reference the shared constant —
  Next.js requires pure inline literals there — so both places must change
  together. Until this lands, a business could register the subdomain
  `appointments` for itself.
- A new matcher entry for the appointments host.
- **The owner adds the DNS record in Vercel.** This cannot be done from code.

**Index page:** the enabled businesses, each with photo, category, fee (or
"Free"), and **its next three open slots**. The slots are the point — "Today
4:30pm, 5:00pm" converts; a name and a Book button makes people phone instead.

**Filtering:** category filter only. No search. At five businesses search is
furniture; it earns its place at thirty.

**Empty state:** the directory scans forward for open slots up to each
business's own `advance_days`, capped at 14 days so one business with
`advance_days: 90` cannot dominate the page's cost. A business with nothing
open in that span shows "No slots available" and sorts last. It must not disappear — otherwise a clinic that
forgot to set hours vanishes silently and neither party finds out.

**SEO constraint — deliberate.** Each business gets a shareable booking URL
(`appointments.ourdahanu.in/dradidx`), but those pages are **`noindex` with a
canonical pointing at the business's own subdomain**. The directory index itself
is indexable and is one genuinely useful page.

This is not incidental. The AdSense "low value content" rejection was diagnosed
as thin auto-generated pages substantially duplicating each other. Five booking
pages mirroring five already-indexed subdomains is that exact pattern. They
exist for sharing on WhatsApp, not for Google.

### 6. Cancellation, no-shows, conflicts

- **No refunds, ever.** Customer-cancelled, business-cancelled, admin-cancelled
  — the fee is not returned. Stated before payment and on the confirmation
  screen.
- **Cancellation window:** customers may cancel until the minimum-notice
  threshold. After that they phone the business. Cancelling five minutes before
  is functionally a no-show; letting the app do it silently just means the
  business finds an empty chair.
- Businesses and admins may cancel at any time. `cancelled_by` already records
  which party; no schema change.
- **No-shows** use the `no_show` status that already exists in the CHECK
  constraint with no UI. The owner's list gets a button. This is the data that
  would later justify changing the ₹5.
- **Override conflicts.** Closing 1 November when three customers are already
  booked must not orphan them. Adding a conflicting override shows the owner the
  affected bookings and forces a choice: cancel them (customers notified) or keep
  them and close only the free slots. Never resolved automatically — either
  choice is wrong sometimes.

**Owner surface:** `/my-business/appointments` gains a Schedule tab — the weekly
windows they already configure, plus a list of upcoming overrides ("1 Nov —
Closed — Diwali") with an Add button. A list, not a calendar widget: faster to
scan and far less to build.

**Reminders** are unchanged. The existing cron messages both parties and dedupes
via `customer_reminder_sent_at` / `owner_reminder_sent_at`.

## Testing

- **Pure functions** — `node:test` via `tsx --test`, registered in the explicit
  list in `package.json` (the runner does not glob). Three targets:
  - the slot generator: multi-window days, date overrides, minimum notice,
    capacity, buffers, and the today/now boundary;
  - `normalizeAppointmentSettings`: both the old single-window shape and the new
    array;
  - the override-conflict detector.

  The slot generator is worth testing hardest — nearly every visible bug in a
  booking system traces back to it, and it is pure input-to-output.

- **Not unit-testable:** the Razorpay leg. Verified by a real booking against a
  live flow, plus confirming no appointment row is written when a checkout is
  abandoned.

- **Migrations** verified against a Supabase branch, not production.

## Rollout

1. Ship with only the owner's test listing enabled; book end to end.
2. Enable **DR.ADIDX GLOW AND SMILE**; watch one real clinic closely.
3. Enable the remaining three.

The directory is admin-curated, so a staged rollout costs nothing.

**Migrations are additive only** — one new table, one new nullable column, one
new index. No destructive DDL. Applied via MCP with a committed `.sql` copy in
`supabase/`, per the project's standing rule that the database is live
production.

## Out of scope

- **Payouts to businesses.** The fee is platform revenue; there is nothing to
  settle.
- **Automated Razorpay refunds.** Nothing is refundable, so there is nothing to
  automate.
- **Self-serve enabling.** Admin-only by decision; revisit if the queue becomes
  a bottleneck.
- **Search in the directory.** Category filter only until the list grows.
- **A calendar widget** for overrides. A list is enough.
- **Multi-practitioner / staff scheduling.** A clinic with three doctors is
  modelled today as `capacity: 3`, which does not distinguish *which* doctor.
  Real support means a resources table and is a separate project.
- **Recurring appointments**, SMS/WhatsApp delivery, and waitlists. Not
  requested.
