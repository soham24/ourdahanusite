# ISR Optimization Report

Date: 2026-05-12

## Summary

The main ISR write pressure came from short public cache windows, a layout-level emergency alert fetch that cascaded to nearly every static page, poll votes invalidating the homepage, and a few unstable ordering/time patterns in public cached data.

After the changes, the production build reports:

- Most static/PPR public routes: `Revalidate 1d`, `Expire 1w`
- Sitemap: `Revalidate 1w`, `Expire 30d`
- API routes: dynamic on demand

Expected write reduction:

- Homepage/listings/jobs/pricing/listing detail: 10 minute regeneration -> 1 day regeneration, about 144x fewer time-based writes before on-demand updates.
- Appointment settings: 5 minute regeneration -> 1 day regeneration, about 288x fewer time-based writes.
- Layout emergency ribbon cascade: 1 hour/6 hour effective cascade -> 1 day, about 4x-24x fewer writes across static pages depending on the previous route.
- Sitemap: 2 hour regeneration -> 1 week regeneration, about 84x fewer time-based writes.
- Poll votes: per-vote homepage and poll cache invalidation removed. Poll create/delete still revalidates; votes return live counts to the voter without triggering ISR writes.

## Highest Write Sources Found

1. `src/lib/data/home.ts`
   - Four cached homepage fetchers used 10 minute revalidation.
   - Updated to `PUBLIC_CONTENT_CACHE` and deterministic query tie-breakers.

2. `src/lib/data/listing-detail.ts`
   - Listing/subdomain pages used 10 minute revalidation per listing.
   - Updated to daily cache plus existing on-demand listing tag invalidation.
   - Similar listings, reviews, questions, and products now have deterministic ordering.

3. `src/app/listings/directory-data.ts`
   - Directory and category data used 10 minute revalidation.
   - Updated to daily cache and stable category/listing ordering.

4. `src/lib/data/polls.ts` and `src/app/actions/polls.ts`
   - Every vote called `revalidatePollsCache()`, invalidating `polls` and `home`.
   - Vote action now returns fresh vote totals directly; public ISR cache is invalidated only for poll create/delete.

5. `src/lib/data/emergency.ts`
   - Root layout emergency fetch was a layout-level cascade.
   - Removed clock-based filtering and moved to daily cache with on-demand admin invalidation.

6. `src/app/sitemap.ts`
   - Sitemap used 2 hour revalidation and had `new Date()` fallback output.
   - Updated to weekly revalidation, static fallback timestamp, and deterministic route ordering.

## Route Strategy

| Route area | Strategy after change | Why |
| --- | --- | --- |
| `/` | ISR/PPR, daily cache, on-demand tags | SEO page, fast static shell, admin/listing/job/poll mutations refresh important content |
| `/listings` and category pages | ISR/PPR, daily cache, on-demand tags | High traffic and SEO-sensitive; directory changes only need immediate refresh on listing approval/edit/review |
| `/listings/[id]` and subdomains | ISR/PPR with cached listing detail, daily cache, per-listing tag | Largest fanout; per-listing tags keep invalidation scoped |
| `/jobs` | ISR/PPR, daily cache, on-demand job tag | Job board stays fast; admin/job actions refresh when needed |
| `/polls` | ISR/PPR, daily cache, no vote-driven ISR | Vote counts update for the voter without rewriting public HTML per vote |
| `/sitemap.xml` | Static cached, weekly, on-demand via listing tag | SEO-safe; stable lastModified fallback avoids clock churn |
| Admin/account/dashboard/my-business | Dynamic/PPR as needed | Auth-specific surfaces should not drive public ISR strategy |
| API routes | Dynamic or explicit edge/private cache | Not ISR HTML; existing viewer/robots cache headers are isolated from page ISR |

## Non-Determinism Fixed

- Removed `new Date()` fallback from sitemap `lastModified`.
- Removed `new Date().toISOString()` filters from cached poll/emergency public fetches.
- Replaced category `localeCompare` tie-breaker with stable ASCII comparison.
- Added deterministic `id` tie-breakers to public listing, job, coupon, sitemap, review, question, product, and similar-listing queries.
- Poll votes no longer change public cached HTML on every write.

## On-Demand Revalidation

Existing tag helpers remain the update path for admin/owner mutations:

- Listings: `home`, `listings`, `listing-categories`, and `listing:{id}` only when approved/public content changes.
- Listing details: per-listing tag for Q&A, marketplace/products, payment config, and stock-affecting order flows.
- Jobs/pricing/settings/emergency/polls/appointments: scoped tag helpers.

Additional reductions:

- Unapproved listing submissions no longer invalidate public listing collections.
- Admin listing approval/update/delete now avoids duplicate collection invalidation.
- Review replies only invalidate the listing detail, not homepage/directory collections.
- Direct service orders no longer invalidate public listing detail because they do not change rendered public content.

## Diagnostics

Set `ISR_DEBUG=1` in the server environment to emit structured logs:

- `cache-invalidation`: which helper invalidated which tags.
- `cache-regeneration`: which cached data function executed again and with which tags.

These logs are disabled by default.

## Manual Cache-Control Audit

No conflicting manual `Cache-Control` headers were found on ISR HTML routes.

Remaining headers are isolated to:

- `src/app/api/listings/[id]/viewer/route.ts`: anonymous API response is edge-cacheable; logged-in response is private/no-store.
- `src/proxy.ts`: subdomain `robots.txt` text response.

## Verification

Commands run:

- `npx tsc --noEmit --pretty false`
- `npx eslint` on all changed files
- `npm run build`

The final build completed successfully and reported public routes at `1d / 1w`, with `/sitemap.xml` at `1w / 30d`.
