# OurDahanu: security, usability, design and optimization review

Reviewed 16 September 2026. Repository baseline: `9c897d4`.

## Assessment

Keep the warm coastal identity, the unified catalog, and the separation between business storefronts and community discovery. The next investment should be security and transaction reliability, followed by faster discovery and clearer customer journeys. A visual rebuild would leave the most consequential problems unresolved.

There is a critical credential-returning Server Action in the current build. There are also potentially critical database policy gaps in the checked-in SQL; those require deployed-policy verification. Payment completion is not atomic. These take precedence over new features or promotional expansion.

## Scope and evidence

- Read recent commit history, application actions/routes, authentication helpers, payment flows, catalog management, database scripts, design tokens, navigation and discovery components.
- Inspected the live homepage on desktop, directory and a storefront/login journey at a narrow mobile viewport, and Find, Jobs and Appointments public entry points. The live application was not proven to be the same deployment as the repository commit.
- Fresh production build passed. All 300 tests passed: 253 existing tests and 47 game tests. Lint passed with 11 warnings and no errors.
- `npm audit --omit=dev` reported eight affected packages: one critical, three high and four moderate. These are dependency findings, not eight demonstrated application exploits.
- Read the installed Next.js data-security guide and checked current upstream security guidance.
- Did not retrieve real seller secrets, run exploit requests, alter production data, make payments, or verify signed-in owner/admin workflows in the browser. Those workflows received source review. Deployed RLS, grants, storage policies, logs and infrastructure controls remain unverified.
- No Lighthouse/Core Web Vitals measurements or full assistive-technology audit were performed. Performance targets below are goals, not measured scores.

## Security and transaction findings

### S1 — Critical: decrypted payment credentials exposed through an action boundary

**Evidence:** `src/app/actions/listing-payments.ts:1` declares `'use server'`. Its exported `loadOwnerRazorpayKeys` at line 339 accepts a listing ID and returns decrypted `keySecret` at line 359 without authenticating the caller. The freshly generated `.next/server/server-reference-manifest.json` registers this export for account-order pages.

**Impact:** a secret-loading internal helper is compiled into the remotely callable Server Action surface. An attacker able to invoke the action could receive seller credentials. A page's login gate is not authorization for this helper. Source and build registration are confirmed; production exploitation was deliberately not attempted.

**Action:** move the helper into a dedicated `import 'server-only'` module with no `'use server'` directive; update server imports. Audit every exported action for authentication, authorization and minimal return values. Add `server-only` to the admin-client module as a build-time guard. If this build is deployed, treat the affected seller keys as potentially exposed: coordinate credential rotation and investigate access after closing the endpoint. Preserve a plan for outstanding payments during rotation.

