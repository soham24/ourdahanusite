# Fluid Active CPU Audit

Date: 2026-05-12

## What Fluid Active CPU Measures

Fluid Active CPU is charged for time spent actively executing server code. Waiting on Supabase, Razorpay, email, or other network I/O is much cheaper than CPU time, but every function/proxy invocation still has parsing, routing, React rendering, JSON serialization, and request handling overhead.

This audit targeted high-frequency dynamic work that was avoidable for anonymous public traffic.

## Highest Cost Surfaces Found

1. Proxy on main-domain traffic
   - `src/proxy.ts` was matched for almost every non-static request, including main-domain pages and API routes.
   - Most of those invocations immediately returned because there was no subdomain.
   - This is pure overhead on the hottest path.

2. Homepage poll auth check
   - `src/components/HomepagePollCard.tsx` called server Supabase auth on the public homepage.
   - That made `/` partially prerendered instead of fully static when a poll exists.

3. Poll listing/detail auth checks
   - `/polls` and `/polls/[id]` fetched user auth/votes in Server Components.
   - Anonymous traffic paid server CPU for user-specific state that usually did not exist.

4. Subdomain availability checks
   - `/api/check-subdomain` used the cookie-aware Supabase server client even though the endpoint only needs public listing data.
   - The client could repeat the same checks while a user edits text.

5. Remaining expected Fluid usage
   - Authenticated admin/account/dashboard/my-business routes.
   - Razorpay APIs and webhooks.
   - Cron routes.
   - Logged-in poll/listing viewer APIs.
   - Dynamic listing details and subdomain redirects.

## Changes Made

### Proxy

`src/proxy.ts`

- Made the proxy function synchronous.
- Restricted proxy matching to subdomain hosts only.
- Further restricted it to:
  - `/`
  - `/robots.txt`
- Main-domain routes and API requests now bypass proxy entirely.

Expected impact:

- Main-domain proxy invocations should drop close to 100%.
- If most traffic is on `ourdahanu.in`, this is likely the largest Fluid invocation reduction.

### Public Poll Rendering

`src/components/HomepagePollCard.tsx`
`src/app/polls/page.tsx`
`src/app/polls/[id]/page.tsx`
`src/app/polls/PollsList.tsx`
`src/components/PollCard.tsx`
`src/app/api/polls/[id]/viewer/route.ts`

- Removed server-side auth and vote lookups from public poll pages.
- Added a client-side viewer fetch that runs only when a Supabase session cookie exists.
- Anonymous visitors no longer call a poll viewer function.
- Moved active/past poll bucketing to a client component to avoid server-side current-time rendering.

Build result:

- `/` changed from `PPR` to `Static`.
- `/polls` changed from `PPR` to `Static`.

Expected impact:

- Anonymous homepage visits should no longer spend server Fluid CPU for poll auth checks.
- Anonymous `/polls` visits should no longer spend server Fluid CPU for auth/vote checks.
- Logged-in users still get correct vote state through `/api/polls/[id]/viewer`.

### Subdomain Check API

`src/app/api/check-subdomain/route.ts`
`src/components/SubdomainInput.tsx`

- Switched from cookie-aware Supabase server client to the public server client.
- Added a short edge cache: `s-maxage=30, stale-while-revalidate=60`.
- Added client-side memoization for repeated slug checks.
- Increased debounce from 600ms to 900ms.

Expected impact:

- Less CPU per request.
- Fewer function invocations while typing.
- Safe because final listing submission still enforces uniqueness server-side.

## Build Verification

Final production build summary:

- `/`: `Static`, `1d / 1w`
- `/polls`: `Static`, `1d / 1w`
- `/sitemap.xml`: `Static`, `1w / 30d`
- Proxy still exists, but matcher now targets only subdomain root and robots requests.

Commands run:

- `npx tsc --noEmit --pretty false`
- `npx eslint` on changed files
- `npm run build`

## Estimated Savings

Without Vercel per-route usage export, exact savings cannot be computed locally, but the likely reductions are:

- Proxy CPU: near-total removal for main-domain traffic and API traffic.
- Homepage CPU: anonymous homepage requests should move from server/PPR work to CDN static serving.
- Poll page CPU: anonymous `/polls` requests should move from server/PPR work to CDN static serving.
- Subdomain checks: fewer invocations and lower per-request overhead.

If homepage plus main-domain proxy traffic is the majority of usage, this can cut a large share of Fluid Active CPU. The remaining bill should mostly be real dynamic work: admin, account, checkout/payment, cron, authenticated viewer state, and route handlers.

## Next Observability Step

In Vercel Usage, filter Fluid Active CPU by function/route after deployment. The routes that should be watched first:

- Proxy/Middleware
- `/`
- `/polls`
- `/api/check-subdomain`
- `/api/listings/[id]/viewer`
- Razorpay route handlers
- Cron route handlers
