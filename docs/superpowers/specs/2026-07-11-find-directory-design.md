# find.ourdahanu.in — Professionals Directory with Rated Reviews

**Date:** 2026-07-11
**Status:** Design approved, pending spec review

## Summary

A new section of the existing OurDahanu Next.js app, served on the `find.ourdahanu.in`
subdomain, that presents a directory of local professionals (name, phone, occupation).
Logged-in users can **submit** professional entries and **rate** them (1–5 stars with a
mandatory experience comment and a "I have used this service" confirmation). Admins review
and approve both submissions and ratings before they go live. It reuses the existing
Supabase database, authentication, and admin panel — "standalone" means its own landing
page and branding, not a separate deployment.

## Goals

- Browse/search local professionals by profession and locality.
- Logged-in users submit new professional entries (name, phone, profession, etc.).
- Logged-in users rate a professional: 1–5 stars, required comment, required
  "I have personally used this service" confirmation.
- One rating per user per professional (re-submitting overwrites and re-enters moderation).
- Admin approves/edits professional submissions ("take it live") and approves/rejects ratings.
- Public pages and averages reflect only approved content.

## Non-Goals (YAGNI)

- Anonymous submissions or ratings (login required for both).
- Photos/avatars for professionals (can be added later).
- Owner replies to ratings, ownership claims, payments, or any monetization.
- A separate repo/deployment/database.

## Architecture

### Routing

Business subdomains (e.g. `organic.ourdahanu.in`) rewrite to `/listings/[subdomain]` via
`src/proxy.ts`. Reserved prefixes (www, admin, api, …) are excluded from the proxy matcher
and pass straight through to the main app. `find` becomes a **reserved prefix** that
rewrites to a new `/find` route segment.

Changes required (three lists must stay in sync — this is an existing constraint in the code):
1. `src/lib/subdomain.ts` — add `'find'` to `RESERVED_SUBDOMAINS`.
2. `src/proxy.ts` — add `'find'` to the inline regex literals in `export const config`
   (they cannot reference the shared constant per Next.js's `extractExportedConstValue`
   limitation), and add rewrite logic mapping the `find` host to `/find/*`.
3. `src/app/api/check-subdomain/route.ts` — add `'find'` to its `RESERVED` set.

The proxy rewrites the `find` host so that:
- `find.ourdahanu.in/` → `/find`
- `find.ourdahanu.in/<path>` → `/find/<path>`
- Works in dev via `find.localhost:3000`.

> Before implementing the proxy/routing changes, read the relevant guides in
> `node_modules/next/dist/docs/` — this Next.js version (16.2.1) has breaking changes
> from prior conventions (per AGENTS.md).

### Pages (`src/app/find/`)

- `layout.tsx` — standalone header/branding for the Find site (distinct from the main site).
- `page.tsx` (`/find`) — landing: search box, profession filter, list of approved
  professionals with average star + rating count.
- `submit/page.tsx` (`/find/submit`) — logged-in form to submit a new professional.
- `p/[id]/page.tsx` (`/find/p/[id]`) — professional detail: info, approved ratings list,
  average, and the rating form (or "log in to rate" prompt).

### Admin (`src/app/admin/find/`)

Inside the existing admin panel, admin-role gated exactly like other admin pages, using the
service-role admin client for all writes.

- **Professionals tab:** pending submissions listed first, each with an **Edit** form
  (correct any field), **Approve** ("take it live"), and **Reject**. Admin can also add a
  professional directly (created as approved). Existing approved entries can be edited or
  deactivated.
- **Ratings tab:** pending ratings listed with professional name, stars, comment, and rater;
  **Approve** / **Reject** buttons. Approved ratings viewable too.

### Server actions

- Submit professional (logged-in): validates fields, inserts `find_professionals` with
  `status = 'pending'`, `submitted_by = <user>`.
- Submit rating (logged-in): validates (rating 1–5, comment non-empty, `used_service = true`),
  **upserts** on `(professional_id, user_id)` with `status = 'pending'` (re-submit resets to
  pending).
- Admin actions: approve/reject/edit professional, approve/reject rating — via service-role
  client, admin-gated.

## Data Model (new Supabase tables)

Kept separate from `listings`/`reviews` so this is a self-contained module. New migration
file under `supabase/` following the existing `add_*.sql` convention.