**Acceptance:** a clean build does not register the helper; anonymous and unrelated-user action tests cannot receive sensitive fields. See [Next.js data security](https://nextjs.org/docs/app/guides/data-security).

### S2 — Potential critical: profile self-edit policies may permit privilege escalation

**Evidence:** `supabase/schema.sql:103` allows users to update their own profile and line 104 allows inserts. `supabase/add_roles.sql` adds role/verified fields without a corresponding protected-column guard. `src/app/actions/admin.ts:18` trusts profile `role` and legacy `is_admin`. No profile-column protection was found in the reviewed SQL.

**Impact:** if these broad policies and table grants are deployed without additional guards, a signed-in user could change privileged fields directly through Supabase, bypassing the profile form. Ownership of a row does not restrict which columns can change.

**Action:** inspect deployed grants, policies and triggers immediately. Protect role, is_admin and verified on both insert and update, preferably separating privileged fields from editable profile data. Test using ordinary user JWTs, not the service role.

**Acceptance:** users can update approved personal fields but cannot self-assign any privileged role, including through insert/upsert. Record the deployed schema as reproducible migrations.

### S3 — Potential high: public profile policy includes private contact fields

**Evidence:** `supabase/schema.sql:8` includes email, phone and address; line 102 permits public selection of profiles. Selecting only name/avatar in application code does not limit direct database API reads.

**Action:** separate public identity from private account/contact data; grant public reads only to an intentionally restricted surface. Verify anonymously in staging with synthetic records. Do not broaden appointment visibility to solve availability queries.

**Acceptance:** anonymous users can obtain public display names/avatars but cannot read account email, phone or address. Deployment applicability remains unconfirmed.

### S4 — High: marketplace finalization can duplicate stock effects or strand captured payments

**Evidence:** `src/app/actions/marketplace-orders.ts:71` checks whether an intent is finalized; stock decrement occurs at line 275, order insertion at line 285, and intent finalization at line 328. These are separate database operations. No unique owner payment-ID constraint on orders was found in the reviewed migrations. The intent's unique payment ID does not serialize concurrent finalization.

**Failure cases:** two simultaneous retries can both pass the initial check; a stock decrement followed by a failed insert leaves stock reduced; a sold-out item returns an error after capture; deleting the product during payment is rejected at line 110 despite the stored intent snapshot.

**Action:** implement one transaction/RPC that locks or claims the intent, checks an order-level unique payment key, creates the order from immutable purchase snapshots, applies stock once and finalizes the intent. Record captured-but-unfulfillable purchases explicitly, with an owner/support resolution or refund state. Do not simply ask the customer to pay again.

**Acceptance:** concurrent retries return one order and decrement stock once. Injected failures roll back all relevant changes. Product deletion, price edits and stock exhaustion after capture preserve the financial record.

### S5 — High: recovery is not independently durable

**Evidence:** `src/lib/payment-intents.ts:45` explicitly allows checkout to proceed when intent recording fails. The webhook marks capture but does not finalize. `src/app/api/razorpay/recover/route.ts:107` does not query the seller's Razorpay account for marketplace payments. The watcher discovers drafts through origin-specific localStorage. Marketplace intent payloads contain item information but not the complete buyer/delivery form.

**Impact:** a closed browser, lost localStorage, another device, another subdomain or failed intent insert can interrupt recovery. A single platform webhook secret does not establish configured, authenticated webhook coverage for every seller account.

**Action:** require durable intent persistence before exposing checkout; save necessary recovery data with limited retention; add a server reconciliation process for platform and seller accounts; authenticate seller-specific events and deduplicate them; show unresolved payments from the signed-in account's server records. Retain needed credential versions safely while existing payments settle.

**Acceptance:** closing the browser immediately after capture still produces a confirmed order or a visible resolution case without relying on a returning client.

### S6 — High priority: patch dependencies after exposure triage

**Evidence:** the fresh build uses Next.js 16.2.1 with Cache Components enabled. The audit proposes Next.js 16.3.5 and reports additional transitive findings involving sharp, PostCSS, nanoid and Resend's dependencies.

The [upstream Cache Components denial-of-service advisory](https://github.com/vercel/next.js/security/advisories/GHSA-mg66-mrh9-m8jx) matches a feature enabled here. Critical findings also include a [Windows-hosted-server advisory](https://github.com/vercel/next.js/security/advisories/GHSA-p293-qw3h-jr36); that is not proof that Vercel production is exposed. Image optimizer findings also require reachability analysis given `unoptimized: true`.

**Action:** upgrade the framework and aligned packages in an isolated change, resolve transitive packages deliberately, rebuild and test subdomain rewrites, OAuth, PPR/cache behavior and payments. Avoid a blind forced audit fix. Review whether the Windows development server is externally reachable.

**Acceptance:** no unexplained production high/critical findings; any accepted advisory has documented reachability reasoning and an owner.

### S7 — Medium: abuse controls and browser containment need strengthening

`src/lib/rate-limit.ts` uses an instance-local Map. It cannot enforce global serverless limits. Coverage is uneven: order-creation APIs are limited, while recovery and several mutation flows lack comparable shared budgets. `next.config.ts:3` explicitly omits CSP.

Adopt a shared limit store for expensive/sensitive actions with user, route and appropriate IP budgets, plus bounded input lengths and timeouts. Add CSP in report-only mode, test Razorpay/OAuth/analytics and then enforce a compatible policy. Preserve current HSTS, frame and MIME protections. Shared `.ourdahanu.in` auth cookies increase the consequences of a compromised sibling subdomain; inventory DNS and keep tenant content non-executable. These are hardening recommendations, not a demonstrated XSS exploit.

### S8 — High reliability: appointment payment and availability disagree at failure boundaries

`src/app/actions/appointments.ts:235` checks current configuration, slot availability and the current booking fee before finalization. A slot that fills or fee that changes during checkout can leave a captured payment without a booking. The booking RPC does serialize slot capacity, which is good, but a capacity error still needs a financial resolution. The shared payment validator does not itself require remote `status === 'paid'` and matching `amount_paid`, unlike marketplace finalization.

Use an expiring slot hold before payment where feasible, verify payment state, and finalize against the original quote. If capture wins but capacity does not, create an explicit reschedule/refund case. Test callback retries, fee changes, cancellation and a booking at capacity.

### S9 — Medium: directory slot counts use a reader that cannot see occupancy under checked-in RLS

`src/lib/data/appointment-directory.ts:83` reads appointment rows using `createPublicClient`. The policies in `supabase/add_appointments.sql:57` allow only the customer or listing owner to read them. With those policies, anonymous occupancy counts are empty and busy slots may be advertised as available. The later booking check prevents this from being proof of overbooking, but the discovery promise can be wrong.

Expose aggregate availability through a narrowly scoped server query/RPC that returns counts only. Also separate time-sensitive slots from the one-day `PUBLIC_CONTENT_CACHE`; booking mutations are not the only reason availability changes—time passing and date rollover matter. Test anonymous versus owner results, full slots and midnight in India.

## UI, usability and design findings

| ID / priority | Observation and evidence | Improvement and completion criterion |
|---|---|---|
| U1 / High | At the sampled mobile width, the directory's title, category-count card, whitespace and category chips fill the first screen. The input is squeezed beside sorting and Add. See `ListingsDirectoryContent.tsx:97` and `ListingsDirectoryResults.tsx:102`. | Give search a full-width row; put sort/filter controls below; reduce the decorative header/count block; collapse categories. A useful result should appear in the first screen at common phone sizes. |
| U2 / High | Global search advertises events/all sections but only searches listing names, caps at five, and treats failures as no results: `src/app/search/page.tsx:64`. Suggestions include unsupported topics. | Search businesses and professionals first, then jobs/bookings with clear result groups. Until then accurately label its scope. Add pagination, category/area matching and a distinct unavailable state. A known plumber must be findable without knowing the business name. |
| U3 / High | Jobs and appointments have standalone products but no visible primary entry points in the inspected homepage navigation/footer/bottom tabs. Play occupies a persistent tab. | Put Find a business/professional, Book and Jobs in a clear task hierarchy. Move Play into secondary discovery if analytics support it. Preserve seller storefront independence. |
| U4 / High | Buying from the inspected storefront sends a signed-out user to a generic Google login screen; product, amount and seller context disappear. Terms and Privacy are both `href="#"` (`src/app/login/page.tsx:90`). | Fix legal destinations immediately. Make login say “Continue your order from [business]”, preserve item/option/quantity and show a return link. Evaluate additional login methods or guest checkout only after measuring abandonment and designing safe order access. |
| U5 / High | Appointment directory showed 25 providers; 24 had no slots in the next two weeks. | Separate “Available to book” from “Contact for availability”, keep businesses discoverable, and help owners complete schedules. Clarify “Free to book” means booking fee, not necessarily a free service. |
| U6 / Medium | Jobs Hiring tab showed zero jobs. Its empty state is clear, but discovery improvements alone cannot supply inventory. | Run owner onboarding to gather real vacancies, add a route to the seeking-work tab and relevant professional discovery. Track active posts and filled jobs. Never seed fake opportunities. |
| U7 / Medium | Directory search and sorting lack explicit accessible labels; its main heading is rendered as h2. Root layout lacks a skip link although standalone products have one. | Label controls, add main h1 and skip navigation, announce result-count changes politely. Verify keyboard navigation and screen-reader naming. |
| U8 / High for owner accessibility | ItemSheet has dialog semantics and Escape handling but no focus trap, initial-focus management, background inertness or focus restoration in the inspected component. Clicking outside/Escape discards edits. | Use an accessible dialog implementation and add a dirty-state guard. Link inline errors to fields and focus the first invalid field. Preserve the recent `100dvh`/scrolling-footer fix and test with a phone keyboard open. |
| U9 / Medium | Directory filter/sort state is local React state; the route's q parameter is not consumed. | Put q/category/sort/page in the URL. Back navigation, refresh and a shared URL must preserve the chosen view. |
| U10 / Medium | Homepage uses “1,000+ Dahanukars”, “30,000 locals” and “Join hundreds of local businesses and residents”, while 65 business results are shown. “Appear in Google searches instantly” is an unsupported guarantee. | Define whether each number represents registered users, social/community reach or businesses, and show credible dated counts. Replace the indexing promise with “A public page that search engines can discover.” |
| U11 / Medium | Warm palette, serif headings and rounded surfaces form a coherent identity. Desktop hero has considerable empty space; mobile utility is delayed by stacked chips and CTAs. | Keep typography/colors; shorten hero and place a task search first. Reserve expressive illustration for the homepage, use compact functional headers elsewhere. Do not add animation merely for decoration. |
| U12 / Medium | The inspected live store has Buy buttons but an empty Contact & Location section. Review cards included two reviews by the same displayed person. | Require a clear support/contact method and fulfillment/refund information before enabling live selling. Suppress empty sections. Check whether repeated reviews are intended; consider one current rating per account/business and clear moderation policy. Do not infer fraud from display names. |

Follow the [W3C modal-dialog pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/) for focus behavior. Retain existing global focus rings, reduced-motion support, labeled Find search, Marathi category names, and the jobs anti-scam message.

## Optimization and maintainability

1. **Paginate the business directory on the server.** `src/app/listings/directory-data.ts:45` caps at 200 and sends rows/descriptions to client-side filtering. It currently renders all 65 entries; growth beyond the cap silently omits businesses. Use stable ordering and a real total, initially 20–24 results, with explicit pagination or an accessible Load more.
2. **Make catalog thumbnails real.** `src/app/actions/catalog.ts:101` sets `image_thumb_url` to the original image URL; `next.config.ts:52` disables image optimization globally. Produce separate smaller upload variants and responsive sources while respecting the known hosting quota. Measure bytes before choosing a CDN or restoring optimization. Check file size/dimensions before browser cropping and verify storage MIME/size/ownership rules server-side.
3. **Make catalog writes transactional.** Item changes and option changes currently save separately; option failures can leave a partial catalog state. Reordering also issues separate writes. Use one transaction with a version/check to handle concurrent owner edits; return a clear conflict instead of silently overwriting newer work.
4. **Reduce global third-party work on transactional pages.** Root layout mounts analytics, conditional AdSense and recovery infrastructure site-wide. Restrict ads to useful discovery/content surfaces, lazy-load nonessential code and measure checkout separately. Do not cache private responses to improve scores.
5. **Fix false success and false empty states.** `updateProfileFull` can return success after ignoring an update error and an unsuccessful fallback upsert. Several data readers treat database errors as empty data. Separate unavailable, empty and successful states, attach a support correlation ID and keep raw database details out of user-facing errors.
6. **Consolidate schema history.** The base schema, add-on SQL and recent removal scripts are not an authoritative deployed schema snapshot. A legacy order INSERT policy is present in the base schema even though newer comments say service-role-only writes. Verify the effective policies, not comments, then add reproducible migration ordering and rollback guidance.
7. **Update cleanup documentation.** README still advertises the removed mobile API/native backend as active. Keep a short historic migration note, but document current routes, dependencies, database prerequisites and payment recovery accurately.
8. **Measure before spending.** Establish mobile field measurements by route/host and key funnels. Target p75 LCP ≤2.5 seconds, INP ≤200 ms and CLS ≤0.1, with agreed image/JS budgets after a baseline. These thresholds follow [Core Web Vitals guidance](https://web.dev/articles/vitals); this review did not measure current values.

## Delivery plan

Effort below is a planning estimate for one developer, excluding external approvals, credential coordination and owner onboarding. Re-estimate after deployed-policy inspection.

| Sequence | Work package | Indicative effort | Release gate |
|---|---|---|---|
| 0 — immediately | Remove credential-returning action; verify deployment; inspect profile privileges/privacy and effective order policies; establish credential response if deployed | 1–2 days plus coordination | No secret helper in action manifest; privilege and privacy tests pass using unprivileged identities |
| 1 — immediately after containment | Patch dependencies; add CI for build, tests, audit triage and action-boundary checks | 1–2 days | Clean build, regression pass, documented advisory exposure, tested rollback |
| 2 — transaction integrity | Atomic order finalizer; unique payment constraint; durable intents; reconciliation; slot/payment conflict handling | 4–7 days | One financial result under retries, closed tabs, concurrent purchases, failed writes and edited/deleted products |
| 3 — fastest customer wins | Real legal links; contextual login; full-width mobile search; compact filters; h1/labels/skip link; URL state | 2–4 days | Core signed-out discovery path works at 360/390/768/1280 widths and keyboard-only |
| 4 — connect the products | Main task navigation; honest unified search; bookable/contact-only availability states; jobs inventory onboarding | 3–5 developer days plus content operations | Users can find each core feature without a direct link; no misleading empty results or availability |
| 5 — owner usability | Accessible guarded item sheet; atomic option updates; selling readiness/contact checklist; schedule setup guidance | 3–5 days | A nontechnical owner can add, edit, preview and publish an item on a phone without help or lost edits |
| 6 — measured optimization | Server pagination; image variants; route-specific scripts; error observability; cache/occupancy fixes | 3–5 days | Documented before/after data; no private caching; no missing directory entries |

Work packages 3 and content preparation for 4 can progress while payment work is underway if separate people are available. Avoid overlapping edits to payment logic and dependency migrations without a shared integration test run.

## Concrete next-change boundaries

- **Change A:** internal secret loader isolation and action audit only.
- **Change B:** deployed-policy verification, protective migrations and ordinary-user integration tests.
- **Change C:** framework/dependency patch and deployment regression matrix.
- **Change D:** transaction-safe finalization and server recovery, including financial exception states.
- **Change E:** login/legal links and mobile directory ergonomics.
- **Change F:** navigation/search and appointment readiness.
- **Change G:** owner dialog/data consistency and performance work.

Keep each independently reviewable. Every schema-dependent change needs a deployment order and backward-compatibility plan; do not drop columns merely because new application code no longer reads them.

## Validation and success measures

**Security matrix:** anonymous, normal user, business A owner, unrelated business B owner, moderator, job reviewer and admin. Exercise direct database access as well as UI actions. Include private profile fields, catalog options, appointments, payment configs, role changes, webhook replay, upload ownership and cross-subdomain authentication.

**Payment matrix:** successful purchase, declined/dismissed checkout, callback repeated in parallel, webhook before/after callback, browser closed after capture, missing localStorage, intent-write failure, stock race, option deletion, product deletion, key rotation and booking capacity conflict. Test in isolated staging with synthetic users and Razorpay test mode.

**Usability sessions:** recruit 5–8 locals spanning resident, business-owner and job-seeker needs, including Marathi-first users and a less experienced phone user. Ask them to find a plumber, locate a clinic slot, resume a purchase, post/find work, and add an item with options. Observe task completion and confusion without coaching.

**Metrics:** search zero-result rate, time to first useful result, listing-to-contact click rate, Buy-to-login drop-off, checkout completion, captured payments unresolved beyond five minutes, duplicate orders/stock effects, owner first-item completion, bookable providers with upcoming slots, and real active job inventory. Record a baseline before assigning conversion-improvement percentages. Never include names, phone numbers, addresses or free-text queries containing personal information in analytics payloads.

**Suggested usability targets:** at least 80% unassisted completion of the core test tasks; no keyboard traps or inaccessible primary actions; zero duplicate financial side effects in fault tests; all captured payments either finalized or in an explicit monitored resolution state. Review production outcomes after two weeks and prioritize the next iteration using actual abandonment and support data.

## Preserve these strengths

- Unified Products & Services with an understandable Buy/WhatsApp distinction and owner preview.
- Server-side price/ownership checks, encrypted payment secrets at rest, signed webhook verification and test/live selling separation.
- Appointment capacity locking and existing booking-conflict tests.
- Distinctive warm visual identity, mobile bottom navigation, reduced-motion handling and global focus styles.
- Find's bilingual categories and moderation language, plus the jobs anti-scam warning.
- Existing error/404 pages, metadata and escaped structured-data serialization.

Passing tests and an attractive interface are valuable foundations. The security boundary and transaction failure cases need dedicated tests before those foundations can support more paid usage confidently.
