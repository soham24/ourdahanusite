# OurDahanu

The local platform for **Dahanu** — a business directory, marketplace, local jobs board, events, news, and community, plus per-business storefronts on subdomains (`yourname.ourdahanu.in`). Live at [ourdahanu.in](https://ourdahanu.in).

## Tech stack

- **Next.js 16** (App Router, Turbopack, `cacheComponents`/PPR) + **React 19**
- **Tailwind CSS v4** (design tokens in `src/app/globals.css`)
- **Supabase** — Postgres + Auth (Google OAuth, PKCE) + Storage, secured with RLS
- **Razorpay** — payments (listings, jobs, product orders, appointments) + payouts
- **Resend** — transactional/newsletter email; **Telegram** + **WhatsApp** — notifications
- **Vercel** — hosting + cron

> ⚠️ This is Next.js 16 with breaking changes from older versions — see `AGENTS.md`. Notably, `export const dynamic` is **not** allowed (incompatible with `cacheComponents`).

## Running this for another town

The town's name, domain and address live in one file,
[`src/lib/site-config.ts`](src/lib/site-config.ts). Change the values there and
the interface follows — page titles, navigation, emails, structured data and
page copy all read from it.

The local *content* is a separate job: emergency phone numbers, guides,
categories and the Chikoo Catcher game are about Dahanu specifically, and no
config translates them. [SETUP.md](SETUP.md) walks through both, step by step.

## Prerequisites

- Node.js 20+ and npm
- A Supabase project, a Razorpay account, and (optional) Resend/Telegram/WhatsApp credentials

## Setup

```bash
git clone https://github.com/soham24/ourdahanusite.git
cd ourdahanusite
npm install
cp .env.local.example .env.local   # then fill in the values below
npm run dev                        # http://localhost:3000
```

## Environment variables

Set these in `.env.local` (local) and in the Vercel project settings (production).

**Required — core**
| Var | Purpose |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key (client + RLS) |
| `SUPABASE_SERVICE_ROLE_KEY` | Service-role key for privileged server writes (payments, admin) |
| `NEXT_PUBLIC_SITE_URL` | `http://localhost:3000` locally; `https://ourdahanu.in` in prod (drives prod cookie domain) |
| `LISTING_PAYMENT_ENCRYPTION_KEY` | AES-256-GCM key for owner Razorpay secrets at rest. Generate: `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"` |

**Required — payments**
| Var | Purpose |
|---|---|
| `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` | Razorpay API keys (order creation + signature verification) |
| `RAZORPAY_WEBHOOK_SECRET` | Orphaned-payment safety net (see `.env.local.example` for webhook setup) |
| `RAZORPAY_X_ACCOUNT_NUMBER` | RazorpayX account for seller payouts |

**Optional — integrations**
| Var | Purpose |
|---|---|
| `RESEND_API_KEY` | Email (newsletter welcome, etc.) |
| `TELEGRAM_BOT_TOKEN` / `TELEGRAM_BOT_USERNAME` / `TELEGRAM_USER_BOT_TOKEN` | Telegram admin alerts + per-user DMs |
| `TELEGRAM_WEBHOOK_SECRET` | **Required if you use Telegram at all** — the webhook fails closed without it. See [SETUP.md](SETUP.md). |
| `WHATSAPP_ACCESS_TOKEN` / `WHATSAPP_PHONE_NUMBER_ID` | WhatsApp notifications |
| `CRON_SECRET` | Authorizes `/api/cron/*` (sent as `Authorization` header by Vercel cron) |
| `ADMIN_EMAIL` | Bootstraps an admin account |
| `ISR_DEBUG` | Verbose cache logging |

## Scripts

```bash
npm run dev     # dev server (Turbopack)
npm run build   # production build — ALWAYS run before pushing to main
npm run start   # serve the production build
npm run lint    # eslint
```

## Project structure

```
src/
  app/
    page.tsx, page-components/   # homepage + sections
    listings/                   # directory + listing detail
    s/[index]/                  # per-business subdomain storefront
    jobs/ events/ news/ forum/ classifieds/ shop/ polls/ emergency/
    dashboard/ my-business/ account/ profile/  # owner + user tools
    admin/                      # admin/moderation
    actions/                    # server actions (cookie/dual-auth)
    api/
      razorpay/ cron/ telegram/ newsletter/ ...
  components/ ui/               # shared components + design-system primitives
  lib/
    supabase/                   # server (dual-auth) + browser + admin clients
    data/                       # cached read fetchers
    database.types.ts           # generated Supabase types
  proxy.ts                      # subdomain routing (Next 16 "proxy", not middleware)
```

## Authentication

Sign-in is Google OAuth through Supabase (PKCE). The server client is
**dual-auth**: it reads the web session cookie, and also accepts an
`Authorization: Bearer <supabase-jwt>` so a native client could call the same
server code. The `/api/v1` namespace that a native app would have used was
removed in September 2026, when it became clear no app was going to ship.

## Deployment

Hosted on **Vercel** (config in `vercel.json`). Pushing to `main` triggers a production deploy. A weekly cron (`/api/cron/listing-expiry`, Mondays 00:00 UTC) expires listings — protected by `CRON_SECRET`.

**Workflow rule:** always run `npm run build` locally and confirm it passes before pushing to `main`.

## Database

Schema and RLS policies live in Supabase. Regenerate TypeScript types after schema changes and overwrite `src/lib/database.types.ts`. Run the Supabase security/performance advisors after DDL changes.

## Contributing

See **[CONTRIBUTING.md](CONTRIBUTING.md)**. Please open an issue before starting
anything substantial — this runs a live site for real businesses, so some things
are missing deliberately.

## Security

Found a vulnerability? Please report it privately rather than in an issue —
**[SECURITY.md](SECURITY.md)** has the details.

## Licence

[MIT](LICENSE) © Soham Railkar.

The code is open. The name "OurDahanu", the logo, and the content of the live
site — business listings, reviews, photos and guides — are not covered by it.
