# Database migrations

The schema lives in `supabase/migrations/`, one file per change, applied in
filename order. Supabase records which ones a database has in its own history
table (`supabase_migrations.schema_migrations`); `supabase db push` compares
that history with this folder and applies what is missing.

## Writing one

Add a **new** file, never edit an existing one; the name sets the order:

```bash
npx supabase@2.120.0 migration new add_something   # creates supabase/migrations/<timestamp>_add_something.sql
npm run db:reset                                   # replays every migration + seed locally
```

## Applying them

- **Locally:** `npm run db:reset`.
- **To a hosted project, by hand:** `npm run db:link -- --project-ref <ref>`,
  then `npm run db:push`.
- **Automatically, on merge:** `.github/workflows/migrate.yml` runs
  `db push` whenever a migration reaches `main`. It is off until you set the
  `SUPABASE_PROJECT_REF` variable and the `SUPABASE_ACCESS_TOKEN` and
  `SUPABASE_DB_PASSWORD` secrets (the workflow file says where). It runs in
  the `production` environment; add yourself as a required reviewer there and
  every run waits for your approval.

## Before turning on the workflow: make the history match, once

`db push` trusts the history table. If a database was set up any other way
than `db push` — by pasting files into the SQL editor, or by the older
hand-applied files in `supabase/legacy/` — its history does not list these
files, and `db push` would try to run them again, starting with the baseline.
So fix the history first. `migration repair` only edits the history table; it
never touches the schema.

**A database set up by pasting `supabase/migrations/` into the SQL editor:**
mark every file as applied.

```bash
npm run db:link -- --project-ref <ref>
npx supabase@2.120.0 migration repair --status applied \
  20261011000000 20261011010000 20261011020000 20261011030000 20261011040000 \
  20261011050000 20261011060000 20261011070000 20261012010000
npx supabase@2.120.0 db push --dry-run    # should say the remote is up to date
```

**ourdahanu.in's own database** has a longer past: its history lists the
older hand-applied migrations, and today's under the timestamps they were
applied at (`20261011124643_profile_names_and_function_grants` rather than
this folder's `20261011010000_…`), so `db push` stops with "Remote migration
versions not found in local migrations directory". First confirm the live schema really
matches this folder (needs Docker; prints nothing when they agree):

```bash
npm run db:link -- --project-ref slmbqngmxketyxjauxxk
npx supabase@2.120.0 db diff --linked
```

Then retire the old entries and record this folder's instead:

```bash
npx supabase@2.120.0 migration repair --status reverted \
  20260613180848 20260614184041 20260614191205 20260615050246 20260615062246 \
  20260711140649 20260711185932 20260713093534 20260716070949 20260721111839 \
  20260901161759 20260901163445 20260901172227 20260901172237 20260909142610 \
  20260914154233 20260914154330 20260915090248 20260915115953 20260915180648 \
  20260916040117 20260916041331 20260927051131 20261011124643 20261011132547 \
  20261011150824 20261011150843 20261011151217 20261011152228 20261012023301 \
  20261012025127
npx supabase@2.120.0 migration repair --status applied \
  20261011000000 20261011010000 20261011020000 20261011030000 20261011040000 \
  20261011050000 20261011060000 20261011070000 20261012010000
npx supabase@2.120.0 db push --dry-run    # should say the remote is up to date
```

These exact commands were rehearsed against a local copy carrying the same
history: `db push` refused before, and reported "up to date" with nothing to
apply after. Only then set the workflow's variable and secrets.
