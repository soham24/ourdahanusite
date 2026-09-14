# Jobs Board (jobs.ourdahanu.in) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the free, two-sided local jobs board at `jobs.ourdahanu.in` described in `docs/superpowers/specs/2026-09-14-jobs-board-design.md`.

**Architecture:** New additive tables (`job_posts`, with phone numbers split into `job_post_contacts`, plus reveal and report tables) behind row-level security that exposes only live posts. All writes go through server actions whose business rules live in a dependency-injected core (`jobs-core.ts`) built on pure, unit-tested helpers in `src/lib/jobs/`. The standalone subdomain follows the existing `find.ourdahanu.in` pattern: a proxy rewrite to `/jobs/*`, its own layout, and cached public reads invalidated by a `jobs` cache tag.

**Tech Stack:** Next.js 16.2.1 App Router with Cache Components, React 19, Supabase (live production), `node:test` via `tsx --test`, Tailwind, lucide-react.

## Global Constraints

Every task's requirements implicitly include this section. Values are copied from the spec.

- **The database is LIVE PRODUCTION.** Migrations are additive and idempotent. Apply only through the Supabase MCP `apply_migration` tool (project `slmbqngmxketyxjauxxk`). If that tool is unavailable, stop and report — never reach the database another way (no psql, no connection strings, no REST calls with the service-role key).
- **Every write to a job table goes through a server action using `createAdminClient()`** (service role). Every call site handles it returning `null`.
- **Phone numbers live only in `job_post_contacts`.** Never in `job_posts`, page HTML, the sitemap, structured data or logs.
- **"Live" means `status = 'approved' AND expires_at > now()`.** Expiry is a comparison, never a status change.
- **Limits:** 5 new posts per user per rolling 24 hours; 30 number reveals per user per rolling 24 hours (re-revealing a number already revealed does not count); staff (admin or moderator) exempt from both. Three reports since a post's last review hide an approved post.
- **Lifecycle:** posts live 30 days from each approval, instant publish or renewal. Renew is available on an approved post with 3 days or fewer left, or already expired, with no cut-off after expiry. The reminder is sent once, within 3 days of expiry.
- **Text limits:** title 80, employer name 100, area 80, timings 80, description 1,000, display name 40, collected source 80.
- **`JOBS_URL = 'https://jobs.ourdahanu.in'`**, hardcoded like the existing `FIND_URL`.
- **Links inside jobs pages use `/jobs/...` paths.** They work on both hosts: the proxy leaves a path that already starts with `/jobs` untouched.
- **Tests:** `node:test` via `tsx --test`. Every new test file is appended to the explicit list in `package.json`'s `test:existing` script — the runner does not glob. The suite currently passes 123 unit tests (`npm run test:existing`) and 47 game tests.
- **Modules imported by a test use relative imports for runtime values.** No existing test resolves the `@/` alias at runtime; `import type` from `@/` is fine because it is erased.
- **`npx tsc --noEmit` stays clean.** No `any`, no `@ts-ignore`. `as` casts are allowed only on Supabase query results, which is the existing data-layer pattern (see `src/lib/data/find.ts`).
- **Lint baseline is 0 errors / 11 warnings.** A task adds zero problems of either kind. `react-hooks/set-state-in-effect` is enforced: never call `setState` inside `useEffect`.
- **`'use server'` files export only async functions** (see the NOTE at the top of `src/app/actions/find.ts`). Types are imported from the non-server module that defines them.
- **Next.js 16:** `params` and `searchParams` are Promises. Cache invalidation happens only through the helpers in `src/lib/cache-tags.ts`, called from server actions. This Next.js has breaking changes from older versions — read `node_modules/next/dist/docs/` whenever an API is unclear.
- **Browser checks** run on `http://localhost:3000/jobs/...`. The in-app browser cannot resolve `*.localhost` subdomains. Start the dev server with the Browser pane's `preview_start` (`dev` config), never from a shell.
- Scratch files go in the system temp directory, never the repo. If the dev server rewrites `next-env.d.ts`, revert it before committing.

## File Map

| File | Responsibility | Task |
|---|---|---|
| `supabase/add_job_board.sql` | Tables, indexes, RLS, privilege revokes | 1 |
| `src/lib/database.types.ts` | Hand-added types for the four tables | 1 |
| `src/lib/jobs/categories.ts` | Category list, Marathi labels, slugs | 2 |
| `src/lib/jobs/options.ts` | Work types, Google employment types, pay periods, area suggestions | 2 |
| `src/lib/jobs/phone.ts` | Indian phone normalisation, links, display | 2 |
| `src/lib/jobs/validation.ts` | Input → column values, every validation rule | 2 |
| `src/lib/jobs/validation.test.ts` | Tests for Task 2 | 2 |
| `src/lib/jobs/scam-signals.ts` | Review flags from free text | 3 |
| `src/lib/jobs/rules.ts` | Instant-vs-pending, edit outcomes, report threshold | 3 |
| `src/lib/jobs/lifecycle.ts` | Publish window, live, renew, reminder, days left | 3 |
| `src/lib/jobs/rules.test.ts` | Tests for Task 3 | 3 |
| `src/lib/jobs/pay.ts` | Pay wording | 4 |
| `src/lib/jobs/job-posting-ld.ts` | Google for Jobs `JobPosting` builder | 4 |
| `src/lib/jobs/display.test.ts` | Tests for Task 4 | 4 |
| `src/lib/standalone-hosts.ts` + `.test.ts` | Standalone subdomain detection, login URL | 5 |
| `src/proxy.ts` | `jobs` host rewrite and matcher | 5 |
| `src/components/SiteChrome.tsx` | Hide main chrome on find, appointments, jobs | 5 |
| `src/app/find/find-server.ts` | Delegates to the shared login helper | 5 |
| `src/lib/notifications/types.ts`, `templates.ts`, `job-templates.test.ts` | Job notification types and copy | 6 |
| `src/app/actions/jobs-core.ts` + `.test.ts` | Business rules for every job action, dependency-injected | 7 |
| `src/lib/cache-tags.ts` | `jobs` tag and invalidation helper | 8 |
| `src/lib/jobs/types.ts` | `PublicJobPost` shape | 8 |
| `src/lib/data/jobs.ts` | Cached public reads | 8 |
| `src/app/jobs/jobs-server.ts` | Login URL for the jobs host | 8 |
| `src/app/actions/jobs.ts` | Server actions wiring the core to Supabase | 8 |
| `src/app/jobs/layout.tsx`, `jobs-ui.tsx`, `JobCard.tsx`, `page.tsx`, `c/[slug]/page.tsx`, `j/[id]/page.tsx`, `j/[id]/ShowContactButton.tsx`, `j/[id]/ReportPostButton.tsx`, `j/[id]/opengraph-image.tsx` | Public board | 9 |
| `src/app/jobs/post/page.tsx`, `post/JobPostForm.tsx`, `my-posts/page.tsx`, `my-posts/MyPostActions.tsx`, `my-posts/[id]/edit/page.tsx` | Posting and managing posts | 10 |
| `src/app/actions/admin-jobs.ts`, `src/app/admin/jobs/page.tsx`, `src/app/admin/jobs/AdminJobActions.tsx`, `src/app/admin/AdminNav.tsx` | Moderation | 11 |
| `src/app/api/cron/job-reminders/route.ts`, `vercel.json` | Daily expiry reminders | 12 |
| `src/app/sitemap.ts`, `src/app/privacy/page.tsx` | Sitemap entries and privacy disclosure | 13 |
| `src/components/Navbar.tsx`, `src/components/Footer.tsx`, `src/app/page-components/HeroSection.tsx`, `src/app/my-business/page.tsx`, `docs/mobile-api.md` | Public entry points (ship last) | 14 |

---

### Task 1: Database tables and types

**Files:**
- Create: `supabase/add_job_board.sql`
- Modify: `src/lib/database.types.ts`

**Interfaces:**
- Produces: tables `job_posts`, `job_post_contacts`, `job_contact_reveals`, `job_post_reports` with the columns below, and their TypeScript types (later tasks query them through the typed public client).

- [ ] **Step 1: Write the migration**

Create `supabase/add_job_board.sql`:

```sql
-- Jobs board for jobs.ourdahanu.in.
-- Spec: docs/superpowers/specs/2026-09-14-jobs-board-design.md
--
-- Additive and safe to re-run. Every write goes through server actions using
-- the service role; the only public access is reading live posts.

CREATE TABLE IF NOT EXISTS public.job_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK (kind IN ('hiring', 'seeking')),
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected', 'closed', 'removed')),
  posted_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  listing_id uuid REFERENCES public.listings(id) ON DELETE SET NULL,
  collected_source text,
  title text NOT NULL,
  category text NOT NULL,
  work_types text[] NOT NULL,
  area text NOT NULL,
  description text,
  employer_name text,
  openings int CHECK (openings BETWEEN 1 AND 500),
  pay_min int CHECK (pay_min >= 1),
  pay_max int CHECK (pay_max >= 1),
  pay_period text CHECK (pay_period IN ('month', 'day', 'hour')),
  timings text,
  display_name text,
  experience_years int CHECK (experience_years BETWEEN 0 AND 60),
  review_flags text[] NOT NULL DEFAULT '{}',
  reject_reason text,
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  published_at timestamptz,
  expires_at timestamptz,
  reminder_sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  -- Each kind carries only its own fields.
  CONSTRAINT job_posts_kind_fields CHECK (
    (kind = 'hiring'
      AND employer_name IS NOT NULL
      AND display_name IS NULL
      AND experience_years IS NULL)
    OR
    (kind = 'seeking'
      AND display_name IS NOT NULL
      AND employer_name IS NULL
      AND listing_id IS NULL
      AND collected_source IS NULL
      AND openings IS NULL
      AND pay_min IS NULL
      AND pay_max IS NULL
      AND pay_period IS NULL)
  ),
  CONSTRAINT job_posts_pay_order CHECK (pay_min IS NULL OR pay_max IS NULL OR pay_max >= pay_min),
  -- An approved post always knows when it went live and when it expires.
  CONSTRAINT job_posts_approved_dated CHECK (
    status <> 'approved' OR (published_at IS NOT NULL AND expires_at IS NOT NULL)
  )
);

-- The board.
CREATE INDEX IF NOT EXISTS idx_job_posts_board
  ON public.job_posts (kind, published_at DESC) WHERE status = 'approved';
-- Category pages.
CREATE INDEX IF NOT EXISTS idx_job_posts_category
  ON public.job_posts (category) WHERE status = 'approved';
-- My posts, and the daily post limit.
CREATE INDEX IF NOT EXISTS idx_job_posts_posted_by
  ON public.job_posts (posted_by, created_at DESC);
-- The review queue.
CREATE INDEX IF NOT EXISTS idx_job_posts_pending
  ON public.job_posts (created_at) WHERE status = 'pending';
-- The reminder cron.
CREATE INDEX IF NOT EXISTS idx_job_posts_reminders
  ON public.job_posts (expires_at) WHERE status = 'approved' AND reminder_sent_at IS NULL;
-- One live "looking for work" profile per person. A lapsed profile is renewed,
-- not duplicated.
CREATE UNIQUE INDEX IF NOT EXISTS idx_job_posts_one_seeking_profile
  ON public.job_posts (posted_by) WHERE kind = 'seeking' AND status IN ('pending', 'approved');

-- Phone numbers live apart from posts. job_posts has a public read policy and
-- the anon key ships in every browser, so a number stored there could be
-- downloaded by anyone in one request, whatever the pages hide. Here the table
-- has no policies at all: "contact after login" is a database guarantee.
CREATE TABLE IF NOT EXISTS public.job_post_contacts (
  post_id uuid PRIMARY KEY REFERENCES public.job_posts(id) ON DELETE CASCADE,
  -- Normalised 10-digit Indian number. Mobiles start 6-9; landlines with
  -- their STD code start 1-5.
  phone text NOT NULL CHECK (phone ~ '^[1-9][0-9]{9}$'),
  whatsapp boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT job_post_contacts_whatsapp_mobile CHECK (NOT whatsapp OR phone ~ '^[6-9]')
);

-- One row per user per post, written the first time that user reveals the
-- number. Gives posters "N people viewed your number" and backs the daily
-- reveal limit.
CREATE TABLE IF NOT EXISTS public.job_contact_reveals (
  post_id uuid NOT NULL REFERENCES public.job_posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_job_contact_reveals_user
  ON public.job_contact_reveals (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.job_post_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.job_posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason text NOT NULL
    CHECK (reason IN ('asks_for_money', 'fake', 'filled', 'offensive', 'my_number', 'other')),
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT job_post_reports_once UNIQUE (post_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_job_post_reports_post
  ON public.job_post_reports (post_id, created_at DESC);

ALTER TABLE public.job_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_post_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_contact_reveals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_post_reports ENABLE ROW LEVEL SECURITY;

-- DROP ... IF EXISTS only makes a re-run safe: both policies are created by
-- this file, nowhere else.
DROP POLICY IF EXISTS "Live job posts are public" ON public.job_posts;
CREATE POLICY "Live job posts are public" ON public.job_posts
  FOR SELECT TO anon, authenticated
  USING (status = 'approved' AND expires_at > now());

DROP POLICY IF EXISTS "Posters can read their own job posts" ON public.job_posts;
CREATE POLICY "Posters can read their own job posts" ON public.job_posts
  FOR SELECT TO authenticated
  USING (posted_by = auth.uid());

-- No insert, update or delete policies anywhere. Defence in depth on top of
-- RLS: the public API roles hold no write privileges on job_posts and no
-- privileges at all on the other three tables.
REVOKE INSERT, UPDATE, DELETE ON public.job_posts FROM anon, authenticated;
REVOKE ALL ON public.job_post_contacts FROM anon, authenticated;
REVOKE ALL ON public.job_contact_reveals FROM anon, authenticated;
REVOKE ALL ON public.job_post_reports FROM anon, authenticated;
```

- [ ] **Step 2: Add the four tables to the generated types**

In `src/lib/database.types.ts`, inside `public` → `Tables`, add these blocks in alphabetical position (after the last table whose name sorts before `job_contact_reveals`). Do **not** regenerate the file — the generator introduces unrelated churn and drops the header. The `auth.users` foreign keys do not appear under `Relationships`; the generator only lists relations inside the `public` schema.

```ts
      job_contact_reveals: {
        Row: {
          created_at: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_contact_reveals_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "job_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      job_post_contacts: {
        Row: {
          phone: string
          post_id: string
          updated_at: string
          whatsapp: boolean
        }
        Insert: {
          phone: string
          post_id: string
          updated_at?: string
          whatsapp?: boolean
        }
        Update: {
          phone?: string
          post_id?: string
          updated_at?: string
          whatsapp?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "job_post_contacts_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: true
            referencedRelation: "job_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      job_post_reports: {
        Row: {
          created_at: string
          id: string
          note: string | null
          post_id: string
          reason: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          note?: string | null
          post_id: string
          reason: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          note?: string | null
          post_id?: string
          reason?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_post_reports_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "job_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      job_posts: {
        Row: {
          area: string
          category: string
          collected_source: string | null
          created_at: string
          description: string | null
          display_name: string | null
          employer_name: string | null
          experience_years: number | null
          expires_at: string | null
          id: string
          kind: string
          listing_id: string | null
          openings: number | null
          pay_max: number | null
          pay_min: number | null
          pay_period: string | null
          posted_by: string
          published_at: string | null
          reject_reason: string | null
          reminder_sent_at: string | null
          review_flags: string[]
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          timings: string | null
          title: string
          updated_at: string
          work_types: string[]
        }
        Insert: {
          area: string
          category: string
          collected_source?: string | null
          created_at?: string
          description?: string | null
          display_name?: string | null
          employer_name?: string | null
          experience_years?: number | null
          expires_at?: string | null
          id?: string
          kind: string
          listing_id?: string | null
          openings?: number | null
          pay_max?: number | null
          pay_min?: number | null
          pay_period?: string | null
          posted_by: string
          published_at?: string | null
          reject_reason?: string | null
          reminder_sent_at?: string | null
          review_flags?: string[]
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          timings?: string | null
          title: string
          updated_at?: string
          work_types: string[]
        }
        Update: {
          area?: string
          category?: string
          collected_source?: string | null
          created_at?: string
          description?: string | null
          display_name?: string | null
          employer_name?: string | null
          experience_years?: number | null
          expires_at?: string | null
          id?: string
          kind?: string
          listing_id?: string | null
          openings?: number | null
          pay_max?: number | null
          pay_min?: number | null
          pay_period?: string | null
          posted_by?: string
          published_at?: string | null
          reject_reason?: string | null
          reminder_sent_at?: string | null
          review_flags?: string[]
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          timings?: string | null
          title?: string
          updated_at?: string
          work_types?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "job_posts_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
        ]
      }
```

- [ ] **Step 3: Typecheck and commit**

Run: `npx tsc --noEmit`
Expected: clean, exit 0.

```bash
git add supabase/add_job_board.sql src/lib/database.types.ts
git commit -m "feat(jobs): add job board tables and types"
```

- [ ] **Step 4: Apply the migration**

If the Supabase MCP `apply_migration` tool is available, apply the exact contents of `supabase/add_job_board.sql` with name `add_job_board` to project `slmbqngmxketyxjauxxk`, then do Step 5.

If it is not available, **stop here** and report `DONE_WITH_CONCERNS`: the migration is written, typed and committed but not applied. The controller arranges for the site owner to apply it. Do not attempt any other route to the database.

- [ ] **Step 5: Verify through the public API (only once applied)**

The anon key is public by design (it ships in every browser), so these probes are safe. Read it and the URL from `.env.local` without printing either:

```bash
URL=$(grep -E '^NEXT_PUBLIC_SUPABASE_URL=' .env.local | cut -d= -f2- | tr -d '"\r ')
KEY=$(grep -E '^NEXT_PUBLIC_SUPABASE_ANON_KEY=' .env.local | cut -d= -f2- | tr -d '"\r ')
curl -s -w "\nHTTP %{http_code}\n" "$URL/rest/v1/job_posts?select=id&limit=1" -H "apikey: $KEY" -H "Authorization: Bearer $KEY"
curl -s -w "\nHTTP %{http_code}\n" "$URL/rest/v1/job_post_contacts?select=post_id&limit=1" -H "apikey: $KEY" -H "Authorization: Bearer $KEY"
curl -s -w "\nHTTP %{http_code}\n" -X POST "$URL/rest/v1/job_posts" -H "apikey: $KEY" -H "Authorization: Bearer $KEY" -H "Content-Type: application/json" -d '{"kind":"hiring","title":"probe","category":"Other","work_types":["Full-time"],"area":"x","employer_name":"x","posted_by":"00000000-0000-0000-0000-000000000000"}'
```

Expected:
- `job_posts` read → `HTTP 200` and `[]`.
- `job_post_contacts` read → `HTTP 401` with code `42501` (permission denied).
- `job_posts` insert → `HTTP 401` with code `42501`. Nothing is inserted.

Report all three results verbatim.

---

### Task 2: Categories, options, phone numbers and validation

**Files:**
- Create: `src/lib/jobs/categories.ts`
- Create: `src/lib/jobs/options.ts`
- Create: `src/lib/jobs/phone.ts`
- Create: `src/lib/jobs/validation.ts`
- Create: `src/lib/jobs/validation.test.ts`
- Modify: `package.json` (register the test file)

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `categories.ts`: `JOB_CATEGORIES`, `type JobCategory`, `JOB_CATEGORY_MR`, `isValidJobCategory(value: string): value is JobCategory`, `jobCategoryMarathi(value: string): string | null`, `jobCategorySlug(value: string): string`, `jobCategoryFromSlug(slug: string): JobCategory | null`
  - `options.ts`: `WORK_TYPES`, `type WorkType`, `isValidWorkType(value: string): value is WorkType`, `GOOGLE_EMPLOYMENT_TYPE: Record<WorkType, string>`, `PAY_PERIODS`, `type PayPeriod`, `isPayPeriod(value: string): value is PayPeriod`, `AREA_SUGGESTIONS`
  - `phone.ts`: `normalizeIndianPhone(raw: string): string | null`, `isIndianMobile(phone10: string): boolean`, `telHrefIndia(phone10: string): string`, `waHrefIndia(phone10: string): string`, `formatIndianPhone(phone10: string): string`
  - `validation.ts`: `type JobKind = 'hiring' | 'seeking'`, `interface JobPostInput`, `interface JobPostFields`, `interface ContactFields { phone: string; whatsapp: boolean }`, `type ValidationResult`, `JOB_TEXT_LIMITS`, `validateJobPostInput(input: JobPostInput): ValidationResult`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/jobs/validation.test.ts`:

```ts
import { test } from 'node:test'
import assert from 'node:assert/strict'

import {
  JOB_CATEGORIES,
  jobCategoryFromSlug,
  jobCategoryMarathi,
  jobCategorySlug,
} from './categories'
import {
  formatIndianPhone,
  isIndianMobile,
  normalizeIndianPhone,
  telHrefIndia,
  waHrefIndia,
} from './phone'
import { validateJobPostInput, type JobPostInput } from './validation'

test('every category has a unique slug that round-trips', () => {
  const slugs = JOB_CATEGORIES.map(jobCategorySlug)
  assert.equal(new Set(slugs).size, JOB_CATEGORIES.length)
  for (const category of JOB_CATEGORIES) {
    assert.equal(jobCategoryFromSlug(jobCategorySlug(category)), category)
  }
  assert.equal(jobCategorySlug('Hotel, Restaurant & Catering'), 'hotel-restaurant-catering')
  assert.equal(jobCategoryFromSlug('not-a-category'), null)
})

test('every category has a Marathi label', () => {
  for (const category of JOB_CATEGORIES) assert.ok(jobCategoryMarathi(category), category)
  assert.equal(jobCategoryMarathi('Unknown'), null)
})

test('phone numbers normalise to 10 digits whatever the formatting', () => {
  for (const raw of ['+91 98765 43210', '098765 43210', '9876543210', '91-98765-43210', '(987) 654-3210']) {
    assert.equal(normalizeIndianPhone(raw), '9876543210', raw)
  }
})

test('landlines with an STD code are valid but are not mobiles', () => {
  assert.equal(normalizeIndianPhone('02528 222333'), '2528222333')
  assert.equal(isIndianMobile('2528222333'), false)
  assert.equal(isIndianMobile('9876543210'), true)
})

test('invalid phone numbers are rejected', () => {
  for (const raw of ['', '12345', '0000000000', '98765432101234', 'call me']) {
    assert.equal(normalizeIndianPhone(raw), null, raw)
  }
})

test('phone links and display', () => {
  assert.equal(telHrefIndia('9876543210'), 'tel:+919876543210')
  assert.equal(waHrefIndia('9876543210'), 'https://wa.me/919876543210')
  assert.equal(formatIndianPhone('9876543210'), '98765 43210')
  assert.equal(formatIndianPhone('2528222333'), '02528222333')
})

function hiring(overrides: Partial<JobPostInput> = {}): JobPostInput {
  return {
    kind: 'hiring',
    title: 'Cook',
    category: 'Hotel, Restaurant & Catering',
    workTypes: ['Full-time'],
    area: 'Dahanu Road',
    description: 'Morning shift, lunch included.',
    employerName: 'Sai Hotel',
    openings: 2,
    payMin: 12000,
    payMax: 15000,
    payPeriod: 'month',
    timings: '9am–6pm',
    phone: '+91 98765 43210',
    whatsapp: true,
    ...overrides,
  }
}

function seeking(overrides: Partial<JobPostInput> = {}): JobPostInput {
  return {
    kind: 'seeking',
    title: 'Driver',
    category: 'Driver & Delivery',
    workTypes: ['Full-time', 'Daily wage'],
    area: 'Bordi',
    description: 'Heavy licence, 5 years with a transport company.',
    displayName: 'Ramesh',
    experienceYears: 5,
    phone: '9876543210',
    whatsapp: true,
    ...overrides,
  }
}

test('a valid hiring post normalises into column values', () => {
  const result = validateJobPostInput(hiring({ title: '  Cook  ', workTypes: ['Full-time', 'Full-time'] }))
  assert.equal(result.ok, true)
  if (!result.ok) return
  assert.deepEqual(result.fields, {
    kind: 'hiring',
    title: 'Cook',
    category: 'Hotel, Restaurant & Catering',
    work_types: ['Full-time'],
    area: 'Dahanu Road',
    description: 'Morning shift, lunch included.',
    employer_name: 'Sai Hotel',
    openings: 2,
    pay_min: 12000,
    pay_max: 15000,
    pay_period: 'month',
    timings: '9am–6pm',
    display_name: null,
    experience_years: null,
    listing_id: null,
    collected_source: null,
  })
  assert.deepEqual(result.contact, { phone: '9876543210', whatsapp: true })
})

test('a valid seeking post drops every hiring-only field', () => {
  const result = validateJobPostInput(
    seeking({
      employerName: 'Should vanish',
      payMin: 500,
      payPeriod: 'day',
      listingId: '11111111-1111-4111-8111-111111111111',
      collectedSource: 'Lokmat',
    }),
  )
  assert.equal(result.ok, true)
  if (!result.ok) return
  assert.equal(result.fields.display_name, 'Ramesh')
  assert.equal(result.fields.experience_years, 5)
  assert.deepEqual(result.fields.work_types, ['Full-time', 'Daily wage'])
  for (const key of ['employer_name', 'openings', 'pay_min', 'pay_max', 'pay_period', 'timings', 'listing_id', 'collected_source'] as const) {
    assert.equal(result.fields[key], null, key)
  }
})

test('pay is optional', () => {
  const result = validateJobPostInput(hiring({ payMin: null, payMax: null, payPeriod: null }))
  assert.equal(result.ok, true)
  if (!result.ok) return
  assert.equal(result.fields.pay_min, null)
  assert.equal(result.fields.pay_max, null)
  assert.equal(result.fields.pay_period, null)
})

test('a landline is accepted when WhatsApp is off', () => {
  const result = validateJobPostInput(hiring({ phone: '02528 222333', whatsapp: false }))
  assert.equal(result.ok, true)
  if (!result.ok) return
  assert.deepEqual(result.contact, { phone: '2528222333', whatsapp: false })
})

const REJECTIONS: Array<[string, JobPostInput, RegExp]> = [
  ['a missing title', hiring({ title: '   ' }), /job title/],
  ['a long title', hiring({ title: 'x'.repeat(81) }), /title under 80/],
  ['an unknown category', hiring({ category: 'Astronaut' }), /category/],
  ['no work type', hiring({ workTypes: [] }), /work type/],
  ['an unknown work type', hiring({ workTypes: ['Gig'] }), /work type/],
  ['a missing area', hiring({ area: '' }), /area/],
  ['a long description', hiring({ description: 'x'.repeat(1001) }), /description under 1000/],
  ['a bad phone number', hiring({ phone: '12345' }), /10-digit/],
  ['WhatsApp on a landline', hiring({ phone: '02528 222333', whatsapp: true }), /mobile/],
  ['a missing employer', hiring({ employerName: '' }), /employer/],
  ['zero openings', hiring({ openings: 0 }), /Openings/],
  ['fractional pay', hiring({ payMin: 12000.5 }), /whole number of rupees/],
  ['zero pay', hiring({ payMin: 0, payMax: 0 }), /Leave it empty/],
  ['negative pay', hiring({ payMin: -500 }), /at least ₹1/],
  ['maximum pay below minimum', hiring({ payMin: 15000, payMax: 12000 }), /less than minimum/],
  ['pay without a period', hiring({ payPeriod: null }), /per month, day or hour/],
  ['a malformed business id', hiring({ listingId: 'not-a-uuid' }), /business/],
  ['a missing first name', seeking({ displayName: ' ' }), /first name/],
  ['impossible experience', seeking({ experienceYears: 61 }), /Experience/],
]

for (const [name, input, expected] of REJECTIONS) {
  test(`rejects ${name}`, () => {
    const result = validateJobPostInput(input)
    assert.equal(result.ok, false)
    if (result.ok) return
    assert.match(result.error, expected)
  })
}
```

- [ ] **Step 2: Register the test file**

Append ` src/lib/jobs/validation.test.ts` to the end of the `test:existing` script string in `package.json`.

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npm run test:existing`
Expected: FAIL — `Cannot find module './categories'`.

- [ ] **Step 4: Write `categories.ts`**

Create `src/lib/jobs/categories.ts`:

