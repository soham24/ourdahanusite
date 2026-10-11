# Setup Guide

This runs OurDahanu, a local platform for the town of Dahanu in Maharashtra.
It is built so the same code can serve another town — OurPune, OurMumbai,
OurAnywhere. This guide takes you from a clone to a working site.

Work through it in order. Steps 1–6 get the site running, step 7 makes it your
town, and step 8 replaces the parts that are about Dahanu rather than about
the software.

**You need:** Node.js 20 or newer, a free Supabase account, and a Google
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

Edit `.env.local` with your real values:

```
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_ID.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
NEXT_PUBLIC_SITE_URL=https://yourdomain.com
```

Find these in: Supabase Dashboard → **Settings** → **API**

## Step 5: Deploy to Vercel

1. Push this project to GitHub
2. Go to https://vercel.com → New Project → Import from GitHub
3. Add the 3 environment variables above in Vercel's settings
4. Deploy!

## Step 6: Update Supabase Auth URL

After deploying, in Supabase:
- **Authentication** → **URL Configuration**
- Set **Site URL** to your Vercel URL (e.g., `https://ourdahanu.vercel.app`)
- Add to **Redirect URLs**: `https://ourdahanu.vercel.app/auth/callback`

## Step 7: Make it your town

Open **`src/lib/site-config.ts`**. This one file is what the interface reads
for its name, its town and its address — the things the code used to have
written out across 159 separate files.

```ts
export const siteConfig = {
  name: 'OurDahanu',                    // → 'OurPune'
  town: 'Dahanu',                       // → 'Pune'
  townLocal: 'आपले डहाणू',                // → 'आपले पुणे', or '' for none
  domain: 'ourdahanu.in',               // → 'ourpune.in'
  areas: 'Dahanu, Bordi, Gholvad and Palghar',
  region: 'Palghar, Maharashtra, India',
  contactEmail: 'railkarsoham@gmail.com',
  tagline: 'OurDahanu is the local platform for …',
}
```

Change those, run `npm run dev`, and the site is your town's.

`areas` is the villages around the town, written as a phrase. A lot of the
copy says "Dahanu, Bordi, Gholvad and Palghar" rather than just "Dahanu", and
substituting only the town name into those sentences would have produced
"Pune, Bordi, Gholvad and Palghar".

`townLocal` is the name in your own script, shown under the logo while pages
load. Set it to `''` to show nothing. A non-Latin script also needs a font
with the right glyphs — see the Devanagari subset loaded in
`src/app/layout.tsx` and swap it for yours.

### What the config does not reach

Most of the interface reads `site-config.ts`, but not all of it. After
changing the config, run this and work through what it finds:

```bash
git grep -in "ourdahanu\|dahanu" -- src/ public/ | grep -v "od-\|dahanu-loader\|OurDahanuLoader"
```

The two that matter most:

**`src/proxy.ts`** — the per-business subdomain routing, and the single most
important file to get right: miss it and `yourbusiness.ourpune.in` keeps
routing against `ourdahanu.in`. Next.js requires the `config.matcher` export
to be inline literals, so a variable there fails the build with "Invalid
segment configuration export detected". There are **19 references** in that
file — the subdomain matcher regex alone appears five times, plus the
standalone-host patterns, the runtime host checks and the robots.txt output.
Replace every one.

**`public/manifest.json`** — the installable-app name and description, read
by the browser before any JavaScript runs.

Beyond those, roughly **50 references remain in ordinary code**: canonical
URL helpers, a few host checks in `src/lib/`, and the test fixtures, which
assert against the literal domain and will need updating for yours. The grep
above lists them all.

**The email sender addresses are a special case.** Four files set a Resend
`from:` address — `src/app/actions/admin.ts`,
`src/app/actions/newsletter.ts`, `src/app/api/newsletter/route.ts` and
`src/lib/notifications/channels/email.ts`. These are deliberately left as
literals, because a sender address is not a display string: it has to be a
domain you have verified with your email provider, so renaming it to match
your site is necessary but not sufficient. Verify the domain with Resend
first, then change all four. `deliverEmail` discards the provider's error
result, so a wrong sender fails silently rather than loudly.

### Deliberately left alone

The `--od-` CSS custom properties and the `dahanu-loader` class names are a
namespace prefix no reader ever sees. Rename them if you want; nothing depends
on the spelling.

## Step 8: Replace what is about Dahanu, not about the software

Some of this repository is local knowledge, and no config can translate it.
Publishing it unchanged means publishing another town's facts as your own, so
go through these before you launch:

| What | Where | Why |
|---|---|---|
| Emergency contacts | `src/app/emergency/` | Real phone numbers for Dahanu's police, hospitals and fire services. **Wrong numbers in an emergency are the worst bug this site can have.** |
| Guides | `src/app/guides/` | Travel, food and local know-how, written about Dahanu. |
| Business categories | `src/lib/category-groups.ts` | Tuned to what Dahanu actually has; a bigger town will want more, and different. |
| Professions | `src/lib/find/` | The trades listed in the FindDahanu directory. |
| Chikoo Catcher | `src/app/play/` | A chikoo is Dahanu's fruit and the game is themed on it. Rename it, re-theme it, or delete the route. |
| About page | `src/app/about/page.tsx` | The story of this project and who built it. Yours is different. |
| Homepage events | `src/app/events/fallback.ts` | Six real Dahanu events, shown when the events table is empty. A fork publishing these is publishing another town's calendar as fact. |
| Terms and privacy | `src/app/terms/`, `src/app/privacy/` | Written for one operator in one jurisdiction. **Have someone qualified read these before publishing them.** |

To find anything still naming the old town once you have edited the config:

```bash
git grep -in dahanu -- src/ public/
```

Hits inside `--od-`, `dahanu-loader` and `OurDahanuLoader` are the harmless
namespace ones.

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


## Local Development

```bash
npm run dev
```

Open http://localhost:3000

---

## Site Pages

| Page | URL | Description |
|------|-----|-------------|
| Home | `/` | Landing page with all sections |
| Shop | `/shop` | Local products marketplace |
| Events | `/events` | Dahanu events listing |
| Listings | `/listings` | Business directory with paid plans |
| About | `/about` | Info, tourism, transport, emergency contacts |
| Login | `/login` | Google sign-in |
| Dashboard | `/dashboard` | User account (protected) |

## Listing Plans (Monetization)

- **Basic** — ₹499/month
- **Featured** — ₹999/month (homepage placement)
- **Premium** — ₹1999/month (full features)
