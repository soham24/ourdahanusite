# Setup Guide

This runs OurDahanu, a local platform for the town of Dahanu in Maharashtra.
It is built so the same code can serve another town — OurPune, OurMumbai,
OurAnywhere. This guide takes you from a clone to a working site.

Work through it in order. Steps 1–6 get the site running, step 7 makes it your
town, and step 8 replaces the parts that are about Dahanu rather than about
the software.

**You need:** Node.js 24 (the version production runs; see `.nvmrc`), a free Supabase account, and a Google
account. Razorpay, Resend, Telegram and WhatsApp are all optional — leave them
until the site is up.

---

## Step 0: Clone and install

```bash
git clone https://github.com/soham24/ourdahanusite.git ourpune
cd ourpune
npm install
cp .env.local.example .env.local
```

Leave `.env.local` alone for now; step 4 fills it in.

## Step 1: Create Supabase Project

1. Go to https://supabase.com and create a free account
2. Click "New Project" → name it `ourdahanu`
3. Save your **Database Password**

## Step 2: Set Up Database

The schema lives in `supabase/migrations/`, one file per change, applied in
filename order. Pick either way:

**In the dashboard (no tools needed)**

1. In Supabase Dashboard → go to **SQL Editor**
2. Open each file in `supabase/migrations/` **in filename order** — start with
   `…_baseline.sql` — paste it in and run it
3. Optional: run `supabase/seed.sql` too, for a made-up town with sample
   businesses, events and tradespeople, so the pages are not empty

**With the Supabase CLI**

```bash
npx supabase init          # once; creates supabase/config.toml
npx supabase link --project-ref YOUR_PROJECT_ID
npx supabase db push       # applies every migration not yet applied
```

For a throwaway local database instead (needs Docker): `npx supabase start`,
then `npx supabase db reset` replays the migrations and loads `seed.sql`.

Either way this creates every table, the row level security policies, the
`uploads` storage bucket and the trigger that creates a profile on sign-up.
Do not run anything from `supabase/legacy/` — those are the old hand-applied
files, kept as history only.

## Step 3: Enable Google Login

