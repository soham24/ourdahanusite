# Jobs Board (jobs.ourdahanu.in) — Design

**Status:** approved section by section, ready for implementation planning
**Date:** 2026-09-14
**Branch:** `feat/jobs-board`

## Goal

A free, two-sided local jobs board for Dahanu at `jobs.ourdahanu.in`: businesses
post vacancies, people post that they are looking for work, and the two reach
each other by phone or WhatsApp.

## Background: this is the second jobs board

OurDahanu ran a jobs board at `/jobs` from 2026-04-06 to 2026-07-16. Employers
paid ₹40 per post (₹70 struck through) through Razorpay, every post waited for
admin approval, and there was a `job_reviewer` role. It received **4 paid posts
in about three months** and was removed with News and Forum in `b4e0b1e`.

The design below changes exactly the things that plausibly held it back:
posting is free, the board has two sides so it has content even when few
employers post, existing businesses post in one tap, and the admin seeds it
with collected jobs.

### Legacy cleanup — done 2026-09-14

The old empty `jobs` table was still in production. It was dropped in
`supabase/drop_legacy_jobs_table.sql` (`ecdb616`, `a1a56b3`), after verifying
with the service role that it held 0 rows and no profile had `job_reviewer`.

`get_homepage_stats` is `LANGUAGE sql` with a plain dollar-quoted body, so
Postgres did not track that it read `jobs`; dropping the table alone would have
succeeded and then broken the function, which `src/lib/data/home.ts` swallows
into a cached homepage showing 0 businesses. The migration replaced the function
without `total_jobs` (no web code read it) and dropped the table in one
transaction, without `CASCADE`. Verified afterwards: `jobs` returns `PGRST205`,
and `get_homepage_stats` returns 65 listings, 28 categories and the featured
listing.

**Left in place, unused, removable on request:** `pricing_config.job_base_price`
and `job_current_price` (currently 100 and 20), and `job_reviewer` in the
`profiles` role check constraint.

## Decisions (confirmed with the site owner)

| Question | Decision |
|---|---|
| What changes from the old board | Free to post; workers post too; one tap for existing businesses; admin posts collected jobs |
| How the sides reach each other | Call / WhatsApp, shown only after login |
| How long a post lives | 30 days, renewable, reminder before expiry |
| Approval | Instant for owners of approved businesses; everyone else waits for review |
| Architecture | New standalone app on new tables, following `find.ourdahanu.in` |
| Old `jobs` table | Drop it (done) |

## 1. The board

### Two kinds of post

| | Hiring (`kind = 'hiring'`) | Looking for work (`kind = 'seeking'`) |
|---|---|---|
| Headline | Role: "Cook", "Sales staff" | Skill: "Driver", "Tuition teacher" |
| Details | Employer name, category, work types, openings, pay (min–max per month/day/hour, or "Pay to be discussed"), area, timings, description | First name only, category, work types wanted, years of experience, area(s), short note |
| Contact | Phone, and whether it takes WhatsApp | Phone, and whether it takes WhatsApp |

"Looking for work" posts have **no photo, age, gender or address fields**.

### Categories (English / Marathi)

Validated server-side against a fixed list in `src/lib/jobs/categories.ts`, each
with a URL slug for category pages:

| Category | Marathi |
|---|---|
| Shop & Sales | दुकान व विक्री |
| Hotel, Restaurant & Catering | हॉटेल, रेस्टॉरंट व केटरिंग |
| Farm & Orchard | शेती व बागायत |
| Fishing & Seafood | मासेमारी व मत्स्य व्यवसाय |
| Driver & Delivery | ड्रायव्हर व डिलिव्हरी |
| Teaching & Tuition | शिक्षण व शिकवणी |
| Healthcare & Clinic | आरोग्य सेवा व दवाखाना |
| Office, Accounts & Computer | ऑफिस, हिशोब व संगणक |
| Factory & Industrial | कारखाना व औद्योगिक |
| Construction & Labour | बांधकाम व मजुरी |
| Electrician, Plumber & Technician | इलेक्ट्रिशियन, प्लंबर व तंत्रज्ञ |
| Domestic Help & Care | घरकाम व देखभाल |
| Security Guard | सुरक्षा रक्षक |
| Beauty & Salon | ब्युटी पार्लर व सलून |
| Other | इतर |