```ts
// Single source of truth for job categories: the post form, board filters,
// category pages and server-side validation. Stored values stay English;
// Marathi is display-only. Keep 'Other' last.
export const JOB_CATEGORIES = [
  'Shop & Sales',
  'Hotel, Restaurant & Catering',
  'Farm & Orchard',
  'Fishing & Seafood',
  'Driver & Delivery',
  'Teaching & Tuition',
  'Healthcare & Clinic',
  'Office, Accounts & Computer',
  'Factory & Industrial',
  'Construction & Labour',
  'Electrician, Plumber & Technician',
  'Domestic Help & Care',
  'Security Guard',
  'Beauty & Salon',
  'Other',
] as const

export type JobCategory = (typeof JOB_CATEGORIES)[number]

// Proofread by the site owner before launch (spec, rollout step 4).
export const JOB_CATEGORY_MR: Record<JobCategory, string> = {
  'Shop & Sales': 'दुकान व विक्री',
  'Hotel, Restaurant & Catering': 'हॉटेल, रेस्टॉरंट व केटरिंग',
  'Farm & Orchard': 'शेती व बागायत',
  'Fishing & Seafood': 'मासेमारी व मत्स्य व्यवसाय',
  'Driver & Delivery': 'ड्रायव्हर व डिलिव्हरी',
  'Teaching & Tuition': 'शिक्षण व शिकवणी',
  'Healthcare & Clinic': 'आरोग्य सेवा व दवाखाना',
  'Office, Accounts & Computer': 'ऑफिस, हिशोब व संगणक',
  'Factory & Industrial': 'कारखाना व औद्योगिक',
  'Construction & Labour': 'बांधकाम व मजुरी',
  'Electrician, Plumber & Technician': 'इलेक्ट्रिशियन, प्लंबर व तंत्रज्ञ',
  'Domestic Help & Care': 'घरकाम व देखभाल',
  'Security Guard': 'सुरक्षा रक्षक',
  'Beauty & Salon': 'ब्युटी पार्लर व सलून',
  Other: 'इतर',
}

export function isValidJobCategory(value: string): value is JobCategory {
  return (JOB_CATEGORIES as readonly string[]).includes(value)
}

export function jobCategoryMarathi(value: string): string | null {
  return isValidJobCategory(value) ? JOB_CATEGORY_MR[value] : null
}

/** URL slug: "Hotel, Restaurant & Catering" → "hotel-restaurant-catering". */
export function jobCategorySlug(value: string): string {
  return value
    .toLowerCase()
    .replace(/&/g, ' ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function jobCategoryFromSlug(slug: string): JobCategory | null {
  return JOB_CATEGORIES.find((category) => jobCategorySlug(category) === slug) ?? null
}
```

- [ ] **Step 5: Write `options.ts`**

Create `src/lib/jobs/options.ts`:

```ts
export const WORK_TYPES = ['Full-time', 'Part-time', 'Daily wage', 'Seasonal', 'Internship'] as const

export type WorkType = (typeof WORK_TYPES)[number]

export function isValidWorkType(value: string): value is WorkType {
  return (WORK_TYPES as readonly string[]).includes(value)
}

/** schema.org `employmentType` values that Google for Jobs understands. */
export const GOOGLE_EMPLOYMENT_TYPE: Record<WorkType, string> = {
  'Full-time': 'FULL_TIME',
  'Part-time': 'PART_TIME',
  'Daily wage': 'PER_DIEM',
  Seasonal: 'TEMPORARY',
  Internship: 'INTERN',
}

export const PAY_PERIODS = ['month', 'day', 'hour'] as const

export type PayPeriod = (typeof PAY_PERIODS)[number]

export function isPayPeriod(value: string): value is PayPeriod {
  return (PAY_PERIODS as readonly string[]).includes(value)
}

/** Suggestions only — the area field accepts any text. */
export const AREA_SUGGESTIONS = [
  'Dahanu Road',
  'Dahanu Town',
  'Bordi',
  'Gholvad',
  'Chinchani',
  'Vangaon',
  'Kasa',
  'Talasari',
  'Boisar',
  'Tarapur',
  'Palghar',
] as const
```

- [ ] **Step 6: Write `phone.ts`**

Create `src/lib/jobs/phone.ts`:

```ts
/**
 * Normalise an Indian phone number to its 10 significant digits.
 *
 * Accepts a +91 / 91 country prefix, a leading trunk 0, and any spaces,
 * dashes or brackets. Returns null when what remains is not a valid number.
 * Mobiles start 6–9; landlines with their STD code (e.g. Dahanu 02528…)
 * start 1–5.
 */
export function normalizeIndianPhone(raw: string): string | null {
  let digits = (raw ?? '').replace(/\D/g, '')
  if (digits.length === 12 && digits.startsWith('91')) digits = digits.slice(2)
  else if (digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1)
  return /^[1-9]\d{9}$/.test(digits) ? digits : null
}

export function isIndianMobile(phone10: string): boolean {
  return /^[6-9]\d{9}$/.test(phone10)
}

export function telHrefIndia(phone10: string): string {
  return `tel:+91${phone10}`
}

export function waHrefIndia(phone10: string): string {
  return `https://wa.me/91${phone10}`
}

/** "98765 43210" for mobiles; landlines get their trunk 0 back. */
export function formatIndianPhone(phone10: string): string {
  return isIndianMobile(phone10) ? `${phone10.slice(0, 5)} ${phone10.slice(5)}` : `0${phone10}`
}
```

- [ ] **Step 7: Write `validation.ts`**

Create `src/lib/jobs/validation.ts`:

```ts
import { isValidJobCategory } from './categories'
import { isPayPeriod, isValidWorkType, type PayPeriod, type WorkType } from './options'
import { isIndianMobile, normalizeIndianPhone } from './phone'

export type JobKind = 'hiring' | 'seeking'

/** What the post form sends. Numbers arrive already parsed; blanks are null. */
export interface JobPostInput {
  kind: JobKind
  title: string
  category: string
  workTypes: string[]
  area: string
  description?: string | null
  employerName?: string | null
  openings?: number | null
  payMin?: number | null
  payMax?: number | null
  payPeriod?: string | null
  timings?: string | null
  displayName?: string | null
  experienceYears?: number | null
  phone: string
  whatsapp: boolean
  listingId?: string | null
  collectedSource?: string | null
}

/** Column values for job_posts, minus the lifecycle fields the server sets. */
export interface JobPostFields {
  kind: JobKind
  title: string
  category: string
  work_types: WorkType[]
  area: string
  description: string | null
  employer_name: string | null
  openings: number | null
  pay_min: number | null
  pay_max: number | null
  pay_period: PayPeriod | null
  timings: string | null
  display_name: string | null
  experience_years: number | null
  listing_id: string | null
  collected_source: string | null
}

export interface ContactFields {
  phone: string
  whatsapp: boolean
}

export type ValidationResult =
  | { ok: true; fields: JobPostFields; contact: ContactFields }
  | { ok: false; error: string }

export const JOB_TEXT_LIMITS = {
  title: 80,
  employerName: 100,
  area: 80,
  timings: 80,
  description: 1000,
  displayName: 40,
  collectedSource: 80,
} as const

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function clean(value: string | null | undefined): string | null {
  const trimmed = (value ?? '').trim()
  return trimmed === '' ? null : trimmed
}

function lengthError(value: string | null, max: number, label: string): string | null {
  return value !== null && value.length > max ? `Keep the ${label} under ${max} characters.` : null
}

type IntResult = { ok: true; value: number | null } | { ok: false }

function readInt(value: number | null | undefined): IntResult {
  if (value === null || value === undefined) return { ok: true, value: null }
  return Number.isInteger(value) ? { ok: true, value } : { ok: false }
}

function fail(error: string): ValidationResult {
  return { ok: false, error }
}

export function validateJobPostInput(input: JobPostInput): ValidationResult {
  const { kind } = input
  if (kind !== 'hiring' && kind !== 'seeking') {
    return fail('Choose whether you are hiring or looking for work.')
  }

  const title = clean(input.title)
  if (!title) {
    return fail(kind === 'hiring' ? 'Enter the job title, e.g. "Cook".' : 'Enter your skill, e.g. "Driver".')
  }
  const titleError = lengthError(title, JOB_TEXT_LIMITS.title, 'title')
  if (titleError) return fail(titleError)

  if (!isValidJobCategory(input.category)) return fail('Choose a category.')

  const workTypes: WorkType[] = []
  for (const raw of input.workTypes ?? []) {
    const value = raw.trim()
    if (!isValidWorkType(value)) return fail('Choose at least one work type.')
    if (!workTypes.includes(value)) workTypes.push(value)
  }
  if (workTypes.length === 0) return fail('Choose at least one work type.')

  const area = clean(input.area)
  if (!area) return fail('Enter the area, e.g. "Dahanu Road".')
  const areaError = lengthError(area, JOB_TEXT_LIMITS.area, 'area')
  if (areaError) return fail(areaError)

  const description = clean(input.description)
  const descriptionError = lengthError(description, JOB_TEXT_LIMITS.description, 'description')
  if (descriptionError) return fail(descriptionError)

  const phone = normalizeIndianPhone(input.phone ?? '')
  if (!phone) return fail('Enter a valid 10-digit phone number.')
  const whatsapp = input.whatsapp === true
  if (whatsapp && !isIndianMobile(phone)) {
    return fail('WhatsApp needs a mobile number. Untick WhatsApp for a landline.')
  }
  const contact: ContactFields = { phone, whatsapp }

  if (kind === 'seeking') {
    const displayName = clean(input.displayName)
    if (!displayName) return fail('Enter your first name.')
    const nameError = lengthError(displayName, JOB_TEXT_LIMITS.displayName, 'first name')
    if (nameError) return fail(nameError)

    const experience = readInt(input.experienceYears)
    if (!experience.ok || (experience.value !== null && (experience.value < 0 || experience.value > 60))) {
      return fail('Experience must be between 0 and 60 years.')
    }

    return {
      ok: true,
      contact,
      fields: {
        kind,
        title,
        category: input.category,
        work_types: workTypes,
        area,
        description,
        employer_name: null,
        openings: null,
        pay_min: null,
        pay_max: null,
        pay_period: null,
        timings: null,
        display_name: displayName,
        experience_years: experience.value,
        listing_id: null,
        collected_source: null,
      },
    }
  }

  const employerName = clean(input.employerName)
  if (!employerName) return fail('Enter the employer or shop name.')
  const employerError = lengthError(employerName, JOB_TEXT_LIMITS.employerName, 'employer name')
  if (employerError) return fail(employerError)

  const openings = readInt(input.openings)
  if (!openings.ok || (openings.value !== null && (openings.value < 1 || openings.value > 500))) {
    return fail('Openings must be a whole number between 1 and 500.')
  }

  const payMin = readInt(input.payMin)
  const payMax = readInt(input.payMax)
  if (!payMin.ok || !payMax.ok) {
    return fail('Pay must be a whole number of rupees.')
  }
  // Zero would read as "₹0 / month" on the public board. An unknown amount is
  // left empty instead, which shows "Pay to be discussed".
  if ((payMin.value !== null && payMin.value < 1) || (payMax.value !== null && payMax.value < 1)) {
    return fail('Pay must be at least ₹1. Leave it empty if pay is to be discussed.')
  }
  if (payMin.value !== null && payMax.value !== null && payMax.value < payMin.value) {
    return fail('Maximum pay cannot be less than minimum pay.')
  }

  let payPeriod: PayPeriod | null = null
  if (payMin.value !== null || payMax.value !== null) {
    const period = clean(input.payPeriod)
    if (!period || !isPayPeriod(period)) return fail('Choose whether pay is per month, day or hour.')
    payPeriod = period
  }

  const timings = clean(input.timings)
  const timingsError = lengthError(timings, JOB_TEXT_LIMITS.timings, 'timings')
  if (timingsError) return fail(timingsError)

  const collectedSource = clean(input.collectedSource)
  const sourceError = lengthError(collectedSource, JOB_TEXT_LIMITS.collectedSource, 'source')
  if (sourceError) return fail(sourceError)

  const listingId = clean(input.listingId)
  if (listingId && !UUID.test(listingId)) return fail('Choose a valid business.')

  return {
    ok: true,
    contact,
    fields: {
      kind,
      title,
      category: input.category,
      work_types: workTypes,
      area,
      description,
      employer_name: employerName,
      openings: openings.value,
      pay_min: payMin.value,
      pay_max: payMax.value,
      pay_period: payPeriod,
      timings,
      display_name: null,
      experience_years: null,
      listing_id: listingId,
      collected_source: collectedSource,
    },
  }
}
```

- [ ] **Step 8: Run the tests to verify they pass**

Run: `npm run test:existing`
Expected: PASS — the previous 123 tests plus the new ones in `validation.test.ts`.

- [ ] **Step 9: Typecheck, lint and commit**

Run: `npx tsc --noEmit && npm run lint`
Expected: typecheck clean; lint 0 errors / 11 warnings.

```bash
git add src/lib/jobs/categories.ts src/lib/jobs/options.ts src/lib/jobs/phone.ts src/lib/jobs/validation.ts src/lib/jobs/validation.test.ts package.json
git commit -m "feat(jobs): categories, phone normalisation and post validation"
```

---

### Task 3: Scam signals, publish rules and lifecycle

**Files:**
- Create: `src/lib/jobs/scam-signals.ts`
- Create: `src/lib/jobs/rules.ts`
- Create: `src/lib/jobs/lifecycle.ts`
- Create: `src/lib/jobs/rules.test.ts`
- Modify: `package.json` (register the test file)

**Interfaces:**
- Consumes: `JobPostFields` from `./validation` (Task 2).
- Produces:
  - `scam-signals.ts`: `type ReviewFlag = 'scam_words' | 'link_or_phone' | 'reports'`, `detectReviewFlags(texts: ReadonlyArray<string | null | undefined>): ReviewFlag[]`, `detectPostFlags(fields): ReviewFlag[]`
  - `rules.ts`: `type JobStatus = 'pending' | 'approved' | 'rejected' | 'closed' | 'removed'`, `interface ListingAccess { accessible: boolean; approved: boolean }`, `decideCreateStatus(ctx: CreateContext): 'approved' | 'pending'`, `decideEditStatus(ctx: EditContext): 'approved' | 'pending' | null`, `AUTO_HIDE_REPORTS = 3`, `shouldAutoHide(status: JobStatus, reportsSinceReview: number): boolean`
  - `lifecycle.ts`: `POST_LIFETIME_DAYS = 30`, `RENEW_WINDOW_DAYS = 3`, `REMINDER_WINDOW_DAYS = 3`, `interface LifecyclePost`, `publishWindow(now: Date): { published_at: string; expires_at: string }`, `isLive(post, now): boolean`, `canRenew(post, now): boolean`, `isReminderDue(post, now): boolean`, `daysLeft(expiresAt: string, now: Date): number`, `hoursAgoIso(now: Date, hours: number): string`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/jobs/rules.test.ts`:

```ts
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { detectReviewFlags } from './scam-signals'
import { AUTO_HIDE_REPORTS, decideCreateStatus, decideEditStatus, shouldAutoHide } from './rules'
import { canRenew, daysLeft, hoursAgoIso, isLive, isReminderDue, publishWindow } from './lifecycle'

const NOW = new Date('2026-09-14T06:30:00.000Z')
const DAY = 86_400_000
const inDays = (days: number) => new Date(NOW.getTime() + days * DAY).toISOString()

test('fee words in English, Marathi and Hindi flag a post', () => {
  for (const text of [
    'Registration fee ₹500 at joining',
    'Pay a security deposit first',
    'processing fees apply',
    'Advance payment required',
    'नोंदणी शुल्क ५०० रुपये',
    'फी भरावी लागेल',
    'फीस जमा करें',
    'डिपॉझिट आवश्यक',
    'Refundable deposit to secure the job',
    'Advance fee ₹300',
    'Pay in advance to confirm',
  ]) {
    assert.deepEqual(detectReviewFlags([text]), ['scam_words'], text)
  }
})

test('ordinary words that merely contain a fee word do not flag', () => {
  for (const text of [
    'Tea and coffee provided',
    'Free lunch every day',
    'Advanced Excel preferred',
    'B.Com or M.Com graduate',
    'No experience needed',
    'Apply in advance',
    'Book your interview slot in advance',
  ]) {
    assert.deepEqual(detectReviewFlags([text]), [], text)
  }
})

test('"No registration fee" still flags, deliberately', () => {
  assert.deepEqual(detectReviewFlags(['No registration fee, apply directly']), ['scam_words'])
})

test('links and phone numbers typed into the text flag for review', () => {
  for (const text of [
    'Apply at https://jobs-now.example/apply',
    'Join t.me/earnfast',
    'Visit www.quickjobs.in',
    'Details on jobs-now.in',
    'Call 98765 43210 now',
    'WhatsApp +91-98765-43210',
  ]) {
    assert.deepEqual(detectReviewFlags([text]), ['link_or_phone'], text)
  }
})

test('both flags can be raised at once, across fields', () => {
  assert.deepEqual(detectReviewFlags(['Cook', null, 'Registration fee. Call 9876543210']), ['scam_words', 'link_or_phone'])
})

const approvedListing = { accessible: true, approved: true }

test('create: the owner of an approved listing goes live instantly', () => {
  assert.equal(decideCreateStatus({ collectedByStaff: false, listing: approvedListing, flags: [] }), 'approved')
})

test('create: an individual, a lapsed or foreign listing, and any flagged post wait for review', () => {
  assert.equal(decideCreateStatus({ collectedByStaff: false, listing: null, flags: [] }), 'pending')
  assert.equal(decideCreateStatus({ collectedByStaff: false, listing: { accessible: true, approved: false }, flags: [] }), 'pending')
  assert.equal(decideCreateStatus({ collectedByStaff: false, listing: { accessible: false, approved: true }, flags: [] }), 'pending')
  assert.equal(decideCreateStatus({ collectedByStaff: false, listing: approvedListing, flags: ['scam_words'] }), 'pending')
})

test('create: staff collected posts go live, flags or not', () => {
  assert.equal(decideCreateStatus({ collectedByStaff: true, listing: null, flags: ['link_or_phone'] }), 'approved')
})

test('edit outcomes follow the table in the spec', () => {
  const cases: Array<[Parameters<typeof decideEditStatus>[0], 'approved' | 'pending' | null]> = [
    [{ current: 'pending', collectedByStaff: false, listing: approvedListing, flags: [] }, 'pending'],
    [{ current: 'rejected', collectedByStaff: false, listing: null, flags: [] }, 'pending'],
    [{ current: 'approved', collectedByStaff: false, listing: approvedListing, flags: [] }, 'approved'],
    [{ current: 'approved', collectedByStaff: false, listing: approvedListing, flags: ['scam_words'] }, 'pending'],
    [{ current: 'approved', collectedByStaff: false, listing: { accessible: true, approved: false }, flags: [] }, 'pending'],
    [{ current: 'approved', collectedByStaff: true, listing: null, flags: ['link_or_phone'] }, 'approved'],
    [{ current: 'approved', collectedByStaff: false, listing: null, flags: [] }, 'pending'],
    [{ current: 'closed', collectedByStaff: false, listing: null, flags: [] }, null],
    [{ current: 'removed', collectedByStaff: true, listing: null, flags: [] }, null],
  ]
  for (const [ctx, expected] of cases) {
    assert.equal(decideEditStatus(ctx), expected, JSON.stringify(ctx))
  }
})

test('reports hide an approved post at the third since review, not before', () => {
  assert.equal(AUTO_HIDE_REPORTS, 3)
  assert.equal(shouldAutoHide('approved', 2), false)
  assert.equal(shouldAutoHide('approved', 3), true)
  assert.equal(shouldAutoHide('pending', 5), false)
})

test('publishing sets a 30-day window', () => {
  assert.deepEqual(publishWindow(NOW), { published_at: NOW.toISOString(), expires_at: inDays(30) })
})

test('a post is live only while approved and unexpired', () => {
  assert.equal(isLive({ status: 'approved', expires_at: inDays(1) }, NOW), true)
  assert.equal(isLive({ status: 'approved', expires_at: inDays(-1) }, NOW), false)
  assert.equal(isLive({ status: 'pending', expires_at: inDays(10) }, NOW), false)
  assert.equal(isLive({ status: 'approved', expires_at: null }, NOW), false)
})

test('renew opens in the last 3 days and never closes after expiry', () => {
  assert.equal(canRenew({ status: 'approved', expires_at: inDays(4) }, NOW), false)
  assert.equal(canRenew({ status: 'approved', expires_at: inDays(3) }, NOW), true)
  assert.equal(canRenew({ status: 'approved', expires_at: inDays(-365) }, NOW), true)
  assert.equal(canRenew({ status: 'closed', expires_at: inDays(1) }, NOW), false)
  assert.equal(canRenew({ status: 'pending', expires_at: null }, NOW), false)
})

test('the reminder is due once, within 3 days of expiry', () => {
  assert.equal(isReminderDue({ status: 'approved', expires_at: inDays(2), reminder_sent_at: null }, NOW), true)
  assert.equal(isReminderDue({ status: 'approved', expires_at: inDays(3), reminder_sent_at: null }, NOW), true)
  assert.equal(isReminderDue({ status: 'approved', expires_at: inDays(4), reminder_sent_at: null }, NOW), false)
  assert.equal(isReminderDue({ status: 'approved', expires_at: inDays(2), reminder_sent_at: NOW.toISOString() }, NOW), false)
  assert.equal(isReminderDue({ status: 'approved', expires_at: inDays(-1), reminder_sent_at: null }, NOW), false)
})

test('days left rounds up and never goes negative', () => {
  assert.equal(daysLeft(inDays(2.5), NOW), 3)
  assert.equal(daysLeft(inDays(-2), NOW), 0)
})

test('hoursAgoIso steps back in whole hours', () => {
  assert.equal(hoursAgoIso(NOW, 24), new Date(NOW.getTime() - DAY).toISOString())
})
```

- [ ] **Step 2: Register the test file**

Append ` src/lib/jobs/rules.test.ts` to the end of the `test:existing` script string in `package.json`.

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npm run test:existing`
Expected: FAIL — `Cannot find module './scam-signals'`.

- [ ] **Step 4: Write `scam-signals.ts`**

Create `src/lib/jobs/scam-signals.ts`:

```ts
import type { JobPostFields } from './validation'

export type ReviewFlag = 'scam_words' | 'link_or_phone' | 'reports'

// Phrases that turn a job post into a request for money, in English, Marathi
// and Hindi. Matched as whole words, so "advanced" and "coffee" never match.
// A false alarm costs one review; a missed scam costs a victim — which is why
// "No registration fee" deliberately flags too. Bare "advance" is deliberately
// absent: everyday scheduling ("apply in advance") uses it.
const SCAM_TERMS = [
  'registration fee',
  'registration fees',
  'registration charge',
  'registration charges',
  'deposit',
  'processing fee',
  'processing fees',
  'joining fee',
  'joining fees',
  'training fee',
  'training fees',
  'advance fee',
  'advance fees',
  'pay in advance',
  'advance payment',
  'नोंदणी शुल्क',
  'शुल्क',
  'फीस',
  'फी',
  'डिपॉझिट',
  'डिपॉजिट',
  'अनामत',
]

// Letters, combining marks (Devanagari vowel signs) and digits count as part
// of a word, so a term only matches when nothing word-like touches either end.
const WORD_CHAR = '[\\p{L}\\p{M}\\p{N}]'

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

const SCAM_PATTERN = new RegExp(
  `(?<!${WORD_CHAR})(?:${[...SCAM_TERMS]
    .sort((a, b) => b.length - a.length)
    .map(escapeRegExp)
    .join('|')})(?!${WORD_CHAR})`,
  'iu',
)

// Links, including bare domains ("details on jobs-now.in") and the short-link
// hosts scams favour. Requiring two characters before a bare domain's dot keeps
// qualifications like "B.Com" and "M.Com" from matching.
const LINK_PATTERN =
  /(?:https?:\/\/|www\.)\S+|\b(?:t\.me|wa\.me|bit\.ly)\/\S*|\b[a-z0-9-]{2,}\.(?:com|in|net|org|co|me|ly|io|link|app|xyz|info)\b/i

// A mobile number typed into free text would bypass the login-gated contact.
const PHONE_PATTERN = /(?<!\d)(?:\+?91[\s-]?)?0?[6-9](?:[\s-]?\d){9}(?!\d)/

export function detectReviewFlags(texts: ReadonlyArray<string | null | undefined>): ReviewFlag[] {
  const text = texts
    .filter((value): value is string => typeof value === 'string' && value.trim() !== '')
    .map((value) => value.replace(/\s+/g, ' '))
    .join(' | ')

  const flags: ReviewFlag[] = []
  if (SCAM_PATTERN.test(text)) flags.push('scam_words')
  if (LINK_PATTERN.test(text) || PHONE_PATTERN.test(text)) flags.push('link_or_phone')
  return flags
}

/** Flags for every free-text field of a post. */
export function detectPostFlags(
  fields: Pick<JobPostFields, 'title' | 'employer_name' | 'display_name' | 'area' | 'timings' | 'description'>,
): ReviewFlag[] {
  return detectReviewFlags([
    fields.title,
    fields.employer_name,
    fields.display_name,
    fields.area,
    fields.timings,
    fields.description,
  ])
}
```

- [ ] **Step 5: Write `rules.ts`**

Create `src/lib/jobs/rules.ts`:

```ts
import type { ReviewFlag } from './scam-signals'

export type JobStatus = 'pending' | 'approved' | 'rejected' | 'closed' | 'removed'

/**
 * A chosen business listing, as seen by the person posting:
 * `accessible` — they own it (or are staff); `approved` — it is live.
 */
export interface ListingAccess {
  accessible: boolean
  approved: boolean
}

export interface CreateContext {
  collectedByStaff: boolean
  listing: ListingAccess | null
  flags: ReviewFlag[]
}

/**
 * Instant or pending, decided by the server — never by the form.
 * Instant only for a staff-collected post, or for a post tied to a listing
 * the poster can act for that is currently approved and raised no flags.
 */
export function decideCreateStatus(ctx: CreateContext): 'approved' | 'pending' {
  if (ctx.collectedByStaff) return 'approved'
  const listing = ctx.listing
  if (listing !== null && listing.accessible && listing.approved && ctx.flags.length === 0) {
    return 'approved'
  }
  return 'pending'
}

export interface EditContext {
  current: JobStatus
  collectedByStaff: boolean
  listing: ListingAccess | null
  flags: ReviewFlag[]
}

/**
 * The status after an edit, or null when the post can no longer be edited.
 * An individual's approved post goes back to review, or a scammer could get a
 * harmless post approved and then edit it into a fee request.
 */
export function decideEditStatus(ctx: EditContext): 'approved' | 'pending' | null {
  if (ctx.current === 'closed' || ctx.current === 'removed') return null
  if (ctx.current !== 'approved') return 'pending'
  if (ctx.collectedByStaff) return 'approved'
  const listing = ctx.listing
  const businessStillApproved = listing !== null && listing.accessible && listing.approved
  return businessStillApproved && ctx.flags.length === 0 ? 'approved' : 'pending'
}

export const AUTO_HIDE_REPORTS = 3

/** Three reports since the post's last review hide an approved post. */
export function shouldAutoHide(status: JobStatus, reportsSinceReview: number): boolean {
  return status === 'approved' && reportsSinceReview >= AUTO_HIDE_REPORTS
}
```

- [ ] **Step 6: Write `lifecycle.ts`**

Create `src/lib/jobs/lifecycle.ts`:

```ts
import type { JobStatus } from './rules'

export const POST_LIFETIME_DAYS = 30
export const RENEW_WINDOW_DAYS = 3
export const REMINDER_WINDOW_DAYS = 3

const DAY_MS = 86_400_000

export interface LifecyclePost {
  status: JobStatus
  expires_at: string | null
  reminder_sent_at?: string | null
}

/** Set on every approval, instant publish and renewal. */
export function publishWindow(now: Date): { published_at: string; expires_at: string } {
  return {
    published_at: now.toISOString(),
    expires_at: new Date(now.getTime() + POST_LIFETIME_DAYS * DAY_MS).toISOString(),
  }
}

export function isLive(post: LifecyclePost, now: Date): boolean {
  return post.status === 'approved' && post.expires_at !== null && Date.parse(post.expires_at) > now.getTime()
}

/**
 * Renew opens in the last 3 days before expiry and has no cut-off afterwards.
 * The window stops daily bumping; the missing cut-off means someone whose
 * profile lapsed long ago renews it instead of being blocked by the
 * one-profile rule.
 */
export function canRenew(post: LifecyclePost, now: Date): boolean {
  return (
    post.status === 'approved' &&
    post.expires_at !== null &&
    Date.parse(post.expires_at) - now.getTime() <= RENEW_WINDOW_DAYS * DAY_MS
  )
}

export function isReminderDue(post: LifecyclePost, now: Date): boolean {
  if (post.status !== 'approved' || post.expires_at === null || post.reminder_sent_at) return false
  const remaining = Date.parse(post.expires_at) - now.getTime()
  return remaining > 0 && remaining <= REMINDER_WINDOW_DAYS * DAY_MS
}

export function daysLeft(expiresAt: string, now: Date): number {
  return Math.max(0, Math.ceil((Date.parse(expiresAt) - now.getTime()) / DAY_MS))
}

export function hoursAgoIso(now: Date, hours: number): string {
  return new Date(now.getTime() - hours * 3_600_000).toISOString()
}
```

- [ ] **Step 7: Run the tests to verify they pass**

Run: `npm run test:existing`
Expected: PASS — all previous tests plus every test in `rules.test.ts`.

- [ ] **Step 8: Typecheck, lint and commit**

Run: `npx tsc --noEmit && npm run lint`
Expected: typecheck clean; lint 0 errors / 11 warnings.

```bash
git add src/lib/jobs/scam-signals.ts src/lib/jobs/rules.ts src/lib/jobs/lifecycle.ts src/lib/jobs/rules.test.ts package.json
git commit -m "feat(jobs): scam signals, publish rules and post lifecycle"
```

---

### Task 4: Pay wording and Google for Jobs markup

**Files:**
- Create: `src/lib/jobs/pay.ts`
- Create: `src/lib/jobs/job-posting-ld.ts`
- Create: `src/lib/jobs/display.test.ts`
- Modify: `package.json` (register the test file)

**Interfaces:**
- Consumes: `PayPeriod`, `GOOGLE_EMPLOYMENT_TYPE`, `isValidWorkType` from `./options` (Task 2).
- Produces:
  - `formatPay(p: { pay_min: number | null; pay_max: number | null; pay_period: PayPeriod | null }): string`
  - `interface JobPostingSource`, `buildJobPostingLd(post: JobPostingSource, url: string): Record<string, unknown>`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/jobs/display.test.ts`:

