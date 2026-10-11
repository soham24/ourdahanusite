# OurDahanu — Architecture & Tech Stack Guide

> A comprehensive guide for an Android developer to understand the full tech stack behind [ourdahanu.in](https://ourdahanu.in) — Dahanu's community portal.

---

## Table of Contents

1. [Android Developer's Rosetta Stone](#1-android-developers-rosetta-stone)
2. [Tech Stack Overview](#2-tech-stack-overview)
3. [Project Structure](#3-project-structure)
4. [How Next.js Works (vs Android)](#4-how-nextjs-works-vs-android)
5. [Routing — The App Router](#5-routing--the-app-router)
6. [Server Components vs Client Components](#6-server-components-vs-client-components)
7. [Data Fetching & Caching](#7-data-fetching--caching)
8. [Server Actions — Handling Form Submissions](#8-server-actions--handling-form-submissions)
9. [Authentication — Supabase Auth](#9-authentication--supabase-auth)
10. [Database — Supabase (PostgreSQL)](#10-database--supabase-postgresql)
11. [Subdomain System — Multi-Tenant Routing](#11-subdomain-system--multi-tenant-routing)
12. [Payments — Razorpay Integration](#12-payments--razorpay-integration)
13. [Notifications — Email, Telegram, WhatsApp](#13-notifications--email-telegram-whatsapp)
14. [Styling — Tailwind CSS & Design Tokens](#14-styling--tailwind-css--design-tokens)
15. [SEO — Metadata, Sitemaps, Structured Data](#15-seo--metadata-sitemaps-structured-data)
16. [Admin Panel & Role-Based Access](#16-admin-panel--role-based-access)
17. [Deployment — Vercel](#17-deployment--vercel)
18. [Environment Variables](#18-environment-variables)
19. [Key Architectural Patterns](#19-key-architectural-patterns)

---

## 1. Android Developer's Rosetta Stone

If you've built Android apps, here's how web concepts map to what you already know:

| Android Concept | Web / Next.js Equivalent | Where in This Project |
|---|---|---|
| `Activity` / `Fragment` | **Page** (React component) | `src/app/**/page.tsx` |
| `AndroidManifest.xml` (routes) | **File-system routing** — folder structure = URL paths | `src/app/` directory |
| `ViewModel` + LiveData | **Server Components** fetch data directly, no state needed | `src/app/page.tsx`, `src/lib/data/` |
| `useState` / `StateFlow` | **React `useState` hook** (client components only) | `'use client'` components |
| `RecyclerView.Adapter` | **`.map()` over an array** to render list items | `{listings.map(l => <Card ... />)}` |
| `Room` / `SQLite` | **Supabase (PostgreSQL)** — cloud database with SDK | `src/lib/supabase/` |
| `SharedPreferences` | **Cookies** (for auth), **localStorage** (for preferences) | Supabase SSR cookies |
| `Retrofit` / `OkHttp` | **`fetch()`** API (built into JS) or **Supabase SDK** | `src/lib/whatsapp.ts`, API routes |
| `Intent` / Navigation Component | **`<Link href="...">` + `useRouter()`** (client nav) | `next/link`, `next/navigation` |
| `@Inject` / Hilt DI | **`import` + function calls** — no DI framework needed | Direct imports everywhere |
| `build.gradle` dependencies | **`package.json`** + `npm install` | `package.json` |
| Jetpack Compose / XML layout | **JSX** — HTML-like syntax inside TypeScript | Every `.tsx` file |
| `strings.xml` | Inline strings or constants files | No separate i18n yet |
| `colors.xml` / Material theme | **Tailwind CSS** design tokens in `globals.css` | `src/app/globals.css` |
| ProGuard / R8 (minification) | **Vercel build** handles minification automatically | `next build` |
| Google Play Console | **Vercel Dashboard** — deploy, logs, analytics | vercel.com |
| Firebase Cloud Messaging | **Resend** (email), **Telegram Bot API**, **WhatsApp Cloud API** | `src/lib/notify-*.ts` |
| Gradle build variants (debug/release) | **Environment variables** (`.env.local` for dev, Vercel env for prod) | `.env.local` |
| `WorkManager` (background tasks) | **Vercel Cron Jobs** | `vercel.json` crons |
| RoomDatabase migrations | **SQL migrations**, applied in filename order | `supabase/migrations/*.sql` |
| OkHttp Interceptors | **Next.js Middleware** — runs before every request | `src/proxy.ts` |

---

## 2. Tech Stack Overview

```
Frontend:   React 19 + Next.js 16 (App Router) + Tailwind CSS 4
Backend:    Next.js Server Components & Server Actions (no separate backend)
Database:   Supabase (PostgreSQL with real-time, auth, storage, RLS)
Auth:       Supabase Auth (Google OAuth)
Payments:   Razorpay (orders + payouts)
Email:      Resend API
Messaging:  Telegram Bot API + Meta WhatsApp Cloud API
Hosting:    Vercel (auto-deploys from Git)
Domain:     ourdahanu.in with wildcard *.ourdahanu.in subdomains
```

### Key Dependencies (`package.json`)

| Package | Version | Purpose |
|---|---|---|
| `next` | 16.3.5 | React framework (SSR, routing, caching) |
| `react` | 19.2.4 | UI library |
| `@supabase/ssr` | 0.9.0 | Supabase server-side auth |
| `@supabase/supabase-js` | 2.109.0 | Supabase client SDK |
| `tailwindcss` | 4.x | Utility-first CSS framework |
| `resend` | 6.9.4 | Transactional email API |
| `lucide-react` | 1.0.1 | Icon library |
| `react-easy-crop` | 5.5.7 | Image crop UI |
| `@vercel/analytics` | 2.0.1 | Usage analytics |

---

## 3. Project Structure

```
ourdahanu/
├── src/
│   ├── app/                  # Routes (each folder = a URL)
│   │   ├── layout.tsx        # Root layout (navbar, footer, fonts)
│   │   ├── page.tsx          # Homepage (/)
│   │   ├── globals.css       # Global styles & design tokens
│   │   ├── robots.ts         # Auto-generated robots.txt
│   │   ├── sitemap.ts        # Auto-generated sitemap.xml
│   │   │
│   │   ├── listings/         # /listings
│   │   │   ├── page.tsx      # Listing index page
│   │   │   ├── [id]/page.tsx # Single listing page (/listings/abc-123)
│   │   │   └── submit/       # /listings/submit (new listing form)
│   │   │
│   │   ├── admin/            # /admin (protected by role check)
│   │   │   ├── layout.tsx    # Admin sidebar navigation
│   │   │   ├── page.tsx      # Admin dashboard
│   │   │   ├── listings/     # Manage listings
│   │   │   ├── events/       # Manage events
│   │   │   ├── jobs/         # Manage jobs
│   │   │   ├── news/         # Manage news
│   │   │   ├── featured/     # Set featured spotlight
│   │   │   └── emergency/    # Emergency alerts
│   │   │
│   │   ├── actions/          # Server Actions (backend logic)
│   │   │   ├── admin.ts      # Admin operations
│   │   │   ├── listings.ts   # Submit/update listings
│   │   │   ├── orders.ts     # Order processing
│   │   │   └── settings.ts   # Site settings
│   │   │
│   │   ├── api/              # API Routes (REST-style)
│   │   │   ├── razorpay/     # Payment endpoints
│   │   │   ├── cron/         # Scheduled jobs
│   │   │   ├── newsletter/   # Email subscription
│   │   │   └── check-subdomain/ # Subdomain availability
│   │   │
│   │   ├── auth/             # Login / signup / callback
│   │   ├── events/           # Events section
│   │   ├── jobs/             # Jobs board
│   │   ├── classifieds/      # Classifieds
│   │   ├── forum/            # Community forum
│   │   ├── news/             # News articles
│   │   ├── emergency/        # Emergency services
│   │   ├── search/           # Search pages
│   │   ├── my-business/      # Business owner dashboard
│   │   ├── my-jobs/          # Job poster dashboard
│   │   ├── profile/          # User profile
│   │   └── shop/             # E-commerce section
│   │
│   ├── components/           # Reusable UI components
│   │   ├── Navbar.tsx        # Top navigation bar
│   │   ├── Footer.tsx        # Site footer
│   │   ├── BottomTabBar.tsx  # Mobile bottom navigation
│   │   ├── EmergencyRibbon.tsx # Alert banner
│   │   ├── OrderModal.tsx    # Payment checkout modal
│   │   ├── ImageCropUpload.tsx # Image upload with cropping
│   │   ├── LocationPicker.tsx  # Map-based location picker
│   │   ├── SubdomainInput.tsx  # Custom domain input
│   │   └── ...
│   │
│   ├── lib/                  # Utilities & business logic
│   │   ├── supabase/         # Database clients
│   │   │   ├── server.ts     # Server-side Supabase client
│   │   │   ├── admin-client.ts # Service-role client (bypasses RLS)
│   │   │   ├── client.ts     # Browser-side client
│   │   │   └── public.ts     # Read-only server client
│   │   ├── data/             # Cached data fetchers
│   │   │   ├── home.ts       # Homepage data
│   │   │   └── pricing.ts    # Pricing config
│   │   ├── cache-tags.ts     # Cache invalidation system
│   │   ├── listing-url.ts    # URL builders for listings
│   │   ├── listing-content.ts # Text normalization
│   │   ├── payment-security.ts # Payment validation (HMAC)
│   │   ├── notify-admin.ts   # Admin email + Telegram notifications
│   │   ├── notify-expiry.ts  # Listing expiry reminders
│   │   └── whatsapp.ts       # WhatsApp Cloud API client
│   │
│   └── proxy.ts              # Middleware — subdomain routing
│
├── public/                   # Static files (images, favicons, manifest)
├── supabase/                 # SQL migration scripts
├── next.config.ts            # Next.js configuration
├── package.json              # Dependencies
├── tsconfig.json             # TypeScript config (@/* path alias)
└── vercel.json               # Vercel deployment + cron config
```

---

## 4. How Next.js Works (vs Android)

### Android Flow
```
User taps icon → Activity starts → ViewModel fetches data → UI renders → User navigates → new Activity
```

### Next.js Flow
```
User opens URL → Server renders page (HTML) → Browser hydrates React → User clicks link → Client-side navigation (no page reload)
```

**Key difference:** In Android, your app runs entirely on the user's device. In Next.js, there are **two runtimes**:

1. **Server** (Vercel's cloud) — renders HTML, fetches database, runs business logic
2. **Client** (user's browser) — handles interactivity (clicks, forms, animations)

This is like having your `ViewModel` run on a server and only sending the rendered `RecyclerView` items to the phone.

### The Build Step

```
Source code (.tsx files)
      │
      ▼  [next build]
Optimized bundles:
  ├── Server components → run on Vercel, never sent to browser
  ├── Client components → JavaScript bundles sent to browser
  ├── API routes → serverless functions
  └── Static pages → pre-rendered HTML
```

Compare to Android:
- `next build` = `./gradlew assembleRelease`
- Vercel deployment = uploading APK to Play Store
- But deploys happen automatically on every `git push`

---

## 5. Routing — The App Router

Next.js uses **file-system routing** — no manifest, no route declarations. The folder structure IS the URL structure.

### How it works

| File Path | URL | What it renders |
|---|---|---|
| `src/app/page.tsx` | `/` | Homepage |
| `src/app/listings/page.tsx` | `/listings` | Listings index |
| `src/app/listings/[id]/page.tsx` | `/listings/abc-123` | Single listing (dynamic) |
| `src/app/admin/page.tsx` | `/admin` | Admin dashboard |
| `src/app/api/newsletter/route.ts` | `POST /api/newsletter` | API endpoint |

### Special Files

| File | Android Equivalent | Purpose |
|---|---|---|
| `page.tsx` | Activity's `onCreate` + layout | The visible UI for a route |
| `layout.tsx` | Parent Activity / NavHost | Wraps child pages (shared navbar, sidebar) |
| `loading.tsx` | Shimmer / placeholder | Shown while page data loads |
| `error.tsx` | Error dialog | Shown when page throws an error |
| `not-found.tsx` | 404 screen | Shown for invalid URLs |
| `route.ts` | Retrofit endpoint handler | API endpoint (REST-style) |

### Dynamic Routes: `[id]`

```
src/app/listings/[id]/page.tsx
```

The `[id]` folder means "any value here". When someone visits `/listings/abc-123`:
- Next.js calls the page component with `params.id = "abc-123"`
- You use that ID to fetch the listing from the database

**Android equivalent:** This is like defining a deep link `ourdahanu.in/listings/{id}` and reading the path parameter in your Activity.

### Layout Nesting

Layouts wrap their children and persist across navigation:

```
app/layout.tsx          ← Root: Navbar + Footer (always visible)
  └── app/admin/layout.tsx  ← Admin sidebar (visible on all /admin/* pages)
        └── app/admin/listings/page.tsx  ← Listing management content
```

**Android equivalent:** Think of `layout.tsx` like a `NavHostFragment` that stays on screen while the inner Fragment changes.

---

## 6. Server Components vs Client Components

This is the most important concept to understand.

### Server Components (default)

Every `.tsx` file is a **Server Component** by default. It runs on the server, NOT in the browser.

```tsx
// src/app/listings/page.tsx — this runs on Vercel's servers
import { createPublicClient } from '@/lib/supabase/public'

export default async function ListingsPage() {
  const supabase = createPublicClient()
  const { data: listings } = await supabase
    .from('listings')
    .select('*')
    .eq('approved', true)

  return (
    <div>
      {listings?.map(listing => (
        <div key={listing.id}>{listing.name}</div>
      ))}
    </div>
  )
}
```

**What happens:**
1. Server fetches listings from database
2. Server renders HTML
3. HTML is sent to browser (no JavaScript shipped for this component)
4. Browser displays it immediately

**Android equivalent:** Imagine your backend rendering the entire RecyclerView as HTML and sending it as a WebView — but with full interactivity.

### Client Components

Add `'use client'` at the top when you need **interactivity** (clicks, forms, state, animations).

```tsx
'use client' // This runs in the USER'S BROWSER

import { useState } from 'react'

export default function LikeButton() {
  const [liked, setLiked] = useState(false)

  return (
    <button onClick={() => setLiked(!liked)}>
      {liked ? 'Liked!' : 'Like'}
    </button>
  )
}
```

**When to use `'use client'`:**
- `useState`, `useEffect`, `useRef` — any React hooks
- `onClick`, `onChange` — any event handlers
- Browser APIs — `window`, `document`, `localStorage`
- Third-party libraries that need the browser (Razorpay SDK, image cropper)

**When NOT to use it:**
- Fetching data from the database
- Rendering static content
- SEO-critical content (server-rendered = better for Google)

### The Boundary Pattern

A common pattern: Server Component fetches data, passes it to a Client Component for interactivity.

```tsx
// page.tsx (Server Component — fetches data)
export default async function ListingPage({ params }) {
  const listing = await fetchListing(params.id)
  return <ListingActions listing={listing} />  // Pass data down
}

// ListingActions.tsx (Client Component — handles clicks)
'use client'
export default function ListingActions({ listing }) {
  return <button onClick={() => alert(listing.name)}>Share</button>
}
```

---

## 7. Data Fetching & Caching

### The `'use cache'` Directive

OurDahanu uses Next.js's caching system to avoid re-fetching data on every request.

```tsx
// src/lib/data/home.ts
export async function getHomePageData() {
  'use cache'                                        // Enable caching
  cacheLife({ stale: 300, revalidate: 600, expire: 3600 })  // Timing
  cacheTag(CACHE_TAGS.home)                          // Tag for invalidation
  cacheTag(CACHE_TAGS.listings)
  cacheTag(CACHE_TAGS.settings)

  // This query runs ONCE, then results are cached for 5 minutes
  const supabase = createPublicClient()
  const { data } = await supabase.from('listings').select('*').eq('approved', true)
  return data
}
```

**Cache timing explained:**
- `stale: 300` (5 min) — Serve cached data for 5 minutes without checking
- `revalidate: 600` (10 min) — After 5 min, serve stale data but fetch fresh in background
- `expire: 3600` (1 hour) — After 1 hour, the cache entry is completely deleted

**Android equivalent:** This is like `Room` with a cache layer, where queries are cached and automatically refreshed. Like setting `@Query` results to be cached with a TTL.

### Cache Invalidation

When an admin approves a listing, the cache must be cleared so the homepage shows the new listing.

```tsx
// src/lib/cache-tags.ts
export const CACHE_TAGS = {
  home: 'home',
  listings: 'listings',
  listingCategories: 'listing-categories',
  jobs: 'jobs',
  pricing: 'pricing',
  settings: 'settings',
  emergency: 'emergency',
  coupons: 'coupons',
  listing: (id: string) => `listing:${id}`,  // Per-listing tag
}

// When admin approves a listing:
export function revalidatePublicListingCollections() {
  revalidateTag(CACHE_TAGS.home, 'max')
  revalidateTag(CACHE_TAGS.listings, 'max')
  revalidateTag(CACHE_TAGS.listingCategories, 'max')
}
```

**Flow:** Admin clicks "Approve" → Server Action runs → `revalidateTag('listings')` → Next request gets fresh data from database.

---

## 8. Server Actions — Handling Form Submissions

Server Actions are functions that run on the server but are called from the browser. They replace traditional API endpoints for form handling.

### How They Work

```tsx
// src/app/actions/admin.ts
'use server'  // This ENTIRE file runs on the server

export async function approveContent(formData: FormData) {
  // 1. Auth check
  const supabase = await createClient()
  await requireAdmin(supabase)

  // 2. Read form data
  const table = formData.get('table') as string
  const id = formData.get('id') as string

  // 3. Update database
  await supabase.from(table).update({ approved: true }).eq('id', id)

  // 4. Clear cache
  revalidatePublicListingCollections()

  // 5. Refresh the page
  revalidatePath('/admin')
}
```

**In the UI (client component or form):**

```tsx
<form action={approveContent}>
  <input type="hidden" name="table" value="listings" />
  <input type="hidden" name="id" value={listing.id} />
  <button type="submit">Approve</button>
</form>
```

**Android equivalent:**
- Server Actions = `Retrofit @POST` endpoint + `ViewModel` function combined
- `FormData` = like a `Bundle` or `RequestBody` — key-value pairs
- The form `action` attribute = like setting an `onClick` that posts to your API
- But there's no separate backend server — the function runs right in Next.js

### The Server Action Flow

```
Browser: User clicks "Approve"
    │
    ▼ (HTTP POST with FormData)
Server: approveContent() runs
    ├── Checks auth (is user admin?)
    ├── Updates database (Supabase)
    ├── Clears cache (revalidateTag)
    ├── Sends notification (fire-and-forget)
    └── Returns response
    │
    ▼
Browser: Page refreshes with new data
```

---

## 9. Authentication — Supabase Auth

### How Login Works

1. User clicks "Sign in with Google"
2. Browser redirects to Google's OAuth page
3. Google redirects back to `/auth/callback` with a code
4. Supabase exchanges the code for a session token
5. Session is stored in cookies (not localStorage — works across subdomains)

### Four Supabase Clients

OurDahanu has four different Supabase clients for different contexts:

| Client | File | Use Case | Auth |
|---|---|---|---|
| **Server** | `lib/supabase/server.ts` | Server Components & Actions | User's session (from cookies) |
| **Admin** | `lib/supabase/admin-client.ts` | Bypassing RLS (admin ops) | Service role key (full access) |
| **Browser** | `lib/supabase/client.ts` | Client Components | User's session (from cookies) |
| **Public** | `lib/supabase/public.ts` | Read-only cached queries | Anonymous (no user context) |

**Android equivalent:**
- Server client = Retrofit with user's auth token in header
- Admin client = Retrofit with admin API key (like Firebase Admin SDK)
- Browser client = Retrofit running on the device
- Public client = Retrofit with no auth (public endpoints only)

### Cookie-Based Sessions

Unlike Android where you store tokens in `SharedPreferences` or `EncryptedSharedPreferences`, web auth uses **cookies**:

```tsx
// src/lib/supabase/server.ts
cookies: {
  getAll() {
    return cookieStore.getAll()  // Read session from request cookies
  },
  setAll(cookiesToSet) {
    for (const { name, value, options } of cookiesToSet) {
      cookieStore.set(name, value, {
        ...options,
        domain: '.ourdahanu.in',  // Shared across all subdomains
      })
    }
  },
}
```

The `.ourdahanu.in` domain means: if you log in on `ourdahanu.in`, you're also logged in on `nisargfarm.ourdahanu.in`. This is like Android's `AccountManager` sharing credentials across apps.

---

## 10. Database — Supabase (PostgreSQL)

### What is Supabase?

Think of Supabase as **Firebase but with PostgreSQL** instead of Firestore. You get:
- A real SQL database (not NoSQL)
- Authentication (Google, email, etc.)
- File storage (images, documents)
- Real-time subscriptions
- Row Level Security (RLS) — database-level access control

### Row Level Security (RLS)

RLS is like Android's `ContentProvider` permissions but enforced at the database level.

```sql
-- Anyone can read approved listings (no auth needed)
CREATE POLICY "public_read" ON listings
  FOR SELECT USING (approved = true);

-- Only the owner can update their listing
CREATE POLICY "owner_update" ON listings
  FOR UPDATE USING (owner_id = auth.uid());

-- Only admins can delete
CREATE POLICY "admin_delete" ON listings
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );
```

**Key insight:** Even if someone hacks the browser JavaScript, they can't read unapproved listings or delete other people's data — the database itself enforces the rules.

### Main Tables (inferred from code)

| Table | Purpose |
|---|---|
| `listings` | Business listings (name, category, phone, address, UPI, subdomain, images) |
| `profiles` | User profiles (linked to auth, role, verified status) |
| `events` | Community events |
| `jobs` | Job postings |
| `classifieds` | Classified ads |
| `forum_threads` | Forum discussions |
| `news_articles` | News (uses `published` instead of `approved`) |
| `emergency_alerts` | Emergency notifications |
| `orders` | Product/service orders |
| `reviews` | Listing reviews and ratings |
| `pricing_config` | Listing/job pricing (base price, current price) |
| `coupons` | Discount coupons |
| `site_settings` | Key-value admin settings (e.g., featured listing) |
| `newsletter_subscriptions` | Email subscribers |

### Querying Data

```tsx
// Simple read
const { data, error } = await supabase
  .from('listings')
  .select('id, name, category, phone, address')
  .eq('approved', true)
  .order('created_at', { ascending: false })
  .limit(10)

// Insert
const { error } = await supabase.from('listings').insert({
  name: 'My Shop',
  category: 'Restaurants',
  owner_id: user.id,
})

// Update
const { error } = await supabase
  .from('listings')
  .update({ approved: true })
  .eq('id', listingId)

// Delete
const { error } = await supabase
  .from('listings')
  .delete()
  .eq('id', listingId)
```

**Android equivalent:** Think of Supabase SDK as Room DAO methods, but they make HTTP requests to a remote PostgreSQL database instead of querying local SQLite.

---

## 11. Subdomain System — Multi-Tenant Routing

One of OurDahanu's unique features: every business gets its own subdomain.

```
ourdahanu.in              → Homepage
nisargfarm.ourdahanu.in   → Nisarg Farm's listing page
dahanubeach.ourdahanu.in  → Dahanu Beach Hotel's listing page
```

### How It Works

**File:** `src/proxy.ts` (Next.js Middleware)

```
Browser requests nisargfarm.ourdahanu.in
    │
    ▼
Middleware (proxy.ts) runs BEFORE the page loads
    ├── Extract "nisargfarm" from Host header
    ├── Check it's not reserved (www, admin, api, etc.)
    ├── Rewrite URL: / → /listings/nisargfarm (internally)
    ├── Set header: x-subdomain = nisargfarm
    └── Set cookie domain: .ourdahanu.in (shared auth)
    │
    ▼
Next.js renders /listings/nisargfarm (but URL still shows nisargfarm.ourdahanu.in)
```

**Android equivalent:** This is like having a custom `Intent` filter where `nisargfarm.ourdahanu.in` deep-links directly to the listing detail Activity.

### URL Generation

```tsx
// src/lib/listing-url.ts
export function getCanonicalListingUrl(id: string, subdomain: string | null): string {
  if (subdomain) return `https://${subdomain}.ourdahanu.in`
  return `https://ourdahanu.in/listings/${id}`
}
```

Listings with a subdomain get a clean URL. Listings without one use the UUID path.

---

## 12. Payments — Razorpay Integration

### Payment Flow (Listing Submission)

```
1. User fills listing form
2. Clicks "Submit & Pay"
3. Browser calls API: POST /api/razorpay/create-listing-order
   → Server creates Razorpay order (amount in paise)
   → Returns orderId + amount

4. Browser opens Razorpay checkout modal (SDK loads dynamically)
5. User pays via UPI/card/netbanking
6. Razorpay returns: paymentId + signature

7. Browser calls Server Action: submitPaidListing(formData)
   → Server verifies HMAC signature: SHA256(orderId|paymentId) === signature
   → If valid: insert listing into database
   → Clear cache, redirect to success page
```

### HMAC Signature Verification

This prevents someone from faking a payment:

```tsx
// src/app/actions/listings.ts
import { createHmac } from 'crypto'

const expectedSignature = createHmac('sha256', RAZORPAY_KEY_SECRET)
  .update(`${orderId}|${paymentId}`)
  .digest('hex')

if (expectedSignature !== providedSignature) {
  return { error: 'Payment verification failed' }
}
```

**Android equivalent:** This is like verifying a Google Play purchase token on your backend — you never trust the client's claim that payment succeeded.

### Coupon System

- Coupons are stored in the `coupons` table
- When a coupon makes the price 0 (free), Razorpay is skipped entirely
- Special values `paymentId: 'free'` signal a coupon-based free submission

---

## 13. Notifications — Email, Telegram, WhatsApp

OurDahanu sends notifications through three channels:

### Email (Resend API)

```tsx
// Pattern used everywhere
const { Resend } = await import('resend')
const resend = new Resend(process.env.RESEND_API_KEY)

await resend.emails.send({
  from: 'OurDahanu <hello@ourdahanu.in>',
  to: userEmail,
  subject: 'Your listing is live!',
  html: `<html>...</html>`,  // Inline HTML template
})
```

Used for: approval notifications, expiry reminders, admin alerts, newsletter welcome.

### Telegram Bot API

```tsx
// src/lib/notify-admin.ts
await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    chat_id: TELEGRAM_CHAT_ID,
    text: '🏪 *New Listing Submitted*\n📌 Nisarg Farm',
    parse_mode: 'Markdown',
  }),
})
```

Used for: real-time admin alerts when new content is submitted.

### WhatsApp Cloud API (Meta)

```tsx
// src/lib/whatsapp.ts
// Uses pre-approved MESSAGE TEMPLATES (Meta requirement)
await fetch(`https://graph.facebook.com/v19.0/${phoneNumberId}/messages`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${token}` },
  body: JSON.stringify({
    messaging_product: 'whatsapp',
    to: '91XXXXXXXXXX',
    type: 'template',
    template: {
      name: 'listing_approved_notice',
      language: { code: 'en' },
      components: [{
        type: 'body',
        parameters: [
          { type: 'text', text: 'Nisarg Farm' },
          { type: 'text', text: 'https://nisargfarm.ourdahanu.in' },
        ],
      }],
    },
  }),
})
```

Used for: listing approval and expiry reminders to business owners.

### Fire-and-Forget Pattern

All notifications are non-blocking — they never slow down the main operation:

```tsx
// The void keyword + .catch() means: "send it, don't wait, don't crash if it fails"
void notifyAdmin('listing', listingName).catch(err =>
  console.error('[notify]', err)
)
```

**Android equivalent:** Like launching a `WorkManager` one-time task — you don't wait for it to complete before showing the UI response.

---

## 14. Styling — Tailwind CSS & Design Tokens

### What is Tailwind CSS?

Instead of writing CSS files, you add utility classes directly in JSX:

```tsx
// Traditional CSS approach
<div className="card">...</div>
// .card { padding: 16px; background: white; border-radius: 8px; }

// Tailwind approach (no separate CSS file needed)
<div className="p-4 bg-white rounded-lg">...</div>
```

**Android equivalent:** It's like using `android:padding="16dp"` directly in XML instead of defining styles in `styles.xml`.

### OurDahanu's Design Tokens

The site uses a custom **Warli art** inspired color palette (from `src/app/globals.css`):

```css
@theme {
  /* Warli terracotta palette — inspired by tribal art of Dahanu */
  --color-warli-terra: #C4663A;   /* Primary terracotta */
  --color-warli-deep: #8B3A1A;    /* Deep brown */
  --color-warli-clay: #D4784A;    /* Light clay */
  --color-warli-cream: #FBF0DC;   /* Cream background */
  --color-warli-sand: #E8C99A;    /* Sand accent */

  /* Chikoo (sapodilla fruit) palette — Dahanu is famous for chikoo */
  --color-chikoo-bark: #3D1A08;   /* Darkest brown (text) */
  --color-chikoo-brown: #7A4A25;  /* Medium brown */
  --color-chikoo-leaf: #4A7040;   /* Leaf green */
  --color-chikoo-gold: #D4952A;   /* Gold accent */
}
```

Usage in components:
```tsx
<div className="bg-warli-cream text-chikoo-bark">
  <h1 className="text-warli-terra font-bold">Welcome to Dahanu</h1>
</div>
```

### Custom Utilities

```css
.warli-pattern { /* SVG geometric pattern overlay — Warli tribal art motif */ }
.warli-divider { /* Decorative triangle + dot strip between sections */ }
.listing-card:hover { transform: translateY(-3px); /* Card lift on hover */ }
.shadow-warm { /* Warm terracotta-tinted shadow */ }
```

### Font

The site uses **Plus Jakarta Sans** — a modern geometric sans-serif font loaded via Next.js `next/font/google` (automatic optimization, no layout shift).

---

## 15. SEO — Metadata, Sitemaps, Structured Data

### Dynamic Metadata

Each page exports metadata for search engines:

```tsx
// src/app/listings/[id]/page.tsx
export async function generateMetadata({ params }) {
  const listing = await fetchListing(params.id)
  return {
    title: `${listing.name} — OurDahanu`,
    description: listing.description,
    openGraph: {
      title: listing.name,
      images: [listing.image_url],
    },
  }
}
```

**Android equivalent:** Like setting `<meta-data>` in `AndroidManifest.xml`, but dynamic per page.

### Sitemap Generation

```tsx
// src/app/sitemap.ts — automatically generates /sitemap.xml
export default async function sitemap() {
  const listings = await fetchAllListings()
  return listings.map(listing => ({
    url: `https://ourdahanu.in/listings/${listing.id}`,
    lastModified: listing.updated_at,
  }))
}
```

### JSON-LD Structured Data

Structured data tells Google what your page content means:

```tsx
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "LocalBusiness",
  "name": "Nisarg Farm",
  "address": { "@type": "PostalAddress", "addressLocality": "Dahanu" },
  "telephone": "+91-XXXXXXXXXX",
  "offers": { "@type": "Offer", "price": "500", "priceCurrency": "INR" }
}
</script>
```

**Android equivalent:** Like `AppIndexing` / Firebase App Indexing — telling Google about your app's content so it appears in search results.

---

## 16. Admin Panel & Role-Based Access

### User Roles

```tsx
// src/app/actions/admin.ts
export type UserRole = 'admin' | 'moderator' | 'business_owner' | 'job_reviewer' | 'user'
```

| Role | Can do |
|---|---|
| `admin` | Everything — approve/reject/delete any content, manage settings |
| `moderator` | Approve/reject content (not delete or settings) |
| `job_reviewer` | Approve/reject job postings only |
| `business_owner` | Manage their own listings |
| `user` | Browse, submit content for review |

### Role Check Pattern

```tsx
// Requires admin — redirects to home if not
export async function requireAdmin(supabase) {
  const { user, role } = await getUserRole(supabase)
  if (!user) redirect('/login')
  if (role !== 'admin') redirect('/')
  return user
}

// Requires admin OR moderator
export async function requireAdminOrMod(supabase) {
  const { user, role } = await getUserRole(supabase)
  if (!user) redirect('/login')
  if (role !== 'admin' && role !== 'moderator') redirect('/')
  return { user, role }
}
```

### Admin Layout

The admin section has its own sidebar navigation:

```tsx
// src/app/admin/layout.tsx
const ADMIN_LINKS = [
  { href: '/admin/featured', label: 'Featured', icon: <Sparkles /> },
  { href: '/admin/listings', label: 'Listings', icon: <Store /> },
  { href: '/admin/events', label: 'Events', icon: <Calendar /> },
  { href: '/admin/jobs', label: 'Jobs', icon: <Briefcase /> },
  // ...
]
```

---

## 17. Deployment — Vercel

### How Deployment Works

```
Developer pushes to GitHub
    │
    ▼
Vercel detects the push (Git integration)
    │
    ▼
Vercel runs: npm install → next build
    │
    ▼
Build output deployed to Vercel's edge network
    ├── Server Components → Serverless Functions
    ├── Client Components → CDN (static JS bundles)
    ├── Static pages → CDN (HTML)
    └── API routes → Serverless Functions
    │
    ▼
Live at ourdahanu.in (+ all *.ourdahanu.in subdomains)
```

### Vercel Configuration

```json
// vercel.json
{
  "framework": "nextjs",
  "buildCommand": "npm run build",
  "crons": [{
    "path": "/api/cron/listing-expiry",
    "schedule": "0 0 * * 1"
  }]
}
```

### Cron Jobs

The listing expiry cron runs every Monday at midnight UTC (5:30 AM IST):
1. Finds listings past their `expires_at` date → unpublishes them
2. Sends email + WhatsApp reminders at 30/15/5/3/1 day milestones
3. Tracks which reminders were already sent via `reminders_sent` array

**Android equivalent:** Like a `PeriodicWorkRequest` with `WorkManager`, but it runs on Vercel's infrastructure instead of the device.

---

## 18. Environment Variables

Environment variables are secrets and configuration that change between development and production.

| Variable | Purpose | Where Used |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL | Everywhere (public) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anonymous key | Browser + server (public) |
| `SUPABASE_SERVICE_ROLE_KEY` | Full database access (SECRET) | Server only — admin client |
| `RAZORPAY_KEY_ID` | Razorpay merchant ID | Payment routes |
| `RAZORPAY_KEY_SECRET` | Razorpay secret (SECRET) | Signature verification |
| `RESEND_API_KEY` | Email sending (SECRET) | Notification functions |
| `ADMIN_EMAIL` | Admin email address | Admin notifications |
| `TELEGRAM_BOT_TOKEN` | Telegram bot (SECRET) | Admin alerts |
| `TELEGRAM_CHAT_ID` | Telegram group chat | Admin alerts |
| `WHATSAPP_ACCESS_TOKEN` | Meta WhatsApp API (SECRET) | WhatsApp notifications |
| `WHATSAPP_PHONE_NUMBER_ID` | WhatsApp phone number | WhatsApp notifications |
| `CRON_SECRET` | Cron job auth token | Cron route protection |

**`NEXT_PUBLIC_` prefix:** Variables starting with `NEXT_PUBLIC_` are safe to expose to the browser. All others are server-only secrets.

**Android equivalent:**
- `NEXT_PUBLIC_*` = values in `BuildConfig` (accessible in app)
- Server-only = values that only your backend knows (never in the APK)

---

## 19. Key Architectural Patterns

### Pattern 1: Server Component → Database → Render

```
URL Request → Server Component → Supabase Query → JSX → HTML → Browser
```

Most pages follow this pattern. No loading spinners needed — the page arrives with data already in the HTML.

### Pattern 2: Client Form → Server Action → Revalidate

```
User fills form → Submit → Server Action validates & writes to DB → revalidateTag() → Page refreshes
```

All mutations (create, update, delete) go through Server Actions.

### Pattern 3: Fire-and-Forget Notifications

```
Main operation completes → void notifyX().catch(console.error)
```

Notifications (email, Telegram, WhatsApp) are always non-blocking. They never slow down the user's operation or cause failures.

### Pattern 4: Cache Tag Graph

```
Admin approves listing
  → revalidatePublicListingCollections()
    → invalidates: home, listings, listing-categories tags
      → All pages using those tags will refetch on next request
```

Cache tags create a dependency graph. Changing one piece of data automatically refreshes all pages that display it.

### Pattern 5: Progressive Enhancement

```
Server renders full HTML (works without JavaScript)
  → Browser loads JavaScript (enables interactions)
    → Client Components hydrate (React takes over)
```

The site works even if JavaScript fails to load — forms submit via HTML, links navigate normally.

---

## Quick Reference: "How Do I..."

| Task | Look At |
|---|---|
| Add a new page | Create `src/app/your-page/page.tsx` |
| Add a new API endpoint | Create `src/app/api/your-endpoint/route.ts` |
| Query the database | Use Supabase client from `src/lib/supabase/` |
| Add a form that writes to DB | Create a Server Action in `src/app/actions/` |
| Add a reusable UI component | Create in `src/components/` |
| Add a new admin section | Create in `src/app/admin/your-section/` + add to layout |
| Add a new cache-aware data fetcher | Create in `src/lib/data/` with `'use cache'` + tags |
| Send a notification | Use patterns from `src/lib/notify-admin.ts` |
| Add a new database table | Add a new file in `supabase/migrations/` and apply it (SQL Editor or `npx supabase db push`) |
| Add new colors/design tokens | Add to `@theme` in `src/app/globals.css` |
| Protect a page (auth required) | Use `requireAdmin()` or check `getUserRole()` |
| Accept payments | Follow Razorpay pattern in `src/app/api/razorpay/` |

---

*Built with Next.js 16, React 19, Supabase, Tailwind CSS 4, and deployed on Vercel.*
*Architecture documented April 2026.*