The Marathi labels are proofread by the site owner before launch (rollout step 4).

### Work types

`Full-time`, `Part-time`, `Daily wage`, `Seasonal`, `Internship`. A post has one
or more. For Google for Jobs they map to `FULL_TIME`, `PART_TIME`, `PER_DIEM`,
`TEMPORARY` and `INTERN`.

### Areas

Free text, with suggestions: Dahanu Road, Dahanu Town, Bordi, Gholvad,
Chinchani, Vangaon, Kasa, Talasari, Boisar, Tarapur, Palghar.

### Who can do what

- **Anyone:** browse, search, filter by category, work type and area, read
  posts. In place of contact details they see **Show phone number**, which asks
  them to log in.
- **Logged-in user:** reveal contact details; post "Looking for work" (one live
  profile per person) or a job as an individual; manage their own posts.
  Both wait for review.
- **Owner of an approved OurDahanu business:** **Post a job** from My Business,
  prefilled from the chosen listing (name, phone, WhatsApp, address). Goes live
  instantly with an "OurDahanu business" badge linking to their business page.
- **Admin and moderators:** review the queue; edit or remove any post; post
  collected jobs, which go live instantly labelled "Collected by OurDahanu"
  with a source such as "Lokmat, 12 Sep".

## 2. Data model

All new objects are additive, in `supabase/add_job_board.sql`.

### `job_posts`

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | `gen_random_uuid()` |
| `kind` | `text` NOT NULL | `CHECK (kind IN ('hiring','seeking'))` |
| `status` | `text` NOT NULL DEFAULT `'pending'` | `CHECK (status IN ('pending','approved','rejected','closed','removed'))` |
| `posted_by` | `uuid` NOT NULL | FK `auth.users(id)` `ON DELETE CASCADE` |
| `listing_id` | `uuid` | FK `listings(id)` `ON DELETE SET NULL`; the business, for hiring posts |
| `collected_source` | `text` | Set only on admin-collected posts |
| `title` | `text` NOT NULL | Role or skill |
| `category` | `text` NOT NULL | Validated in the app against the fixed list |
| `work_types` | `text[]` NOT NULL | At least one, validated in the app |
| `area` | `text` NOT NULL | |
| `description` | `text` | |
| `employer_name` | `text` | Hiring only |
| `openings` | `int` | Hiring only, `CHECK (openings BETWEEN 1 AND 500)` |
| `pay_min`, `pay_max` | `int` | Hiring only; both null means "Pay to be discussed" |
| `pay_period` | `text` | `CHECK (pay_period IN ('month','day','hour'))` |
| `timings` | `text` | Hiring only |
| `display_name` | `text` | Seeking only: first name |
| `experience_years` | `int` | Seeking only, `CHECK (experience_years BETWEEN 0 AND 60)` |
| `review_flags` | `text[]` NOT NULL DEFAULT `'{}'` | `scam_words`, `link_or_phone`, `reports` |
| `reject_reason` | `text` | |
| `reviewed_by` | `uuid` | FK `auth.users(id)` `ON DELETE SET NULL` |
| `reviewed_at` | `timestamptz` | |
| `published_at` | `timestamptz` | Set on each approval, instant publish and renewal; orders the board |
| `expires_at` | `timestamptz` | Null until first published |
| `reminder_sent_at` | `timestamptz` | |
| `created_at`, `updated_at` | `timestamptz` NOT NULL DEFAULT `now()` | `updated_at` is set by the server actions |

Table-level checks:

- **Kind consistency.** Hiring rows have `employer_name` and no `display_name` or
  `experience_years`. Seeking rows have `display_name`, and no `employer_name`,
  `listing_id`, `collected_source`, `openings`, `pay_min`, `pay_max` or
  `pay_period`.
- **Pay order.** `pay_min IS NULL OR pay_max IS NULL OR pay_max >= pay_min`, and
  both non-negative.
- **Approved posts are dated.** `status <> 'approved' OR (published_at IS NOT NULL AND expires_at IS NOT NULL)`.

Indexes:

- `(kind, published_at DESC) WHERE status = 'approved'` — the board.
- `(category) WHERE status = 'approved'` — category pages.
- `(posted_by, created_at DESC)` — My posts and the daily post limit.
- `(created_at) WHERE status = 'pending'` — the review queue.
- `(expires_at) WHERE status = 'approved' AND reminder_sent_at IS NULL` — the reminder cron.
- **Unique** `(posted_by) WHERE kind = 'seeking' AND status IN ('pending','approved')` — one live profile per person.

"Live" means `status = 'approved' AND expires_at > now()`. Expiry is a
comparison, never a status change, so nothing has to run for a post to expire.

The "OurDahanu business" badge is computed when reading, by joining the listing
and checking it is still approved; it is not stored.

### `job_post_contacts`

| Column | Type | Notes |
|---|---|---|
| `post_id` | `uuid` PK | FK `job_posts(id)` `ON DELETE CASCADE` |
| `phone` | `text` NOT NULL | Normalised 10-digit Indian number, `CHECK (phone ~ '^[1-9][0-9]{9}$')` |
| `whatsapp` | `boolean` NOT NULL DEFAULT `true` | `CHECK (NOT whatsapp OR phone ~ '^[6-9]')` — WhatsApp needs a mobile |
| `updated_at` | `timestamptz` NOT NULL DEFAULT `now()` | |

Phone numbers live in their own table because the public API is reachable with
the anon key that ships in every browser. If numbers were columns on
`job_posts`, which has a public read policy, anyone could download all of them
in one request regardless of what the pages hide. This split makes "contact
after login" a database guarantee.

Normalisation strips non-digits, then a leading `91` from 12-digit numbers and a
leading `0` from 11-digit numbers, leaving 10 digits. Mobiles start 6–9;
landlines with their STD code (e.g. Dahanu `02528…`) start 1–5.

### `job_contact_reveals`

`post_id` (FK `job_posts` `ON DELETE CASCADE`), `user_id` (FK `auth.users`
`ON DELETE CASCADE`), `created_at`. Primary key `(post_id, user_id)`; index
`(user_id, created_at DESC)`.

One row per user per post the first time that user reveals the number. It gives
posters "N people viewed your number" and backs the daily reveal limit.
A poster revealing their own post, and staff, are not recorded.

### `job_post_reports`

`id` PK, `post_id` (FK `job_posts` `ON DELETE CASCADE`), `user_id` (FK
`auth.users` `ON DELETE CASCADE`), `reason` `CHECK (reason IN ('asks_for_money','fake','filled','offensive','my_number','other'))`,
`note`, `created_at`. Unique `(post_id, user_id)`.

### Row-level security

- `job_posts`: RLS on.
  - `"Live job posts are public"` — `FOR SELECT TO anon, authenticated USING (status = 'approved' AND expires_at > now())`.
  - `"Posters can read their own job posts"` — `FOR SELECT TO authenticated USING (posted_by = auth.uid())`.
  - **No insert, update or delete policies.** Every write goes through server
    actions using the service role, which decide instant versus pending. (The
    old `jobs` table's insert policy let any logged-in user insert an
    already-approved post; this design has no such path.)
- `job_post_contacts`, `job_contact_reveals`, `job_post_reports`: RLS on, **no
  policies**, and `REVOKE ALL ... FROM anon, authenticated` for defence in depth.

`src/lib/database.types.ts` gains the four tables, hand-added (not regenerated).

## 3. Routing, pages, entry points, caching

### Routing

- `src/proxy.ts` gets a `jobs.ourdahanu.in` / `jobs.localhost` branch that
  rewrites page paths to `/jobs/*`, exactly like the find branch, plus its own
  host matcher entry. `jobs` is already in `RESERVED_SUBDOMAINS` and in all five
  inline regex literals, so no business can claim it and no literal changes.
- `ourdahanu.in/jobs/*` serves the same pages; every jobs page sets its
  canonical URL to `https://jobs.ourdahanu.in/...`.
- `jobs.ourdahanu.in` already resolves and reaches the app (verified
  2026-09-14: `200`, served by Vercel). **No DNS change is needed.** Today it
  serves a copy of the homepage; this feature fixes that.