```ts
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { formatPay } from './pay'
import { buildJobPostingLd, type JobPostingSource } from './job-posting-ld'

test('pay reads naturally', () => {
  assert.equal(formatPay({ pay_min: 12000, pay_max: 15000, pay_period: 'month' }), '₹12,000–15,000 / month')
  assert.equal(formatPay({ pay_min: 500, pay_max: 500, pay_period: 'day' }), '₹500 / day')
  assert.equal(formatPay({ pay_min: 500, pay_max: null, pay_period: 'day' }), 'From ₹500 / day')
  assert.equal(formatPay({ pay_min: null, pay_max: 90, pay_period: 'hour' }), 'Up to ₹90 / hour')
  assert.equal(formatPay({ pay_min: null, pay_max: null, pay_period: null }), 'Pay to be discussed')
})

const SOURCE: JobPostingSource = {
  id: 'post-1',
  title: 'Cook',
  description: 'Morning shift.',
  category: 'Hotel, Restaurant & Catering',
  work_types: ['Full-time', 'Daily wage'],
  area: 'Dahanu Road',
  employer_name: 'Sai Hotel',
  pay_min: 12000,
  pay_max: 15000,
  pay_period: 'month',
  published_at: '2026-09-14T06:30:00.000Z',
  expires_at: '2026-10-14T06:30:00.000Z',
}

test('JobPosting carries the fields Google for Jobs needs', () => {
  const ld = buildJobPostingLd(SOURCE, 'https://jobs.ourdahanu.in/j/post-1')
  assert.equal(ld['@type'], 'JobPosting')
  assert.equal(ld.title, 'Cook')
  assert.equal(ld.datePosted, SOURCE.published_at)
  assert.equal(ld.validThrough, SOURCE.expires_at)
  assert.deepEqual(ld.employmentType, ['FULL_TIME', 'PER_DIEM'])
  assert.deepEqual(ld.hiringOrganization, { '@type': 'Organization', name: 'Sai Hotel' })
  assert.deepEqual(ld.jobLocation, {
    '@type': 'Place',
    address: { '@type': 'PostalAddress', addressLocality: 'Dahanu Road', addressRegion: 'Maharashtra', addressCountry: 'IN' },
  })
  assert.deepEqual(ld.baseSalary, {
    '@type': 'MonetaryAmount',
    currency: 'INR',
    value: { '@type': 'QuantitativeValue', minValue: 12000, maxValue: 15000, unitText: 'MONTH' },
  })
})

test('JobPosting never contains a phone number', () => {
  const json = JSON.stringify(buildJobPostingLd(SOURCE, 'https://jobs.ourdahanu.in/j/post-1'))
  assert.equal(/telephone/i.test(json), false)
  assert.equal(/\d{10}/.test(json), false)
})

test('JobPosting omits salary when pay is to be discussed, and describes itself when no description is given', () => {
  const ld = buildJobPostingLd({ ...SOURCE, description: null, pay_min: null, pay_max: null, pay_period: null }, 'https://jobs.ourdahanu.in/j/post-1')
  assert.equal('baseSalary' in ld, false)
  assert.equal(ld.description, 'Cook — Hotel, Restaurant & Catering job in Dahanu Road, Dahanu.')
})

test('JobPosting sends pay only as an exact amount or a full range', () => {
  const url = 'https://jobs.ourdahanu.in/j/post-1'
  assert.equal('baseSalary' in buildJobPostingLd({ ...SOURCE, pay_min: 500, pay_max: null, pay_period: 'day' }, url), false)
  assert.equal('baseSalary' in buildJobPostingLd({ ...SOURCE, pay_min: null, pay_max: 90, pay_period: 'hour' }, url), false)
  assert.deepEqual(buildJobPostingLd({ ...SOURCE, pay_min: 500, pay_max: 500, pay_period: 'day' }, url).baseSalary, {
    '@type': 'MonetaryAmount',
    currency: 'INR',
    value: { '@type': 'QuantitativeValue', value: 500, unitText: 'DAY' },
  })
})
```

- [ ] **Step 2: Register the test file**

Append ` src/lib/jobs/display.test.ts` to the end of the `test:existing` script string in `package.json`.

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npm run test:existing`
Expected: FAIL — `Cannot find module './pay'`.

- [ ] **Step 4: Write `pay.ts`**

Create `src/lib/jobs/pay.ts`:

```ts
import type { PayPeriod } from './options'

function rupees(amount: number): string {
  return amount.toLocaleString('en-IN')
}

export function formatPay(p: { pay_min: number | null; pay_max: number | null; pay_period: PayPeriod | null }): string {
  const { pay_min: min, pay_max: max, pay_period: period } = p
  if (period === null || (min === null && max === null)) return 'Pay to be discussed'
  const per = ` / ${period}`
  if (min !== null && max !== null) {
    return min === max ? `₹${rupees(min)}${per}` : `₹${rupees(min)}–${rupees(max)}${per}`
  }
  if (min !== null) return `From ₹${rupees(min)}${per}`
  if (max !== null) return `Up to ₹${rupees(max)}${per}`
  return 'Pay to be discussed'
}
```

- [ ] **Step 5: Write `job-posting-ld.ts`**

Create `src/lib/jobs/job-posting-ld.ts`:

```ts
import { GOOGLE_EMPLOYMENT_TYPE, isValidWorkType, type PayPeriod } from './options'

const UNIT_TEXT: Record<PayPeriod, string> = { month: 'MONTH', day: 'DAY', hour: 'HOUR' }

/** Everything the markup may use. Deliberately has no contact fields. */
export interface JobPostingSource {
  id: string
  title: string
  description: string | null
  category: string
  work_types: string[]
  area: string
  employer_name: string
  pay_min: number | null
  pay_max: number | null
  pay_period: PayPeriod | null
  published_at: string
  expires_at: string
}

/** schema.org JobPosting for Google for Jobs. Hiring posts only. */
export function buildJobPostingLd(post: JobPostingSource, url: string): Record<string, unknown> {
  const ld: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'JobPosting',
    title: post.title,
    description: post.description?.trim() || `${post.title} — ${post.category} job in ${post.area}, Dahanu.`,
    datePosted: post.published_at,
    validThrough: post.expires_at,
    employmentType: post.work_types.filter(isValidWorkType).map((type) => GOOGLE_EMPLOYMENT_TYPE[type]),
    hiringOrganization: { '@type': 'Organization', name: post.employer_name },
    jobLocation: {
      '@type': 'Place',
      address: {
        '@type': 'PostalAddress',
        addressLocality: post.area,
        addressRegion: 'Maharashtra',
        addressCountry: 'IN',
      },
    },
    url,
    identifier: { '@type': 'PropertyValue', name: 'OurDahanu Jobs', value: post.id },
  }

  // Pay goes to Google only as an exact amount or a full range. A lone minimum
  // or maximum ("From ₹500 / day") is not a shape Google documents, so it is
  // left out of the markup; the page itself still shows it.
  if (post.pay_period !== null && post.pay_min !== null && post.pay_max !== null) {
    ld.baseSalary = {
      '@type': 'MonetaryAmount',
      currency: 'INR',
      value:
        post.pay_min === post.pay_max
          ? { '@type': 'QuantitativeValue', value: post.pay_min, unitText: UNIT_TEXT[post.pay_period] }
          : {
              '@type': 'QuantitativeValue',
              minValue: post.pay_min,
              maxValue: post.pay_max,
              unitText: UNIT_TEXT[post.pay_period],
            },
    }
  }

  return ld
}
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npm run test:existing`
Expected: PASS.

- [ ] **Step 7: Typecheck, lint and commit**

Run: `npx tsc --noEmit && npm run lint`
Expected: typecheck clean; lint 0 errors / 11 warnings.

```bash
git add src/lib/jobs/pay.ts src/lib/jobs/job-posting-ld.ts src/lib/jobs/display.test.ts package.json
git commit -m "feat(jobs): pay wording and Google for Jobs markup"
```

---

### Task 5: Standalone hosts — routing, chrome and login

**Files:**
- Create: `src/lib/standalone-hosts.ts`
- Create: `src/lib/standalone-hosts.test.ts`
- Modify: `src/proxy.ts` (add the jobs branch and matcher entry)
- Modify: `src/components/SiteChrome.tsx` (replace the find-only host check)
- Modify: `src/app/find/find-server.ts` (delegate to the shared helper, identical behaviour)
- Modify: `package.json` (register the test file)

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `STANDALONE_SUBDOMAINS = ['find', 'appointments', 'jobs'] as const`, `type StandaloneSubdomain`
  - `getStandaloneSubdomain(host: string | null | undefined): StandaloneSubdomain | null`
  - `buildStandaloneLoginHref(rawHost: string, returnPath: string): string`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/standalone-hosts.test.ts`:

```ts
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { buildStandaloneLoginHref, getStandaloneSubdomain } from './standalone-hosts'

test('recognises the standalone products on production and local hosts', () => {
  assert.equal(getStandaloneSubdomain('find.ourdahanu.in'), 'find')
  assert.equal(getStandaloneSubdomain('appointments.ourdahanu.in'), 'appointments')
  assert.equal(getStandaloneSubdomain('jobs.ourdahanu.in'), 'jobs')
  assert.equal(getStandaloneSubdomain('JOBS.localhost:3000'), 'jobs')
  assert.equal(getStandaloneSubdomain('jobs.ourdahanu.in, proxy.example'), 'jobs')
})

test('business subdomains, the apex and junk are not standalone', () => {
  for (const host of ['ourdahanu.in', 'www.ourdahanu.in', 'jigarchheda.ourdahanu.in', 'localhost:3000', 'jobs.evil.com', '', null, undefined]) {
    assert.equal(getStandaloneSubdomain(host), null, String(host))
  }
})

test('login from a standalone host runs on the main domain and returns to the same page', () => {
  assert.equal(
    buildStandaloneLoginHref('find.ourdahanu.in', '/submit'),
    `https://ourdahanu.in/login?next=${encodeURIComponent('https://find.ourdahanu.in/submit')}`,
  )
  assert.equal(
    buildStandaloneLoginHref('jobs.ourdahanu.in', '/j/abc'),
    `https://ourdahanu.in/login?next=${encodeURIComponent('https://jobs.ourdahanu.in/j/abc')}`,
  )
  assert.equal(
    buildStandaloneLoginHref('jobs.localhost:3000', '/post'),
    `http://localhost:3000/login?next=${encodeURIComponent('http://jobs.localhost:3000/post')}`,
  )
})

test('login from the main domain stays on the main domain', () => {
  assert.equal(
    buildStandaloneLoginHref('ourdahanu.in', '/jobs/post'),
    `https://ourdahanu.in/login?next=${encodeURIComponent('https://ourdahanu.in/jobs/post')}`,
  )
})
```

- [ ] **Step 2: Register the test file**

Append ` src/lib/standalone-hosts.test.ts` to the end of the `test:existing` script string in `package.json`.

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npm run test:existing`
Expected: FAIL — `Cannot find module './standalone-hosts'`.

- [ ] **Step 4: Write `standalone-hosts.ts`**

Create `src/lib/standalone-hosts.ts`:

```ts
// Subdomains that serve a standalone OurDahanu product with its own layout.
// src/proxy.ts rewrites each one to /<name>/*, and SiteChrome hides the main
// site's navbar, emergency ribbon, bottom tabs and footer on them.
export const STANDALONE_SUBDOMAINS = ['find', 'appointments', 'jobs'] as const

export type StandaloneSubdomain = (typeof STANDALONE_SUBDOMAINS)[number]

function bareHost(host: string | null | undefined): string {
  return (host ?? '').split(',')[0].trim().split(':')[0].toLowerCase()
}

/** Which standalone product a request host belongs to, if any. */
export function getStandaloneSubdomain(host: string | null | undefined): StandaloneSubdomain | null {
  const normalized = bareHost(host)
  for (const name of STANDALONE_SUBDOMAINS) {
    if (normalized === `${name}.ourdahanu.in` || normalized === `${name}.localhost`) return name
  }
  return null
}

/**
 * A main-site login URL that returns to `returnPath` on the same host.
 *
 * Login must run on the main domain: a standalone proxy rewrites every path
 * under /<name>/*, so <name>.ourdahanu.in/login would 404. Session cookies are
 * scoped to .ourdahanu.in, so the session created on the main domain is
 * visible back on the subdomain.
 */
export function buildStandaloneLoginHref(rawHost: string, returnPath: string): string {
  const host = rawHost.split(',')[0].trim()
  const proto = host.includes('localhost') ? 'http' : 'https'
  const returnUrl = `${proto}://${host}${returnPath}`
  const mainHost = host.replace(/^(?:find|appointments|jobs)\./, '')
  return `${proto}://${mainHost}/login?next=${encodeURIComponent(returnUrl)}`
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npm run test:existing`
Expected: PASS.

- [ ] **Step 6: Delegate `findLoginHref` to the shared helper**

Replace the whole of `src/app/find/find-server.ts` with:

```ts
import { headers } from 'next/headers'

import { buildStandaloneLoginHref } from '@/lib/standalone-hosts'

/**
 * Build a login URL that works from the `find` subdomain.
 *
 * Login must run on the MAIN domain: the find-host proxy rewrites every path
 * to `/find/*`, so `find.ourdahanu.in/login` would resolve to `/find/login`
 * (404). We send the user to `<main-origin>/login` with a `next` that returns
 * them to the exact find page they were on. Session cookies are scoped to
 * `.ourdahanu.in` (see src/lib/supabase/server.ts), so the session created on
 * the main domain is visible back on the find subdomain.
 *
 * @param returnPath find-relative path to come back to, e.g. `/submit` or `/p/<id>`
 */
export async function findLoginHref(returnPath: string): Promise<string> {
  const h = await headers()
  const rawHost = (h.get('x-forwarded-host') ?? h.get('host') ?? 'find.ourdahanu.in')
    .split(',')[0]
    .trim()
  return buildStandaloneLoginHref(rawHost, returnPath)
}
```

This keeps Find's behaviour identical: the shared helper strips `find.` exactly as the old inline `replace(/^find\./, '')` did.

- [ ] **Step 7: Hide the main chrome on every standalone host**

Replace the whole of `src/components/SiteChrome.tsx` with:

```tsx
import { headers } from 'next/headers'

import BottomTabBar from '@/components/BottomTabBar'
import BusinessFooter from '@/components/BusinessFooter'
import EmergencyRibbon from '@/components/EmergencyRibbon'
import Footer from '@/components/Footer'
import Navbar from '@/components/Navbar'
import { getStandaloneSubdomain } from '@/lib/standalone-hosts'
import { getBusinessSubdomain } from '@/lib/subdomain'

// Business subdomains (e.g. organic.ourdahanu.in) are standalone microsites —
// each one is reviewed for the business's own Razorpay account, so they must
// not show generic OurDahanu chrome (navbar, jobs links, emergency ribbon,
// bottom tabs). The standalone products — find, appointments and jobs — render
// their own header and footer, so the main chrome is hidden there too; before
// appointments was added here it rendered two footers and a doubled ribbon.
// These wrappers read the request host and swap or drop the chrome
// accordingly. They access headers(), so each must be rendered inside a
// <Suspense> boundary (cacheComponents requirement).

async function getRequestHost(): Promise<string | null> {
  const headersList = await headers()
  return headersList.get('x-forwarded-host') ?? headersList.get('host')
}

export async function SiteNavbar() {
  const host = await getRequestHost()
  if (getBusinessSubdomain(host) || getStandaloneSubdomain(host)) return null
  return <Navbar />
}

export async function SiteEmergencyRibbon() {
  const host = await getRequestHost()
  if (getBusinessSubdomain(host) || getStandaloneSubdomain(host)) return null
  return <EmergencyRibbon />
}

export async function SiteBottomTabBar() {
  const host = await getRequestHost()
  if (getBusinessSubdomain(host) || getStandaloneSubdomain(host)) return null
  return <BottomTabBar />
}

export async function SiteFooter() {
  const host = await getRequestHost()
  if (getStandaloneSubdomain(host)) return null
  const subdomain = getBusinessSubdomain(host)
  if (subdomain) return <BusinessFooter subdomain={subdomain} />
  return <Footer />
}
```

- [ ] **Step 8: Rewrite the jobs host in the proxy**

In `src/proxy.ts`, immediately after the closing `}` of the `appointments.ourdahanu.in` branch (the block that ends `return NextResponse.rewrite(url)` for `/appointments`), insert:

```ts
  // jobs.ourdahanu.in → /jobs/* (standalone jobs board, own layout). Same
  // shape as the find and appointments branches above.
  if (findHost === 'jobs.ourdahanu.in' || findHost === 'jobs.localhost') {
    const pathname = request.nextUrl.pathname
    const isInternalOrAsset =
      pathname.startsWith('/_next') ||
      pathname.startsWith('/api') ||
      /\.[^/]+$/.test(pathname)
    if (isInternalOrAsset) {
      return NextResponse.next()
    }
    const url = request.nextUrl.clone()
    if (!url.pathname.startsWith('/jobs')) {
      url.pathname = url.pathname === '/' ? '/jobs' : `/jobs${url.pathname}`
    }
    return NextResponse.rewrite(url)
  }
```

Then, in `export const config`, add this entry as the last element of the `matcher` array (after the `appointments.ourdahanu.in` entry). Keep it a pure inline literal — Next.js rejects computed values in this export:

```ts
    {
      // jobs.ourdahanu.in — standalone jobs board
      source: '/:path*',
      has: [
        {
          type: 'header',
          key: 'host',
          value: '(?:jobs\\.ourdahanu\\.in|jobs\\.localhost(?::\\d+)?)',
        },
      ],
    },
```

`jobs` is already in `RESERVED_SUBDOMAINS` (`src/lib/subdomain.ts`) and in all five business-subdomain regex literals, so nothing else in the config changes.

- [ ] **Step 9: Typecheck, lint, test and build**

Run: `npx tsc --noEmit && npm run lint && npm run test:existing && npm run build`
Expected: typecheck clean; lint 0 errors / 11 warnings; tests pass; build succeeds.

- [ ] **Step 10: Check Find still works**

Start the dev server with the Browser pane (`preview_start`, `dev` config) and load `http://localhost:3000/find`. Confirm the FindDahanu header renders, the main site navbar also renders (this is the apex path, where the main chrome is expected), and the console has no errors. Report what you saw. The subdomain chrome change is verified after deploy — the in-app browser cannot open `*.localhost` subdomains.

- [ ] **Step 11: Commit**

```bash
git add src/lib/standalone-hosts.ts src/lib/standalone-hosts.test.ts src/proxy.ts src/components/SiteChrome.tsx src/app/find/find-server.ts package.json
git commit -m "feat(jobs): route jobs.ourdahanu.in and hide main chrome on standalone hosts"
```

---

### Task 6: Job notifications

**Files:**
- Modify: `src/lib/notifications/types.ts`
- Modify: `src/lib/notifications/templates.ts`
- Create: `src/lib/notifications/job-templates.test.ts`
- Modify: `package.json` (register the test file)

**Interfaces:**
- Consumes: nothing new.
- Produces:
  - Notification types `'job.approved'` `{ postId: string; title: string; kind: 'hiring' | 'seeking' }`, `'job.rejected'` `{ postId; title; kind; reason: string }`, `'job.expiring'` `{ postId; title; kind; daysLeft: number }`.
  - `admin.new_submission` kinds gain `'job'` and `'job_report'`.

- [ ] **Step 1: Write the failing tests**

Create `src/lib/notifications/job-templates.test.ts`:

```ts
import assert from 'node:assert/strict'
import test from 'node:test'

import { renderNotification } from './templates'

test('job.approved links to the live post', () => {
  const rendered = renderNotification('job.approved', { postId: 'p1', title: 'Cook', kind: 'hiring' })
  assert.equal(rendered.title, '✅ Your job post is live · Cook')
  assert.equal(rendered.link, '/jobs/j/p1')
  assert.match(rendered.email?.html ?? '', /https:\/\/jobs\.ourdahanu\.in\/j\/p1/)
})

test('job.rejected carries the reason, escaped in the email', () => {
  const rendered = renderNotification('job.rejected', { postId: 'p1', title: 'Driver', kind: 'seeking', reason: 'Asks for <money>' })
  assert.equal(rendered.title, 'Your profile was not approved · Driver')
  assert.equal(rendered.link, '/jobs/my-posts')
  assert.match(rendered.body, /Asks for <money>/)
  assert.match(rendered.email?.html ?? '', /Asks for &lt;money&gt;/)
  assert.equal((rendered.email?.html ?? '').includes('<money>'), false)
})

test('job.expiring says "1 day", not "1 days"', () => {
  assert.equal(
    renderNotification('job.expiring', { postId: 'p1', title: 'Cook', kind: 'hiring', daysLeft: 1 }).title,
    '⏳ Your job post expires in 1 day · Cook',
  )
  assert.equal(
    renderNotification('job.expiring', { postId: 'p1', title: 'Cook', kind: 'hiring', daysLeft: 3 }).title,
    '⏳ Your job post expires in 3 days · Cook',
  )
})

test('admin submissions label job posts and job reports', () => {
  assert.equal(
    renderNotification('admin.new_submission', { kind: 'job', title: 'Cook', reviewPath: '/admin/jobs' }).title,
    'New Job post submission',
  )
  assert.equal(
    renderNotification('admin.new_submission', { kind: 'job_report', title: 'Cook · asks_for_money', reviewPath: '/admin/jobs' }).title,
    'New Job report submission',
  )
})
```

- [ ] **Step 2: Register the test file**

Append ` src/lib/notifications/job-templates.test.ts` to the end of the `test:existing` script string in `package.json`.

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npm run test:existing`
Expected: FAIL — a type or runtime error because `'job.approved'` is not a known notification type (the `renderNotification` switch reaches its `default` branch and throws `Unknown notification type`).

- [ ] **Step 4: Add the types**

In `src/lib/notifications/types.ts`:

1. In `NOTIFICATION_TYPES`, directly after `'listing.expiring',`, add:

```ts
  // Jobs board
  'job.approved',
  'job.rejected',
  'job.expiring',
```

2. Directly after the `ListingExpiringPayload` interface, add:

```ts
interface JobApprovedPayload {
  postId: string
  title: string
  kind: 'hiring' | 'seeking'
}

interface JobRejectedPayload {
  postId: string
  title: string
  kind: 'hiring' | 'seeking'
  reason: string
}

interface JobExpiringPayload {
  postId: string
  title: string
  kind: 'hiring' | 'seeking'
  daysLeft: number
}
```

3. In `AdminSubmissionPayload`, extend `kind` so it reads:

```ts
  kind:
    | 'listing'
    | 'event'
    | 'professional'
    | 'professional_review'
    | 'job'
    | 'job_report'
```

4. In `NotificationPayloadMap`, directly after `'listing.expiring': ListingExpiringPayload`, add:

```ts
  'job.approved': JobApprovedPayload
  'job.rejected': JobRejectedPayload
  'job.expiring': JobExpiringPayload
```

- [ ] **Step 5: Add the renderers**

In `src/lib/notifications/templates.ts`:

1. Directly after `const SITE_URL = 'https://ourdahanu.in'`, add:

```ts
const JOBS_URL = 'https://jobs.ourdahanu.in'
```

2. Directly before `function renderReviewNew`, add:

```ts
function jobNoun(kind: 'hiring' | 'seeking'): string {
  return kind === 'hiring' ? 'job post' : 'profile'
}

function renderJobApproved(p: NotificationPayload<'job.approved'>): RenderedNotification {
  const postUrl = `${JOBS_URL}/j/${p.postId}`
  const noun = jobNoun(p.kind)
  return {
    title: `✅ Your ${noun} is live · ${p.title}`,
    body: `"${p.title}" is now live on OurDahanu Jobs for 30 days.`,
    link: `/jobs/j/${p.postId}`,
    icon: 'CheckCircle',
    metadata: { postId: p.postId },
    email: {
      subject: `Your ${noun} "${p.title}" is live on OurDahanu Jobs`,
      html: renderEmailLayout({
        eyebrow: 'OurDahanu Jobs',
        headline: `Your ${noun} is live`,
        introHtml: `<strong>${escapeHtml(p.title)}</strong> was approved and is now visible on OurDahanu Jobs for 30 days.`,
        detailRows: buildDetailRow(
          'Your post',
          `<a href="${postUrl}" style="color:#C4663A;text-decoration:none;">${escapeHtml(postUrl)}</a>`,
          false,
        ),
        ctaUrl: `${JOBS_URL}/my-posts`,
        ctaText: 'Open my posts',
      }),
    },
    telegram: {
      text: `✅ <b>Jobs post approved</b>\n${escapeHtml(p.title)} is live: <a href="${postUrl}">open</a>`,
    },
  }
}

function renderJobRejected(p: NotificationPayload<'job.rejected'>): RenderedNotification {
  const noun = jobNoun(p.kind)
  return {
    title: `Your ${noun} was not approved · ${p.title}`,
    body: `Reason: ${p.reason}. Edit it from My posts to resubmit.`,
    link: '/jobs/my-posts',
    icon: 'XCircle',
    metadata: { postId: p.postId },
    email: {
      subject: `Your ${noun} "${p.title}" was not approved`,
      html: renderEmailLayout({
        eyebrow: 'OurDahanu Jobs',
        headline: `Your ${noun} was not approved`,
        introHtml: `We could not approve <strong>${escapeHtml(p.title)}</strong> yet. You can edit it and resubmit.`,
        detailRows: buildDetailRow('Reason', escapeHtml(p.reason), false),
        ctaUrl: `${JOBS_URL}/my-posts`,
        ctaText: 'Edit and resubmit',
      }),
    },
    telegram: {
      text: `❌ <b>Jobs post not approved</b>\n${escapeHtml(p.title)}\nReason: ${escapeHtml(p.reason)}`,
    },
  }
}

function renderJobExpiring(p: NotificationPayload<'job.expiring'>): RenderedNotification {
  const noun = jobNoun(p.kind)
  const when = p.daysLeft === 1 ? '1 day' : `${p.daysLeft} days`
  return {
    title: `⏳ Your ${noun} expires in ${when} · ${p.title}`,
    body: `Renew "${p.title}" to keep it on OurDahanu Jobs for another 30 days.`,
    link: '/jobs/my-posts',
    icon: 'Clock',
    metadata: { postId: p.postId, daysLeft: p.daysLeft },
    email: {
      subject: `Your ${noun} "${p.title}" expires in ${when}`,
      html: renderEmailLayout({
        eyebrow: 'OurDahanu Jobs',
        headline: p.kind === 'hiring' ? 'Still hiring?' : 'Still looking for work?',
        introHtml: `<strong>${escapeHtml(p.title)}</strong> comes off OurDahanu Jobs in ${when}. Renew it in one tap to keep it live for another 30 days.`,
        ctaUrl: `${JOBS_URL}/my-posts`,
        ctaText: 'Renew my post',
      }),
    },
    telegram: {
      text: `⏳ <b>Jobs post expiring</b>\n${escapeHtml(p.title)} expires in ${when}. <a href="${JOBS_URL}/my-posts">Renew</a>`,
    },
  }
}
```

3. In `renderAdminSubmission`, add two entries to the `labels` object so it reads:

```ts
  const labels: Record<NotificationPayload<'admin.new_submission'>['kind'], string> = {
    listing: 'Listing',
    event: 'Event',
    professional: 'Professional',
    professional_review: 'Professional review',
    job: 'Job post',
    job_report: 'Job report',
  }
```

4. In the `renderNotification` switch, directly after the `case 'listing.expiring':` return, add:

```ts
    case 'job.approved':
      return renderJobApproved(payload as NotificationPayload<'job.approved'>)
    case 'job.rejected':
      return renderJobRejected(payload as NotificationPayload<'job.rejected'>)
    case 'job.expiring':
      return renderJobExpiring(payload as NotificationPayload<'job.expiring'>)
```

The `as` casts here follow the existing switch exactly; the `never` default stays exhaustive.

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npm run test:existing`
Expected: PASS.

- [ ] **Step 7: Typecheck, lint and commit**

Run: `npx tsc --noEmit && npm run lint`
Expected: typecheck clean (the exhaustive switch proves every new type has a renderer); lint 0 errors / 11 warnings.

```bash
git add src/lib/notifications/types.ts src/lib/notifications/templates.ts src/lib/notifications/job-templates.test.ts package.json
git commit -m "feat(jobs): notifications for approved, rejected and expiring posts"
```

---

### Task 7: Job action rules (dependency-injected core)

**Files:**
- Create: `src/app/actions/jobs-core.ts`
- Create: `src/app/actions/jobs-core.test.ts`
- Modify: `package.json` (register the test file)

