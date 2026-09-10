# Moving Availability Settings to the Appointments Page — Design

**Status:** approved, ready for implementation planning
**Date:** 2026-09-10

## Goal

Put everything a business owner does about appointments on one page. Weekly
hours and slot settings move out of the listing editor and onto
`/my-business/appointments`, beside the bookings they produce and the closures
that interrupt them.

## Why this is needed

Appointment configuration is currently split across two pages with no
relationship to each other:

- `/my-business/edit/<id>` → **Appointments** tab — slot duration, capacity,
  buffer, advance window, minimum notice, and the weekly schedule. About 211
  lines, gated on `appointments_enabled`, saved as part of the whole-listing
  form submit.
- `/my-business/appointments` → **Bookings** and **Schedule** tabs — the
  bookings themselves, and per-date closures.

An owner setting up appointments has to know that "when am I open" lives inside
the listing editor, several tabs deep, while "close me on Diwali" lives
somewhere else entirely. The two settings describe the same thing at different
resolutions.

## Decisions

Confirmed with the site owner before designing:

- **One business selector for the whole page.** Pick a business once; all three
  tabs follow it. Hidden when the owner has only one, which is every owner
  today.
- **The old tab is removed completely**, not left as a pointer. Almost nobody
  has used it — appointments are enabled on a single test listing — so there is
  no meaningful muscle memory to strand.
- **An explicit Save button**, not auto-save. Eight interdependent fields
  saving as someone types is how half-configured hours reach production.

## Architecture

### 1. Page structure

`/my-business/appointments` gains a business selector above the tab strip and a
third tab:

```
Bookings · Availability · Schedule
```

The selector currently lives **inside** `ScheduleTab`, which fetches its own
list. It hoists to `page.tsx` and is passed down to both `ScheduleTab` and the
new `AvailabilityTab`, so the tabs cannot disagree about which business is
being edited.

The list still comes from `getMyAppointmentListings()` — derived from
`owner_id` + `appointments_enabled` rather than from existing bookings. That
distinction is load-bearing and was itself a bug fix: deriving from bookings
made the page unreachable for a business that had just been enabled and had no
bookings yet, which is precisely the state a business is in when it most needs
to set its hours.

**That action is widened to also return each listing's current
`appointment_settings`**, so the page fetches once and hands the selected
listing's settings straight to the Availability tab. The alternative — a
second reader fired on every selector change — buys nothing: an owner has one
or two listings, and the settings are a few hundred bytes of JSONB already
being read from the same row. Its return type becomes:

```ts
export type OwnerAppointmentListing = {
  id: string
  name: string
  appointment_settings: unknown   // normalised by the consumer
}
```

`ScheduleTab` ignores the new field; widening the type does not disturb it.

Selector rules, unchanged from `ScheduleTab`'s current behaviour:

- zero listings → a single message, `Appointments are not enabled for any of your businesses yet.`
- exactly one → no selector rendered
- more than one → a `<select>` labelled `Business`

Because the selector now scopes the whole page, **Bookings becomes
listing-scoped too**. It currently shows every owned listing's appointments
mixed together. For a single-business owner nothing changes; for a
multi-business owner the page becomes consistent instead of meaning two
different things in two places.

Mechanically this is a client-side filter, not a new query:
`getMyBusinessAppointments()` already returns every owned listing's
appointments and each row carries `listing_id`, so the Bookings tab filters the
array it already holds against the selected id. No server change, and the
existing Today / Upcoming / Recent Activity groupings and the stats tiles all
derive from that same filtered array so they cannot disagree with the list
beneath them.

### 2. `AvailabilityTab`

A new client component, `src/app/my-business/appointments/AvailabilityTab.tsx`,
holding the controls lifted out of the listing editor:

| Control | Range |
|---|---|
| Slot duration | 15 / 30 / 60 min |
| Capacity per slot | 1–20 |
| Buffer between slots | 0 / 5 / 10 / 15 min |
| Advance booking window | 1–90 days |
| Minimum notice | None / 1 / 2 / 4 hours |
| Weekly schedule | per weekday: Open/Closed, up to `MAX_WINDOWS_PER_DAY` (3) time ranges |