### `find_professionals`

| column            | type      | notes                                              |
|-------------------|-----------|----------------------------------------------------|
| id                | uuid pk   | default gen_random_uuid()                          |
| name              | text      | required                                           |
| phone             | text      | required                                           |
| whatsapp          | boolean   | default false — is the number WhatsApp-enabled     |
| profession        | text      | required; one of the fixed category list           |
| profession_other  | text      | nullable; free text when profession = 'Other'      |
| locality          | text      | nullable; area within Dahanu                       |
| note              | text      | nullable; short description                        |
| status            | text      | 'pending' | 'approved' | 'rejected', default 'pending' |
| is_active         | boolean   | default true; admin hide without deleting          |
| submitted_by      | uuid      | fk → auth.users, nullable (null = admin-created)   |
| created_at        | timestamptz | default now()                                    |
| updated_at        | timestamptz | default now()                                    |

Publicly visible when `status = 'approved' AND is_active = true`.

### `find_ratings`

| column          | type      | notes                                            |
|-----------------|-----------|--------------------------------------------------|
| id              | uuid pk   | default gen_random_uuid()                        |
| professional_id | uuid      | fk → find_professionals, on delete cascade       |
| user_id         | uuid      | fk → auth.users                                  |
| rating          | int       | check between 1 and 5                            |
| comment         | text      | required (non-empty)                             |
| used_service    | boolean   | must be true                                     |
| status          | text      | 'pending' | 'approved' | 'rejected', default 'pending' |
| created_at      | timestamptz | default now()                                  |
| updated_at      | timestamptz | default now()                                  |

**Unique constraint** on `(professional_id, user_id)` — one rating per user per professional;
re-submit updates the row and resets `status` to 'pending'.

Public average and count computed from `status = 'approved'` ratings only.

### RLS

- `find_professionals`: public `SELECT` when `status = 'approved' AND is_active`; a user may
  read their own submissions. All writes via service-role admin client (admin actions);
  authenticated users insert their own `pending` submissions.
- `find_ratings`: public `SELECT` when `status = 'approved'`; a user may read their own
  ratings. Authenticated user may insert/update their own row (status forced to 'pending').
  Status transitions to approved/rejected only via service-role admin client.

## Shared constants

`PROFESSIONS` list in one shared module, used by the submit form, admin form, public filter,
and server-side validation:

> Electrician, Plumber, Carpenter, Painter, Doctor, Tutor/Teacher, Mechanic, Mason, Welder,
> Tailor, Beautician, Cook/Caterer, Driver, Gardener, Cleaner/Housekeeping,
> AC/Appliance Repair, Photographer, Priest/Pujari, Other

## User Flows

**Submit a professional (logged-in):** `/find/submit` → fill name, phone, WhatsApp?,
profession (+ other text if Other), locality, note → submit → row created `pending` →
"Thanks, it will appear once approved." Admin reviews, edits if needed, approves → live.

**Rate a professional (logged-in):** `/find/p/[id]` → 1–5 stars + required comment +
required "I confirm I have personally used this service" checkbox → submit → upsert `pending`
→ "Thanks — your rating will appear once approved." Hidden and excluded from average until
approved.

**Not logged in:** submit and rate actions show a "Log in to continue" prompt using existing auth.

## Error Handling

- Server actions re-validate all inputs (never trust client): rating range, non-empty comment,
  `used_service = true`, required professional fields, profession in the allowed list.
- Duplicate rating handled by upsert on the unique constraint (no error surfaced to user).
- Admin actions verify admin role server-side before any service-role write.
- Rate limiting on submit/rating actions consistent with existing patterns (see
  `src/lib/rate-limit.ts`).

## Testing / Verification

Read Next.js 16 docs for proxy/routing first. Then verify end-to-end on
`find.localhost:3000`:
1. Submit a professional as a logged-in user → confirm it is hidden publicly (pending).
2. As admin, edit and approve it → confirm it appears in the public list.
3. Rate it as a logged-in user (stars + comment + checkbox) → confirm hidden until approved
   and excluded from the average.
4. Approve the rating as admin → confirm it shows and the average is correct.
5. Confirm one-rating-per-user: re-submitting overwrites and returns to pending.
6. Confirm `find.` does not collide with business-subdomain routing.