**Interfaces:**
- Consumes: `validateJobPostInput`, `JobPostInput`, `ContactFields`, `JobKind` (Task 2); `detectPostFlags` (Task 3); `decideCreateStatus`, `decideEditStatus`, `shouldAutoHide`, `JobStatus`, `ListingAccess` (Task 3); `publishWindow`, `isLive`, `canRenew`, `hoursAgoIso` (Task 3); `NotificationPayload<'admin.new_submission'>` with kinds `job` / `job_report` (Task 6).
- Produces:
  - `DAILY_POST_LIMIT = 5`, `DAILY_REVEAL_LIMIT = 30`, `REPORT_REASONS`, `type ReportReason`, `type DbError`
  - `interface StoredJobPost`, `interface JobActionDependencies` (exact members below)
  - `createJobActions(deps)` → `{ createPost, updatePost, renewPost, closePost, revealContact, reportPost }` with result types `CreatePostResult`, `UpdatePostResult`, `SimpleResult`, `RevealResult`, `ReportResult`

- [ ] **Step 1: Write the failing tests**

Create `src/app/actions/jobs-core.test.ts`:

```ts
import assert from 'node:assert/strict'
import test from 'node:test'
import type { User } from '@supabase/supabase-js'

import {
  createJobActions,
  DAILY_POST_LIMIT,
  DAILY_REVEAL_LIMIT,
  type JobActionDependencies,
  type StoredJobPost,
} from './jobs-core'
import type { JobPostInput } from '../../lib/jobs/validation'

const NOW = new Date('2026-09-14T06:30:00.000Z')
const DAY = 86_400_000
const inDays = (days: number) => new Date(NOW.getTime() + days * DAY).toISOString()
const LISTING_ID = '11111111-1111-4111-8111-111111111111'

const user = { id: 'user-1', email: 'asha@example.com', user_metadata: { full_name: 'Asha' } } as unknown as User

function hiringInput(overrides: Partial<JobPostInput> = {}): JobPostInput {
  return {
    kind: 'hiring',
    title: 'Cook',
    category: 'Hotel, Restaurant & Catering',
    workTypes: ['Full-time'],
    area: 'Dahanu Road',
    description: 'Morning shift.',
    employerName: 'Sai Hotel',
    openings: 1,
    payMin: 12000,
    payMax: 15000,
    payPeriod: 'month',
    timings: null,
    phone: '9876543210',
    whatsapp: true,
    ...overrides,
  }
}

function storedPost(overrides: Partial<StoredJobPost> = {}): StoredJobPost {
  return {
    id: 'post-1',
    kind: 'hiring',
    status: 'approved',
    posted_by: 'owner-9',
    listing_id: null,
    collected_source: null,
    title: 'Cook',
    expires_at: inDays(10),
    reviewed_at: null,
    review_flags: [],
    ...overrides,
  }
}

function harness(overrides: Partial<JobActionDependencies> = {}) {
  const calls = {
    inserted: [] as Array<{ row: Record<string, unknown>; contact: unknown }>,
    updated: [] as Array<{ postId: string; fields: Record<string, unknown>; contact?: unknown }>,
    reveals: [] as string[],
    reports: [] as unknown[],
    notified: [] as unknown[],
    revalidated: 0,
  }
  const deps: JobActionDependencies = {
    now: () => NOW,
    async getUser() { return user },
    async isStaff() { return false },
    async checkListing() { return { accessible: true, approved: true } },
    async countPostsSince() { return 0 },
    async insertPost(row, contact) { calls.inserted.push({ row, contact }); return { id: 'new-post', error: null } },
    async getPost() { return storedPost() },
    async updatePost(postId, fields, contact) { calls.updated.push({ postId, fields, contact }); return { error: null } },
    async getContact() { return { phone: '9876543210', whatsapp: true } },
    async hasRevealed() { return false },
    async countRevealsSince() { return 0 },
    async recordReveal(postId, userId) { calls.reveals.push(`${postId}:${userId}`); return { error: null } },
    async insertReport(row) { calls.reports.push(row); return { error: null } },
    async countReportsSince() { return 1 },
    async loginUrl(path) { return `https://ourdahanu.in/login?next=${encodeURIComponent(`https://jobs.ourdahanu.in${path}`)}` },
    notifyAdmins(payload) { calls.notified.push(payload) },
    revalidate() { calls.revalidated += 1 },
    ...overrides,
  }
  return { actions: createJobActions(deps), calls }
}

test('an individual post waits for review and tells the admins', async () => {
  const { actions, calls } = harness()
  assert.deepEqual(await actions.createPost(hiringInput()), { ok: true, id: 'new-post', status: 'pending' })
  const { row, contact } = calls.inserted[0]
  assert.equal(row.status, 'pending')
  assert.equal(row.posted_by, 'user-1')
  assert.equal('expires_at' in row, false)
  assert.deepEqual(contact, { phone: '9876543210', whatsapp: true })
  assert.deepEqual(calls.notified, [{ kind: 'job', title: 'Cook', submitterName: 'Asha', reviewPath: '/admin/jobs' }])
  assert.equal(calls.revalidated, 0)
})

test('the owner of an approved listing goes live instantly, with no admin notification', async () => {
  const { actions, calls } = harness()
  assert.deepEqual(await actions.createPost(hiringInput({ listingId: LISTING_ID })), { ok: true, id: 'new-post', status: 'approved' })
  const { row } = calls.inserted[0]
  assert.equal(row.published_at, NOW.toISOString())
  assert.equal(row.expires_at, inDays(30))
  assert.equal(row.listing_id, LISTING_ID)
  assert.deepEqual(calls.notified, [])
  assert.equal(calls.revalidated, 1)
})

test('a lapsed listing, or a flagged post from an approved one, waits for review', async () => {
  const lapsed = harness({ async checkListing() { return { accessible: true, approved: false } } })
  assert.deepEqual(await lapsed.actions.createPost(hiringInput({ listingId: LISTING_ID })), { ok: true, id: 'new-post', status: 'pending' })

  const flagged = harness()
  assert.deepEqual(
    await flagged.actions.createPost(hiringInput({ listingId: LISTING_ID, description: 'Registration fee ₹500.' })),
    { ok: true, id: 'new-post', status: 'pending' },
  )
  assert.deepEqual(flagged.calls.inserted[0].row.review_flags, ['scam_words'])
})

test('posting for a business you do not own is refused before anything is written', async () => {
  const { actions, calls } = harness({ async checkListing() { return { accessible: false, approved: true } } })
  assert.deepEqual(await actions.createPost(hiringInput({ listingId: LISTING_ID })), { error: 'You can only post for a business you own.' })
  assert.equal(calls.inserted.length, 0)
})

test('collected posts are staff-only, and go live regardless of flags', async () => {
  const outsider = harness()
  assert.deepEqual(
    await outsider.actions.createPost(hiringInput({ collectedSource: 'Lokmat, 12 Sep' })),
    { error: 'Only OurDahanu staff can post collected jobs.' },
  )

  const staff = harness({ async isStaff() { return true } })
  assert.deepEqual(
    await staff.actions.createPost(hiringInput({ collectedSource: 'Lokmat, 12 Sep', description: 'Call 9876543210' })),
    { ok: true, id: 'new-post', status: 'approved' },
  )
  assert.deepEqual(staff.calls.inserted[0].row.review_flags, [])
})

test('the daily post limit applies to everyone but staff', async () => {
  const busy = harness({ async countPostsSince() { return DAILY_POST_LIMIT } })
  assert.deepEqual(await busy.actions.createPost(hiringInput()), {
    error: `You can post ${DAILY_POST_LIMIT} times a day. Please try again tomorrow.`,
  })

  const staff = harness({ async countPostsSince() { return DAILY_POST_LIMIT }, async isStaff() { return true } })
  assert.equal('ok' in (await staff.actions.createPost(hiringInput())), true)
})

test('a second live profile is refused with a helpful message', async () => {
  const { actions } = harness({ async insertPost() { return { id: null, error: { code: '23505', message: 'duplicate key' } } } })
  const result = await actions.createPost({
    kind: 'seeking',
    title: 'Driver',
    category: 'Driver & Delivery',
    workTypes: ['Full-time'],
    area: 'Bordi',
    displayName: 'Ramesh',
    phone: '9876543210',
    whatsapp: true,
  })
  assert.deepEqual(result, { error: 'You already have a "Looking for work" profile. Edit or renew it from My posts.' })
})

test('logged-out posting is refused', async () => {
  const { actions } = harness({ async getUser() { return null } })
  assert.deepEqual(await actions.createPost(hiringInput()), { error: 'Please log in to post.' })
})

test('editing an approved individual post sends it back to review; a business post stays live', async () => {
  const individual = harness({ async getPost() { return storedPost({ posted_by: 'user-1' }) } })
  assert.deepEqual(await individual.actions.updatePost('post-1', hiringInput()), { ok: true, status: 'pending' })
  assert.equal(individual.calls.updated[0].fields.status, 'pending')
  assert.equal(individual.calls.notified.length, 1)

  const business = harness({ async getPost() { return storedPost({ posted_by: 'user-1', listing_id: LISTING_ID }) } })
  assert.deepEqual(await business.actions.updatePost('post-1', hiringInput({ listingId: LISTING_ID })), { ok: true, status: 'approved' })
  assert.equal(business.calls.notified.length, 0)
})

test('nobody else can edit a post, and closed posts cannot be edited', async () => {
  const stranger = harness()
  assert.deepEqual(await stranger.actions.updatePost('post-1', hiringInput()), { error: 'Post not found.' })

  const closed = harness({ async getPost() { return storedPost({ posted_by: 'user-1', status: 'closed' }) } })
  assert.deepEqual(await closed.actions.updatePost('post-1', hiringInput()), { error: 'This post is closed and can no longer be edited.' })
})

test('renew opens in the last 3 days and restarts the 30 days', async () => {
  const early = harness({ async getPost() { return storedPost({ posted_by: 'user-1', expires_at: inDays(4) }) } })
  assert.deepEqual(await early.actions.renewPost('post-1'), { error: 'You can renew a post in its last 3 days, or once it has expired.' })

  const lapsed = harness({ async getPost() { return storedPost({ posted_by: 'user-1', expires_at: inDays(-40) }) } })
  assert.deepEqual(await lapsed.actions.renewPost('post-1'), { ok: true })
  assert.deepEqual(lapsed.calls.updated[0].fields, {
    published_at: NOW.toISOString(),
    expires_at: inDays(30),
    reminder_sent_at: null,
    updated_at: NOW.toISOString(),
  })
})

test('revealing a number needs a login, and returns to the post afterwards', async () => {
  const { actions } = harness({ async getUser() { return null } })
  assert.deepEqual(await actions.revealContact('post-1'), {
    loginUrl: `https://ourdahanu.in/login?next=${encodeURIComponent('https://jobs.ourdahanu.in/j/post-1')}`,
  })
})

test('a first reveal is recorded; a repeat is free even over the limit', async () => {
  const first = harness()
  assert.deepEqual(await first.actions.revealContact('post-1'), { ok: true, phone: '9876543210', whatsapp: true })
  assert.deepEqual(first.calls.reveals, ['post-1:user-1'])

  const repeat = harness({ async hasRevealed() { return true }, async countRevealsSince() { return DAILY_REVEAL_LIMIT } })
  assert.deepEqual(await repeat.actions.revealContact('post-1'), { ok: true, phone: '9876543210', whatsapp: true })
  assert.deepEqual(repeat.calls.reveals, [])
})

test('the daily reveal limit stops a new reveal', async () => {
  const { actions, calls } = harness({ async countRevealsSince() { return DAILY_REVEAL_LIMIT } })
  assert.deepEqual(await actions.revealContact('post-1'), {
    error: `You have viewed ${DAILY_REVEAL_LIMIT} numbers today — that is the daily limit. Please try again tomorrow.`,
  })
  assert.deepEqual(calls.reveals, [])
})

test('posters revealing their own number are not counted, and expired posts stay hidden from others', async () => {
  const own = harness({ async getPost() { return storedPost({ posted_by: 'user-1', expires_at: inDays(-1) }) } })
  assert.equal('ok' in (await own.actions.revealContact('post-1')), true)
  assert.deepEqual(own.calls.reveals, [])

  const expired = harness({ async getPost() { return storedPost({ expires_at: inDays(-1) }) } })
  assert.deepEqual(await expired.actions.revealContact('post-1'), { error: 'This post is no longer live.' })
})

test('the third report since review hides an approved post; earlier ones do not', async () => {
  const second = harness({ async countReportsSince() { return 2 } })
  assert.deepEqual(await second.actions.reportPost('post-1', 'asks_for_money', null), { ok: true })
  assert.equal(second.calls.updated.length, 0)
  assert.equal(second.calls.notified.length, 1)

  const sinceArgs: Array<string | null> = []
  const third = harness({
    async getPost() { return storedPost({ reviewed_at: inDays(-5) }) },
    async countReportsSince(_postId, since) { sinceArgs.push(since); return 3 },
  })
  assert.deepEqual(await third.actions.reportPost('post-1', 'fake', ' looks fake '), { ok: true })
  assert.deepEqual(sinceArgs, [inDays(-5)])
  assert.deepEqual(third.calls.reports, [{ post_id: 'post-1', user_id: 'user-1', reason: 'fake', note: 'looks fake' }])
  assert.equal(third.calls.updated[0].fields.status, 'pending')
  assert.deepEqual(third.calls.updated[0].fields.review_flags, ['reports'])
  assert.equal(third.calls.revalidated, 1)
})

test('reports are refused for your own post, for an unknown reason, and twice', async () => {
  const own = harness({ async getPost() { return storedPost({ posted_by: 'user-1' }) } })
  assert.deepEqual(await own.actions.reportPost('post-1', 'fake', null), { error: 'You cannot report your own post.' })

  const unknownReason = harness()
  assert.deepEqual(await unknownReason.actions.reportPost('post-1', 'boring', null), { error: 'Choose a reason.' })

  const twice = harness({ async insertReport() { return { error: { code: '23505', message: 'duplicate' } } } })
  assert.deepEqual(await twice.actions.reportPost('post-1', 'fake', null), { error: 'You have already reported this post.' })
})
```

- [ ] **Step 2: Register the test file**

Append ` src/app/actions/jobs-core.test.ts` to the end of the `test:existing` script string in `package.json`.

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npm run test:existing`
Expected: FAIL — `Cannot find module './jobs-core'`.

- [ ] **Step 4: Write `jobs-core.ts`**

Create `src/app/actions/jobs-core.ts`. It is **not** a `'use server'` module — it exports constants, types and a factory, and `src/app/actions/jobs.ts` (Task 8) wraps it.

```ts
import type { User } from '@supabase/supabase-js'
import type { NotificationPayload } from '@/lib/notifications'

// Runtime imports are relative on purpose: a node:test file loads this module,
// and the test runner does not resolve the @/ alias.
import { canRenew, hoursAgoIso, isLive, publishWindow } from '../../lib/jobs/lifecycle'
import {
  decideCreateStatus,
  decideEditStatus,
  shouldAutoHide,
  type JobStatus,
  type ListingAccess,
} from '../../lib/jobs/rules'
import { detectPostFlags } from '../../lib/jobs/scam-signals'
import {
  validateJobPostInput,
  type ContactFields,
  type JobKind,
  type JobPostInput,
} from '../../lib/jobs/validation'

export const DAILY_POST_LIMIT = 5
export const DAILY_REVEAL_LIMIT = 30

export const REPORT_REASONS = ['asks_for_money', 'fake', 'filled', 'offensive', 'my_number', 'other'] as const

export type ReportReason = (typeof REPORT_REASONS)[number]

export type DbError = { code?: string; message: string } | null

/** The columns the rules need, read with the service role. */
export interface StoredJobPost {
  id: string
  kind: JobKind
  status: JobStatus
  posted_by: string
  listing_id: string | null
  collected_source: string | null
  title: string
  expires_at: string | null
  reviewed_at: string | null
  review_flags: string[]
}

export interface JobActionDependencies {
  now(): Date
  getUser(): Promise<User | null>
  /** Admin or moderator. */
  isStaff(): Promise<boolean>
  /** Null when the listing does not exist. */
  checkListing(listingId: string): Promise<ListingAccess | null>
  countPostsSince(userId: string, since: string): Promise<number>
  /** Inserts the post and its contact together; never leaves a post without a number. */
  insertPost(row: Record<string, unknown>, contact: ContactFields): Promise<{ id: string | null; error: DbError }>
  getPost(postId: string): Promise<StoredJobPost | null>
  updatePost(postId: string, fields: Record<string, unknown>, contact?: ContactFields): Promise<{ error: DbError }>
  getContact(postId: string): Promise<ContactFields | null>
  hasRevealed(postId: string, userId: string): Promise<boolean>
  countRevealsSince(userId: string, since: string): Promise<number>
  recordReveal(postId: string, userId: string): Promise<{ error: DbError }>
  insertReport(row: { post_id: string; user_id: string; reason: ReportReason; note: string | null }): Promise<{ error: DbError }>
  /** Reports created after `since`, or every report when `since` is null. */
  countReportsSince(postId: string, since: string | null): Promise<number>
  /** Main-site login URL that returns to this jobs-relative path. */
  loginUrl(returnPath: string): Promise<string>
  notifyAdmins(payload: NotificationPayload<'admin.new_submission'>): void
  /** Refresh the cached public board. */
  revalidate(): void
}

export type CreatePostResult = { ok: true; id: string; status: 'approved' | 'pending' } | { error: string }
export type UpdatePostResult = { ok: true; status: 'approved' | 'pending' } | { error: string }
export type SimpleResult = { ok: true } | { error: string }
export type RevealResult = { ok: true; phone: string; whatsapp: boolean } | { loginUrl: string } | { error: string }
export type ReportResult = { ok: true } | { loginUrl: string } | { error: string }

const PROFILE_EXISTS = 'You already have a "Looking for work" profile. Edit or renew it from My posts.'
const SAVE_FAILED = 'Could not save your post. Please try again.'

function displayName(user: User): string | null {
  const fullName = user.user_metadata.full_name
  return typeof fullName === 'string' && fullName.trim() ? fullName.trim() : user.email ?? null
}

function isReportReason(value: string): value is ReportReason {
  return (REPORT_REASONS as readonly string[]).includes(value)
}

export function createJobActions(deps: JobActionDependencies) {
  /** Null when no listing was chosen; 'forbidden' when the user cannot act for it. */
  async function listingFor(listingId: string | null): Promise<ListingAccess | null | 'forbidden'> {
    if (!listingId) return null
    const listing = await deps.checkListing(listingId)
    return listing && listing.accessible ? listing : 'forbidden'
  }

  async function createPost(input: JobPostInput): Promise<CreatePostResult> {
    const user = await deps.getUser()
    if (!user) return { error: 'Please log in to post.' }
    const staff = await deps.isStaff()
    const now = deps.now()

    if (!staff && (await deps.countPostsSince(user.id, hoursAgoIso(now, 24))) >= DAILY_POST_LIMIT) {
      return { error: `You can post ${DAILY_POST_LIMIT} times a day. Please try again tomorrow.` }
    }

    const result = validateJobPostInput(input)
    if (!result.ok) return { error: result.error }
    const { fields, contact } = result

    if (fields.collected_source !== null && !staff) {
      return { error: 'Only OurDahanu staff can post collected jobs.' }
    }
    const collectedByStaff = staff && fields.collected_source !== null

    const listing = await listingFor(fields.listing_id)
    if (listing === 'forbidden') return { error: 'You can only post for a business you own.' }

    // Staff-collected posts skip the scam check; everything else is scanned.
    const flags = collectedByStaff ? [] : detectPostFlags(fields)
    const status = decideCreateStatus({ collectedByStaff, listing, flags })

    const { id, error } = await deps.insertPost(
      {
        ...fields,
        status,
        posted_by: user.id,
        review_flags: flags,
        ...(status === 'approved' ? publishWindow(now) : {}),
        updated_at: now.toISOString(),
      },
      contact,
    )
    if (error) return { error: error.code === '23505' ? PROFILE_EXISTS : SAVE_FAILED }
    if (!id) return { error: SAVE_FAILED }

    // Pending posts need a reviewer; instant and collected posts are already
    // public, so they refresh the board instead.
    if (status === 'pending') {
      deps.notifyAdmins({ kind: 'job', title: fields.title, submitterName: displayName(user), reviewPath: '/admin/jobs' })
    } else {
      deps.revalidate()
    }
    return { ok: true, id, status }
  }

  async function updatePost(postId: string, input: JobPostInput): Promise<UpdatePostResult> {
    const user = await deps.getUser()
    if (!user) return { error: 'Please log in.' }
    const [post, staff] = await Promise.all([deps.getPost(postId), deps.isStaff()])
    if (!post || (post.posted_by !== user.id && !staff)) return { error: 'Post not found.' }

    // A post never changes kind, and only staff can set or change the
    // "collected" label.
    const result = validateJobPostInput({ ...input, kind: post.kind })
    if (!result.ok) return { error: result.error }
    const fields = {
      ...result.fields,
      collected_source: staff ? result.fields.collected_source : post.collected_source,
    }
    const collectedByStaff = staff && fields.collected_source !== null

    const listing = await listingFor(fields.listing_id)
    if (listing === 'forbidden') return { error: 'You can only post for a business you own.' }

    const flags = collectedByStaff ? [] : detectPostFlags(fields)
    const next = decideEditStatus({ current: post.status, collectedByStaff, listing, flags })
    if (next === null) return { error: 'This post is closed and can no longer be edited.' }

    const { error } = await deps.updatePost(
      postId,
      { ...fields, status: next, review_flags: flags, reject_reason: null, updated_at: deps.now().toISOString() },
      result.contact,
    )
    if (error) return { error: error.code === '23505' ? PROFILE_EXISTS : SAVE_FAILED }

    // Only tell reviewers when a post newly enters the queue, not on every
    // edit of a post that is already waiting.
    if (next === 'pending' && post.status !== 'pending') {
      deps.notifyAdmins({ kind: 'job', title: fields.title, submitterName: displayName(user), reviewPath: '/admin/jobs' })
    }
    // A live post that went back to review must leave the board at once.
    deps.revalidate()
    return { ok: true, status: next }
  }

  async function renewPost(postId: string): Promise<SimpleResult> {
    const user = await deps.getUser()
    if (!user) return { error: 'Please log in.' }
    const post = await deps.getPost(postId)
    if (!post || post.posted_by !== user.id) return { error: 'Post not found.' }

    const now = deps.now()
    if (!canRenew(post, now)) {
      return { error: 'You can renew a post in its last 3 days, or once it has expired.' }
    }
    const { error } = await deps.updatePost(postId, {
      ...publishWindow(now),
      reminder_sent_at: null,
      updated_at: now.toISOString(),
    })
    if (error) return { error: 'Could not renew your post. Please try again.' }
    deps.revalidate()
    return { ok: true }
  }

  async function closePost(postId: string): Promise<SimpleResult> {
    const user = await deps.getUser()
    if (!user) return { error: 'Please log in.' }
    const [post, staff] = await Promise.all([deps.getPost(postId), deps.isStaff()])
    if (!post || (post.posted_by !== user.id && !staff)) return { error: 'Post not found.' }
    if (post.status === 'closed' || post.status === 'removed') return { error: 'This post is already closed.' }

    const { error } = await deps.updatePost(postId, { status: 'closed', updated_at: deps.now().toISOString() })
    if (error) return { error: 'Could not close your post. Please try again.' }
    deps.revalidate()
    return { ok: true }
  }

  async function revealContact(postId: string): Promise<RevealResult> {
    const user = await deps.getUser()
    if (!user) return { loginUrl: await deps.loginUrl(`/j/${postId}`) }

    const [post, staff] = await Promise.all([deps.getPost(postId), deps.isStaff()])
    const now = deps.now()
    const own = post !== null && post.posted_by === user.id
    if (!post || (!isLive(post, now) && !own && !staff)) return { error: 'This post is no longer live.' }

    const contact = await deps.getContact(postId)
    if (!contact) return { error: 'The number for this post is not available.' }

    // Posters and staff are never counted. For everyone else a number already
    // revealed stays free; only a first reveal counts against the daily limit.
    if (!own && !staff && !(await deps.hasRevealed(postId, user.id))) {
      if ((await deps.countRevealsSince(user.id, hoursAgoIso(now, 24))) >= DAILY_REVEAL_LIMIT) {
        return {
          error: `You have viewed ${DAILY_REVEAL_LIMIT} numbers today — that is the daily limit. Please try again tomorrow.`,
        }
      }
      const { error } = await deps.recordReveal(postId, user.id)
      // 23505: another tab revealed it a moment ago — the number is theirs already.
      if (error && error.code !== '23505') return { error: 'Could not show the number. Please try again.' }
    }

    return { ok: true, phone: contact.phone, whatsapp: contact.whatsapp }
  }

  async function reportPost(postId: string, reason: string, note: string | null): Promise<ReportResult> {
    const user = await deps.getUser()
    if (!user) return { loginUrl: await deps.loginUrl(`/j/${postId}`) }
    if (!isReportReason(reason)) return { error: 'Choose a reason.' }

    const post = await deps.getPost(postId)
    if (!post) return { error: 'Post not found.' }
    if (post.posted_by === user.id) return { error: 'You cannot report your own post.' }

    const cleanNote = note?.trim().slice(0, 500) || null
    const { error } = await deps.insertReport({ post_id: postId, user_id: user.id, reason, note: cleanNote })
    if (error) {
      return { error: error.code === '23505' ? 'You have already reported this post.' : 'Could not send your report. Please try again.' }
    }

    deps.notifyAdmins({
      kind: 'job_report',
      title: `${post.title} · ${reason}`,
      submitterName: displayName(user),
      reviewPath: '/admin/jobs',
    })

    // Counted since the last review, so a post approved again after a report
    // hide needs three new reports to be hidden again. The poster is not told:
    // telling a scammer what tripped the hide teaches them to avoid it.
    const reports = await deps.countReportsSince(postId, post.reviewed_at)
    if (shouldAutoHide(post.status, reports)) {
      const reviewFlags = post.review_flags.includes('reports') ? post.review_flags : [...post.review_flags, 'reports']
      await deps.updatePost(postId, { status: 'pending', review_flags: reviewFlags, updated_at: deps.now().toISOString() })
      deps.revalidate()
    }
    return { ok: true }
  }

  return { createPost, updatePost, renewPost, closePost, revealContact, reportPost }
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npm run test:existing`
Expected: PASS — every test in `jobs-core.test.ts` plus all earlier tests.

- [ ] **Step 6: Typecheck, lint and commit**

Run: `npx tsc --noEmit && npm run lint`
Expected: typecheck clean; lint 0 errors / 11 warnings.

```bash
git add src/app/actions/jobs-core.ts src/app/actions/jobs-core.test.ts package.json
git commit -m "feat(jobs): business rules for posting, reveals and reports"
```

**Post-review changes (commit `8989ee1`, approved by the site owner):** side effects that run after a successful write (`notifyAdmins`, `revalidate`) go through an `afterWrite` helper that logs a failure and never throws, so a saved post is never reported as failed. `reportPost` checks the auto-hide write's result and hides before notifying admins, so a notification failure cannot skip the hide. Four tests cover these paths. The 5-posts and 30-reveals limits stay check-then-act soft limits by decision.

---

### Task 8: Wiring — cache tag, data layer and server actions

**Files:**
- Modify: `src/lib/cache-tags.ts`
- Create: `src/lib/jobs/types.ts`
- Create: `src/lib/data/jobs.ts`
- Create: `src/app/jobs/jobs-server.ts`
- Create: `src/app/actions/jobs.ts`

**Interfaces:**
- Consumes: Task 1 table types (the public client is typed, so the tables must exist in `database.types.ts`); `buildStandaloneLoginHref`, `getStandaloneSubdomain` (Task 5); `createJobActions`, `JobActionDependencies`, `StoredJobPost`, `DbError` (Task 7); `JobPostInput`, `ContactFields`, `JobKind` (Task 2); `PayPeriod` (Task 2); `jobCategoryMarathi` (Task 2).
- Produces:
  - `CACHE_TAGS.jobs = 'jobs'`, `revalidateJobsCache(): void`
  - `interface JobBusiness { id: string; name: string; subdomain: string | null }`, `interface PublicJobPost` (fields below)
  - `interface JobBoardFilters { kind: JobKind; q?: string; category?: string | null; workType?: string | null; area?: string | null }`, `getJobBoard(filters): Promise<PublicJobPost[]>`, `getLiveJobPostById(id: string): Promise<PublicJobPost | null>`
  - `jobsLoginHref(returnPath: string): Promise<string>` — `returnPath` is jobs-relative (`/post`, `/j/<id>`)
  - Server actions: `createJobPost(input: JobPostInput)`, `updateJobPost(postId: string, input: JobPostInput)`, `renewJobPost(postId: string)`, `closeJobPost(postId: string)`, `revealJobContact(postId: string)`, `reportJobPost(postId: string, reason: string, note: string | null)`. Each returns its core result type or `{ error: string }`.

- [ ] **Step 1: Add the cache tag**

In `src/lib/cache-tags.ts`, add `jobs: 'jobs',` as the last property of `CACHE_TAGS` (after `find: 'find-directory',`), and append this helper at the end of the file:

```ts
// One tag covers the whole jobs board: the list, category pages and post pages
// all read the same cached set of live posts.
export function revalidateJobsCache() {
  updatePublicTag('jobs', CACHE_TAGS.jobs)
}
```

- [ ] **Step 2: Define the public post shape**

Create `src/lib/jobs/types.ts`:

```ts
import type { PayPeriod } from './options'
import type { JobKind } from './validation'

/** A linked business, present only while its listing is approved. */
export interface JobBusiness {
  id: string
  name: string
  subdomain: string | null
}

/** A live post as the public sees it. It never carries contact details. */
export interface PublicJobPost {
  id: string
  kind: JobKind
  title: string
  category: string
  work_types: string[]
  area: string
  description: string | null
  employer_name: string | null
  openings: number | null
  pay_min: number | null
  pay_max: number | null
  pay_period: PayPeriod | null
  timings: string | null
  display_name: string | null
  experience_years: number | null
  collected_source: string | null
  published_at: string
  expires_at: string
  business: JobBusiness | null
}
```

- [ ] **Step 3: Write the cached data layer**

Create `src/lib/data/jobs.ts`:

```ts
import 'server-only'

import { cacheLife, cacheTag } from 'next/cache'

import { CACHE_TAGS } from '@/lib/cache-tags'
import { logCacheRegeneration } from '@/lib/isr-debug'
import { jobCategoryMarathi } from '@/lib/jobs/categories'
import type { JobBusiness, PublicJobPost } from '@/lib/jobs/types'
import type { JobKind } from '@/lib/jobs/validation'
import { createPublicClient } from '@/lib/supabase/public'

// Explicit columns, never `*`: job_posts holds moderation columns that must not
// reach cached public payloads. Contact details live in a table the public
// client cannot read at all.
const PUBLIC_COLUMNS =
  'id, kind, title, category, work_types, area, description, employer_name, openings, pay_min, pay_max, pay_period, timings, display_name, experience_years, collected_source, published_at, expires_at'

// A safety bound, not a page size. Keep it well above the number of live posts,
// or posts silently vanish from the board.
const LIVE_POST_CAP = 500

type RawBusiness = (JobBusiness & { approved: boolean | null }) | null
type RawPost = Omit<PublicJobPost, 'business'> & { business: RawBusiness }

function toPublicPost(row: RawPost): PublicJobPost {
  const { business, ...post } = row
  return {
    ...post,
    // The "OurDahanu business" badge follows the listing: if the listing
    // lapses, the badge disappears with it.
    business: business && business.approved ? { id: business.id, name: business.name, subdomain: business.subdomain } : null,
  }
}

/**
 * Every live post, newest first, as one cached unit. Row-level security applies
 * the live filter (approved and not yet expired) at query time. With the
 * `hours` profile an expired post leaves the board within about an hour even
 * when nothing writes; every mutation refreshes it at once via the `jobs` tag.
 */
async function getLiveJobPosts(): Promise<PublicJobPost[]> {
  'use cache'

  cacheLife('hours')
  cacheTag(CACHE_TAGS.jobs)
  logCacheRegeneration({ scope: 'jobs:board', tags: [CACHE_TAGS.jobs] })

  const supabase = createPublicClient()
  const { data } = await supabase
    .from('job_posts')
    .select(`${PUBLIC_COLUMNS}, business:listings(id, name, subdomain, approved)`)
    .eq('status', 'approved')
    .order('published_at', { ascending: false })
    .order('id', { ascending: true })
    .limit(LIVE_POST_CAP)

  return ((data ?? []) as unknown as RawPost[]).map(toPublicPost)
}

export interface JobBoardFilters {
  kind: JobKind
  q?: string
  category?: string | null
  workType?: string | null
  area?: string | null
}

function matchesTerms(post: PublicJobPost, terms: string[]): boolean {
  const haystack = [
    post.title,
    post.employer_name ?? '',
    post.display_name ?? '',
    post.area,
    post.description ?? '',
    post.category,
    // Categories match in both languages.
    jobCategoryMarathi(post.category) ?? '',
  ]
    .join(' ')
    .toLowerCase()
  return terms.every((term) => haystack.includes(term))
}

/** Filters run in memory over the cached set — a few hundred rows at most. */
export async function getJobBoard(filters: JobBoardFilters): Promise<PublicJobPost[]> {
  const terms = (filters.q ?? '').trim().toLowerCase().split(/\s+/).filter(Boolean)
  const area = (filters.area ?? '').trim().toLowerCase()
  const posts = await getLiveJobPosts()
  return posts.filter(
    (post) =>
      post.kind === filters.kind &&
      (!filters.category || post.category === filters.category) &&
      (!filters.workType || post.work_types.includes(filters.workType)) &&
      (!area || post.area.toLowerCase().includes(area)) &&
      (terms.length === 0 || matchesTerms(post, terms)),
  )
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function getLiveJobPostById(id: string): Promise<PublicJobPost | null> {
  if (!UUID.test(id)) return null
  const posts = await getLiveJobPosts()
  return posts.find((post) => post.id === id) ?? null
}
```

- [ ] **Step 4: Write the jobs login helper**

Create `src/app/jobs/jobs-server.ts`:

```ts
import { headers } from 'next/headers'

import { buildStandaloneLoginHref, getStandaloneSubdomain } from '@/lib/standalone-hosts'

/**
 * Main-site login URL that brings the user back to a jobs page.
 *
 * `returnPath` is jobs-relative (`/post`, `/j/<id>`). On jobs.ourdahanu.in that
 * is the real path; on the main domain the same page lives under /jobs, so the
 * prefix is added there.
 */
export async function jobsLoginHref(returnPath: string): Promise<string> {
  const h = await headers()
  const rawHost = (h.get('x-forwarded-host') ?? h.get('host') ?? 'jobs.ourdahanu.in').split(',')[0].trim()
  const path =
    getStandaloneSubdomain(rawHost) === 'jobs' ? returnPath : `/jobs${returnPath === '/' ? '' : returnPath}`
  return buildStandaloneLoginHref(rawHost, path)
}
```

- [ ] **Step 5: Write the server actions**

Create `src/app/actions/jobs.ts`:

```ts
'use server'

import { after } from 'next/server'

import { getUserRole } from '@/app/actions/admin'
import { jobsLoginHref } from '@/app/jobs/jobs-server'
import { requireListingAccess } from '@/lib/appointment-access'
import { revalidateJobsCache } from '@/lib/cache-tags'
import type { ContactFields, JobPostInput } from '@/lib/jobs/validation'
import { sendNotificationToAdmins } from '@/lib/notifications'
import { createAdminClient } from '@/lib/supabase/admin-client'
import { createClient } from '@/lib/supabase/server'
import { createJobActions, type DbError, type JobActionDependencies, type StoredJobPost } from './jobs-core'

// NOTE: this is a 'use server' module — it may export ONLY async functions.
// Import result and input types from './jobs-core' and '@/lib/jobs/validation'.
// Re-exporting a type from here makes Next's server-action transform emit a
// runtime reference to it, and every action then 500s at module evaluation.

const UNAVAILABLE = { error: 'Jobs are temporarily unavailable. Please try again later.' }

function toDbError(error: { code?: string; message: string } | null): DbError {
  return error ? { code: error.code, message: error.message } : null
}

/** Builds the core with production dependencies, once per action invocation. */
async function buildJobActions() {
  const supabase = await createClient()
  const adminClient = createAdminClient()
  if (!adminClient) return null
  const db = adminClient

  const deps: JobActionDependencies = {
    now: () => new Date(),

    async getUser() {
      return (await supabase.auth.getUser()).data.user
    },

    async isStaff() {
      const { role } = await getUserRole(supabase)
      return role === 'admin' || role === 'moderator'
    },

    async checkListing(listingId) {
      const { data } = await db.from('listings').select('approved').eq('id', listingId).maybeSingle()
      if (!data) return null
      // Owner or staff — the same check that guards appointment settings. It
      // does not look at approval, which is why `approved` is read separately.
      const access = await requireListingAccess(listingId)
      return {
        accessible: 'userId' in access,
        approved: (data as { approved: boolean | null }).approved === true,
      }
    },

    async countPostsSince(userId, since) {
      const { count } = await db
        .from('job_posts')
        .select('id', { count: 'exact', head: true })
        .eq('posted_by', userId)
        .gte('created_at', since)
      return count ?? 0
    },

    async insertPost(row, contact) {
      const { data, error } = await db.from('job_posts').insert(row).select('id').single()
      if (error || !data) return { id: null, error: toDbError(error) ?? { message: 'Insert returned no row.' } }
      const id = (data as { id: string }).id

      const { error: contactError } = await db
        .from('job_post_contacts')
        .insert({ post_id: id, phone: contact.phone, whatsapp: contact.whatsapp })
      if (contactError) {
        // Never leave a post without its number: remove the row created just above.
        await db.from('job_posts').delete().eq('id', id)
        return { id: null, error: toDbError(contactError) }
      }
      return { id, error: null }
    },

    async getPost(postId) {
      const { data } = await db
        .from('job_posts')
        .select('id, kind, status, posted_by, listing_id, collected_source, title, expires_at, reviewed_at, review_flags')
        .eq('id', postId)
        .maybeSingle()
      return (data ?? null) as StoredJobPost | null
    },

    async updatePost(postId, fields, contact) {
      const { error } = await db.from('job_posts').update(fields).eq('id', postId)
      if (error) return { error: toDbError(error) }
      if (contact) {
        const { error: contactError } = await db
          .from('job_post_contacts')
          .upsert(
            { post_id: postId, phone: contact.phone, whatsapp: contact.whatsapp, updated_at: new Date().toISOString() },
            { onConflict: 'post_id' },
          )
        if (contactError) return { error: toDbError(contactError) }
      }
      return { error: null }
    },

    async getContact(postId) {
      const { data } = await db.from('job_post_contacts').select('phone, whatsapp').eq('post_id', postId).maybeSingle()
      return (data ?? null) as ContactFields | null
    },

    async hasRevealed(postId, userId) {
      const { data } = await db
        .from('job_contact_reveals')
        .select('post_id')
        .eq('post_id', postId)
        .eq('user_id', userId)
        .maybeSingle()
      return data !== null
    },

    async countRevealsSince(userId, since) {
      const { count } = await db
        .from('job_contact_reveals')
        .select('post_id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .gte('created_at', since)
      return count ?? 0
    },

    async recordReveal(postId, userId) {
      const { error } = await db.from('job_contact_reveals').insert({ post_id: postId, user_id: userId })
      return { error: toDbError(error) }
    },

    async insertReport(row) {
      const { error } = await db.from('job_post_reports').insert(row)
      return { error: toDbError(error) }
    },

    async countReportsSince(postId, since) {
      let query = db.from('job_post_reports').select('id', { count: 'exact', head: true }).eq('post_id', postId)
      if (since) query = query.gt('created_at', since)
      const { count } = await query
      return count ?? 0
    },

    loginUrl: (returnPath) => jobsLoginHref(returnPath),

    notifyAdmins(payload) {
      // Deliver after the response, awaiting every channel so the serverless
      // function stays alive until delivery completes (see actions/find.ts).
      after(() => sendNotificationToAdmins('admin.new_submission', payload, { awaitDelivery: true }))
    },

    revalidate: () => revalidateJobsCache(),
  }

  return createJobActions(deps)
}

export async function createJobPost(input: JobPostInput) {
  const actions = await buildJobActions()
  return actions ? actions.createPost(input) : UNAVAILABLE
}

export async function updateJobPost(postId: string, input: JobPostInput) {
  const actions = await buildJobActions()
  return actions ? actions.updatePost(postId, input) : UNAVAILABLE
}

export async function renewJobPost(postId: string) {
  const actions = await buildJobActions()
  return actions ? actions.renewPost(postId) : UNAVAILABLE
}

export async function closeJobPost(postId: string) {
  const actions = await buildJobActions()
  return actions ? actions.closePost(postId) : UNAVAILABLE
}

export async function revealJobContact(postId: string) {
  const actions = await buildJobActions()
  return actions ? actions.revealContact(postId) : UNAVAILABLE
}

export async function reportJobPost(postId: string, reason: string, note: string | null) {
  const actions = await buildJobActions()
  return actions ? actions.reportPost(postId, reason, note) : UNAVAILABLE
}
```

- [ ] **Step 6: Typecheck, lint, test and build**

Run: `npx tsc --noEmit && npm run lint && npm run test:existing && npm run build`
Expected: typecheck clean; lint 0 errors / 11 warnings; all tests pass; build succeeds.

If `tsc` rejects the typed `job_posts` select in `src/lib/data/jobs.ts`, the Task 1 types are missing or misspelled — fix the types, never loosen the query with a cast on the client.

- [ ] **Step 7: Commit**

```bash
git add src/lib/cache-tags.ts src/lib/jobs/types.ts src/lib/data/jobs.ts src/app/jobs/jobs-server.ts src/app/actions/jobs.ts
git commit -m "feat(jobs): cached board reads and server actions"
```

---

### Task 9: Public board pages

**Files:**
- Create: `src/app/jobs/layout.tsx`
- Create: `src/app/jobs/jobs-ui.tsx`
- Create: `src/app/jobs/JobCard.tsx`
- Create: `src/app/jobs/page.tsx`
- Create: `src/app/jobs/c/[slug]/page.tsx`
- Create: `src/app/jobs/j/[id]/page.tsx`
- Create: `src/app/jobs/j/[id]/ShowContactButton.tsx`
- Create: `src/app/jobs/j/[id]/ReportPostButton.tsx`
- Create: `src/app/jobs/j/[id]/opengraph-image.tsx`

**Interfaces:**
- Consumes: `getJobBoard`, `getLiveJobPostById`, `PublicJobPost`, `JobBusiness` (Task 8); `revealJobContact`, `reportJobPost` (Task 8); `formatPay` (Task 4); `buildJobPostingLd` (Task 4); `JOB_CATEGORIES`, `jobCategoryMarathi`, `jobCategorySlug`, `jobCategoryFromSlug` (Task 2); `WORK_TYPES`, `AREA_SUGGESTIONS` (Task 2); `formatIndianPhone`, `telHrefIndia`, `waHrefIndia` (Task 2); `Mr`, `chipBase`, `chipOn`, `chipOff` from `src/app/find/find-ui.tsx`; `getCanonicalListingUrl` from `src/lib/listing-url.ts`; `truncateAtWord` from `src/lib/text.ts`; `MIN_CATEGORY_SIZE` from `src/lib/seo-thresholds.ts`.
- Produces (used by Tasks 10 and 11): from `src/app/jobs/jobs-ui.tsx` — `JOBS_URL`, `Mr`, `chipBase`, `chipOn`, `chipOff`, `CategoryPill`, `BusinessBadge`, `CollectedLabel`, `kindLabel(kind)`, `shortDate(iso)`.

Public jobs pages never read the current time: dates are shown as absolute dates ("14 Sep") so pages stay cacheable under Cache Components, where reading the current time during prerender is an error.

- [ ] **Step 1: Write the shared UI**

Create `src/app/jobs/jobs-ui.tsx`:

```tsx
import { BadgeCheck, Newspaper } from 'lucide-react'

import { Mr } from '@/app/find/find-ui'
import { jobCategoryMarathi } from '@/lib/jobs/categories'
import type { JobBusiness } from '@/lib/jobs/types'
import { getCanonicalListingUrl } from '@/lib/listing-url'

// Generic pieces shared with Find, re-exported so jobs code has one import path.
export { Mr, chipBase, chipOff, chipOn } from '@/app/find/find-ui'

export const JOBS_URL = 'https://jobs.ourdahanu.in'

export function kindLabel(kind: 'hiring' | 'seeking'): string {
  return kind === 'hiring' ? 'Hiring' : 'Looking for work'
}

/** "14 Sep" in IST. An absolute date, so cached pages never go stale mid-sentence. */
export function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' })
}

export function CategoryPill({ category }: { category: string }) {
  return (
    <span className="rounded-full bg-[rgba(192,88,46,0.09)] px-2 py-0.5 text-[11px] font-bold text-[var(--od-brand-strong)]">
      {category} <Mr text={jobCategoryMarathi(category)} />
    </span>
  )
}

export function BusinessBadge({ business }: { business: JobBusiness }) {
  return (
    <a
      href={getCanonicalListingUrl(business.id, business.subdomain)}
      target="_blank"
      rel="noopener noreferrer"
      className="relative z-10 inline-flex items-center gap-1 rounded-full bg-[var(--od-gold)]/15 px-2 py-0.5 text-[11px] font-bold text-[var(--od-brand-strong)] transition-colors hover:bg-[var(--od-gold)]/25"
    >
      <BadgeCheck size={12} className="text-[var(--od-gold)]" aria-hidden />
      OurDahanu business · {business.name}
    </a>
  )
}

export function CollectedLabel({ source }: { source: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-[var(--color-surface-soft)] px-2 py-0.5 text-[11px] font-semibold text-[var(--od-muted)]">
      <Newspaper size={12} aria-hidden />
      Collected by OurDahanu · {source}
    </span>
  )
}
```

- [ ] **Step 2: Write the layout**

Create `src/app/jobs/layout.tsx`:

```tsx
import Link from 'next/link'
import type { Metadata } from 'next'
import { Plus } from 'lucide-react'

export const metadata: Metadata = {
  title: 'OurDahanu Jobs — Local Jobs in Dahanu',
  description:
    'Local jobs in Dahanu, Bordi, Gholvad and Palghar — shops, hotels, farms, clinics and homes hiring. Free to post a job, or to say you are looking for work.',
}

export default function JobsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="od-page flex min-h-dvh flex-col text-[var(--od-ink)]">
      <a
        href="#jobs-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-white focus:px-3 focus:py-2 focus:text-sm focus:font-semibold"
      >
        Skip to content
      </a>

      <div className="w-full bg-[var(--od-ink)] px-4 py-2 text-center text-xs font-semibold text-[var(--od-bg)]">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-center gap-x-2 gap-y-0.5">
          <span aria-hidden>🛡️</span>
          <span>Never pay anyone to get a job. Report posts that ask for money.</span>
        </div>
      </div>

      <header className="sticky top-0 z-40 border-b border-[var(--od-border)] bg-[rgba(250,250,247,0.88)] backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-3 px-4">
          <Link href="/jobs" className="flex items-baseline">
            <span className="font-display text-[1.4rem] leading-none">Jobs</span>
            <span className="font-display text-[1.4rem] italic leading-none text-[var(--od-brand)]">Dahanu</span>
          </Link>
          <nav aria-label="Jobs" className="flex items-center gap-3">
            <Link
              href="/jobs/my-posts"
              className="text-sm font-semibold text-[var(--od-ink-2)] transition-colors hover:text-[var(--od-brand-strong)]"
            >
              My posts
            </Link>
            <Link href="/jobs/post" className="od-button-primary px-3.5 py-2 text-sm active:scale-[0.98]">
              <Plus size={15} aria-hidden />
              Post
            </Link>
          </nav>
        </div>
      </header>

      <main id="jobs-content" className="mx-auto w-full max-w-5xl flex-1 scroll-mt-14 px-4 pb-16 pt-6">
        {children}
      </main>

      <footer className="border-t border-[var(--od-border)] bg-[var(--color-surface-2)]">
        <div className="warli-divider opacity-70" aria-hidden />
        <div className="mx-auto flex max-w-5xl flex-col items-center gap-1.5 px-4 py-6 text-center">
          <p className="font-display text-lg">
            Jobs<span className="italic text-[var(--od-brand)]">Dahanu</span>
          </p>
          <p className="text-xs text-[var(--od-muted)]">
            Free to post. Posts from individuals are checked by a moderator before they appear.
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

- [ ] **Step 3: Write the card**

Create `src/app/jobs/JobCard.tsx`:

```tsx
import Link from 'next/link'
import { BriefcaseBusiness, MapPin, Users } from 'lucide-react'

import { formatPay } from '@/lib/jobs/pay'
import type { PublicJobPost } from '@/lib/jobs/types'
import { BusinessBadge, CategoryPill, CollectedLabel, shortDate } from './jobs-ui'

export default function JobCard({ post }: { post: PublicJobPost }) {
  const subtitle = post.kind === 'hiring' ? post.employer_name : post.display_name

  return (
    <article className="od-card od-card-hover relative flex flex-col p-4 sm:p-5">
      <Link
        href={`/jobs/j/${post.id}`}
        className="absolute inset-0 z-0 rounded-[inherit]"
        aria-label={`View ${post.title}${subtitle ? ` — ${subtitle}` : ''}`}
      />

      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="truncate text-[1.05rem] font-bold tracking-[-0.01em]">{post.title}</h2>
          {subtitle && <p className="mt-0.5 truncate text-sm text-[var(--od-ink-2)]">{subtitle}</p>}
        </div>
        <span className="shrink-0 text-[11px] text-[var(--od-muted)]">{shortDate(post.published_at)}</span>
      </div>

      <div className="mt-2 flex flex-wrap gap-1">
        <CategoryPill category={post.category} />
        {post.business && <BusinessBadge business={post.business} />}
        {post.collected_source && <CollectedLabel source={post.collected_source} />}
      </div>

      <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--od-muted)]">
        <span className="flex items-center gap-1">
          <MapPin size={12} aria-hidden /> {post.area}
        </span>
        <span>{post.work_types.join(' · ')}</span>
        {post.kind === 'hiring' && <span className="font-semibold text-[var(--od-ink-2)]">{formatPay(post)}</span>}
        {post.kind === 'hiring' && post.openings !== null && post.openings > 1 && (
          <span className="flex items-center gap-1">
            <Users size={12} aria-hidden /> {post.openings} openings
          </span>
        )}
        {post.kind === 'seeking' && post.experience_years !== null && (
          <span className="flex items-center gap-1">
            <BriefcaseBusiness size={12} aria-hidden /> {post.experience_years} {post.experience_years === 1 ? 'year' : 'years'} experience
          </span>
        )}
      </p>

      {post.description && (
        <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-[var(--od-ink-2)]">{post.description}</p>
      )}
    </article>
  )
}
```

- [ ] **Step 4: Write the board page**

Create `src/app/jobs/page.tsx`:

```tsx
import { Suspense } from 'react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { SearchX, ShieldCheck } from 'lucide-react'

import { getJobBoard } from '@/lib/data/jobs'
import { JOB_CATEGORIES, jobCategoryMarathi } from '@/lib/jobs/categories'
import { AREA_SUGGESTIONS, WORK_TYPES } from '@/lib/jobs/options'
import JobCard from './JobCard'

type Tab = 'hiring' | 'seeking'

interface BoardParams {
  tab?: string
  q?: string
  category?: string
  type?: string
  area?: string
}

export const metadata: Metadata = {
  title: 'OurDahanu Jobs — Local Jobs in Dahanu',
  description:
    'Local jobs in Dahanu, Bordi, Gholvad and Palghar — shops, hotels, farms, clinics and homes hiring. Free to post a job, or to say you are looking for work.',
  alternates: { canonical: 'https://jobs.ourdahanu.in/' },
}

const labelCls = 'mb-1 block text-[12px] font-bold text-[var(--od-ink-2)]'
const inputCls = 'od-input h-11 w-full px-3.5 text-[15px]'

function tabHref(tab: Tab): string {
  return tab === 'seeking' ? '/jobs?tab=seeking' : '/jobs'
}

function BoardSkeleton() {
  return (
    <div aria-hidden className="mt-5 grid gap-3 md:grid-cols-2">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="od-card h-36 animate-pulse" />
      ))}
    </div>
  )
}

async function BoardResults({
  tab,
  q,
  category,
  type,
  area,
}: {
  tab: Tab
  q: string
  category: string
  type: string
  area: string
}) {
  const posts = await getJobBoard({ kind: tab, q, category: category || null, workType: type || null, area: area || null })
  const filtered = Boolean(q || category || type || area)
  const countLabel =
    tab === 'hiring'
      ? `${posts.length === 1 ? 'job' : 'jobs'}`
      : `${posts.length === 1 ? 'person' : 'people'} looking for work`

  return (
    <div className="mt-5">
      <p className="mb-3 text-[13px] font-semibold text-[var(--od-muted)]" aria-live="polite">
        <span className="tabular-nums">{posts.length}</span> {countLabel}
      </p>

      {posts.length === 0 ? (
        <div className="od-card flex flex-col items-center px-6 py-14 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-[14px] bg-[var(--color-surface-soft)] text-[var(--od-brand)]">
            <SearchX size={26} aria-hidden />
          </span>
          <h2 className="mt-4 font-display text-2xl">{filtered ? 'No matches' : 'Nothing here yet'}</h2>
          <p className="mt-1 max-w-sm text-sm leading-relaxed text-[var(--od-muted)]">
            {filtered
              ? 'Try a different search, or clear the filters.'
              : tab === 'hiring'
                ? 'Be the first to post a job in Dahanu.'
                : 'Be the first to say you are looking for work.'}
          </p>
          <div className="mt-5 flex gap-2">
            {filtered && (
              <Link href={tabHref(tab)} className="od-button-secondary px-4 py-2 text-sm">
                Clear filters
              </Link>
            )}
            <Link href={`/jobs/post?kind=${tab}`} className="od-button-primary px-4 py-2 text-sm">
              {tab === 'hiring' ? 'Post a job' : 'Post your profile'}
            </Link>
          </div>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {posts.map((post) => (
            <JobCard key={post.id} post={post} />
          ))}
        </div>
      )}
    </div>
  )
}

export default async function JobsBoardPage({ searchParams }: { searchParams: Promise<BoardParams> }) {
  const params = await searchParams
  const tab: Tab = params.tab === 'seeking' ? 'seeking' : 'hiring'
  const q = (params.q ?? '').trim()
  const category = JOB_CATEGORIES.find((value) => value === params.category) ?? ''
  const type = WORK_TYPES.find((value) => value === params.type) ?? ''
  const area = (params.area ?? '').trim()
  const filtered = Boolean(q || category || type || area)

  return (
    <div>
      <section className="relative -mx-4 -mt-6 overflow-hidden border-b border-[var(--od-border)] bg-[var(--color-surface-2)] px-4 pb-7 pt-9 sm:pb-9 sm:pt-11">
        <div className="warli-bg absolute inset-0 opacity-60" aria-hidden />
        <div className="relative mx-auto max-w-2xl text-center">
          <p className="od-eyebrow">Dahanu’s local jobs board</p>
          <h1 className="mt-2 text-balance font-display text-4xl leading-[1.08] sm:text-5xl">
            Local work, <em className="text-[var(--od-brand)]">local people</em>.
          </h1>
          <p className="mx-auto mt-3 max-w-md text-balance text-sm leading-relaxed text-[var(--od-muted)] sm:text-[15px]">
            Shops, farms, clinics and homes hiring across Dahanu — and neighbours looking for work. Free to post.
          </p>
          <p className="mt-3 flex items-center justify-center gap-1.5 text-xs font-bold text-[var(--od-ink-2)]">
            <ShieldCheck size={13} className="text-[var(--od-success)]" aria-hidden />
            Never pay anyone to get a job
          </p>
        </div>
      </section>

      <nav aria-label="Board" className="mt-5 flex gap-2">
        {(['hiring', 'seeking'] as const).map((value) => (
          <Link
            key={value}
            href={tabHref(value)}
            aria-current={tab === value ? 'page' : undefined}
            className={`rounded-full border px-4 py-2 text-sm font-semibold transition-colors ${
              tab === value
                ? 'border-[var(--od-brand-strong)] bg-[var(--od-brand-strong)] text-[#FFFAF3]'
                : 'border-[var(--od-border)] bg-white/70 text-[var(--od-ink-2)] hover:text-[var(--od-brand-strong)]'
            }`}
          >
            {value === 'hiring' ? 'Hiring' : 'Looking for work'}
          </Link>
        ))}
      </nav>

      <form method="get" action="/jobs" className="od-card mt-4 grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
        {tab === 'seeking' && <input type="hidden" name="tab" value="seeking" />}
        <label className="block">
          <span className={labelCls}>Search</span>
          <input
            name="q"
            defaultValue={q}
            placeholder={tab === 'hiring' ? 'Cook, driver, teacher…' : 'Skill or name…'}
            className={inputCls}
          />
        </label>
        <label className="block">
          <span className={labelCls}>Category</span>
          <select name="category" defaultValue={category} className={inputCls}>
            <option value="">All categories</option>
            {JOB_CATEGORIES.map((value) => (
              <option key={value} value={value}>
                {value} · {jobCategoryMarathi(value)}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className={labelCls}>Work type</span>
          <select name="type" defaultValue={type} className={inputCls}>
            <option value="">Any</option>
            {WORK_TYPES.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className={labelCls}>Area</span>
          <input name="area" defaultValue={area} list="job-areas" placeholder="Dahanu Road…" className={inputCls} />
          <datalist id="job-areas">
            {AREA_SUGGESTIONS.map((value) => (
              <option key={value} value={value} />
            ))}
          </datalist>
        </label>
        <div className="flex gap-2 sm:col-span-2 lg:col-span-4">
          <button className="od-button-primary px-5 py-2 text-sm">Search</button>
          {filtered && (
            <Link href={tabHref(tab)} className="od-button-secondary px-4 py-2 text-sm">
              Clear
            </Link>
          )}
        </div>
      </form>

      <Suspense key={`${tab}|${q}|${category}|${type}|${area}`} fallback={<BoardSkeleton />}>
        <BoardResults tab={tab} q={q} category={category} type={type} area={area} />
      </Suspense>
    </div>
  )
}
```

- [ ] **Step 5: Write the category page**

Create `src/app/jobs/c/[slug]/page.tsx`:

```tsx
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, SearchX } from 'lucide-react'

import { getJobBoard } from '@/lib/data/jobs'
import { JOB_CATEGORIES, jobCategoryFromSlug, jobCategoryMarathi, jobCategorySlug } from '@/lib/jobs/categories'
import { MIN_CATEGORY_SIZE } from '@/lib/seo-thresholds'
import JobCard from '../../JobCard'
import { JOBS_URL, Mr } from '../../jobs-ui'

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const category = jobCategoryFromSlug(slug)
  if (!category || category === 'Other') return {}

  const posts = await getJobBoard({ kind: 'hiring', category })
  const canonical = `${JOBS_URL}/c/${slug}`
  const title = `${category} jobs in Dahanu`
  const description = `${posts.length > 0 ? `${posts.length} ` : ''}${category.toLowerCase()} jobs open now in Dahanu, Bordi, Gholvad and Palghar. Free to use — reach the employer directly.`.slice(0, 160)

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: { title, description, url: canonical, type: 'website', siteName: 'OurDahanu Jobs' },
    // A category with only a post or two reads as thin content; don't index it yet.
    ...(posts.length < MIN_CATEGORY_SIZE ? { robots: { index: false, follow: true } } : {}),
  }
}

export default async function JobCategoryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const category = jobCategoryFromSlug(slug)
  if (!category || category === 'Other') notFound()

  const hiring = await getJobBoard({ kind: 'hiring' })
  const posts = hiring.filter((post) => post.category === category)
  const counts = new Map<string, number>()
  for (const post of hiring) counts.set(post.category, (counts.get(post.category) ?? 0) + 1)
  const others = JOB_CATEGORIES.filter((value) => value !== category && value !== 'Other' && (counts.get(value) ?? 0) > 0)

  return (
    <div>
      <Link
        href="/jobs"
        className="mb-4 inline-flex items-center gap-1.5 rounded-full border border-[var(--od-border)] bg-white/70 px-3 py-1.5 text-[13px] font-semibold text-[var(--od-ink-2)] transition-colors hover:border-[rgba(192,88,46,0.4)] hover:text-[var(--od-brand-strong)]"
      >
        <ArrowLeft size={13} aria-hidden /> All jobs
      </Link>

      <header className="mb-6">
        <h1 className="text-balance font-display text-3xl leading-tight sm:text-4xl">
          {category} <span className="text-[var(--od-brand)]">jobs in Dahanu</span>
        </h1>
        <p className="mt-1 text-[15px] font-semibold text-[var(--od-muted)]">
          <Mr text={jobCategoryMarathi(category)} />
        </p>
        <p className="mt-3 text-xs font-bold text-[var(--od-ink-2)]">
          {posts.length} open {posts.length === 1 ? 'job' : 'jobs'}
        </p>
      </header>

      {posts.length > 0 ? (
        <div className="grid gap-3 md:grid-cols-2">
          {posts.map((post) => (
            <JobCard key={post.id} post={post} />
          ))}
        </div>
      ) : (
        <div className="od-card flex flex-col items-center px-6 py-14 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-[14px] bg-[var(--color-surface-soft)] text-[var(--od-brand)]">
            <SearchX size={26} aria-hidden />
          </span>
          <h2 className="mt-4 font-display text-2xl">No {category.toLowerCase()} jobs yet</h2>
          <p className="mt-1 max-w-sm text-sm leading-relaxed text-[var(--od-muted)]">
            Hiring in this line of work? Posting is free.
          </p>
          <Link href="/jobs/post?kind=hiring" className="od-button-primary mt-5 px-4 py-2 text-sm">
            Post a job
          </Link>
        </div>
      )}

      {others.length > 0 && (
        <nav aria-label="Other categories" className="mt-10 border-t border-[var(--od-border)] pt-6">
          <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.1em] text-[var(--od-muted)]">
            Other jobs in Dahanu
          </p>
          <div className="flex flex-wrap gap-2">
            {others.map((value) => (
              <Link
                key={value}
                href={`/jobs/c/${jobCategorySlug(value)}`}
                className="inline-flex items-center gap-1.5 rounded-full border border-[var(--od-border)] bg-white/70 px-3.5 py-2 text-[13px] font-semibold text-[var(--od-ink-2)] transition-colors hover:border-[var(--od-gold)] hover:bg-white"
              >
                {value}
                <span className="rounded-full bg-[var(--od-surface-soft)] px-1.5 py-0.5 text-[11px] font-bold tabular-nums text-[var(--od-brand-strong)]">
                  {counts.get(value) ?? 0}
                </span>
              </Link>
            ))}
          </div>
        </nav>
      )}
    </div>
  )
}
```

- [ ] **Step 6: Write the contact and report buttons**

Create `src/app/jobs/j/[id]/ShowContactButton.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { MessageCircle, Phone } from 'lucide-react'