Same controls and same behaviour as today — this is a relocation, not a
redesign. It receives `listingId` and that listing's raw `appointment_settings`
as props from the page, normalises them for display with
`normalizeAppointmentSettings` (falling back to `DEFAULT_APPOINTMENT_SETTINGS`
when a listing has none yet), and owns its own draft state and Save button.
Switching business in the selector re-seeds the draft from the newly selected
listing, discarding any unsaved edits — the tab must not carry one business's
half-finished hours across to another.

### 3. `saveAppointmentSettings`

Today these settings ride along inside `updateListing`'s whole-listing
`FormData`. A page that is not the listing form cannot produce that payload, so
the move needs its own write path.

A new server action:

```ts
saveAppointmentSettings(
  listingId: string,
  settings: AppointmentSettings,
): Promise<{ error?: string; saved?: boolean }>
```

It must:

1. Reject a caller who is neither the listing's owner nor an admin/moderator,
   using the same ownership check pattern as `requireListingAccess` in
   `src/app/actions/appointment-overrides.ts`.
2. Run the incoming value through `normalizeAppointmentSettings` **server-side**
   before writing. The client is never the validator: the normaliser is what
   guarantees windows arrive sorted, non-overlapping and capped, which every
   downstream slot computation assumes.
3. Write via the service-role client, matching the existing appointment write
   paths.
4. Call `revalidateAppointmentsCache(listingId)` on success.

That last step is not optional. `getAppointmentDirectory` and
`getBookableListingBySubdomain` are tagged `appointments` and cached for 24
hours; without the invalidation an owner fixes their hours and
`appointments.ourdahanu.in` keeps advertising the old free slots for a day.

No new reader is needed: the widened `getMyAppointmentListings()` already
carries the settings the tab displays.

### 4. Removing the old path

- Delete the `appointments` entry from `EditListingForm`'s tab list, the tab's
  JSX block, its `appointmentSettings` state, its five helpers
  (`setDayWindows`, `toggleAppointmentDay`, `updateAppointmentWindow`,
  `addAppointmentWindow`, `removeAppointmentWindow`), and the
  `fd.set('appointment_settings', …)` line in `handleSubmit`.
- Remove any import left unused by that deletion. An unused import is a lint
  error and the baseline must not move.
- Delete `updateListing`'s `appointment_settings` handling. Once nothing
  submits the field it is dead code, and two writers to one JSONB column is how
  they drift — a stale form could otherwise overwrite what the new tab just
  saved.
- The `revalidateAppointmentsCache(id)` call added to `updateListing` goes with
  it. It is not lost: the new action carries that responsibility.

**Do not** remove `appointments_enabled` or `appointment_booking_fee` handling
anywhere. Both remain admin-only, set at `/admin/appointments`, and are
untouched by this work.

## Testing

The tab is UI and the action is I/O, so neither is unit-testable in this
project's harness. The validation gate they both depend on —
`normalizeAppointmentSettings` — already carries 13 tests, including the legacy
single-window shape that production's only configured listing still holds. That
coverage stays the safety net and must keep passing.

Verification is therefore:

- `npx tsc --noEmit` clean
- `npm run lint` at the `main` baseline of 61 problems / 34 errors
- `npm run test:existing` — 92 passing
- `npm run build` succeeds
- One real save round-trip performed by the owner while signed in: change a
  weekly window on the test listing, save, reload, and confirm the value
  persisted and that `appointments.ourdahanu.in` reflects it.

That last check matters more than usual. The owner-facing pages sit behind
Google OAuth with no dev bypass, so no agent can reach them — every automated
verification of this surface during the previous project was blind. The site
owner can sign in, so this is the one gap that a human can close and an agent
cannot.

## Out of scope

- Any change to the availability controls themselves. This is a relocation; the
  fields, ranges and behaviour are identical.
- Admin-side editing of another owner's hours. `/my-business/edit/[id]` filters
  on `owner_id`, and this design does not add an admin route into the new tab.
- `appointments_enabled` and `appointment_booking_fee`, which stay admin-only.
- The booking flow, the directory, the overrides table, the Razorpay path, and
  the `create_appointment_booking` RPC. None are touched.
