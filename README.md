# OurDahanu

A local platform for one town: a business directory where every business gets
its own subdomain, plus a jobs board, a professionals directory, appointment
booking, and online ordering paid straight into each business's own account.

Running at **[ourdahanu.in](https://ourdahanu.in)** for Dahanu, Maharashtra —
65 businesses, around 500 residents signed up.

**It is built to be re-pointed at your town.** The name, the place and the
domain live in one file. Change them and you have OurPune, OurNashik,
OurWherever.

---

## Start here

New to this repository? Read these three, in order:

1. **This file** — what it is, how to run it, what each piece does.
2. **[SETUP.md](SETUP.md)** — the step-by-step: clone → Supabase → your town →
   deployed.
3. **[ARCHITECTURE.md](ARCHITECTURE.md)** — how it fits together, once you want
   to change something.

## Deploy it in one click

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fsoham24%2Fourdahanusite&project-name=our-town&repository-name=our-town&integration-ids=oac_VqOgBHqhEoFTPzGkPd7L0iH6&env=NEXT_PUBLIC_SITE_URL%2CADMIN_EMAIL%2CCRON_SECRET&envDescription=Your%20site%20address%20%28use%20https%3A%2F%2F%3Cproject%3E.vercel.app%20until%20you%20add%20a%20domain%29%2C%20the%20Google%20email%20that%20becomes%20the%20first%20admin%2C%20and%20any%20long%20random%20string%20for%20the%20scheduled%20jobs.&envLink=https%3A%2F%2Fgithub.com%2Fsoham24%2Fourdahanusite%2Fblob%2Fmain%2FSETUP.md%23step-4-set-environment-variables)

The button copies this repository to your GitHub account, creates a Supabase
database through Vercel's Supabase integration (which fills in the database
keys), asks for three values — your site address, the Google email that
becomes admin, and a random string for the scheduled jobs — and deploys.

Then, to finish:

1. **Make sure the database has its tables.** If the Supabase project is
   empty, run the files in `supabase/migrations/` in its SQL editor in
   filename order (SETUP.md step 2).
2. **Turn on Google sign-in** in Supabase and add your site's
   `/auth/callback` to its redirect URLs (SETUP.md steps 3 and 6).
3. **Make it your town** — edit `src/lib/site-config.ts` in your copy, run
   `npm run sync:proxy`, and push (SETUP.md step 7).
4. **Check everything:** clone your copy, `vercel env pull .env.local`, then
   `npm run doctor` — it lists anything still missing, with the fix.

