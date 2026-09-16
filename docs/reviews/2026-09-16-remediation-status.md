# Remediation status — 16 September 2026

This is an implementation following the [deep review](2026-09-16-site-review.md). The two production database migrations were applied through the Supabase SQL editor on 16 September 2026. No application deployment, credential rotation, or real payment was performed.

## Production migration result

- Project: `ourdahanu`, reference `slmbqngmxketyxjauxxk`, production branch.
- Read-only compatibility check: no required columns missing and no legacy order payout columns still `NOT NULL`.
- Duplicate preflight: zero duplicate owner Razorpay payment IDs and zero duplicate owner Razorpay order IDs.
- Applied `atomic_marketplace_finalization.sql`, followed by `harden_profile_access.sql`; both transactions completed successfully.
- Post-migration verification: all ten checks passed—fulfillment column, both unique indexes, finalizer existence, service-role-only finalizer execution, profile guard trigger, exact profile policy set, three-column public profile projection, public projection reads, and revoked anonymous/authenticated order writes.
- The application deployment remains outstanding and should be completed promptly because production now has the hardened profile policies and the application-compatible public view/RPC.

## Implemented

- Moved the decrypted owner Razorpay key loader out of the `use server` module into a `server-only` module. Added a compiled Server Action manifest test; it failed before the change and passes after rebuilding. The admin database client also has a server-only boundary.
- Upgraded Next.js, its companion packages, sharp and safe transitive dependency updates. Production dependency audit reports zero known vulnerabilities. Six high-severity development dependency advisories remain in the presentation/browser-tool dependency chains; no forced breaking downgrade was applied.
- Added profile privacy/privilege SQL: own-profile reads and edits, protected role/is_admin/verified fields, a public name/avatar projection, and removal of client order-write grants. Public review-name readers use the new view. Admin profile changes use the service client only after admin authorization.
- Checkout creation now requires a durable payment intent before returning an order to the browser. Shared payment verification requires a fully paid INR order and the expected metadata. Marketplace signature comparison uses constant-time comparison.
- Added a service-role-only marketplace finalization transaction: serialized replay, unique payment/order IDs, atomic stock/order/intent updates, and an explicit fulfillment issue for removed items/options or insufficient stock after capture. Buyer, seller and admin order screens surface that issue. This records an obligation; it does not issue a refund automatically.
- Appointment directory occupancy uses a trusted server reader restricted to public bookable businesses and exposes only generated slot availability. Refresh is 60 seconds with 120-second expiry; failed occupancy/override reads no longer masquerade as free slots. Added a retry error screen. Final booking availability still needs rechecking at checkout.
- Mobile directory: full-width search, less header spacing, horizontally scrollable category chips, explicit control labels, h1 and result announcements. Search and sort survive category navigation and refresh through URL parameters.
- Login: checkout context, return-to-item link, real legal links and visible OAuth-start failures. Jobs/appointments are in desktop navigation; mobile menu also links to professionals. Search accurately states its business-name scope, shows up to 20 results, links to broader directory filtering and distinguishes failure from an empty result.

## Validation

- `npm test`: 303 Node tests pass (253 existing + 47 game + 3 new regression tests), plus both isolated PostgreSQL/PGlite integration scripts.
- SQL integration checks cover profile privacy, protected privilege fields, ordinary self-edits, blocked direct order creation, public identity projection, trusted admin updates, migration reapplication, repeated payment finalization, rollback after insert failure, stock shortage, option stock, removed items/options and test-mode inventory isolation.
- `npm run build`: production build and TypeScript pass with Next.js 16.3.5.
- `npm run check:action-boundaries`: compiled secret-loader action exposure check passes.
- `npm run lint`: no errors; 14 warnings, including three existing navigation patterns newly flagged by the upgraded Next lint rules.
- `npm audit --omit=dev`: zero vulnerabilities at verification time.
- Browser check on the local production build at 390 × 844: first business appears in the initial viewport; `cake` search and A–Z sort persist through category navigation and refresh; checkout login and legal destinations verified. Local absolute links reflect the existing `.env.local` site URL (`ourdahanusite.vercel.app`); production canonical configuration must be checked at release.

Tests use isolated synthetic databases, not the deployed Supabase policy set. They do not replace a full-schema staging migration, real concurrent PostgreSQL sessions, cross-account tests or Razorpay sandbox checkout. No authenticated owner/admin UI session was used.

## Release order and gates

1. Back up the target database and capture current policies/grants. Run `supabase/security_release_preflight.sql` read-only. Confirm the expected profile privilege columns and all order/catalog/payment-intent columns exist. Check that legacy required commission/payout columns were already relaxed or removed by the existing schema migrations. Duplicate payment/order counts must be zero.
2. Apply `supabase/atomic_marketplace_finalization.sql` in staging first, then `supabase/harden_profile_access.sql`. Use the trusted migration owner so the intentionally owner-executed public identity view bypasses private-profile RLS. Review any legacy security-definer functions that mutate profiles; the trigger protects direct anon/authenticated writes and cannot secure unrelated privileged RPCs by itself.
3. Deploy this application immediately after the schema changes. The profile migration removes old broad reads; the old admin-role editor cannot write protected fields afterward. The new application expects `public_profiles` and `finalize_marketplace_order`. Coordinate the transition and pause checkout briefly if needed. Do not deploy the new finalizer without its function.
4. Test anonymous/customer/owner A/owner B/admin access. Run a Razorpay test purchase and replay its callback concurrently; verify one order, one stock decrement and one finalized intent. Test stock shortage, deleted option/item, failed intent insert and failed transaction. Verify reviewer names and admin role editing against the real schema. Test normal listings, appointment payment and seller subdomains.
5. Run `npm test`, `npm run lint`, `npm run build`, then `npm run check:action-boundaries` in the release environment. Regenerate database types from the deployed schema. Verify production canonical URL and OAuth return URLs.
6. Rotate potentially exposed seller Razorpay secrets through an owner-coordinated process, inspect relevant access/payment logs, and preserve a way to resolve payments started with old credentials. Removing the endpoint does not revoke previously exposed credentials. No evidence of exploitation was established by this review.

Rollback should preserve the added column/view/function and unique indexes. Do not restore public private-profile reads or client order-write privileges. If application rollback is necessary, carry the key-loader boundary fix and adapt the old profile readers/admin writes. Do not blindly rerun all legacy SQL files; some would restore the vulnerable policies.

## Remaining priorities

1. **Payment recovery:** server-side reconciliation with the correct seller account, durable captured-but-unfinalized monitoring, retry/outbox delivery, quote snapshots and a reschedule/refund path for appointment capacity/fee changes. Browser-closed recovery is not solved by this patch.
2. **Production security verification:** actual RLS/RPC/storage policy audit, staging role matrix, shared rate limiting and a tested CSP rollout. The profile migration alone is not an audit of every security-definer function.
3. **Owner accessibility/data consistency:** focus-managed item dialog, dirty-change protection, linked form errors, atomic catalog/options saves and edit-conflict handling.
4. **Discovery and performance:** real server pagination, broader grouped search, bookable/contact-only provider states, owner schedule setup, genuine job inventory, image variants and credible audience-count copy.
5. **Measurement:** baseline checkout/login abandonment, failed-payment resolution time, successful searches and unassisted owner task completion. Use the review's usability sessions and milestones to prioritize subsequent work.

The highest-risk code boundary is closed locally. Release remains gated on target-schema validation, coordinated migration/deployment and sandbox payment verification.
