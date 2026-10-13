# Contributing to OurDahanu

Thanks for looking. OurDahanu is a real site serving one town — Dahanu, in
Palghar, Maharashtra — so changes here reach real businesses and their
customers. That shapes most of what follows.

## Before you start

**Open an issue first for anything beyond a small fix.** A lot of what looks
missing is missing on purpose, and a lot of what looks like a quick improvement
touches the payment path. A short conversation before you write code saves the
disappointment of a closed pull request.

Small, obviously-good changes — a typo, a broken link, a clear bug with a clear
fix — just send them.

## Setting up

`README.md` has the full list, but the short version:

```bash
npm install
npm run setup   # local Supabase in Docker, migrations + sample data, writes .env.local
npm run dev
```

Sign in at `/login` with the email form ("Local development only") as
`admin@example.com`; the link arrives in the local inbox at
http://127.0.0.1:54324, and that account is the admin. No Docker? Use a
hosted Supabase project instead (SETUP.md steps 1–5). Schema changes go in a
new migration file, never an edit to an existing one; `npm run db:reset`
replays them all from scratch. You do not need Razorpay, Telegram or
WhatsApp credentials unless you are working on those paths.

## Before you open a pull request

All four of these must pass:

```bash
npx tsc --noEmit     # types
npx eslint           # 0 errors (warnings are an existing backlog)
npm test             # unit, game and security suites
npm run build        # also runs the Server Action credential boundary check
```

CI also runs a browser smoke test (`.github/workflows/e2e.yml`). To run it
yourself, with the local database from `npm run setup`: `npm run build`,
`npm start`, then `npm run test:e2e` in another terminal (once, first:
`npx playwright install chromium`).

The same CI job then runs Lighthouse on five pages (`lighthouserc.json`):
accessibility, best practices and SEO fail the build below 90; performance
only warns. Each run's reports are attached as the `lighthouse` artifact. To
run it locally against `npm start`: `npx @lhci/cli@0.15.1 autorun`.

`npm run build` runs `scripts/check-action-boundaries.mjs`, which fails the
build if a server action leaks a credential into client-reachable code. If it
complains, it has found something real.

## House rules

**This is Next.js 16, and it is not the Next.js you may know.** `AGENTS.md`
explains. The rule that catches people out most often: `export const dynamic`
is not allowed, because it is incompatible with `cacheComponents`. When you are
unsure how an API behaves in this version, read the copy of the docs in
`node_modules/next/dist/docs/` rather than going from memory.

**Tests are run by `node:test` through `tsx`, and each test file is listed
explicitly** in the `test:existing` script in `package.json`. A new test file
that is not added to that list will never run. This has bitten us before.
The entries are glob patterns, so a route folder like `[id]` must be written
as `*` and the entry quoted (`"src/app/listings/*/components/X.test.tsx"`);
`npm test` refuses to start if an entry matches no file.

**Pure logic goes in `src/lib/` and gets a test.** Pricing, validation, display
rules and anything with a branch worth arguing about belongs there rather than
inside a component, so it can be tested without a browser or a database.

**Say why, not what, in comments and commit messages.** The diff already says
what changed. What the next reader needs is the reason, and the constraint that
made the obvious alternative wrong.

## The parts to be careful with

Some of this code handles other people's money and other people's personal
data. Changes in these areas get read closely, and may be declined even when
correct if the risk is not worth the gain:

- **Payments** — `src/app/actions/orders.ts`, `src/lib/payments/`,
  `src/app/api/razorpay/`. The governing rule: a payment Razorpay has captured
  must always end up recorded. Losing a paid order is worse than almost any
  other bug here.
- **Row level security** — the policies in `supabase/`. The anon key is public
  by design, so these policies are the real access boundary.
- **Credentials** — a business owner's Razorpay key secret is encrypted at rest
  and must never be logged, returned to a client, or selected outside the one
  function that decrypts it.
- **Notification delivery** — owners receive these on Telegram and WhatsApp.
  Changes that could cause a flood affect real people's phones.

## Reporting a security problem

Do not open an issue. See `SECURITY.md`.

## Licence

Contributions are made under the MIT licence in `LICENSE`.