- `src/components/SiteChrome.tsx`: the find-only host check becomes a list of
  standalone hosts — **find, appointments, jobs** — on which the main navbar,
  emergency ribbon, bottom tabs and footer are hidden. Adding appointments fixes
  the doubled ribbon and footer on `appointments.ourdahanu.in` (live HTML on
  2026-09-14 had twice find's emergency-ribbon text and two footers). Booking
  there is unaffected: `BookingWidget` has its own sign-in link.
- `findLoginHref` in `src/app/find/find-server.ts` is generalised into a helper
  that builds a main-site login URL returning to the current standalone host.
  Find's two callers keep identical behaviour.

### Pages on `jobs.ourdahanu.in`

| Path | Purpose |
|---|---|
| `/` | Tabs **Hiring** (default) and **Looking for work** (`?tab=seeking`); search; filters for category, work type and area; cards link to the post |
| `/c/[slug]` | Hiring posts in one category, e.g. "Cook jobs in Dahanu" |
| `/j/[id]` | Full post, safety notice, **Show phone number**, **Report**. Hiring posts render `JobPosting` JSON-LD. Seeking posts are `noindex`. Open Graph image |
| `/post` | Choose kind, then the form. Login required. `?listing=<id>` prefills from a business the user owns |
| `/my-posts` | The user's posts: status, days left, **Renew**, **Mark filled / Found work**, **Edit**, "N people viewed your number" |
| `/my-posts/[id]/edit` | Edit form |

The jobs layout mirrors find's: its own header ("JobsDahanu", **Post a job**),
skip link, and a footer linking back to OurDahanu.

### Show phone number

A client button calls the `revealJobContact` server action:

- Not logged in → returns a login URL; the button navigates there, and login
  returns the user to the post.
- Logged in → checks the post is live, checks the daily reveal limit, records
  the reveal, returns the number and WhatsApp flag; the button then shows
  **Call** and **WhatsApp**.

The post page itself stays fully cached; numbers never appear in its HTML.

### Google for Jobs

Hiring posts emit `JobPosting` with `title`, `description`, `datePosted`
(`published_at`), `validThrough` (`expires_at`), `employmentType` (mapped work
types), `hiringOrganization.name` (`employer_name`), `jobLocation` with
`addressLocality` (area), `addressRegion` "Maharashtra", `addressCountry` "IN",
and `baseSalary` when pay is given. It never contains a phone number. Validated
with Google's Rich Results Test after deploy.

### On the main site

- **My Business:** a **Post a job** card linking to `jobs.ourdahanu.in/post?listing=<id>`.
  The auth cookie is shared across `.ourdahanu.in`, so the login carries over.
- **Admin → Jobs** (`/admin/jobs`, admin or moderator): pending queue with
  flags and report counts, all live posts with edit and remove, a **Post a
  collected job** form, and the two success numbers (live posts, reveals this
  month). Linked from `AdminNav`.
- **Navbar, footer and homepage hero:** a Jobs link, restored (they were removed
  in July). Shipped last, separately (rollout step 5).
- **Sitemap:** the board, category pages and live hiring posts, as cross-host
  entries like Find's. Seeking posts are excluded.

### Caching

- `CACHE_TAGS.jobs = 'jobs'`, with an update helper in `src/lib/cache-tags.ts`
  called from every mutating action (create, edit, approve, reject, remove,
  renew, close, auto-hide).
- Public reads use `'use cache'` with `cacheTag(CACHE_TAGS.jobs)` and the
  `hours` cache profile, through the public client, so RLS applies the live
  filter at query time. An expired post therefore leaves the board within about
  an hour even with no writes.

## 4. Posting, moderation, notifications, reminders

### Creating a post

| Who | Path | Starts as |
|---|---|---|
| Individual (either kind) | `/post` | `pending` |
| Business owner, with a listing chosen | **Post a job** / `/post?listing=` | `approved` (published now, expires in 30 days) |
| Admin or moderator, collected post | Admin → Jobs | `approved` |

The server decides, never the form. A post starts approved only if:

- it is a collected post by staff; or
- a listing is chosen, the user passes `requireListingAccess(listingId)` (owner,
  or admin/moderator), **and** that listing is currently `approved = true` —
  `requireListingAccess` does not check approval, so this is checked separately —
  **and** the scam check raised no flags.

Otherwise it is pending. A business owner posting without choosing a listing is
treated as an individual.

### Validation (every create and edit)

- Required fields for the kind; category from the fixed list; at least one
  valid work type.
- Length caps: title 80, employer name 100, area 80, timings 80, description
  1,000, display name 40.
- Pay: non-negative integers, max ≥ min; pay period required when either is set.
- Phone normalises to a valid 10-digit number; WhatsApp only for mobiles.
- **At most 5 new posts per user per rolling 24 hours**, counted from
  `job_posts` (staff exempt).
- One live seeking profile per person, also enforced by the unique index; a
  `23505` there becomes "You already have a profile — edit or renew it".

### Editing

| Post status | After an edit |
|---|---|
| `pending` | stays `pending` |
| `rejected` | becomes `pending` (fix and resubmit) |
| `approved`, business post whose listing is still approved, or staff-collected | stays `approved`, unless the edit raises scam flags, then `pending` |
| `approved`, individual post | becomes `pending` |
| `closed`, `removed` | not editable |

### Moderation (Admin → Jobs)

- **Approve:** `status = 'approved'`, `published_at = now()`,
  `expires_at = now() + 30 days`, clears `review_flags` and `reminder_sent_at`,
  records reviewer. Every approval restarts the 30 days, including re-approval
  after an edit or a report hide.
- **Reject:** requires a reason; `status = 'rejected'`.
- **Remove:** `status = 'removed'` for any post.

### Renew and close

- **Renew** is available on an approved post when it has **3 days or fewer
  left, or has already expired — with no cut-off after expiry**. It sets
  `expires_at = now() + 30 days`, `published_at = now()` (back to the top of the
  board) and clears `reminder_sent_at`. Limiting it to the last 3 days stops
  daily bumping. Having no cut-off lets someone whose profile lapsed long ago
  renew it instead of being blocked by the one-profile rule.
- **Mark filled / Found work** sets `status = 'closed'`. Closed is final; to
  hire again, post again.

### Notifications

Through the existing engine (`sendNotification` / `sendNotificationToAdmins`),
respecting each user's preferences:

- `admin.new_submission` gains kinds `job` (every pending post) and
  `job_report` (every report).
- New types: `job.approved`, `job.rejected` (with the reason) and `job.expiring`
  ("Your post 'Cook' expires in 3 days — Renew"). Each is added to
  `NOTIFICATION_TYPES`, the payload map and the `renderNotification` switch.
- Instant and collected posts do not notify the admin.
- Posters are not told when a report hides their post.

### Reminder cron

- `src/app/api/cron/job-reminders/route.ts`, guarded by `CRON_SECRET` like the
  existing cron.
- `vercel.json` adds `{ "path": "/api/cron/job-reminders", "schedule": "30 3 * * *" }`
  — 09:00 IST daily. Hobby allows daily crons (up to 100 per project), and may
  fire anywhere within that hour.
- Selects approved posts with `reminder_sent_at IS NULL` and
  `now() < expires_at <= now() + 3 days`, sends `job.expiring`, then sets
  `reminder_sent_at`. A re-run never double-sends.
- The existing weekly `listing-expiry` cron is untouched.

## 5. Safety and privacy

### Scams

- The post form states: "Jobs must never ask applicants to pay. Posts that ask
  for money are removed." Every post page shows: "Never pay anyone to get a job.
  Report posts that ask for money."
- A pure scam check (`src/lib/jobs/scam-signals.ts`) flags:
  - `scam_words`: fee words in English, Marathi and Hindi — "registration fee",
    "deposit", "advance fee", "pay in advance", "processing fee", "शुल्क", "फी",
    "नोंदणी शुल्क", "डिपॉझिट" — matched as whole words, so "coffee" does not
    match "fee";
  - `link_or_phone`: any URL, or a phone number typed into free-text fields.
- A flagged post goes to review even when it would otherwise be instant, and the
  flags show in the queue. Staff-collected posts skip the check.

### Reports

- Logged-in users can report any post except their own, once per post, with a
  reason: asks for money, fake or misleading, already filled, offensive, "this
  is my number, remove it", or other.
- The admin is notified of every report.
- **Three reports from different users, counted since the post's last review,
  hide an approved post automatically:** `status = 'pending'`, `review_flags`
  gains `reports`. Counting since the last review means an approved-again post
  needs three new reports to be hidden again.

### Harvesting limits

Counted in the database, so they hold across server instances (unlike
`src/lib/rate-limit.ts`, which is per-instance):

- **Reveals: 30 per user per rolling 24 hours**, counted from `job_contact_reveals`.
  Re-revealing a number already revealed does not count.
- **New posts: 5 per user per rolling 24 hours**, counted from `job_posts`.
- Staff are exempt from both.
- Posters see only the count of people who viewed their number, never who.

### Privacy for people looking for work

- First name, skill, area and experience only.
- Seeking post pages are `noindex` and excluded from the sitemap, so a person's
  profile does not linger in search results after they find work. Hiring posts
  are indexed.
- Numbers never appear in page HTML, the sitemap or structured data.
- Deleting an account cascades to that user's posts, numbers, reveals and reports.

### Privacy policy

`src/app/privacy/page.tsx` gains a Jobs paragraph in the same change: what is
public, what needs a login, that number reveals are counted, and that "looking
for work" profiles are hidden from search engines.

## 6. Testing

### Unit tests

`node:test` via `tsx --test`; every new test file registered in the explicit
`test:existing` list in `package.json`.

- **Validation** for both kinds: required fields, category list, work types,
  length caps, pay rules, and phone normalisation — `+91 98765 43210`,
  `098765 43210` and `9876543210` normalise alike; a landline with STD code is
  accepted without WhatsApp.
- **Publish rules:** instant for the owner of an approved listing; pending for
  a lapsed listing, an individual, and any flagged post; instant for staff
  collected posts. **Edit rules** per the table in section 4.
- **Scam check:** each listed fee word, a URL and a typed phone number flag;
  "coffee" and "free" do not; "No registration fee" does flag, deliberately —
  a false alarm costs one review, a missed scam costs a victim.
- **Dates:** approval and renewal set 30 days; renew availability at 4 days
  left (no), 3 days (yes), expired a year ago (yes); reminder due within 3 days
  and not after `reminder_sent_at` is set.
- **Pay display:** "₹12,000–15,000 / month", "₹500 / day", "Pay to be discussed".
- **`JobPosting` builder:** contains no phone number; `validThrough` equals
  `expires_at`; work types map correctly.
- **Report threshold:** hides at the third report since last review, not before,
  and not again until three newer reports.
- **Server actions** are built as `createJobActions(deps)` in
  `src/app/actions/jobs-core.ts`, like `find-core.ts`, and tested with fakes:
  the instant path, edits returning to review, both daily limits, the
  one-profile `23505` message, login-required reveals, and staff exemptions.

### Database checks after the migration

Through the public API with the anon key, as was done for `listing_events`:
anon can read live posts; gets nothing from `job_post_contacts`,
`job_contact_reveals` and `job_post_reports`; cannot insert into `job_posts`.

### Browser checks

On `localhost:3000/jobs/...`, because the in-app browser cannot resolve
`*.localhost` subdomains (seen with `appointments.localhost`). The real
subdomain, the chrome fix on find and appointments, and Google's Rich Results
Test are checked after deploy.

## 7. Rollout

1. **Legacy cleanup** — done (above).
2. **Migration** `supabase/add_job_board.sql` — via the Supabase connector if it
   is back, otherwise pasted by the site owner, then the database checks above.
3. **Deploy the board with no public entry points.** It is live at
   `jobs.ourdahanu.in`, but nothing on the main site links to it.
4. **Seed quietly.** The site owner proofreads the Marathi category labels,
   posts 10–15 collected jobs, and asks a handful of businesses to use
   **Post a job**.
5. **Entry points** — navbar, footer, homepage hero link and the My Business
   card — as the final, separately mergeable task; then announce in local
   WhatsApp groups.

Also in step 5: `docs/mobile-api.md` still lists `jobs` and `news` among the
tables the app reads directly; both are gone, so that line is corrected.

## Success measures

The old board never measured anything. For the first month after entry points
go live: **30 live posts** and **100 number reveals**, both shown on
Admin → Jobs.

## Out of scope

- In-app applications, chat, CV uploads and photos.
- Paid or featured posts.
- Job alerts and subscriptions.
- Mobile-app screens and a jobs API for the app.
- Company pages.
- Automatic import from WhatsApp groups.
- Removing the unused `pricing_config` job columns and the `job_reviewer` role
  (on request).
