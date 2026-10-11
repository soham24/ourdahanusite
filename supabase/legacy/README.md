# Legacy SQL — history only, do not run

These are the schema files the project grew up with: `schema.sql` plus one file
per change, run by hand in the Supabase SQL editor. Over time the live database
drifted from them — some changes were applied straight from the editor and
never written down here, and `schema.sql` stopped describing the real schema.

`../migrations/20261011000000_baseline.sql` replaces all of them. It was
generated from the production database itself and is checked against it, so it
is the one source of truth for a fresh install.

They are kept because their comments explain *why* parts of the schema look
the way they do, and two of them are still exercised by tests
(`scripts/test-security-migration.mjs`, `scripts/test-marketplace-finalization.mjs`).
Running them on top of the baseline would fail or, worse, partly succeed.
