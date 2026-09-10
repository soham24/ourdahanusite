# Listing Views and Contact Clicks — Design

**Status:** approved, ready for implementation planning
**Date:** 2026-09-10

## Goal

Show a business owner what their listing fee actually bought: how many people
looked at their listing, and how many tapped to call or message them.

## Why this is needed

`listings.views` already exists as a column, and `src/app/my-business/page.tsx`
already renders it as a "Views" stat tile (line 257, via `totalViews` at line
174). **Nothing in the codebase has ever written that column** — no update, no
increment, no RPC. Every business owner who has opened My Business has been
shown a views counter reading zero since launch.

So this is not a new feature. It is making a number the product already
promises stop being false.

The commercial case is concrete. Total revenue today is roughly ₹45,750/year
from 61 paid listings at ₹750. **62 of those listings renew between April and
September 2027.** Every renewal is a conversation where the owner asks what
they got, and today there is no answer. A business that sees "12 people tapped
WhatsApp this month" renews; one shown a zero does not.

It is also a precondition for selling anything more. The `plan` column exists
with a single value (`standard`) across all 64 listings. Nobody buys featured
placement until they can see the placement they already have.

### What exists today

- `TrackedContactLink` (`src/app/find/TrackedContactLink.tsx`) sends a GA4
  event on contact taps — but only on the Find directory, and only to Google.
  GA4 data cannot be shown back to an individual business owner, so it does not
  serve this purpose.
- `/api/listings/[id]/viewer` is a viewer *identity* endpoint (logged in, is
  owner, has favourited). It is not view tracking, despite the name.
- Business listings have no tracking of any kind.

## Decisions

Confirmed with the site owner before designing:

- **Event rows, aggregated** — not a bare counter. A counter can only ever say
  "1,203 all time"; event rows can say "47 this month, up from 31", which is
  the sentence that closes a renewal.
- **One view per visitor per day**, matching how Google Business and Instagram
  count, so the figure survives comparison. The owner's own views are excluded.
- **Phone taps and WhatsApp taps count as contacts.** Directions and website
  taps do not — weaker evidence, and few listings have a website.

## Architecture

### 1. Why the write is client-side

Listing pages are cached. `getCachedListingDetail` is a `'use cache'` function
and production serves listing pages with `X-Vercel-Cache: HIT` (verified
against `jigarchheda.ourdahanu.in`). A counter incremented during server render
would fire only on cache misses — undercounting by an unknown and unknowable
factor.

Views are therefore recorded by a **client-side beacon** to an API route,
following the shape of the existing `/api/listings/[id]/viewer`. Contact taps
are already client events and use the same endpoint.

### 2. `listing_events`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | `gen_random_uuid()` |
| `listing_id` | uuid NOT NULL | FK → `listings(id)` `ON DELETE CASCADE` |
| `kind` | text NOT NULL | `CHECK (kind IN ('view','phone','whatsapp'))` |
| `visitor_key` | text NOT NULL | random per-browser id, no PII |
| `day` | date NOT NULL | IST date, for dedupe and month bucketing |
| `created_at` | timestamptz NOT NULL | `DEFAULT now()` |

```sql
CREATE UNIQUE INDEX idx_listing_events_daily
  ON listing_events (listing_id, kind, visitor_key, day);
CREATE INDEX idx_listing_events_listing_day
  ON listing_events (listing_id, day DESC);
```

**The dedupe is a database constraint, not a client-side hope.** A browser that
fires the beacon twice, or someone calling the endpoint in a loop, hits the
unique index and the duplicate is discarded. A `23505` is success, not an
error — the same pattern `coupon_redemptions` already uses.

**All three kinds dedupe per visitor per day**, not just views. `kind` is part
of the unique index, so one person can produce a view, a phone tap and a
WhatsApp tap on the same day — but not two WhatsApp taps. Someone who taps
WhatsApp three times while composing a message is one enquiry, not three, and a
contact figure that counts fumbling is exactly the kind of number an owner
stops believing once they test it on themselves.

