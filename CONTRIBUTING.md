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
cp .env.local.example .env.local   # fill in your own Supabase project
npm run dev
```

You need your own Supabase project. Apply `supabase/schema.sql` first, then the
other files in `supabase/` — they are individual migrations, applied in the
order their contents imply. You do not need Razorpay, Telegram or WhatsApp
credentials unless you are working on those paths.

## Before you open a pull request

All four of these must pass:

```bash
npx tsc --noEmit     # types
npx eslint           # 0 errors (warnings are an existing backlog)
npm test             # unit, game and security suites
npm run build        # also runs the Server Action credential boundary check
```

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
