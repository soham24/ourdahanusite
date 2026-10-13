# Public release checklist

Where this repository stands against going public, what was checked and how,
and what is left. No secrets or exploit detail here — sensitive specifics go
to the maintainer directly.

Last reviewed: 2026-10-13, against `main` at the merge of PR #124.

---

## Verdict

**Ready after the owner actions listed below.** Nothing found in the code or
the history blocks publication. The open items are decisions and hosting
settings that only the repository owner can make.

---

## Exposure audit

### Scope

| Surface | Covered | How |
|---|---|---|
| Tracked files on `main` | Yes | Pattern scan plus targeted reads |
| Full local Git history | Yes | Every reachable object: 2,508 blobs across 718 commits |
| Local branches | Yes | 98 branches, included in the object scan |
| Tags | N/A | None exist |
| GitHub release assets | **No** | None published; nothing to inspect |
| GitHub Actions logs and artifacts | **No** | Not retrievable from this environment |
| Issue and pull request text | **No** | Not inspected; see owner actions |

The object scan covers everything reachable from any ref, so a secret that was
committed and later removed would still have been caught. It cannot see
content that only ever existed in GitHub's web UI — Actions logs, issue
comments, PR descriptions.

### Result

No credential of any kind was found in the working tree or in history. The
scan looked for Supabase JWTs and secret keys, Supabase personal access
tokens, Razorpay key IDs and secrets, Resend API keys, Google OAuth client
secrets, AWS access keys, GitHub tokens, Telegram bot tokens, PEM private
keys, and Postgres connection URLs.

No `.env` file has ever been committed. `.env.local.example` is tracked, and
every value in it is a placeholder.

### Already public by design, and fine

- **`NEXT_PUBLIC_SUPABASE_ANON_KEY`** ships in the browser bundle. Row level
  security is the access boundary, not the key. This is how Supabase is meant
  to work, and `SECURITY.md` says so, so researchers do not report it.
- **`get_profile_names(uuid[])`** is executable by anonymous callers. It
  returns display names for a list of account ids and nothing else, so a
  review can show who wrote it. It replaced the `public_profiles` view, which
  exposed id, name and avatar for *every* account and was dropped in
  migration `20261011020000`.

### Owner's own contact details

`src/content/local.ts` and `src/lib/site-config.ts` carry the maintainer's
WhatsApp number and email address. Both are already published on the live
site, so this is not new exposure — but a public repository is far easier to
scrape. `npm run doctor` warns a fork to replace both. **Owner decision:**
keep them, or move to a role address before publishing.

---

## What was verified, and how

Run in a clean clone (`git clone` into an empty directory, no `.env.local`,
no credentials of any kind), on Node 24.20.0:

| Check | Result |
|---|---|
| `npm ci` | Passed |
| `npx tsc --noEmit` | Passed |
| `npm test` | **390 passed, 0 failed** (340 unit + 47 security + 3 game) |
| `npm run doctor` | Ran, reported the missing settings with correct next steps |
| `npm run setup` with no Docker | Failed cleanly: plain-English message, correct fallback, exit code 1 |
| `npm run build` with placeholder credentials | Passed, including the Server Action credential boundary check |

**This matters for contributors:** the full test suite and the type check pass
with no credentials at all, so a first-time contributor can validate their
work without an account anywhere.

### Limitations — not verified

- **The documented Docker quick start (`npm run setup`) was not run.** Docker
  is not installed in the environment this review ran in. The script's
  no-Docker path was verified; the path that actually starts a local database
  and seeds it was not. Someone with Docker should run it once from a clean
  clone before launch.
- **The e2e and Lighthouse workflows were not executed locally.** They run in
  CI; their configuration was read, not exercised.
- **This was not a penetration test.** The review below is a read of the
  access-control code and the live database's policies, not an attempt to
  break them.

---

## Repository hygiene

### Done in this pass

- **Least-privilege workflow permissions.** None of the five workflows
  declared a `permissions:` block, so each ran with whatever the repository
  default grants — which, on a public repo, is the token handed to every
  fork's pull request build. All five now declare `contents: read`.
- **`npm run doctor` now matches the README.** A newcomer with no
  `.env.local` was being told to fetch credentials from a Supabase dashboard,
  contradicting the README's opening promise of "no accounts, no keys". It now
  points at `npm run setup` first.

### Already in place, confirmed

- MIT licence, scoped in the README so the name, logo and site content are
  excluded.
- `SECURITY.md` routes reports to a private advisory and lists the
  deliberate-looking-but-fine findings.