import { revealJobContact } from '@/app/actions/jobs'
import { formatIndianPhone, telHrefIndia, waHrefIndia } from '@/lib/jobs/phone'

/**
 * The number is fetched on tap, never rendered into the cached page. Logged-out
 * visitors are sent to login and brought back to this post.
 */
export default function ShowContactButton({ postId }: { postId: string }) {
  const [contact, setContact] = useState<{ phone: string; whatsapp: boolean } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function reveal() {
    setPending(true)
    setError(null)
    try {
      const result = await revealJobContact(postId)
      if ('loginUrl' in result) {
        window.location.href = result.loginUrl
        return
      }
      if ('error' in result) {
        setError(result.error)
        return
      }
      setContact({ phone: result.phone, whatsapp: result.whatsapp })
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setPending(false)
    }
  }

  if (contact) {
    return (
      <div className="flex flex-col gap-2 sm:flex-row">
        <a href={telHrefIndia(contact.phone)} className="od-button-primary h-11 flex-1 text-[15px] active:scale-[0.98]">
          <Phone size={16} aria-hidden /> Call <span className="tabular-nums">{formatIndianPhone(contact.phone)}</span>
        </a>
        {contact.whatsapp && (
          <a
            href={waHrefIndia(contact.phone)}
            target="_blank"
            rel="noopener noreferrer"
            className="flex h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-[rgba(19,138,75,0.3)] bg-[rgba(19,138,75,0.06)] text-[15px] font-bold text-[var(--color-success-strong)] transition-colors duration-150 hover:bg-[rgba(19,138,75,0.12)] active:scale-[0.98]"
          >
            <MessageCircle size={16} className="text-[var(--od-success)]" aria-hidden /> WhatsApp
          </a>
        )}
      </div>
    )
  }

  return (
    <div>
      <button
        type="button"
        onClick={reveal}
        disabled={pending}
        className="od-button-primary h-11 w-full text-[15px] active:scale-[0.99] disabled:opacity-60"
      >
        <Phone size={16} aria-hidden /> {pending ? 'Checking…' : 'Show phone number'}
      </button>
      <p className="mt-2 text-center text-xs text-[var(--od-muted)]">
        Log in with Google to see the number. It is never shown publicly.
      </p>
      {error && (
        <p role="alert" className="mt-2 text-center text-sm font-semibold text-[var(--od-danger)]">
          {error}
        </p>
      )}
    </div>
  )
}
```

Create `src/app/jobs/j/[id]/ReportPostButton.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { Flag } from 'lucide-react'

import { reportJobPost } from '@/app/actions/jobs'

const REASONS: Array<{ value: string; label: string }> = [
  { value: 'asks_for_money', label: 'Asks for money' },
  { value: 'fake', label: 'Fake or misleading' },
  { value: 'filled', label: 'Already filled' },
  { value: 'offensive', label: 'Offensive' },
  { value: 'my_number', label: 'This is my number — remove it' },
  { value: 'other', label: 'Something else' },
]

export default function ReportPostButton({ postId }: { postId: string }) {
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [note, setNote] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPending(true)
    setError(null)
    try {
      const result = await reportJobPost(postId, reason, note.trim() || null)
      if ('loginUrl' in result) {
        window.location.href = result.loginUrl
        return
      }
      if ('error' in result) {
        setError(result.error)
        return
      }
      setDone(true)
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setPending(false)
    }
  }

  if (done) {
    return (
      <p role="status" className="text-sm text-[var(--od-muted)]">
        Thanks — a moderator will look at this post.
      </p>
    )
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-[var(--od-muted)] transition-colors hover:text-[var(--od-danger)]"
      >
        <Flag size={13} aria-hidden /> Report this post
      </button>
    )
  }

  return (
    <form onSubmit={submit} className="od-card w-full space-y-3 p-4">
      <fieldset>
        <legend className="mb-2 text-[13px] font-bold text-[var(--od-ink-2)]">Why are you reporting this post?</legend>
        <div className="space-y-1.5">
          {REASONS.map((option) => (
            <label key={option.value} className="flex items-center gap-2 text-sm text-[var(--od-ink-2)]">
              <input
                type="radio"
                name="reason"
                value={option.value}
                checked={reason === option.value}
                onChange={() => setReason(option.value)}
                className="accent-[var(--od-brand)]"
              />
              {option.label}
            </label>
          ))}
        </div>
      </fieldset>
      <label className="block">
        <span className="mb-1 block text-[13px] font-bold text-[var(--od-ink-2)]">Anything else? (optional)</span>
        <textarea
          value={note}
          onChange={(event) => setNote(event.target.value)}
          rows={2}
          maxLength={500}
          className="od-input w-full px-3.5 py-2.5 text-[15px]"
        />
      </label>
      {error && (
        <p role="alert" className="text-sm font-semibold text-[var(--od-danger)]">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <button disabled={pending || !reason} className="od-button-primary px-4 py-2 text-sm disabled:opacity-60">
          {pending ? 'Sending…' : 'Send report'}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="od-button-secondary px-4 py-2 text-sm">
          Cancel
        </button>
      </div>
    </form>
  )
}
```

- [ ] **Step 7: Write the post page**

Create `src/app/jobs/j/[id]/page.tsx`:

```tsx
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, Clock, MapPin, Share2, ShieldAlert, Users } from 'lucide-react'

import StructuredData from '@/components/StructuredData'
import { getLiveJobPostById } from '@/lib/data/jobs'
import { jobCategorySlug } from '@/lib/jobs/categories'
import { buildJobPostingLd } from '@/lib/jobs/job-posting-ld'
import { formatPay } from '@/lib/jobs/pay'
import { truncateAtWord } from '@/lib/text'
import { BusinessBadge, CategoryPill, CollectedLabel, JOBS_URL, kindLabel, shortDate } from '../../jobs-ui'
import ReportPostButton from './ReportPostButton'
import ShowContactButton from './ShowContactButton'

const dtCls = 'text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--od-muted)]'
const pillLinkCls =
  'inline-flex items-center gap-1.5 rounded-full border border-[var(--od-border)] bg-white/70 px-3 py-1.5 text-[13px] font-semibold text-[var(--od-ink-2)] transition-colors hover:border-[rgba(192,88,46,0.4)] hover:text-[var(--od-brand-strong)]'

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params
  const post = await getLiveJobPostById(id)
  if (!post) return {}

  const url = `${JOBS_URL}/j/${post.id}`
  const title =
    post.kind === 'hiring'
      ? `${post.title} job at ${post.employer_name} in ${post.area}`
      : `${post.display_name} — ${post.title}, looking for work in ${post.area}`
  const description = truncateAtWord(
    [post.kind === 'hiring' ? formatPay(post) : null, post.work_types.join(', '), post.description]
      .filter(Boolean)
      .join(' · '),
    159,
  )

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { title, description, url, type: 'website', siteName: 'OurDahanu Jobs' },
    twitter: { card: 'summary_large_image', title, description },
    // A person's "looking for work" page should not linger in search results
    // after they find work. Only hiring posts are indexed.
    ...(post.kind === 'seeking' ? { robots: { index: false, follow: true } } : {}),
  }
}

export default async function JobPostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const post = await getLiveJobPostById(id)
  if (!post) notFound()

  const url = `${JOBS_URL}/j/${post.id}`
  const shareText = `${post.title}${post.kind === 'hiring' && post.employer_name ? ` — ${post.employer_name}` : ''}, ${post.area}\n${url}`

  return (
    <div className="mx-auto max-w-2xl">
      {post.kind === 'hiring' && post.employer_name && (
        <StructuredData data={buildJobPostingLd({ ...post, employer_name: post.employer_name }, url)} />
      )}

      <nav aria-label="Breadcrumb" className="mb-4 flex items-center gap-1.5">
        <Link href={post.kind === 'hiring' ? '/jobs' : '/jobs?tab=seeking'} className={pillLinkCls}>
          <ArrowLeft size={13} aria-hidden /> {post.kind === 'hiring' ? 'All jobs' : 'Looking for work'}
        </Link>
        {post.kind === 'hiring' && post.category !== 'Other' && (
          <>
            <span className="text-[var(--od-muted)]" aria-hidden>/</span>
            <Link href={`/jobs/c/${jobCategorySlug(post.category)}`} className={pillLinkCls}>
              {post.category}
            </Link>
          </>
        )}
      </nav>

      <article className="od-card relative p-5 sm:p-6">
        <a
          href={`https://wa.me/?text=${encodeURIComponent(shareText)}`}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Share this post on WhatsApp"
          title="Share on WhatsApp"
          className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full border border-[var(--od-border)] bg-white/70 text-[var(--od-muted)] transition-colors hover:border-[rgba(192,88,46,0.4)] hover:text-[var(--od-brand-strong)]"
        >
          <Share2 size={15} aria-hidden />
        </a>

        <p className="od-eyebrow pr-10">{kindLabel(post.kind)}</p>
        <h1 className="mt-1 pr-10 text-balance font-display text-3xl leading-tight sm:text-4xl">{post.title}</h1>
        <p className="mt-1 text-[15px] font-semibold text-[var(--od-ink-2)]">
          {post.kind === 'hiring'
            ? post.employer_name
            : `${post.display_name}${
                post.experience_years !== null
                  ? ` · ${post.experience_years} ${post.experience_years === 1 ? 'year' : 'years'} experience`
                  : ''
              }`}
        </p>

        <div className="mt-3 flex flex-wrap gap-1">
          <CategoryPill category={post.category} />
          {post.business && <BusinessBadge business={post.business} />}
          {post.collected_source && <CollectedLabel source={post.collected_source} />}
        </div>

        <dl className="mt-4 grid gap-x-4 gap-y-2.5 rounded-[14px] bg-[var(--color-surface-soft)] px-4 py-3 text-sm sm:grid-cols-2">
          <div>
            <dt className={dtCls}>Area</dt>
            <dd className="flex items-center gap-1">
              <MapPin size={13} aria-hidden /> {post.area}
            </dd>
          </div>
          <div>
            <dt className={dtCls}>Work type</dt>
            <dd>{post.work_types.join(' · ')}</dd>
          </div>
          {post.kind === 'hiring' && (
            <div>
              <dt className={dtCls}>Pay</dt>
              <dd>{formatPay(post)}</dd>
            </div>
          )}
          {post.kind === 'hiring' && post.openings !== null && (
            <div>
              <dt className={dtCls}>Openings</dt>
              <dd className="flex items-center gap-1">
                <Users size={13} aria-hidden /> {post.openings}
              </dd>
            </div>
          )}
          {post.kind === 'hiring' && post.timings && (
            <div>
              <dt className={dtCls}>Timings</dt>
              <dd className="flex items-center gap-1">
                <Clock size={13} aria-hidden /> {post.timings}
              </dd>
            </div>
          )}
          <div>
            <dt className={dtCls}>Posted</dt>
            <dd>
              {shortDate(post.published_at)} · open until {shortDate(post.expires_at)}
            </dd>
          </div>
        </dl>

        {post.description && (
          <p className="mt-4 whitespace-pre-line text-[15px] leading-relaxed text-[var(--od-ink-2)]">{post.description}</p>
        )}

        <div className="mt-5 border-t border-[var(--od-border)] pt-4">
          <ShowContactButton postId={post.id} />
        </div>

        <p className="mt-4 flex items-start gap-2 rounded-[12px] border border-[rgba(180,35,24,0.2)] bg-[rgba(180,35,24,0.04)] px-3 py-2.5 text-[13px] text-[var(--od-ink-2)]">
          <ShieldAlert size={15} className="mt-0.5 shrink-0 text-[var(--od-danger)]" aria-hidden />
          <span>Never pay anyone to get a job. Report posts that ask for money.</span>
        </p>
      </article>

      <div className="mt-4 flex justify-end">
        <ReportPostButton postId={post.id} />
      </div>
    </div>
  )
}
```

- [ ] **Step 8: Write the Open Graph image**

Create `src/app/jobs/j/[id]/opengraph-image.tsx`:

```tsx
import { ImageResponse } from 'next/og'

import { getLiveJobPostById } from '@/lib/data/jobs'

export const alt = 'A post on OurDahanu Jobs'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

// Coastal sunset palette, matching FindDahanu's share image.
const BARK = '#2E1205'
const TERRA = '#C0582E'
const TERRA_DEEP = '#8A3618'
const GOLD = '#C8881E'
const GOLD_LIGHT = '#F0C87A'
const CREAM = '#FBF0DC'

// Uses next/og's bundled default font, which covers Latin text only — so the
// image carries no rupee sign and no Marathi, and pay is left out.
export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const post = await getLiveJobPostById(id)

  const eyebrow = post ? (post.kind === 'hiring' ? 'Hiring' : 'Looking for work') : 'OurDahanu Jobs'
  const heading = post?.title ?? 'Local jobs in Dahanu'
  const subheading = post
    ? `${(post.kind === 'hiring' ? post.employer_name : post.display_name) ?? ''} · ${post.area}`
    : 'Free to post · Shops, farms, clinics and homes hiring'

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: 64,
          background: `linear-gradient(160deg, ${BARK} 0%, ${TERRA_DEEP} 45%, ${TERRA} 78%, ${GOLD} 130%)`,
        }}
      >
        <div style={{ display: 'flex', color: GOLD_LIGHT, fontSize: 30, fontWeight: 700 }}>{eyebrow}</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', color: CREAM, fontSize: 72, fontWeight: 700, lineHeight: 1.05, maxWidth: 1000 }}>
            {heading}
          </div>
          <div style={{ display: 'flex', color: 'rgba(251,240,220,0.85)', fontSize: 34 }}>{subheading}</div>
        </div>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            paddingTop: 28,
            borderTop: '2px solid rgba(251,240,220,0.18)',
            color: 'rgba(251,240,220,0.65)',
            fontSize: 24,
          }}
        >
          <div style={{ display: 'flex' }}>jobs.ourdahanu.in</div>
          <div style={{ display: 'flex' }}>Never pay anyone to get a job</div>
        </div>
      </div>
    ),
    { ...size },
  )
}
```

- [ ] **Step 9: Typecheck, lint, test and build**

Run: `npx tsc --noEmit && npm run lint && npm run test:existing && npm run build`
Expected: typecheck clean; lint 0 errors / 11 warnings; tests pass; build succeeds and lists `/jobs`, `/jobs/c/[slug]` and `/jobs/j/[id]` routes.

- [ ] **Step 10: Verify in the browser**

Start the dev server with the Browser pane (`preview_start`, `dev` config). The migration may not be applied yet, in which case the board is simply empty — that is expected, and a missing table must not crash any page.

1. `http://localhost:3000/jobs` — hero, **Hiring** / **Looking for work** tabs, filter form, and the empty state (or cards, if posts exist). Console has no errors.
2. `http://localhost:3000/jobs?tab=seeking` — the seeking tab is selected; the form carries `tab=seeking`.
3. `http://localhost:3000/jobs?category=Driver%20%26%20Delivery&area=Bordi` — filters are pre-filled and **Clear** appears.
4. `http://localhost:3000/jobs/c/driver-delivery` — category page renders; `http://localhost:3000/jobs/c/not-real` returns the 404 page.
5. `http://localhost:3000/jobs/j/00000000-0000-4000-8000-000000000000` and `/jobs/j/not-a-uuid` both return the 404 page.
6. Using `javascript_tool`, confirm the board page HTML contains no `tel:` and no `wa.me/91` link: `document.documentElement.innerHTML.includes('tel:')` and `.includes('wa.me/91')` are both `false`.

Report exactly what you observed for each.

- [ ] **Step 11: Commit**

```bash
git add src/app/jobs/layout.tsx src/app/jobs/jobs-ui.tsx src/app/jobs/JobCard.tsx src/app/jobs/page.tsx "src/app/jobs/c/[slug]/page.tsx" "src/app/jobs/j/[id]/page.tsx" "src/app/jobs/j/[id]/ShowContactButton.tsx" "src/app/jobs/j/[id]/ReportPostButton.tsx" "src/app/jobs/j/[id]/opengraph-image.tsx"
git commit -m "feat(jobs): public board, category and post pages"
```

---

### Task 10: Posting, My posts and editing

**Files:**
- Create: `src/app/jobs/post/JobPostForm.tsx`
- Create: `src/app/jobs/post/page.tsx`
- Create: `src/app/jobs/my-posts/page.tsx`
- Create: `src/app/jobs/my-posts/MyPostActions.tsx`
- Create: `src/app/jobs/my-posts/[id]/edit/page.tsx`

**Interfaces:**
- Consumes: `createJobPost`, `updateJobPost`, `renewJobPost`, `closeJobPost` (Task 8); `jobsLoginHref` (Task 8); `JOB_CATEGORIES`, `jobCategoryMarathi`, `WORK_TYPES`, `PAY_PERIODS`, `AREA_SUGGESTIONS`, `JOB_TEXT_LIMITS`, `JobKind`, `JobPostInput`, `formatIndianPhone` (Task 2); `canRenew`, `daysLeft`, `isLive` (Task 3); `JobStatus` (Task 3); `chipBase`, `chipOn`, `chipOff`, `kindLabel`, `shortDate` (Task 9); `safelySubmit` from `src/lib/find/safe-submission.ts`; `getUserRole` from `src/app/actions/admin.ts`.
- Produces (used by Task 11): default export `JobPostForm` with props `{ mode: 'create' | 'edit' | 'collected'; postId?: string; initial?: Partial<JobPostFormValues>; businesses: OwnedBusiness[]; lockKind?: boolean; showCollectedSource?: boolean }`, and the types `OwnedBusiness`, `JobPostFormValues`.

`JobPostForm.tsx` is a client module, so server pages import only its default export and its **types** from it — never a runtime constant.

- [ ] **Step 1: Write the form**

Create `src/app/jobs/post/JobPostForm.tsx`:

```tsx
'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { CheckCircle2, MessageCircle } from 'lucide-react'

import { createJobPost, updateJobPost } from '@/app/actions/jobs'
import { safelySubmit } from '@/lib/find/safe-submission'
import { JOB_CATEGORIES, jobCategoryMarathi } from '@/lib/jobs/categories'
import { AREA_SUGGESTIONS, PAY_PERIODS, WORK_TYPES } from '@/lib/jobs/options'
import { JOB_TEXT_LIMITS, type JobKind, type JobPostInput } from '@/lib/jobs/validation'
import { chipBase, chipOff, chipOn } from '../jobs-ui'

/** An approved listing the user owns, offered under "Posting as". */
export interface OwnedBusiness {
  id: string
  name: string
  phone: string | null
  whatsapp: string | null
  address: string | null
}

/** Form state. Numbers stay as text until submit. */
export interface JobPostFormValues {
  kind: JobKind
  listingId: string
  title: string
  category: string
  workTypes: string[]
  area: string
  description: string
  employerName: string
  openings: string
  payMin: string
  payMax: string
  payPeriod: string
  timings: string
  displayName: string
  experienceYears: string
  phone: string
  whatsapp: boolean
  collectedSource: string
}

const EMPTY_FORM: JobPostFormValues = {
  kind: 'hiring',
  listingId: '',
  title: '',
  category: '',
  workTypes: [],
  area: '',
  description: '',
  employerName: '',
  openings: '1',
  payMin: '',
  payMax: '',
  payPeriod: 'month',
  timings: '',
  displayName: '',
  experienceYears: '',
  phone: '',
  whatsapp: true,
  collectedSource: '',
}

const labelCls = 'mb-1 block text-[13px] font-bold text-[var(--od-ink-2)]'
const inputCls = 'od-input h-11 w-full px-3.5 text-[15px] disabled:opacity-60'
const hintCls = 'mt-1 block text-xs text-[var(--od-muted)]'

function Required() {
  return <span className="text-[var(--od-brand)]">*</span>
}

function toNumber(text: string): number | null {
  const trimmed = text.trim()
  return trimmed === '' ? null : Number(trimmed)
}

/** Choosing a business fills in its name and number; choosing none clears the link. */
function prefillFromBusiness(values: JobPostFormValues, business: OwnedBusiness | undefined): JobPostFormValues {
  if (!business) return { ...values, listingId: '' }
  return {
    ...values,
    listingId: business.id,
    employerName: business.name,
    phone: business.whatsapp || business.phone || '',
    whatsapp: Boolean(business.whatsapp),
    area: values.area || (business.address ?? '').slice(0, JOB_TEXT_LIMITS.area),
  }
}

function toInput(values: JobPostFormValues): JobPostInput {
  const hiring = values.kind === 'hiring'
  return {
    kind: values.kind,
    title: values.title,
    category: values.category,
    workTypes: values.workTypes,
    area: values.area,
    description: values.description,
    employerName: hiring ? values.employerName : null,
    openings: hiring ? toNumber(values.openings) : null,
    payMin: hiring ? toNumber(values.payMin) : null,
    payMax: hiring ? toNumber(values.payMax) : null,
    payPeriod: hiring ? values.payPeriod : null,
    timings: hiring ? values.timings : null,
    displayName: hiring ? null : values.displayName,
    experienceYears: hiring ? null : toNumber(values.experienceYears),
    phone: values.phone,
    whatsapp: values.whatsapp,
    listingId: hiring ? values.listingId || null : null,
    collectedSource: values.collectedSource || null,
  }
}

export default function JobPostForm({
  mode,
  postId,
  initial,
  businesses,
  lockKind = false,
  showCollectedSource = false,
}: {
  mode: 'create' | 'edit' | 'collected'
  postId?: string
  initial?: Partial<JobPostFormValues>
  businesses: OwnedBusiness[]
  lockKind?: boolean
  showCollectedSource?: boolean
}) {
  const router = useRouter()
  // Lazy initial state, not an effect: a business chosen up front (the My
  // Business link) prefills exactly once, at mount.
  const [values, setValues] = useState<JobPostFormValues>(() => {
    const start: JobPostFormValues = { ...EMPTY_FORM, ...initial, ...(mode === 'collected' ? { kind: 'hiring' as const } : {}) }
    return mode === 'create' && start.listingId
      ? prefillFromBusiness(start, businesses.find((business) => business.id === start.listingId))
      : start
  })
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [created, setCreated] = useState<{ id: string; status: 'approved' | 'pending' } | null>(null)

  function update<K extends keyof JobPostFormValues>(key: K, value: JobPostFormValues[K]) {
    setValues((current) => ({ ...current, [key]: value }))
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPending(true)
    setError(null)
    const input = toInput(values)

    if (mode === 'edit' && postId) {
      const result = await safelySubmit(() => updateJobPost(postId, input))
      setPending(false)
      if ('error' in result) {
        setError(result.error)
        return
      }
      router.push('/jobs/my-posts')
      router.refresh()
      return
    }

    const result = await safelySubmit(() => createJobPost(input))
    setPending(false)
    if ('error' in result) {
      setError(result.error)
      return
    }
    setCreated({ id: result.id, status: result.status })
  }

  if (created) {
    const live = created.status === 'approved'
    return (
      <div className="od-card flex flex-col items-center px-6 py-10 text-center">
        <CheckCircle2 size={32} className="text-[var(--od-success)]" aria-hidden />
        <h2 className="mt-3 font-display text-2xl">{live ? 'Your post is live' : 'Sent for review'}</h2>
        <p className="mt-1 max-w-sm text-sm leading-relaxed text-[var(--od-muted)]">
          {live
            ? 'It is on the board now and stays up for 30 days. We will remind you before it expires.'
            : 'A moderator will check it, usually within a day. We will let you know when it is live.'}
        </p>
        <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
          {live && (
            <Link href={`/jobs/j/${created.id}`} className="od-button-primary px-5 py-2 text-sm">
              View post
            </Link>
          )}
          {mode === 'collected' ? (
            <button
              type="button"
              onClick={() => {
                setValues({ ...EMPTY_FORM })
                setCreated(null)
              }}
              className="od-button-secondary px-5 py-2 text-sm"
            >
              Post another
            </button>
          ) : (
            <Link href="/jobs/my-posts" className="od-button-secondary px-5 py-2 text-sm">
              My posts
            </Link>
          )}
        </div>
      </div>
    )
  }

  const hiring = values.kind === 'hiring'
  const kindLocked = lockKind || mode === 'collected'

  return (
    <form onSubmit={onSubmit} className="od-card space-y-4 p-5">
      <p role="alert" aria-live="assertive">
        {error && (
          <span className="block rounded-[12px] border border-[rgba(180,35,24,0.25)] bg-[rgba(180,35,24,0.06)] px-3 py-2 text-sm font-semibold text-[var(--od-danger)]">
            {error}
          </span>
        )}
      </p>

      {!kindLocked && (
        <fieldset>
          <legend className={labelCls}>I am…</legend>
          <div className="grid grid-cols-2 gap-2">
            {(['hiring', 'seeking'] as const).map((kind) => (
              <button
                key={kind}
                type="button"
                aria-pressed={values.kind === kind}
                disabled={pending}
                onClick={() => update('kind', kind)}
                className={`${chipBase} disabled:opacity-60 ${values.kind === kind ? chipOn : chipOff}`}
              >
                {kind === 'hiring' ? 'Hiring' : 'Looking for work'}
              </button>
            ))}
          </div>
        </fieldset>
      )}

      {hiring && mode !== 'collected' && businesses.length > 0 && (
        <label className="block">
          <span className={labelCls}>Posting as</span>
          <select
            value={values.listingId}
            disabled={pending}
            onChange={(event) =>
              setValues((current) =>
                prefillFromBusiness(current, businesses.find((business) => business.id === event.target.value)),
              )
            }
            className={inputCls}
          >
            <option value="">Myself / another employer</option>
            {businesses.map((business) => (
              <option key={business.id} value={business.id}>
                {business.name}
              </option>
            ))}
          </select>
          <span className={hintCls}>Posts from your approved business go live instantly.</span>
        </label>
      )}

      {(showCollectedSource || mode === 'collected') && (
        <label className="block">
          <span className={labelCls}>
            Where was this job found? {mode === 'collected' && <Required />}
          </span>
          <input
            value={values.collectedSource}
            required={mode === 'collected'}
            disabled={pending}
            maxLength={JOB_TEXT_LIMITS.collectedSource}
            placeholder="e.g. Lokmat, 12 Sep"
            onChange={(event) => update('collectedSource', event.target.value)}
            className={inputCls}
          />
        </label>
      )}

      <label className="block">
        <span className={labelCls}>
          {hiring ? 'Job title' : 'Your skill, or the work you want'} <Required />
        </span>
        <input
          value={values.title}
          required
          disabled={pending}
          maxLength={JOB_TEXT_LIMITS.title}
          placeholder={hiring ? 'e.g. Cook, Sales staff' : 'e.g. Driver, Tuition teacher'}
          onChange={(event) => update('title', event.target.value)}
          className={inputCls}
        />
      </label>

      {hiring ? (
        <label className="block">
          <span className={labelCls}>
            Employer or shop name <Required />
          </span>
          <input
            value={values.employerName}
            required
            disabled={pending}
            maxLength={JOB_TEXT_LIMITS.employerName}
            onChange={(event) => update('employerName', event.target.value)}
            className={inputCls}
          />
        </label>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className={labelCls}>
              First name <Required />
            </span>
            <input
              value={values.displayName}
              required
              disabled={pending}
              autoComplete="given-name"
              maxLength={JOB_TEXT_LIMITS.displayName}
              onChange={(event) => update('displayName', event.target.value)}
              className={inputCls}
            />
            <span className={hintCls}>Only your first name is shown.</span>
          </label>
          <label className="block">
            <span className={labelCls}>Years of experience</span>
            <input
              type="number"
              inputMode="numeric"
              min={0}
              max={60}
              value={values.experienceYears}
              disabled={pending}
              onChange={(event) => update('experienceYears', event.target.value)}
              className={inputCls}
            />
          </label>
        </div>
      )}

      <label className="block">
        <span className={labelCls}>
          Category <Required />
        </span>
        <select
          value={values.category}
          required
          disabled={pending}
          onChange={(event) => update('category', event.target.value)}
          className={inputCls}
        >
          <option value="">Choose a category</option>
          {JOB_CATEGORIES.map((category) => (
            <option key={category} value={category}>
              {category} · {jobCategoryMarathi(category)}
            </option>
          ))}
        </select>
      </label>

      <fieldset>
        <legend className={labelCls}>
          Work type <Required /> <span className="font-normal text-[var(--od-muted)]">(pick one or more)</span>
        </legend>
        <div className="flex flex-wrap gap-2">
          {WORK_TYPES.map((workType) => {
            const on = values.workTypes.includes(workType)
            return (
              <button
                key={workType}
                type="button"
                aria-pressed={on}
                disabled={pending}
                onClick={() =>
                  update('workTypes', on ? values.workTypes.filter((value) => value !== workType) : [...values.workTypes, workType])
                }
                className={`${chipBase} disabled:opacity-60 ${on ? chipOn : chipOff}`}
              >
                {workType}
              </button>
            )
          })}
        </div>
      </fieldset>

      <label className="block">
        <span className={labelCls}>
          {hiring ? 'Where is the job?' : 'Areas you can work in'} <Required />
        </span>
        <input
          value={values.area}
          required
          disabled={pending}
          list="job-post-areas"
          maxLength={JOB_TEXT_LIMITS.area}
          placeholder={hiring ? 'e.g. Dahanu Road' : 'e.g. Dahanu, Bordi'}
          onChange={(event) => update('area', event.target.value)}
          className={inputCls}
        />
        <datalist id="job-post-areas">
          {AREA_SUGGESTIONS.map((area) => (
            <option key={area} value={area} />
          ))}
        </datalist>
      </label>

      {hiring && (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <label className="block">
              <span className={labelCls}>Pay from (₹)</span>
              <input
                type="number"
                inputMode="numeric"
                min={0}
                value={values.payMin}
                disabled={pending}
                onChange={(event) => update('payMin', event.target.value)}
                className={inputCls}
              />
            </label>
            <label className="block">
              <span className={labelCls}>Pay up to (₹)</span>
              <input
                type="number"
                inputMode="numeric"
                min={0}
                value={values.payMax}
                disabled={pending}
                onChange={(event) => update('payMax', event.target.value)}
                className={inputCls}
              />
            </label>
            <label className="block">
              <span className={labelCls}>Per</span>
              <select
                value={values.payPeriod}
                disabled={pending}
                onChange={(event) => update('payPeriod', event.target.value)}
                className={inputCls}
              >
                {PAY_PERIODS.map((period) => (
                  <option key={period} value={period}>
                    {period}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <p className={hintCls}>Leave pay empty if it is to be discussed.</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className={labelCls}>Openings</span>
              <input
                type="number"
                inputMode="numeric"
                min={1}
                max={500}
                value={values.openings}
                disabled={pending}
                onChange={(event) => update('openings', event.target.value)}
                className={inputCls}
              />
            </label>
            <label className="block">
              <span className={labelCls}>Timings</span>
              <input
                value={values.timings}
                disabled={pending}
                maxLength={JOB_TEXT_LIMITS.timings}
                placeholder="e.g. 9am–6pm, Sunday off"
                onChange={(event) => update('timings', event.target.value)}
                className={inputCls}
              />
            </label>
          </div>
        </>
      )}

      <label className="block">
        <span className={labelCls}>{hiring ? 'About the job' : 'About you'}</span>
        <textarea
          rows={4}
          value={values.description}
          disabled={pending}
          maxLength={JOB_TEXT_LIMITS.description}
          placeholder={
            hiring
              ? 'What the work involves, and who you are looking for.'
              : 'Your experience, licences, languages, and when you can start.'
          }
          onChange={(event) => update('description', event.target.value)}
          className="od-input w-full px-3.5 py-2.5 text-[15px] disabled:opacity-60"
        />
      </label>

      <label className="block">
        <span className={labelCls}>
          Phone number <Required />
        </span>
        <input
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          required
          value={values.phone}
          disabled={pending}
          placeholder="e.g. 98765 43210"
          onChange={(event) => update('phone', event.target.value)}
          className={inputCls}
        />
        <span className={hintCls}>Shown only to people who log in, never publicly.</span>
      </label>

      <label className="flex items-center gap-2.5 rounded-[12px] border border-[var(--od-border)] bg-[var(--color-surface-2)] px-3.5 py-3 text-sm text-[var(--od-ink-2)]">
        <input
          type="checkbox"
          checked={values.whatsapp}
          disabled={pending}
          onChange={(event) => update('whatsapp', event.target.checked)}
          className="h-4 w-4 accent-[var(--od-brand)]"
        />
        <MessageCircle size={15} className="text-[var(--od-success)]" aria-hidden />
        This number is on WhatsApp
      </label>

      <p className="rounded-[12px] bg-[var(--color-surface-soft)] px-3.5 py-3 text-[13px] leading-relaxed text-[var(--od-ink-2)]">
        Jobs must never ask applicants to pay. Posts that ask for money are removed.
      </p>

      <button
        disabled={pending}
        className="od-button-primary h-11 w-full text-[15px] active:scale-[0.99] disabled:opacity-60"
      >
        {pending ? 'Saving…' : mode === 'edit' ? 'Save changes' : mode === 'collected' ? 'Publish collected job' : 'Post'}
      </button>
    </form>
  )
}
```

- [ ] **Step 2: Write the post page**

Create `src/app/jobs/post/page.tsx`:

```tsx
import type { Metadata } from 'next'
import { BadgeCheck, LogIn, PencilLine, ShieldCheck } from 'lucide-react'

import { createAdminClient } from '@/lib/supabase/admin-client'
import { createClient } from '@/lib/supabase/server'
import { jobsLoginHref } from '../jobs-server'
import JobPostForm, { type OwnedBusiness } from './JobPostForm'

export const metadata: Metadata = {
  title: 'Post on OurDahanu Jobs',
  robots: { index: false, follow: false },
}

const STEPS = [
  { icon: PencilLine, label: 'You post it' },
  { icon: ShieldCheck, label: 'A moderator checks it' },
  { icon: BadgeCheck, label: 'It stays live for 30 days' },
]

export default async function PostJobPage({
  searchParams,
}: {
  searchParams: Promise<{ kind?: string; listing?: string }>
}) {
  const { kind, listing } = await searchParams
  const initialKind = kind === 'seeking' ? 'seeking' : 'hiring'

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    const query = new URLSearchParams()
    if (kind) query.set('kind', initialKind)
    if (listing) query.set('listing', listing)
    const qs = query.toString()
    const loginHref = await jobsLoginHref(`/post${qs ? `?${qs}` : ''}`)

    return (
      <div className="mx-auto max-w-lg">
        <div className="od-card flex flex-col items-center px-6 py-8 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-[14px] bg-[var(--color-surface-soft)] text-[var(--od-brand)]">
            <LogIn size={22} aria-hidden />
          </span>
          <h1 className="mt-3 font-display text-2xl">Log in to post</h1>
          <p className="mt-1 max-w-sm text-sm text-[var(--od-muted)]">
            We ask for a login so every post can be traced to a real neighbour.
          </p>
          <a href={loginHref} className="od-button-primary mt-4 px-5 py-2 text-sm">
            Log in with Google
          </a>
        </div>
      </div>
    )
  }

  // Approved listings this user owns, for "Posting as". The service role reads
  // the owner's own phone and WhatsApp numbers to prefill the form.
  let businesses: OwnedBusiness[] = []
  const db = createAdminClient()
  if (db) {
    const { data } = await db
      .from('listings')
      .select('id, name, phone, whatsapp, address')
      .eq('owner_id', user.id)
      .eq('approved', true)
      .order('name', { ascending: true })
    businesses = (data ?? []) as OwnedBusiness[]
  }
  const initialListingId = listing && businesses.some((business) => business.id === listing) ? listing : ''

  return (
    <div className="mx-auto max-w-lg">
      <h1 className="text-balance font-display text-3xl sm:text-4xl">
        {initialKind === 'hiring' ? 'Post a job' : 'Say you are looking for work'}
      </h1>
      <p className="mt-2 text-sm leading-relaxed text-[var(--od-muted)]">
        Free, and seen by people across Dahanu. You can switch between hiring and looking for work below.
      </p>

      <ol className="mt-5 grid grid-cols-3 gap-2">
        {STEPS.map(({ icon: Icon, label }, index) => (
          <li
            key={label}
            className="flex flex-col items-center gap-1.5 rounded-[14px] border border-[var(--od-border)] bg-[var(--color-surface-2)] px-2 py-3 text-center"
          >
            <Icon size={16} className="text-[var(--od-brand)]" aria-hidden />
            <span className="text-[11px] font-bold leading-tight text-[var(--od-ink-2)]">
              <span className="sr-only">Step {index + 1}: </span>
              {label}
            </span>
          </li>
        ))}
      </ol>
      <p className="mt-2 text-xs text-[var(--od-muted)]">
        Posts from an approved OurDahanu business skip the check and go live instantly.
      </p>

      <div className="mt-6">
        <JobPostForm mode="create" businesses={businesses} initial={{ kind: initialKind, listingId: initialListingId }} />
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Write the My posts actions**

Create `src/app/jobs/my-posts/MyPostActions.tsx`:

```tsx
'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { CheckCircle2, Pencil, RefreshCw } from 'lucide-react'

import { closeJobPost, renewJobPost } from '@/app/actions/jobs'
import { safelySubmit } from '@/lib/find/safe-submission'