`day` is the **IST** date, derived with the shared `getIndiaToday()` helper in
`src/lib/india-time.ts`. Using UTC would roll the counter over at 5:30am local
and split a single evening's browsing across two days.

**RLS:** enabled, with no public read policy. Owners never query this table
directly — they read aggregates through a server action that checks ownership.
Writes go through the service-role client in the API route.

### 3. `visitor_key`

A random identifier generated once per browser and stored in `localStorage`.
No login required, no PII, never sent anywhere but this endpoint.

It exists solely to answer "have I already counted this person today". A
missing or cleared key produces a new one, which slightly over-counts — that is
the correct direction to err, since the alternative is fingerprinting.

The owner's own views are excluded server-side: the route resolves the signed-in
user and skips the insert when that user owns the listing. An owner refreshing
their own page must never move their own number, or they will discover it and
stop trusting the whole figure.

### 4. `listings.views` stays

The API route also increments `listings.views` as a **lifetime** total.

Two reasons. The tile the dashboard already renders stops reading zero on the
day this ships. And lifetime figures survive the retention prune, so pruning
old event rows never makes a business's history appear to shrink.

### 5. What the owner sees

In `src/app/my-business/page.tsx`, one line per listing beneath the existing
tiles:

> **Dahanu Organic** — 47 views this month · 12 WhatsApp · 3 calls
> *Last month: 31 views*

No charts and no dashboard page. A shopkeeper reads one sentence and decides
whether ₹750 was worth it. A listing with no events yet reads
`No views yet this month` rather than a row of zeros.

Aggregates are computed in a server action that verifies `owner_id` before
returning anything.

### 6. Retention

Because views dedupe per visitor per day, volume is modest — hundreds of rows a
day across 64 listings, not thousands.

Raw events are pruned after **180 days** by a delete added to the existing cron
at `src/app/api/cron/listing-expiry/route.ts`. That route already runs on a
schedule and already touches `listings`, so the prune needs no new
infrastructure and no new secret. It deletes only `listing_events` rows older
than 180 days and touches nothing else.

Note the schedule is **weekly**, not daily — `vercel.json` declares
`0 0 * * 1` (Mondays at 00:00 UTC). A row therefore lives at most 187 days
rather than exactly 180. That is fine for a retention floor; it is recorded
here so nobody later reads "180 days" as an exact guarantee.

The UI only ever reads the current month, the previous month, and the lifetime
counter, so nothing visible is lost. Without a prune rule this table grows
without bound on a free-tier database.

### 7. Privacy

`visitor_key` is a first-party identifier stored on the visitor's device. The
privacy policy already discloses analytics and the site runs a consent banner
for EEA visitors, so this is consistent with what visitors are told — but it
must be **named explicitly** in the policy rather than added silently. One
sentence, shipped in the same change.

## Testing

- **Pure functions** get real tests via `node:test` + `tsx --test`, registered
  in the explicit list in `package.json` (the runner does not glob):
  - the month bucketing — current month, previous month, and the boundary,
    computed in IST rather than UTC;
  - the aggregate shaping that turns event rows into the owner's one-line
    summary, including the empty case.
- **Not unit-testable:** the beacon route and the panel. Verified by loading a
  real listing page, confirming one row appears, reloading and confirming a
  second row does *not*, and confirming the owner's own view inserts nothing.
- **Migration** is additive only — one new table, no schema change to
  `listings`. Applied via the Supabase MCP with a committed `.sql` copy under
  `supabase/`, per the project's standing rule that the database is live
  production.

## Out of scope

- **Find professionals.** The same table could serve them later — the
  monetisation case there is real, since 90 professionals are listed free — but
  this ships for business listings first, where the renewal deadline is.
- **Directions and website taps.** Deliberately excluded.
- **Charts, date pickers, a dedicated analytics page.** One line of text.
- **Featured/premium tiers.** This is the precondition for selling them, not
  the tier itself.
- **Backfilling history.** There is no data to backfill; counting starts at
  deploy.