1. In Supabase Dashboard → **Authentication** → **Providers**
2. Enable **Google**
3. Go to [Google Cloud Console](https://console.cloud.google.com)
4. Create a new project → APIs & Services → Credentials → OAuth 2.0 Client ID
5. Application type: **Web application**
6. Add Authorized redirect URI:
   - `https://YOUR_SUPABASE_PROJECT_ID.supabase.co/auth/v1/callback`
7. Copy the **Client ID** and **Client Secret** back to Supabase

## Step 4: Set Environment Variables

Edit `.env.local`. Four values are required; everything else in
`.env.local.example` is optional and should stay **empty** until you have real
credentials for it (an optional value that is merely set switches its feature
on).

```
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_ID.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

The first three are in Supabase Dashboard → **Project Settings** → **API**.
The service-role key is not optional: admin, payment and notification writes
all use it, and without it they fail with "Server configuration error". Never
expose it to the browser.

Also set `ADMIN_EMAIL` to the Google account you will sign in with — that
account becomes the first admin.

## Step 5: Sign in locally

In Supabase → **Authentication** → **URL Configuration**, add
`http://localhost:3000/auth/callback` to **Redirect URLs**. Without it, signing
in on your machine bounces you to the Site URL instead.

Then:

```bash
npm run dev
```

Open http://localhost:3000 and sign in with the `ADMIN_EMAIL` account.

## Step 6: Deploy

1. Push the project to GitHub and import it in Vercel (**New Project**).
2. Add the same environment variables in Vercel's **Settings → Environment
   Variables**, with `NEXT_PUBLIC_SITE_URL` set to your real domain
   (`https://ourpune.in`).
3. Add your domain in Vercel → **Settings → Domains**, and also the wildcard
   `*.ourpune.in`: every business gets its own subdomain. Vercel needs to run
   the domain's DNS (its nameservers) to issue wildcard certificates.
4. In Supabase → **Authentication** → **URL Configuration**, set **Site URL** to
   `https://ourpune.in` and add `https://ourpune.in/auth/callback` to
   **Redirect URLs** (keep the localhost one for development).
5. Set `CRON_SECRET` (any long random string) in Vercel. The two jobs in
   `vercel.json` — listing expiry and the daily reminders — refuse to run
   without it.

## Step 7: Make it your town

Open **`src/lib/site-config.ts`**. This one file is what the interface reads
for its name, its town, its domain and its address.

```ts
export const siteConfig = {
  name: 'OurDahanu',                    // → 'OurPune'
  town: 'Dahanu',                       // → 'Pune'
  townLocal: 'आपले डहाणू',                // → 'आपले पुणे', or '' for none
  domain: 'ourdahanu.in',               // → 'ourpune.in'
  areas: 'Dahanu, Bordi, Gholvad and Palghar',
  region: 'Palghar, Maharashtra, India',
  contactEmail: 'you@example.com',
  tagline: 'OurDahanu is the local platform for …',
}
```

Change those, run `npm run dev`, and the site is your town's: sign-in cookies,
business subdomains, canonical URLs, robots.txt, the sitemap and the links in
emails and Telegram messages all follow `domain`.

`areas` is the places around the town, written as a phrase; much of the copy
says "Dahanu, Bordi, Gholvad and Palghar" rather than just "Dahanu".
`townLocal` is the name in your own script, shown under the logo while pages
load — `''` shows nothing, and a non-Latin script needs a font with its glyphs
(see the Devanagari subset in `src/app/layout.tsx`).

### What the config does not reach

After changing the config, list what still names the old town:

```bash
git grep -in "ourdahanu\|dahanu\|palghar" -- src/ public/ | grep -v "od-\|dahanu-loader\|OurDahanuLoader"
```

- **`src/proxy.ts`** — the `config.matcher` entries must be inline literals
  (Next.js analyses them at build time; a variable fails the build with
  "Invalid segment configuration export detected"). Replace the domain in each
  matcher regex. The rest of the file reads the config.
- **`public/manifest.json`** — the installable-app name and description, read
  by the browser before any JavaScript runs.
- **Test fixtures** assert against the literal domain; update them to yours.
- **Email sender.** Mail is sent from `hello@<domain>`. That domain must be
  verified with Resend before anything is delivered — and `deliverEmail`
  discards the provider's error, so an unverified sender fails silently.

The `--od-` CSS custom properties and the `dahanu-loader` class names are a
namespace prefix no reader ever sees; rename them only if you want to.

## Step 8: Replace what is about Dahanu, not about the software

Some of this repository is local knowledge, and no config can translate it.
Publishing it unchanged means publishing another town's facts as your own, so
go through these before you launch:

| What | Where | Why |
|---|---|---|
| Emergency contacts | `src/app/emergency/` | Real phone numbers for Dahanu's police, hospitals and fire services. **Wrong numbers in an emergency are the worst bug this site can have.** |
| Guides | `content/guides/*.md`, images in `public/guides/` | Travel, food and local know-how, written about Dahanu. |
| Contact details | `src/app/contact/page.tsx` | The maintainer's WhatsApp number and Instagram handle. |
| Team on the homepage | `src/app/page-components/HeritageSection.tsx` | Names the people behind OurDahanu. |
| Logo and verification | `public/logo.png`, `public/google*.html` | The logo, and Google Search Console's ownership file for ourdahanu.in — delete it and add your own. |
| Business categories | `src/lib/category-groups.ts` | Tuned to what Dahanu actually has; a bigger town will want more, and different. |
| Professions | `src/lib/find/` | The trades in the Find directory, which is branded "FindDahanu". |
| Area suggestions | `src/lib/jobs/options.ts` | Localities offered when posting a job. |
| Chikoo Catcher | `src/app/play/` | A chikoo is Dahanu's fruit and the game is themed on it. Rename it, re-theme it, or delete the route. |
| About page | `src/app/about/page.tsx` | The story of this project and who built it. Yours is different. |
| WhatsApp templates | `src/lib/whatsapp.ts` | The three message templates Meta must approve, with their wording. |
| Terms and privacy | `src/app/terms/`, `src/app/privacy/` | Written for one operator in one jurisdiction. **Have someone qualified read these before publishing them.** |

## Optional services

Each is off until its variables are set, and the rest of the site works
without it. `.env.local.example` has the details for each.

- **Payments (Razorpay).** Without it, listings and bookings are free only: a
  listing price of 0, or a 100% coupon. With it, also add the webhook
  (`https://<your domain>/api/razorpay/webhook`, events `payment.captured` and
  `order.paid`) so a payment is still recorded if the buyer's browser dies.
  The listing price is set on the admin pricing page.
- **Email (Resend).** Verify your domain first — see "Email sender" above.
- **WhatsApp (Meta Cloud API).** Needs the three approved templates listed in
  `src/lib/whatsapp.ts`.
- **Telegram.** Below.

## Telegram notifications (optional)

Skip this entirely if you are not using Telegram — nothing else depends on it.

1. Create a bot with [@BotFather](https://t.me/BotFather) and copy the token
   into `TELEGRAM_BOT_TOKEN`. Put the bot's @name in `TELEGRAM_BOT_USERNAME`.
2. Generate a secret and set it as `TELEGRAM_WEBHOOK_SECRET`:

   ```bash
   node -e "console.log(require('crypto').randomBytes(24).toString('base64url'))"
   ```

   **This is required, not optional.** The webhook refuses every request when
   it is unset — it fails closed on purpose, so that a deployment which forgets
   it gets a loud 500 rather than a quietly open endpoint.

3. Register the webhook once, with the secret in the URL:

   ```bash
   curl -X POST "https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/setWebhook"      -d "url=https://<your-domain>/api/telegram/webhook?secret=<TELEGRAM_WEBHOOK_SECRET>"
   ```

4. Confirm it is reachable and that the secret matches — this should return
   `{"ok":true,...}`, and a 401 without the query param:

   ```bash
   curl "https://<your-domain>/api/telegram/webhook?secret=<TELEGRAM_WEBHOOK_SECRET>"
   ```

If you ever rotate the secret, set the new value **and** re-run `setWebhook`
with it. Changing only one of the two leaves Telegram posting to a URL the app
now rejects, and account linking stops working with no error visible to users.