export default function MyPostActions({
  postId,
  kind,
  canRenew,
  canClose,
  canEdit,
}: {
  postId: string
  kind: 'hiring' | 'seeking'
  canRenew: boolean
  canClose: boolean
  canEdit: boolean
}) {
  const router = useRouter()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function run(action: () => Promise<{ ok: true } | { error: string }>) {
    setPending(true)
    setError(null)
    const result = await safelySubmit(action)
    setPending(false)
    if ('error' in result) {
      setError(result.error)
      return
    }
    router.refresh()
  }

  function close() {
    const question =
      kind === 'hiring'
        ? 'Mark this job as filled? It comes off the board and cannot be reopened.'
        : 'Mark that you found work? Your profile comes off the board.'
    if (window.confirm(question)) void run(() => closeJobPost(postId))
  }

  if (!canRenew && !canClose && !canEdit) return null

  return (
    <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-[var(--od-border)] pt-3">
      {canRenew && (
        <button
          type="button"
          disabled={pending}
          onClick={() => void run(() => renewJobPost(postId))}
          className="od-button-primary px-3.5 py-1.5 text-sm disabled:opacity-60"
        >
          <RefreshCw size={14} aria-hidden /> Renew for 30 days
        </button>
      )}
      {canEdit && (
        <Link href={`/jobs/my-posts/${postId}/edit`} className="od-button-secondary px-3.5 py-1.5 text-sm">
          <Pencil size={14} aria-hidden /> Edit
        </Link>
      )}
      {canClose && (
        <button
          type="button"
          disabled={pending}
          onClick={close}
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-sm font-semibold text-[var(--od-muted)] transition-colors hover:text-[var(--od-brand-strong)] disabled:opacity-60"
        >
          <CheckCircle2 size={14} aria-hidden /> {kind === 'hiring' ? 'Mark filled' : 'Found work'}
        </button>
      )}
      {error && (
        <p role="alert" className="w-full text-sm font-semibold text-[var(--od-danger)]">
          {error}
        </p>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Write the My posts page**

Create `src/app/jobs/my-posts/page.tsx`:

```tsx
import type { Metadata } from 'next'
import Link from 'next/link'
import { connection } from 'next/server'
import { LogIn, Phone, Plus } from 'lucide-react'

import { canRenew, daysLeft, isLive } from '@/lib/jobs/lifecycle'
import type { JobStatus } from '@/lib/jobs/rules'
import { createAdminClient } from '@/lib/supabase/admin-client'
import { createClient } from '@/lib/supabase/server'
import { jobsLoginHref } from '../jobs-server'
import { kindLabel, shortDate } from '../jobs-ui'
import MyPostActions from './MyPostActions'

export const metadata: Metadata = {
  title: 'My posts — OurDahanu Jobs',
  robots: { index: false, follow: false },
}

interface MyPost {
  id: string
  kind: 'hiring' | 'seeking'
  status: JobStatus
  title: string
  category: string
  reject_reason: string | null
  expires_at: string | null
  created_at: string
}

type Tone = 'live' | 'waiting' | 'muted' | 'bad'

const TONE_CLASS: Record<Tone, string> = {
  live: 'text-[var(--color-success-strong)]',
  waiting: 'text-[var(--od-gold)]',
  muted: 'text-[var(--od-muted)]',
  bad: 'text-[var(--od-danger)]',
}

// A post hidden by reports reads "Waiting for review" like any other pending
// post: telling a scammer what tripped the hide teaches them to avoid it.
function statusLine(post: MyPost, now: Date): { label: string; tone: Tone } {
  if (post.status === 'approved') {
    if (post.expires_at && isLive(post, now)) {
      const left = daysLeft(post.expires_at, now)
      return { label: `Live · ${left} ${left === 1 ? 'day' : 'days'} left`, tone: 'live' }
    }
    return { label: 'Expired — renew to put it back on the board', tone: 'muted' }
  }
  if (post.status === 'pending') return { label: 'Waiting for review', tone: 'waiting' }
  if (post.status === 'rejected') {
    return { label: `Not approved${post.reject_reason ? `: ${post.reject_reason}` : ''}`, tone: 'bad' }
  }
  if (post.status === 'closed') {
    return { label: post.kind === 'hiring' ? 'Closed — filled' : 'Closed — found work', tone: 'muted' }
  }
  return { label: 'Removed by a moderator', tone: 'bad' }
}

export default async function MyPostsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    const loginHref = await jobsLoginHref('/my-posts')
    return (
      <div className="mx-auto max-w-lg">
        <div className="od-card flex flex-col items-center px-6 py-8 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-[14px] bg-[var(--color-surface-soft)] text-[var(--od-brand)]">
            <LogIn size={22} aria-hidden />
          </span>
          <h1 className="mt-3 font-display text-2xl">Log in to see your posts</h1>
          <a href={loginHref} className="od-button-primary mt-4 px-5 py-2 text-sm">
            Log in with Google
          </a>
        </div>
      </div>
    )
  }

  // Reads the current time below; mark the render as request-time explicitly.
  await connection()
  const now = new Date()

  const db = createAdminClient()
  if (!db) {
    return <p className="text-sm font-semibold text-[var(--od-danger)]">Jobs are temporarily unavailable.</p>
  }

  const { data } = await db
    .from('job_posts')
    .select('id, kind, status, title, category, reject_reason, expires_at, created_at')
    .eq('posted_by', user.id)
    .order('created_at', { ascending: false })
    .limit(100)
  const posts = (data ?? []) as MyPost[]

  const revealCounts = new Map<string, number>()
  if (posts.length > 0) {
    const { data: reveals } = await db
      .from('job_contact_reveals')
      .select('post_id')
      .in('post_id', posts.map((post) => post.id))
    for (const row of (reveals ?? []) as { post_id: string }[]) {
      revealCounts.set(row.post_id, (revealCounts.get(row.post_id) ?? 0) + 1)
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="flex items-center justify-between gap-3">
        <h1 className="font-display text-3xl sm:text-4xl">My posts</h1>
        <Link href="/jobs/post" className="od-button-primary px-3.5 py-2 text-sm">
          <Plus size={15} aria-hidden /> New post
        </Link>
      </div>

      {posts.length === 0 ? (
        <div className="od-card mt-6 flex flex-col items-center px-6 py-12 text-center">
          <h2 className="font-display text-2xl">You have not posted yet</h2>
          <p className="mt-1 max-w-sm text-sm text-[var(--od-muted)]">
            Post a job, or tell Dahanu you are looking for work. It is free.
          </p>
          <Link href="/jobs/post" className="od-button-primary mt-5 px-5 py-2 text-sm">
            Post now
          </Link>
        </div>
      ) : (
        <ul className="mt-6 space-y-3">
          {posts.map((post) => {
            const status = statusLine(post, now)
            const reveals = revealCounts.get(post.id) ?? 0
            const editable = post.status !== 'closed' && post.status !== 'removed'
            return (
              <li key={post.id} className="od-card p-4 sm:p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="od-eyebrow">
                      {kindLabel(post.kind)} · {post.category}
                    </p>
                    <h2 className="mt-1 truncate text-[1.05rem] font-bold">
                      {isLive(post, now) ? (
                        <Link href={`/jobs/j/${post.id}`} className="hover:text-[var(--od-brand-strong)]">
                          {post.title}
                        </Link>
                      ) : (
                        post.title
                      )}
                    </h2>
                    <p className={`mt-1 text-sm font-semibold ${TONE_CLASS[status.tone]}`}>{status.label}</p>
                  </div>
                  <span className="shrink-0 text-[11px] text-[var(--od-muted)]">{shortDate(post.created_at)}</span>
                </div>
                <p className="mt-2 flex items-center gap-1.5 text-xs text-[var(--od-muted)]">
                  <Phone size={12} aria-hidden /> {reveals} {reveals === 1 ? 'person' : 'people'} viewed your number
                </p>
                <MyPostActions
                  postId={post.id}
                  kind={post.kind}
                  canRenew={canRenew(post, now)}
                  canClose={editable}
                  canEdit={editable}
                />
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
```

- [ ] **Step 5: Write the edit page**

Create `src/app/jobs/my-posts/[id]/edit/page.tsx`:

```tsx
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'

import { getUserRole } from '@/app/actions/admin'
import { createAdminClient } from '@/lib/supabase/admin-client'
import { createClient } from '@/lib/supabase/server'
import { jobsLoginHref } from '../../../jobs-server'
import JobPostForm, { type JobPostFormValues, type OwnedBusiness } from '../../../post/JobPostForm'

export const metadata: Metadata = {
  title: 'Edit post — OurDahanu Jobs',
  robots: { index: false, follow: false },
}

interface EditablePost {
  id: string
  kind: 'hiring' | 'seeking'
  status: string
  posted_by: string
  listing_id: string | null
  collected_source: string | null
  title: string
  category: string
  work_types: string[]
  area: string
  description: string | null
  employer_name: string | null
  openings: number | null
  pay_min: number | null
  pay_max: number | null
  pay_period: string | null
  timings: string | null
  display_name: string | null
  experience_years: number | null
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function asText(value: number | null): string {
  return value === null ? '' : String(value)
}

export default async function EditJobPostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!UUID.test(id)) notFound()

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect(await jobsLoginHref(`/my-posts/${id}/edit`))

  const db = createAdminClient()
  if (!db) notFound()

  const { role } = await getUserRole(supabase)
  const staff = role === 'admin' || role === 'moderator'

  const { data } = await db
    .from('job_posts')
    .select(
      'id, kind, status, posted_by, listing_id, collected_source, title, category, work_types, area, description, employer_name, openings, pay_min, pay_max, pay_period, timings, display_name, experience_years',
    )
    .eq('id', id)
    .maybeSingle()
  const post = (data ?? null) as EditablePost | null
  // Staff can edit any post; everyone else only their own. A stranger gets the
  // same 404 as a missing post, so post ids cannot be probed.
  if (!post || (post.posted_by !== user.id && !staff)) notFound()

  const backLink = (
    <Link
      href={staff && post.posted_by !== user.id ? '/admin/jobs' : '/jobs/my-posts'}
      className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-[var(--od-ink-2)] hover:text-[var(--od-brand-strong)]"
    >
      <ArrowLeft size={13} aria-hidden /> Back
    </Link>
  )

  if (post.status === 'closed' || post.status === 'removed') {
    return (
      <div className="mx-auto max-w-lg">
        {backLink}
        <div className="od-card mt-3 p-6 text-center">
          <h1 className="font-display text-2xl">This post is closed</h1>
          <p className="mt-1 text-sm text-[var(--od-muted)]">Closed posts cannot be edited. Post again instead.</p>
        </div>
      </div>
    )
  }

  const { data: contactRow } = await db.from('job_post_contacts').select('phone, whatsapp').eq('post_id', id).maybeSingle()
  const contact = (contactRow ?? null) as { phone: string; whatsapp: boolean } | null

  // "Posting as" lists the poster's own approved businesses, even when staff edit.
  let businesses: OwnedBusiness[] = []
  if (post.kind === 'hiring') {
    const { data: listings } = await db
      .from('listings')
      .select('id, name, phone, whatsapp, address')
      .eq('owner_id', post.posted_by)
      .eq('approved', true)
      .order('name', { ascending: true })
    businesses = (listings ?? []) as OwnedBusiness[]
  }

  const initial: Partial<JobPostFormValues> = {
    kind: post.kind,
    listingId: post.listing_id ?? '',
    title: post.title,
    category: post.category,
    workTypes: post.work_types,
    area: post.area,
    description: post.description ?? '',
    employerName: post.employer_name ?? '',
    openings: asText(post.openings),
    payMin: asText(post.pay_min),
    payMax: asText(post.pay_max),
    payPeriod: post.pay_period ?? 'month',
    timings: post.timings ?? '',
    displayName: post.display_name ?? '',
    experienceYears: asText(post.experience_years),
    phone: contact?.phone ?? '',
    whatsapp: contact?.whatsapp ?? false,
    collectedSource: post.collected_source ?? '',
  }

  return (
    <div className="mx-auto max-w-lg">
      {backLink}
      <h1 className="mt-3 font-display text-3xl">Edit post</h1>
      <p className="mt-2 text-sm leading-relaxed text-[var(--od-muted)]">
        {post.listing_id || post.collected_source
          ? 'Changes to a business post stay live unless they need a check.'
          : 'Changes to a live post are checked by a moderator before it goes live again.'}
      </p>
      <div className="mt-6">
        <JobPostForm
          mode="edit"
          postId={post.id}
          initial={initial}
          businesses={businesses}
          lockKind
          showCollectedSource={staff && post.collected_source !== null}
        />
      </div>
    </div>
  )
}
```

- [ ] **Step 6: Typecheck, lint and build**

Run: `npx tsc --noEmit && npm run lint && npm run test:existing && npm run build`
Expected: typecheck clean; lint 0 errors / 11 warnings; tests pass; build succeeds.

- [ ] **Step 7: Verify in the browser**

These pages need a Google sign-in, which this environment cannot complete. Check the logged-out behaviour and report exactly what you observe — do not describe a signed-in result as verified.

1. `http://localhost:3000/jobs/post?kind=seeking` — the "Log in to post" card renders. Read its link with `read_page`: it must be `http://localhost:3000/login?next=` followed by the encoded `http://localhost:3000/jobs/post?kind=seeking`.
2. `http://localhost:3000/jobs/my-posts` — the "Log in to see your posts" card renders.
3. `http://localhost:3000/jobs/my-posts/00000000-0000-4000-8000-000000000000/edit` — redirects to the login page.
4. No console errors on any of them.

State plainly in your report that posting, renewing, closing and editing still need a signed-in check by the site owner.

- [ ] **Step 8: Commit**

```bash
git add src/app/jobs/post/JobPostForm.tsx src/app/jobs/post/page.tsx src/app/jobs/my-posts/page.tsx src/app/jobs/my-posts/MyPostActions.tsx "src/app/jobs/my-posts/[id]/edit/page.tsx"
git commit -m "feat(jobs): posting form, my posts, renew, close and edit"
```

---

### Task 11: Moderation — Admin → Jobs

**Files:**
- Create: `src/app/actions/admin-jobs.ts`
- Create: `src/app/admin/jobs/AdminJobActions.tsx`
- Create: `src/app/admin/jobs/page.tsx`
- Modify: `src/app/admin/AdminNav.tsx`

**Interfaces:**
- Consumes: `requireAdminOrMod` from `src/app/actions/admin.ts` (redirects anyone who is not admin or moderator; returns `{ user, role }`); `publishWindow` (Task 3); `revalidateJobsCache` (Task 8); `sendNotification` with `job.approved` / `job.rejected` (Task 6); `formatIndianPhone` (Task 2); `JobPostForm` (Task 10); `getIndiaToday` from `src/lib/india-time.ts`.
- Produces: server actions `approveJobPost(postId: string)`, `rejectJobPost(postId: string, reason: string)`, `removeJobPost(postId: string)`, each returning `{ ok: true } | { error: string }`.

- [ ] **Step 1: Write the moderation actions**

Create `src/app/actions/admin-jobs.ts`:

```ts
'use server'

import { after } from 'next/server'

import { requireAdminOrMod } from '@/app/actions/admin'
import { revalidateJobsCache } from '@/lib/cache-tags'
import { publishWindow } from '@/lib/jobs/lifecycle'
import { sendNotification } from '@/lib/notifications'
import { createAdminClient } from '@/lib/supabase/admin-client'
import { createClient } from '@/lib/supabase/server'

type Result = { ok: true } | { error: string }

interface ModeratedPost {
  id: string
  kind: 'hiring' | 'seeking'
  title: string
  posted_by: string
  status: string
}

async function staffContext() {
  const supabase = await createClient()
  const { user } = await requireAdminOrMod(supabase) // redirects anyone else
  const db = createAdminClient()
  if (!db) throw new Error('Service role not configured')
  return { db, userId: user.id }
}

async function loadPost(
  db: NonNullable<ReturnType<typeof createAdminClient>>,
  postId: string,
): Promise<ModeratedPost | null> {
  const { data } = await db.from('job_posts').select('id, kind, title, posted_by, status').eq('id', postId).maybeSingle()
  return (data ?? null) as ModeratedPost | null
}

export async function approveJobPost(postId: string): Promise<Result> {
  const { db, userId } = await staffContext()
  const post = await loadPost(db, postId)
  if (!post) return { error: 'Post not found.' }
  if (post.status === 'closed' || post.status === 'removed') {
    return { error: 'Closed or removed posts cannot be approved.' }
  }

  // Every approval restarts the 30 days and clears flags, including a
  // re-approval after an edit or a report hide.
  const now = new Date()
  const { error } = await db
    .from('job_posts')
    .update({
      status: 'approved',
      ...publishWindow(now),
      review_flags: [],
      reminder_sent_at: null,
      reject_reason: null,
      reviewed_by: userId,
      reviewed_at: now.toISOString(),
      updated_at: now.toISOString(),
    })
    .eq('id', postId)
  if (error) return { error: error.message }

  revalidateJobsCache()
  after(() =>
    sendNotification(post.posted_by, 'job.approved', { postId: post.id, title: post.title, kind: post.kind }, { awaitDelivery: true }),
  )
  return { ok: true }
}

export async function rejectJobPost(postId: string, reason: string): Promise<Result> {
  const cleanReason = reason.trim().slice(0, 300)
  if (!cleanReason) return { error: 'Give the poster a reason.' }

  const { db, userId } = await staffContext()
  const post = await loadPost(db, postId)
  if (!post) return { error: 'Post not found.' }
  if (post.status !== 'pending' && post.status !== 'approved') {
    return { error: 'Only pending or live posts can be rejected.' }
  }

  const now = new Date()
  const { error } = await db
    .from('job_posts')
    .update({
      status: 'rejected',
      reject_reason: cleanReason,
      reviewed_by: userId,
      reviewed_at: now.toISOString(),
      updated_at: now.toISOString(),
    })
    .eq('id', postId)
  if (error) return { error: error.message }

  revalidateJobsCache()
  after(() =>
    sendNotification(
      post.posted_by,
      'job.rejected',
      { postId: post.id, title: post.title, kind: post.kind, reason: cleanReason },
      { awaitDelivery: true },
    ),
  )
  return { ok: true }
}

export async function removeJobPost(postId: string): Promise<Result> {
  const { db, userId } = await staffContext()
  const post = await loadPost(db, postId)
  if (!post) return { error: 'Post not found.' }

  const now = new Date()
  const { error } = await db
    .from('job_posts')
    .update({ status: 'removed', reviewed_by: userId, reviewed_at: now.toISOString(), updated_at: now.toISOString() })
    .eq('id', postId)
  if (error) return { error: error.message }

  revalidateJobsCache()
  return { ok: true }
}
```

- [ ] **Step 2: Write the moderation buttons**

Create `src/app/admin/jobs/AdminJobActions.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

import { approveJobPost, rejectJobPost, removeJobPost } from '@/app/actions/admin-jobs'

export default function AdminJobActions({ postId, status }: { postId: string; status: string }) {
  const router = useRouter()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function run(action: () => Promise<{ ok: true } | { error: string }>) {
    setPending(true)
    setError(null)
    try {
      const result = await action()
      if ('error' in result) {
        setError(result.error)
        return
      }
      router.refresh()
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setPending(false)
    }
  }

  function reject() {
    const reason = window.prompt('Why is this post not approved? The poster will see this.')
    if (reason === null) return
    void run(() => rejectJobPost(postId, reason))
  }

  function remove() {
    if (!window.confirm('Remove this post from the board? The poster cannot restore it.')) return
    void run(() => removeJobPost(postId))
  }

  const canApprove = status === 'pending' || status === 'rejected'
  const canReject = status === 'pending' || status === 'approved'
  const canRemove = status !== 'removed'

  return (
    <div className="mt-3 flex items-center gap-2">
      {canApprove && (
        <button
          type="button"
          disabled={pending}
          onClick={() => void run(() => approveJobPost(postId))}
          className="rounded bg-green-600 px-3 py-1 text-xs font-semibold text-white disabled:opacity-60"
        >
          Approve
        </button>
      )}
      {canReject && (
        <button
          type="button"
          disabled={pending}
          onClick={reject}
          className="rounded bg-red-600 px-3 py-1 text-xs font-semibold text-white disabled:opacity-60"
        >
          Reject
        </button>
      )}
      {canRemove && (
        <button
          type="button"
          disabled={pending}
          onClick={remove}
          className="ml-auto rounded border border-red-300 px-3 py-1 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-60"
        >
          Remove
        </button>
      )}
      {error && <span className="text-xs text-red-700">{error}</span>}
    </div>
  )
}
```

- [ ] **Step 3: Write the admin page**

Create `src/app/admin/jobs/page.tsx`:

```tsx
import Link from 'next/link'
import { connection } from 'next/server'
import { ArrowLeft } from 'lucide-react'

import { requireAdminOrMod } from '@/app/actions/admin'
import JobPostForm from '@/app/jobs/post/JobPostForm'
import { getIndiaToday } from '@/lib/india-time'
import { formatIndianPhone } from '@/lib/jobs/phone'
import { createAdminClient } from '@/lib/supabase/admin-client'
import { createClient } from '@/lib/supabase/server'
import AdminJobActions from './AdminJobActions'

type Tab = 'pending' | 'live' | 'all'

interface AdminJobRow {
  id: string
  kind: 'hiring' | 'seeking'
  status: string
  title: string
  category: string
  area: string
  description: string | null
  employer_name: string | null
  display_name: string | null
  collected_source: string | null
  listing_id: string | null
  review_flags: string[]
  reviewed_at: string | null
  posted_by: string
  created_at: string
  expires_at: string | null
}

const FLAG_LABEL: Record<string, string> = {
  scam_words: 'Fee words',
  link_or_phone: 'Link or number in text',
  reports: 'Reported',
}

const ROW_COLUMNS =
  'id, kind, status, title, category, area, description, employer_name, display_name, collected_source, listing_id, review_flags, reviewed_at, posted_by, created_at, expires_at'

export default async function AdminJobsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const supabase = await createClient()
  await requireAdminOrMod(supabase)
  await connection()

  const db = createAdminClient()
  if (!db) return <p className="p-6 text-red-600">Service role key not configured.</p>

  const { tab: rawTab } = await searchParams
  const nowIso = new Date().toISOString()
  // The success measure is per calendar month in IST.
  const monthStart = `${getIndiaToday().slice(0, 7)}-01T00:00:00+05:30`

  const [pendingResult, liveResult, revealsResult] = await Promise.all([
    db.from('job_posts').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    db.from('job_posts').select('id', { count: 'exact', head: true }).eq('status', 'approved').gt('expires_at', nowIso),
    db.from('job_contact_reveals').select('post_id', { count: 'exact', head: true }).gte('created_at', monthStart),
  ])
  const pendingCount = pendingResult.count ?? 0
  const liveCount = liveResult.count ?? 0
  const revealsThisMonth = revealsResult.count ?? 0

  const tab: Tab =
    rawTab === 'pending' || rawTab === 'live' || rawTab === 'all' ? rawTab : pendingCount > 0 ? 'pending' : 'live'

  let query = db.from('job_posts').select(ROW_COLUMNS)
  if (tab === 'pending') query = query.eq('status', 'pending')
  if (tab === 'live') query = query.eq('status', 'approved').gt('expires_at', nowIso)
  const { data } = await query.order('created_at', { ascending: false }).limit(100)
  const rows = (data ?? []) as AdminJobRow[]

  const phoneById = new Map<string, string>()
  const reportsById = new Map<string, number>()
  const nameById = new Map<string, string>()

  if (rows.length > 0) {
    const ids = rows.map((row) => row.id)
    const [contacts, reports, profiles] = await Promise.all([
      db.from('job_post_contacts').select('post_id, phone').in('post_id', ids),
      db.from('job_post_reports').select('post_id, created_at').in('post_id', ids),
      db.from('profiles').select('id, full_name, email').in('id', Array.from(new Set(rows.map((row) => row.posted_by)))),
    ])

    for (const contact of (contacts.data ?? []) as { post_id: string; phone: string }[]) {
      phoneById.set(contact.post_id, contact.phone)
    }

    // Count reports since each post's last review — the same rule that hides posts.
    const reviewedAt = new Map(rows.map((row) => [row.id, row.reviewed_at]))
    for (const report of (reports.data ?? []) as { post_id: string; created_at: string }[]) {
      const since = reviewedAt.get(report.post_id)
      if (!since || Date.parse(report.created_at) > Date.parse(since)) {
        reportsById.set(report.post_id, (reportsById.get(report.post_id) ?? 0) + 1)
      }
    }

    for (const profile of (profiles.data ?? []) as { id: string; full_name: string | null; email: string | null }[]) {
      nameById.set(profile.id, profile.full_name || profile.email || 'Unknown user')
    }
  }

  const tabCls = (value: Tab) =>
    `rounded-md px-3 py-1.5 text-sm font-semibold ${tab === value ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-700'}`

  return (
    <div className="mx-auto max-w-4xl p-4">
      <Link href="/admin" className="mb-3 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800">
        <ArrowLeft size={14} /> Admin
      </Link>
      <h1 className="mb-4 text-2xl font-bold">Jobs</h1>

      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Waiting for review</p>
          <p className="mt-1 text-2xl font-bold tabular-nums">{pendingCount}</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Live posts</p>
          <p className="mt-1 text-2xl font-bold tabular-nums">{liveCount}</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Numbers viewed this month</p>
          <p className="mt-1 text-2xl font-bold tabular-nums">{revealsThisMonth}</p>
        </div>
      </div>

      <div className="mb-4 flex gap-2">
        <Link href="/admin/jobs?tab=pending" className={tabCls('pending')}>
          Waiting{pendingCount ? ` (${pendingCount})` : ''}
        </Link>
        <Link href="/admin/jobs?tab=live" className={tabCls('live')}>
          Live
        </Link>
        <Link href="/admin/jobs?tab=all" className={tabCls('all')}>
          All
        </Link>
      </div>

      {rows.length === 0 ? (
        <p className="rounded-lg border border-dashed border-gray-300 p-6 text-center text-sm text-gray-500">Nothing here.</p>
      ) : (
        <ul className="space-y-3">
          {rows.map((row) => {
            const reports = reportsById.get(row.id) ?? 0
            const phone = phoneById.get(row.id)
            return (
              <li key={row.id} className="rounded-lg border border-gray-200 bg-white p-4">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="rounded bg-gray-100 px-2 py-0.5 font-semibold">
                    {row.kind === 'hiring' ? 'Hiring' : 'Looking for work'}
                  </span>
                  <span className="rounded bg-gray-100 px-2 py-0.5">{row.status}</span>
                  {row.collected_source && (
                    <span className="rounded bg-amber-50 px-2 py-0.5 text-amber-800">Collected · {row.collected_source}</span>
                  )}
                  {row.listing_id && <span className="rounded bg-emerald-50 px-2 py-0.5 text-emerald-800">Business post</span>}
                  {row.review_flags.map((flag) => (
                    <span key={flag} className="rounded bg-red-50 px-2 py-0.5 font-semibold text-red-700">
                      {FLAG_LABEL[flag] ?? flag}
                    </span>
                  ))}
                  {reports > 0 && (
                    <span className="rounded bg-red-50 px-2 py-0.5 font-semibold text-red-700">
                      {reports} {reports === 1 ? 'report' : 'reports'}
                    </span>
                  )}
                </div>
                <h2 className="mt-2 font-semibold text-gray-900">
                  {row.title}{' '}
                  <span className="font-normal text-gray-500">
                    · {row.kind === 'hiring' ? row.employer_name : row.display_name} · {row.area}
                  </span>
                </h2>
                <p className="text-xs text-gray-500">
                  {row.category} · by {nameById.get(row.posted_by) ?? 'Unknown user'}
                  {phone ? ` · ${formatIndianPhone(phone)}` : ''}
                </p>
                {row.description && <p className="mt-2 whitespace-pre-line text-sm text-gray-700">{row.description}</p>}
                <div className="mt-2 flex flex-wrap gap-3 text-xs">
                  <Link href={`/jobs/my-posts/${row.id}/edit`} className="font-semibold text-blue-700 hover:underline">
                    Edit
                  </Link>
                  {row.status === 'approved' && (
                    <Link href={`/jobs/j/${row.id}`} className="font-semibold text-blue-700 hover:underline">
                      View on the board
                    </Link>
                  )}
                </div>
                <AdminJobActions postId={row.id} status={row.status} />
              </li>
            )
          })}
        </ul>
      )}

      <section className="mt-10 rounded-lg border border-gray-200 bg-white p-4">
        <h2 className="text-lg font-bold">Post a collected job</h2>
        <p className="mb-4 text-sm text-gray-500">
          For jobs gathered from WhatsApp groups, newspapers and shop notices. It goes live instantly, labelled
          &ldquo;Collected by OurDahanu&rdquo; with the source you enter.
        </p>
        <JobPostForm mode="collected" businesses={[]} />
      </section>
    </div>
  )
}
```

- [ ] **Step 4: Link it from the admin navigation**

In `src/app/admin/AdminNav.tsx`:

1. Add `BriefcaseBusiness,` to the `lucide-react` import list, directly after `BarChart3,`.
2. In `NAV_ITEMS`, directly after the `/admin/reviews` entry, add:

```ts
  { href: '/admin/jobs', label: 'Jobs', icon: BriefcaseBusiness, roles: MOD_ROLES },
```

- [ ] **Step 5: Typecheck, lint and build**

Run: `npx tsc --noEmit && npm run lint && npm run test:existing && npm run build`
Expected: typecheck clean; lint 0 errors / 11 warnings (the page uses `&ldquo;`/`&rdquo;`, not raw quotes, so `react/no-unescaped-entities` stays quiet); tests pass; build succeeds.

- [ ] **Step 6: Verify in the browser**

Load `http://localhost:3000/admin/jobs` in the Browser pane while logged out. Expected: `requireAdminOrMod` redirects to `/login`. Report what you observe. State plainly that the queue, approve, reject, remove and the collected-job form need a signed-in check by the site owner.

- [ ] **Step 7: Commit**

```bash
git add src/app/actions/admin-jobs.ts src/app/admin/jobs/AdminJobActions.tsx src/app/admin/jobs/page.tsx src/app/admin/AdminNav.tsx
git commit -m "feat(jobs): admin review queue, collected jobs and moderation"
```

---

### Task 12: Daily expiry reminders

**Files:**
- Create: `src/app/api/cron/job-reminders/route.ts`
- Modify: `vercel.json`

**Interfaces:**
- Consumes: `daysLeft`, `REMINDER_WINDOW_DAYS` (Task 3); `sendNotification` with `job.expiring` (Task 6).
- Produces: `GET /api/cron/job-reminders` (Bearer `CRON_SECRET`), returning `{ ok: true, due, sent, skipped, failed }`.

- [ ] **Step 1: Write the cron route**

Create `src/app/api/cron/job-reminders/route.ts`:

```ts
/**
 * Daily cron job — jobs board expiry reminders.
 *
 * Vercel runs this at 03:30 UTC (09:00 IST) every day, per vercel.json. Hobby
 * crons may fire anywhere within that hour. Secured with CRON_SECRET.
 *
 * Sends one `job.expiring` reminder for each live post within 3 days of expiry.
 * Nothing here expires posts: the board stops showing a post once its
 * expires_at passes.
 */

import { connection, NextResponse } from 'next/server'

import { daysLeft, REMINDER_WINDOW_DAYS } from '@/lib/jobs/lifecycle'
import { sendNotification } from '@/lib/notifications'
import { createAdminClient } from '@/lib/supabase/admin-client'

const DAY_MS = 86_400_000

interface DuePost {
  id: string
  kind: 'hiring' | 'seeking'
  title: string
  posted_by: string
  expires_at: string
}

export async function GET(request: Request) {
  await connection()

  const cronSecret = process.env.CRON_SECRET?.trim()
  if (!cronSecret) {
    return NextResponse.json({ error: 'CRON_SECRET is not configured' }, { status: 500 })
  }
  if (request.headers.get('authorization') !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const db = createAdminClient()
  if (!db) {
    return NextResponse.json({ error: 'Admin client unavailable' }, { status: 500 })
  }

  const now = new Date()
  const windowEnd = new Date(now.getTime() + REMINDER_WINDOW_DAYS * DAY_MS).toISOString()

  const { data, error } = await db
    .from('job_posts')
    .select('id, kind, title, posted_by, expires_at')
    .eq('status', 'approved')
    .is('reminder_sent_at', null)
    .gt('expires_at', now.toISOString())
    .lte('expires_at', windowEnd)
    .limit(500)

  if (error) {
    console.error('[cron/job-reminders] query failed', error.message)
    return NextResponse.json({ error: 'Query failed' }, { status: 500 })
  }

  const stats = { due: 0, sent: 0, skipped: 0, failed: 0 }

  for (const post of (data ?? []) as DuePost[]) {
    stats.due += 1

    // Claim before sending: only the run that flips reminder_sent_at from null
    // sends, so an overlapping or repeated run never double-sends.
    const { data: claimed } = await db
      .from('job_posts')
      .update({ reminder_sent_at: now.toISOString() })
      .eq('id', post.id)
      .is('reminder_sent_at', null)
      .select('id')
    if (!claimed || claimed.length === 0) {
      stats.skipped += 1
      continue
    }

    try {
      await sendNotification(
        post.posted_by,
        'job.expiring',
        { postId: post.id, title: post.title, kind: post.kind, daysLeft: daysLeft(post.expires_at, now) },
        { awaitDelivery: true },
      )
      stats.sent += 1
    } catch (sendError) {
      stats.failed += 1
      console.error('[cron/job-reminders] send failed', sendError)
    }
  }

  console.log('[cron/job-reminders]', stats)
  return NextResponse.json({ ok: true, ...stats })
}
```

- [ ] **Step 2: Schedule it**

In `vercel.json`, add a second entry to `crons` so the array reads:

```json
  "crons": [
    {
      "path": "/api/cron/listing-expiry",
      "schedule": "0 0 * * 1"
    },
    {
      "path": "/api/cron/job-reminders",
      "schedule": "30 3 * * *"
    }
  ]
```

Leave the existing `listing-expiry` entry exactly as it is.

- [ ] **Step 3: Typecheck, lint and build**

Run: `npx tsc --noEmit && npm run lint && npm run build`
Expected: typecheck clean; lint 0 errors / 11 warnings; build succeeds and lists `/api/cron/job-reminders`.

- [ ] **Step 4: Verify it refuses unauthenticated calls**

With the dev server running (Browser pane `preview_start`), run:

```bash
curl -s -w "\nHTTP %{http_code}\n" http://localhost:3000/api/cron/job-reminders
```

Expected: `HTTP 401` with `{"error":"Unauthorized"}`, or `HTTP 500` with `{"error":"CRON_SECRET is not configured"}` if the local env has no secret. Never `200`.

**Do not call it with the secret.** The dev server talks to the live production database, and an authorised run sends real reminders to real people.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/cron/job-reminders/route.ts vercel.json
git commit -m "feat(jobs): daily reminder before a post expires"
```

---

### Task 13: Sitemap and privacy policy

**Files:**
- Modify: `src/app/sitemap.ts`
- Modify: `src/app/privacy/page.tsx`

**Interfaces:**
- Consumes: `CACHE_TAGS.jobs` (Task 8); `isValidJobCategory`, `jobCategorySlug` (Task 2); Task 1 table types (the sitemap's public client is typed).
- Produces: nothing other tasks consume.

- [ ] **Step 1: Add jobs to the sitemap**

In `src/app/sitemap.ts`:

1. Add this import alongside the other `@/lib` imports:

```ts
import { isValidJobCategory, jobCategorySlug } from '@/lib/jobs/categories'
```

2. Directly after `cacheTag(CACHE_TAGS.find)`, add `cacheTag(CACHE_TAGS.jobs)`, and change the `logCacheRegeneration` call so its tags read `[CACHE_TAGS.listings, CACHE_TAGS.find, CACHE_TAGS.jobs]`.

3. Replace the line `return [...staticRoutes, ...categoryRoutes, ...listingRoutes, ...findRoutes]` with:

```ts
    // jobs.ourdahanu.in — the board, category pages with enough live hiring
    // posts, and each live hiring post. "Looking for work" profiles are left
    // out on purpose: their pages are noindex, so a person's profile never
    // lingers in search results. The public client can only read live posts.
    // An expired post can stay listed until the next write or sitemap refresh;
    // its page then 404s, and its JobPosting carried validThrough regardless.
    const { data: jobRows } = await supabase
      .from('job_posts')
      .select('id, category, published_at')
      .eq('status', 'approved')
      .eq('kind', 'hiring')

    const liveHiring = (jobRows ?? []) as { id: string; category: string; published_at: string | null }[]

    const jobCategoryCounts = new Map<string, number>()
    for (const row of liveHiring) {
      if (row.category !== 'Other' && isValidJobCategory(row.category)) {
        jobCategoryCounts.set(row.category, (jobCategoryCounts.get(row.category) ?? 0) + 1)
      }
    }

    const jobRoutes: MetadataRoute.Sitemap = [
      {
        url: 'https://jobs.ourdahanu.in/',
        lastModified: STATIC_LAST_MODIFIED,
        changeFrequency: 'daily',
        priority: 0.8,
      },
      ...[...jobCategoryCounts.entries()]
        .filter(([, count]) => count >= MIN_CATEGORY_SIZE)
        .map(([category]) => ({
          url: `https://jobs.ourdahanu.in/c/${jobCategorySlug(category)}`,
          lastModified: STATIC_LAST_MODIFIED,
          changeFrequency: 'daily' as const,
          priority: 0.7,
        })),
      ...liveHiring.map((row) => ({
        url: `https://jobs.ourdahanu.in/j/${row.id}`,
        lastModified: row.published_at ? new Date(row.published_at) : STATIC_LAST_MODIFIED,
        changeFrequency: 'weekly' as const,
        priority: 0.6,
      })),
    ]

    return [...staticRoutes, ...categoryRoutes, ...listingRoutes, ...findRoutes, ...jobRoutes]
```

Cross-host entries are valid for the same reason the find entries are: `robots.txt` is served on every host (the proxy passes file paths through untouched) and declares this sitemap.

- [ ] **Step 2: Disclose the jobs board in the privacy policy**

In `src/app/privacy/page.tsx`, directly after the closing `</Section>` of the `title="Analytics"` section, add:

```tsx
        <Section title="Jobs board">
          <p>Posts on OurDahanu Jobs (jobs.ourdahanu.in) are public, except the phone number, which is shown only to
            people who are logged in. When someone views a number we record that they did, so the person who posted
            can see how many people viewed it &mdash; never who. &ldquo;Looking for work&rdquo; profiles show only a first
            name and are hidden from search engines. You can close your post at any time, and deleting your account
            deletes your posts.</p>
        </Section>
```

Every claim here must stay true to the code: numbers come only from `job_post_contacts` through the login-gated reveal action; reveals are recorded in `job_contact_reveals` and shown to posters only as a count; seeking pages are `noindex` and excluded from the sitemap; closing sets `closed`; `posted_by` cascades on account deletion.

- [ ] **Step 3: Typecheck, lint and build**

Run: `npx tsc --noEmit && npm run lint && npm run build`
Expected: typecheck clean; lint 0 errors / 11 warnings; build succeeds.

- [ ] **Step 4: Verify in the browser**

1. `http://localhost:3000/privacy` — the "Jobs board" section renders after "Analytics", with the curly quotes and dash displayed correctly.
2. `http://localhost:3000/sitemap.xml` — contains `https://jobs.ourdahanu.in/`. If live hiring posts exist, their `/j/` URLs appear; no `/j/` URL for a "looking for work" post appears.

Report what you observed.

- [ ] **Step 5: Commit**

```bash
git add src/app/sitemap.ts src/app/privacy/page.tsx
git commit -m "feat(jobs): sitemap entries and privacy disclosure"
```

---

### Task 14: Public entry points (ship last)

This task is deliberately its own commit. The spec's rollout seeds the board quietly before anything links to it: if the site owner wants to seed first, stop before this task and open the pull request for Tasks 1–13, then ship this task as a follow-up.

**Files:**
- Modify: `src/components/Navbar.tsx`
- Modify: `src/components/Footer.tsx`
- Modify: `src/app/page-components/HeroSection.tsx`
- Modify: `src/app/my-business/page.tsx`
- Modify: `docs/mobile-api.md`

**Interfaces:**
- Consumes: the live `jobs.ourdahanu.in` board (Tasks 5 and 9) and `/post?kind=hiring&listing=<id>` (Task 10).
- Produces: nothing.

- [ ] **Step 1: Navbar**

In `src/components/Navbar.tsx`:

1. Add `BriefcaseBusiness` to the `lucide-react` import.
2. In `NAV_LINKS`, directly after the `Businesses` entry, add:

```ts
  { href: 'https://jobs.ourdahanu.in', label: 'Jobs' },
```

3. In `MOBILE_NAV`, directly after the `Explore Businesses` entry, add:

```ts
  { href: 'https://jobs.ourdahanu.in', label: 'Jobs in Dahanu', icon: BriefcaseBusiness },
```

- [ ] **Step 2: Footer**

In `src/components/Footer.tsx`, in `EXPLORE_LINKS`, directly after the `Business Listings` entry, add:

```ts
  { href: 'https://jobs.ourdahanu.in', label: 'Jobs in Dahanu' },
```

The footer passes every href through `buildAbsoluteUrl`, which returns an absolute URL unchanged.

- [ ] **Step 3: Homepage hero**

In `src/app/page-components/HeroSection.tsx`:

1. Add `BriefcaseBusiness` to the `lucide-react` import.
2. Inside the `{/* CTA buttons */}` group, directly after the `List Your Business` `<Button>`, add:

```tsx
            <Button
              href="https://jobs.ourdahanu.in"
              variant="outline"
              size="lg"
              icon={<BriefcaseBusiness size={15} />}
              className="bg-white/[0.12] border-white/25 text-white hover:bg-white/[0.20]"
            >
              Jobs in Dahanu
            </Button>
```

- [ ] **Step 4: My Business card**

In `src/app/my-business/page.tsx`:

1. Add `BriefcaseBusiness,` to the `lucide-react` import list.
2. Immediately above the page component's main `return (`, add:

```ts
  const approvedListings = listings.filter((listing) => listing.approved)
  // With one business the form can preselect it; with several, the form asks.
  const postJobHref =
    approvedListings.length === 1
      ? `https://jobs.ourdahanu.in/post?kind=hiring&listing=${approvedListings[0].id}`
      : 'https://jobs.ourdahanu.in/post?kind=hiring'
```

3. Directly before the card whose heading is `<p className="font-semibold text-gray-900 text-sm">Appointments</p>` (the whole `<div className="od-card mb-4 flex items-center justify-between gap-4 p-5">` that contains it), add:

```tsx
      {approvedListings.length > 0 && (
        <div className="od-card mb-4 flex items-center justify-between gap-4 p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-surface-soft rounded-xl flex items-center justify-center">
              <BriefcaseBusiness size={18} className="text-brand" />
            </div>
            <div>
              <p className="font-semibold text-gray-900 text-sm">Hiring?</p>
              <p className="text-xs text-gray-400">Post a job on OurDahanu Jobs — free, and live instantly for your business</p>
            </div>
          </div>
          <a
            href={postJobHref}
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand hover:text-brand-strong border border-border hover:border-brand px-3 py-2 rounded-xl transition-colors"
          >
            <ArrowUpRight size={14} />
            Post a job
          </a>
        </div>
      )}
```

`ArrowUpRight` is already imported in this file.

- [ ] **Step 5: Correct the mobile API guide**

In `docs/mobile-api.md`, the Jobs and News tables no longer exist:

1. Change the text `listings/jobs/events/news/search reads` to `listings/events/search reads`.
2. Change the text `(or appointment/job)` to `(or appointment)`.

- [ ] **Step 6: Typecheck, lint and build**

Run: `npx tsc --noEmit && npm run lint && npm run test:existing && npm run build`
Expected: typecheck clean; lint 0 errors / 11 warnings; tests pass; build succeeds.

- [ ] **Step 7: Verify in the browser**

1. `http://localhost:3000/` — use `find` or `read_page` to confirm a navbar link labelled **Jobs** to `https://jobs.ourdahanu.in`, a footer link **Jobs in Dahanu**, and the hero button **Jobs in Dahanu**. No console errors.
2. `http://localhost:3000/my-business` needs a sign-in; report that the card needs a signed-in check by the site owner.

- [ ] **Step 8: Commit**

```bash
git add src/components/Navbar.tsx src/components/Footer.tsx src/app/page-components/HeroSection.tsx src/app/my-business/page.tsx docs/mobile-api.md
git commit -m "feat(jobs): link the jobs board from the site"
```

---

## Post-implementation checks

Not tasks — what to confirm before and after this ships.

- [ ] `npx tsc --noEmit` clean, `npm run lint` at 0 errors / 11 warnings, `npm test` passing (unit and game tests), `npm run build` succeeds.
- [ ] **Migration applied and probed** (Task 1 Steps 4–5): anon reads `job_posts` as `[]`; anon gets `42501` on `job_post_contacts` and on inserting into `job_posts`.
- [ ] **Site owner, signed in, on production:**
  1. Post "Looking for work" as an individual → it shows **Waiting for review** in My posts, and the admin is notified.
  2. Approve it in Admin → Jobs → it appears under the **Looking for work** tab; the poster is notified.
  3. From My Business, **Post a job** for an approved business → live instantly with the business badge; no admin notification.
  4. From a second account, **Show phone number** → Call and WhatsApp appear; My posts on the first account shows "1 person viewed your number"; revealing again does not change it.
  5. Report a post from three different accounts → it leaves the board and reappears in the queue marked **Reported**.
  6. Post a collected job from Admin → Jobs → live instantly with the "Collected by OurDahanu" label.
- [ ] **Subdomains after deploy:** `jobs.ourdahanu.in` shows only the JobsDahanu header and footer; `find.ourdahanu.in` and `appointments.ourdahanu.in` each render exactly one footer and no main navbar or emergency ribbon.
- [ ] **Google Rich Results Test** on a live hiring post URL reports a valid Job posting.
- [ ] **Vercel → Settings → Cron Jobs** lists `/api/cron/job-reminders`; its first run logs `[cron/job-reminders]` with no error.
- [ ] **Rollout step 4:** the site owner proofreads the Marathi category labels and seeds 10–15 collected jobs before Task 14's entry points go live.