Not on Vercel? `docker compose --env-file .env.local up --build -d` runs it
anywhere Docker does; [SETUP.md](SETUP.md#hosting-without-vercel) covers the
scheduled jobs and subdomains that Vercel would otherwise handle.

## Try it in five minutes

You need **Node.js 24** (`.nvmrc` has it; `nvm use` picks it up) and
**Docker**. No accounts at all: no Supabase, no Google, no payment or email
provider.

```bash
git clone https://github.com/soham24/ourdahanusite.git ourpune
cd ourpune
npm install
npm run setup     # local database with sample data; writes .env.local
npm run dev
```

Open <http://localhost:3000>: the homepage, with sample businesses, events and
tradespeople. To sign in, go to `/login`, enter `admin@example.com` under
"Local development only", and click the link that arrives in the local inbox
at <http://127.0.0.1:54324>. That account is the admin.

**If you got that far, everything else is optional.**

No Docker? Create a free Supabase project instead, run the files in
`supabase/migrations/` in its SQL editor in filename order (then
`supabase/seed.sql` for sample data), and put its URL, anon key and
service-role key in `.env.local` (copied from `.env.local.example`).
Signing in there needs Google set up: [SETUP.md](SETUP.md) steps 1–5.

At any point, `npm run doctor` checks your setup — database, migrations,
sign-in, and each optional service — and says what to fix.

Sign-in, payments, email and notifications each need their own account, and
each is independently skippable — [SETUP.md](SETUP.md) takes them one at a
time. Nothing breaks while they are unconfigured; those features just stay
switched off.

## Make it your city

Open **[`src/lib/site-config.ts`](src/lib/site-config.ts)**. This is the file
that makes the difference between OurDahanu and OurPune:

```ts
export const siteConfig = {
  name: 'OurDahanu',                    // -> 'OurPune'
  town: 'Dahanu',                       // -> 'Pune'
  townLocal: 'आपले डहाणू',                // -> 'आपले पुणे', or '' for none
  domain: 'ourdahanu.in',               // -> 'ourpune.in'
  areas: 'Dahanu, Bordi, Gholvad and Palghar',
  localities: ['Dahanu Road', 'Bordi', ...], // nearby places, as a list
  region: 'Palghar, Maharashtra, India',
  contactEmail: 'you@example.com',
  tagline: 'OurDahanu is the local platform for ...',
}
```

Change those, reload, and the site is your city's — page titles, navigation,
emails, structured data and page copy all read from here.

One file cannot read it: **`src/proxy.ts`**, the per-business subdomain
routing, because Next.js requires its matchers to be inline literals. After
changing `domain`, run `npm run sync:proxy` and it rewrites them for you;
`npm test` (and so CI) fails if you forget.

### Then replace what is *about* Dahanu

Some of this repository is local knowledge, and no config translates it: the
emergency phone numbers, the guides, the business categories, the homepage
events, and Chikoo Catcher (a chikoo is Dahanu's fruit, and the game is themed
on it). Publishing those unchanged means publishing another town's facts as
your own.

**[SETUP.md step 8](SETUP.md)** lists every one, with the file and why it
matters. Do the emergency contacts first — wrong numbers there are the worst
bug this site can have.

## Environment variables

Put these in `.env.local` for development, and in your host's project settings
for production. `.env.local.example` has the full list with comments.

**The three you need to run anything**

| Var | Purpose |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key — public by design; row level security is the boundary |
| `SUPABASE_SERVICE_ROLE_KEY` | Service-role key for privileged server writes. **Never expose this to a browser.** |

**For a real deployment**

| Var | Purpose |
|---|---|
| `NEXT_PUBLIC_SITE_URL` | This deployment's own origin — `http://localhost:3000` locally, your domain in production |
| `LISTING_PAYMENT_ENCRYPTION_KEY` | AES-256-GCM key encrypting each business's payment secret at rest. Generate: `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"` |

**To take payments** — skip until you have a Razorpay account

| Var | Purpose |
|---|---|
| `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` | Order creation and signature verification |
| `RAZORPAY_WEBHOOK_SECRET` | Safety net so a captured payment is never lost |

**Everything else is optional**

| Var | Purpose |
|---|---|
| `RESEND_API_KEY` | Notification and newsletter email (needs a domain verified in Resend) |
| `TELEGRAM_BOT_TOKEN` / `TELEGRAM_BOT_USERNAME` | Telegram notifications for people who link their account (`TELEGRAM_USER_BOT_TOKEN` is an older name for the token; leave it empty) |
| `TELEGRAM_WEBHOOK_SECRET` | **Required if you use Telegram at all** — the webhook fails closed without it |
| `WHATSAPP_ACCESS_TOKEN` / `WHATSAPP_PHONE_NUMBER_ID` | WhatsApp notifications (one Meta-approved template) |
| `CRON_SECRET` | Authorizes `/api/cron/*`; sent by the host's scheduler as a bearer token |
| `ADMIN_EMAIL` | Bootstraps the first admin account on sign-in |
| `NEXT_PUBLIC_GA_ID` / `NEXT_PUBLIC_ADSENSE_CLIENT_ID` | Analytics and ads |
| `ISR_DEBUG` | Verbose cache logging |

What each notification provider sends, to whom, and how to set it up:
**[docs/EMAIL-AND-NOTIFICATIONS.md](docs/EMAIL-AND-NOTIFICATIONS.md)**.

## Scripts

```bash
npm run dev       # dev server (Turbopack)
npm run build     # production build — run this before you push
npm test          # unit, game and security suites
npm run lint      # eslint
npx tsc --noEmit  # types
npm run doctor    # checks your .env.local, database and services; changes nothing
```

`npm run build` also runs a check that fails if a server action leaks a
credential into client-reachable code. If it complains, it has found something
real.

## How it is put together

**Next.js 16** (App Router, Cache Components) · **React 19** · **Tailwind v4**
· **Supabase** (Postgres, Auth, Storage, RLS) · **Razorpay** · **Vercel**

> ⚠️ This is Next.js 16, with breaking changes from the versions you may know —
> see [AGENTS.md](AGENTS.md). The one that catches everyone: `export const
> dynamic` is **not** allowed, because it is incompatible with
> `cacheComponents`.

```
src/
  app/
    page.tsx, page-components/    # homepage and its sections
    listings/                     # the directory and each business page
    find/ jobs/ appointments/     # standalone products, each on its own subdomain
    guides/ events/ polls/ play/  # community content and the game
    emergency/                    # local emergency contacts
    checkout/ p/ s/               # buying an item; shared item and legacy links
    my-business/ dashboard/ account/ profile/
    admin/                        # admin and moderation, gated in its layout
    actions/                      # server actions
    api/                          # razorpay/ cron/ telegram/ newsletter/
  components/ ui/                 # shared components and design primitives
  lib/
    site-config.ts                # <- the town's identity
    supabase/                     # server, browser and admin clients
    data/                         # cached read fetchers
    database.types.ts             # generated Supabase types
  proxy.ts                        # subdomain routing (Next 16 "proxy")
```

**Business subdomains.** `bakery.ourdahanu.in` serves that business's page
from the same deployment; `proxy.ts` rewrites the request. `find.`, `jobs.`
and `appointments.` are standalone products that hide the main site's
navigation.

**Authentication** is Google OAuth through Supabase (PKCE). The server client
is dual-auth: it reads the session cookie, and also accepts an
`Authorization: Bearer <supabase-jwt>`.

**Data access.** The anon key is public — it ships in the browser. Row level
security is what actually protects the data, so when something should or
should not be readable, the thing to change is a policy, not a query.

## Deploying

Built for **Vercel**; `vercel.json` carries the cron schedule. Any host that
runs Next.js 16 will do, but you would have to arrange the cron jobs yourself.

Set the same environment variables in your host's project settings, point your
domain at it, and add a wildcard `*.yourdomain` DNS record so business
subdomains resolve.

## Database

The schema — tables, row level security policies, functions, grants, the
storage bucket — lives in `supabase/migrations/`, applied in filename order.
`…_baseline.sql` is the whole schema as it stood when the project went open
source, generated from the production database and checked against it.
`supabase/seed.sql` is a made-up town to fill an empty database.
`supabase/legacy/` holds the old hand-applied files; never run them.

To change the schema, add a new `supabase/migrations/<timestamp>_<what>.sql`
— never edit one that has shipped — then regenerate
`src/lib/database.types.ts` and run Supabase's security and performance
advisors. `npm test` builds a database from the migrations and seed
(`scripts/test-baseline-schema.mjs`), so a migration that does not apply
cleanly fails CI.

## Contributing

See **[CONTRIBUTING.md](CONTRIBUTING.md)**. Please open an issue before
starting anything substantial — this runs a live site for real businesses, so
some things are missing deliberately.

## Security

Found a vulnerability? Please report it privately rather than in an issue —
**[SECURITY.md](SECURITY.md)** has the details, including the three things
that look like findings but are deliberate.

## Licence

[MIT](LICENSE) © Soham Railkar.

The code is open. The name "OurDahanu", the logo, and the content of the live
site — business listings, reviews, photos and guides — are not covered by it.
Build your own town's; don't clone ours.