- `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, issue forms, a pull request
  template, and Dependabot.
- Five workflows: CI, e2e, Docker, scheduled cron, and a migration workflow
  that declares `environment: production`. Note that it runs on **push to
  `main`** whenever `supabase/migrations/**` changes, not only on manual
  dispatch — so merging a pull request that adds a migration applies it to
  the live database. Whether the `production` environment has a required
  reviewer holding that back is a GitHub setting and could not be checked
  from here. See owner actions.
- **No workflow triggered by a pull request uses any secret.** Only `cron.yml`
  and `migrate.yml` do, and neither runs on pull requests, so a fork cannot
  reach them. No workflow uses `pull_request_target`.
- `npm test` enforces two things that used to drift silently: every test file
  is registered, and `src/proxy.ts`'s hardcoded host regexes still match
  `site-config.ts`.

---

## Multi-tenant review

Businesses each get a subdomain, so the risks worth naming are tenant
isolation and impersonation.

### Holds up

- **Row level security is on for every table** holding personal or business
  data. `profiles` is restricted to each user's own row with no anonymous
  policy, so the public anon key cannot enumerate accounts.
- **Reserved subdomains** are refused at listing creation and ignored by the
  host resolver, and `npm test` checks that `src/proxy.ts`'s inline copy
  still matches. A seller cannot claim `admin`, `login`, `api` and so on.

  Fixed in this pass: the availability endpoint
  (`/api/check-subdomain`) kept a *third* hand-written copy of the list, and
  it had fallen a name behind — `appointments` reported available and then
  failed at submit. It reads the shared set now, with a test that fails if
  another copy appears.
- **Listings are not self-publishing.** A database trigger forces `approved`
  and `payments_enabled` to false for API-role inserts, so an impersonating
  listing cannot reach the public directory without an admin acting.
- **The admin area is gated in its layout**, so every page under it is
  protected server-side rather than page by page.
- **Owner payment secrets** are encrypted at rest with AES-256-GCM, and a
  build-time check fails the build if a server action leaks a credential into
  client-reachable code.
- **Uploads** are capped at 2 MB and restricted to `image/*` **by the storage
  bucket**, not only by the browser, so the client-side checks are not the
  control.

### Open: storage writes are not scoped to the uploader

Any signed-in user may write to any path in the single public `uploads`
bucket; the insert policy checks only the bucket name. Uploads also use a flat
`public/<timestamp>-<name>.jpg` path with no per-user folder, so there is
nothing for a tighter policy to key on today.

Overwriting someone else's image is *not* possible — there is no update
policy, so RLS refuses the overwrite half of an upsert. The practical risk is
abuse rather than cross-tenant data access: a signed-in account can upload
unlimited 2 MB images and have them served from the site's own domain.

Remediation, in this order:

1. Change the upload path to include the uploader: `public/<uid>/<name>.jpg`.
   Existing images keep working — their URLs are stored in the database, and
   the read policy is unchanged.
2. Deploy that, then add an insert policy requiring
   `(storage.foldername(name))[2] = auth.uid()::text`.
3. Consider a per-account upload quota or rate limit.

Deliberately not done in this pass: it changes live upload behaviour, and
tightening the policy before the new paths are deployed would break uploads
for every owner.

---

## Owner actions before going public

1. **Confirm preview deployments do not carry production credentials.**
   Preview builds have been sharing the production Supabase URL, anon key and
   **service-role key**. While the repository is private this is a small blast
   radius. Public, it is not: if the hosting provider is configured to build
   pull requests from forks, a contributor's branch runs with a
   service-role key, which bypasses row level security entirely. Check the
   provider's fork-build setting and give previews their own project, or
   disable preview builds for forks. **Treat this as blocking.**
2. **Confirm the `production` environment has a required reviewer.
   Treat this as blocking.** The migration workflow runs `supabase db push`
   against the live database, and it triggers on push to `main` whenever
   `supabase/migrations/**` changes — merging a pull request that adds a
   migration is enough. A required reviewer on that environment is the only
   thing holding it; without one, a merge migrates production unattended,
   and once the repository is public the pool of people who can open that
   pull request is everyone. Settings → Environments → production.
3. **Rotate anything that was ever pasted outside the repository** — chat,
   screenshots, issue comments. The repository is clean; that is not evidence
   about places this review could not see.
4. **Review existing issues and pull request descriptions** for pasted keys,
   logs or customer details. Not inspectable from here.
5. **Decide on the personal WhatsApp number and email** in
   `src/content/local.ts` and `src/lib/site-config.ts`.
6. **Run the Docker quick start once from a clean clone**, so the README's
   headline path is known to work and not merely believed to.
7. **Decide whether to add a screenshot.** The README has no visual. A real
   one shows real businesses — public already, but more durable in a
   repository. None was invented for this pass.

### GitHub settings, once public

- Branch protection on `main`: require pull requests, and require the CI and
  e2e checks. **Not the Docker check** — it is path-filtered to Dockerfile and
  dependency changes, so on any other pull request it never reports, and a
  required check that never reports blocks the merge forever.
- Enable private vulnerability reporting, so `SECURITY.md`'s link works.
- Enable Dependabot alerts and secret scanning with push protection.
- Set "Require approval for all outside collaborators" on workflow runs, so a
  first-time contributor's workflow does not run unreviewed.
- Add the About description, website and topics (suggested in the handover).

---

## Not done, and why

- **No history rewrite.** Nothing was found that needs one. If something turns
  up later, removing it from the current files does not remove it from
  history: it needs a rewrite of every commit that touched it *and* rotation
  of the exposed credential, because anyone may already have a clone.
- **No credential rotation, no visibility change, no push, no release.** All
  require the owner's explicit go-ahead.
