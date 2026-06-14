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
| `TELEGRAM_BOT_TOKEN` / `TELEGRAM_BOT_USERNAME` / `TELEGRAM_USER_BOT_TOKEN` / `TELEGRAM_WEBHOOK_SECRET` | Telegram admin alerts + per-user DMs |
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
      v1/                       # JSON API for the native app (see docs/mobile-api.md)
  components/ ui/               # shared components + design-system primitives
  lib/
    supabase/                   # server (dual-auth) + browser + admin clients
    data/                       # cached read fetchers
    api/                        # /api/v1 helpers (auth, cors, respond, form)
    database.types.ts           # generated Supabase types
  proxy.ts                      # subdomain routing (Next 16 "proxy", not middleware)
docs/mobile-api.md              # app/backend integration guide
```

## Mobile app backend

The backend is **dual-auth**: API routes and server actions accept either the web session cookie or an `Authorization: Bearer <supabase-jwt>` from a native app. A versioned `/api/v1` namespace exposes the server-secret flows (payments, devices). See **[docs/mobile-api.md](docs/mobile-api.md)**.

## Deployment

Hosted on **Vercel** (config in `vercel.json`). Pushing to `main` triggers a production deploy. A weekly cron (`/api/cron/listing-expiry`, Mondays 00:00 UTC) expires listings — protected by `CRON_SECRET`.

**Workflow rule:** always run `npm run build` locally and confirm it passes before pushing to `main`.

## Database

Schema and RLS policies live in Supabase. Regenerate TypeScript types after schema changes and overwrite `src/lib/database.types.ts`. Run the Supabase security/performance advisors after DDL changes.
