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

**Stuck?** Run `npm run doctor` at any point. It reads `.env.local`, checks
the database, migrations, sign-in and every optional service, and says what to
fix. It changes nothing. Common problems are under
[Troubleshooting](#troubleshooting) at the end.

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

**With the Supabase CLI** (`supabase/config.toml` is already committed; the
scripts fetch a pinned CLI through npx, so nothing to install)

```bash
npm run db:link -- --project-ref YOUR_PROJECT_ID
npm run db:push            # applies every migration not yet applied
```

**Or entirely on your machine** (needs Docker; no Supabase account at all)

```bash
npm run db:start           # starts Postgres, Auth and Storage; applies migrations + seed.sql
```

It prints an API URL and keys: put `API URL` in `NEXT_PUBLIC_SUPABASE_URL`,
the anon/publishable key in `NEXT_PUBLIC_SUPABASE_ANON_KEY` and the
service-role/secret key in `SUPABASE_SERVICE_ROLE_KEY`. `npm run db:reset`
wipes it back to migrations + seed; `npm run db:stop` shuts it down. Sign-in
needs Google keys even locally; `supabase/config.toml` says where they go.

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

If anything is off, `npm run doctor` will tell you which step to revisit.

## Step 6: Deploy

The quickest way is the **Deploy with Vercel** button in the README: it copies
the repository, creates the Supabase database for you and deploys. The steps
below are the manual way, and what to finish after the button.

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
  localities: ['Dahanu Road', 'Bordi', 'Gholvad', …],
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
`localities` is the same surroundings as a list: the area suggestions on the
jobs board, `areaServed` in search results, and the locality guessed from a
business's address. The professionals directory takes its name from `town`
("FindDahanu" → "FindPune"), and the governing-law line in the terms from
`region`.
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
| Professions | `src/lib/find/` | The trades in the Find directory. |
| Chikoo Catcher | `src/app/play/` | A chikoo is Dahanu's fruit and the game is themed on it. Rename it, re-theme it, or delete the route. |
| About page | `src/app/about/page.tsx` | The story of this project and who built it. Yours is different. |
| WhatsApp template | `docs/EMAIL-AND-NOTIFICATIONS.md` | The wording of the one template Meta must approve names the site. |
| Terms and privacy | `src/app/terms/`, `src/app/privacy/` | Written for one operator in one jurisdiction. **Have someone qualified read these before publishing them.** |

## Hosting without Vercel

The repository also builds into a plain Node server in a Docker image, for a
VPS, Render, Fly.io, Railway or anywhere else that runs containers.

```bash
docker compose --env-file .env.local up --build -d
```

That builds the `Dockerfile` with your `.env.local` and serves the site on
port 3000; put it behind a reverse proxy (Caddy, nginx, your platform's own)
that terminates HTTPS. Without Docker, the same thing is
`NEXT_OUTPUT=standalone npm run build`, then copy `public/` and `.next/static/`
into `.next/standalone/` and run `node .next/standalone/server.js`.

Three things Vercel was doing for you:

- **`NEXT_PUBLIC_*` values are baked in at build time.** Change one and
  rebuild the image; every other variable is read at runtime.
- **Scheduled jobs.** Add the repository variable `CRON_SITE_URL` (your site's
  address) and the secret `CRON_SECRET` in GitHub → Settings → Secrets and
  variables → Actions, and `.github/workflows/cron.yml` calls the jobs on the
  schedule in `vercel.json`. Any other scheduler works too: it only needs to
  send `GET /api/cron/listing-expiry` weekly and `GET /api/cron/job-reminders`
  daily with the header `Authorization: Bearer <CRON_SECRET>`.
- **Business subdomains.** Point both `yourtown.in` and `*.yourtown.in` at the
  server, and get a wildcard certificate (Caddy and certbot both can, via a DNS
  challenge).

## Optional services

Each is off until its variables are set, and the rest of the site works
without it. `.env.local.example` has the details for each.

- **Payments (Razorpay).** Without it, listings and bookings are free only: a
  listing price of 0, or a 100% coupon. With it, also add the webhook
  (`https://<your domain>/api/razorpay/webhook`, events `payment.captured` and
  `order.paid`) so a payment is still recorded if the buyer's browser dies.
  The listing price is set on the admin pricing page.
- **Email, Telegram and WhatsApp.** What each sends, to whom, and how to set
  up Resend, a Telegram bot and Meta's WhatsApp API is in
  **[docs/EMAIL-AND-NOTIFICATIONS.md](docs/EMAIL-AND-NOTIFICATIONS.md)**. With
  none of them configured, notifications still appear in the app.

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

## Troubleshooting

Run `npm run doctor` first — it catches most of these. To check the deployed
site's settings rather than your local ones, pull them with
`vercel env pull .env.local` and run it again.

**Signing in sends me back to the homepage, or to the live site, without
logging me in.**
The address you are on is missing from Supabase → Authentication → URL
Configuration → **Redirect URLs**. Add `<that address>/auth/callback` —
`http://localhost:3000/auth/callback` locally, `https://<your domain>/auth/callback`
in production (steps 5 and 6).

**"Unsupported provider" or the Google button does nothing.**
Google is not switched on in Supabase → Authentication → Providers, or its
Client ID/Secret are wrong (step 3).

**I signed in but have no admin panel.**
`ADMIN_EMAIL` must match the Google account's address exactly (same case), and
must be set where the site runs — in Vercel too, followed by a redeploy. Admin
emails and alerts go to profiles whose role is `admin`, so also mark yourself
in the SQL editor:
`update profiles set role = 'admin' where email = 'you@example.com';`

**"relation … does not exist", or pages error on an empty database.**
The migrations have not been run, or not all of them. Run every file in
`supabase/migrations/` in filename order (step 2). The doctor reports which
ones are missing.

**"Server configuration error" when booking, ordering or saving settings.**
`SUPABASE_SERVICE_ROLE_KEY` is not set where the site runs — add it in Vercel
too, then redeploy. Environment variable changes only reach new deployments.

**Business subdomains (`shop.yourtown.in`) do not load, or show a
certificate warning.**
Add the wildcard `*.yourtown.in` in Vercel → Domains, and let Vercel run the
domain's DNS (point the nameservers at Vercel). Wildcard certificates need it.
On a `*.vercel.app` address subdomains cannot work; listings still open at
`/listings/<id>`.

**Listings never expire / no appointment reminders.**
`CRON_SECRET` is missing in Vercel, so the scheduled jobs refuse to run. Set it
and redeploy; Vercel → Settings → Cron Jobs shows each run.

**Emails do not arrive.**
Usually the sending domain is not verified in Resend. Resend → **Logs** shows
each attempt and why it failed. See
[docs/EMAIL-AND-NOTIFICATIONS.md](docs/EMAIL-AND-NOTIFICATIONS.md).

**"Connect Telegram" opens the bot, but the account never links.**
The webhook is not registered, or was registered with a different
`TELEGRAM_WEBHOOK_SECRET` than the site has. Re-run `setWebhook` (above).

**Payments succeed but the order stays unpaid.**
The Razorpay webhook is missing, or `RAZORPAY_WEBHOOK_SECRET` does not match
the secret entered in Razorpay's dashboard (Optional services, above).

**Images fail to upload.**
The `uploads` storage bucket is missing — it is created by the baseline
migration, so re-check step 2.

**The site still says Dahanu.**
Step 7: `src/lib/site-config.ts`, and step 8 for content outside it.
