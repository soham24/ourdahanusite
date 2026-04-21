-- Indexes to speed up the homepage queries in src/lib/data/home.ts.
--
-- Every homepage render issues several queries against `listings` filtered
-- on `approved = true` and sorted by combinations of (verified, review_count,
-- created_at). Today the table has only `listings_subdomain_idx`, so each
-- query does a sequential scan. At 30 rows this is invisible; at a few
-- hundred it will dominate cold-cache render time. Partial indexes keyed on
-- `WHERE approved` keep them small and targeted to the hot query path.
--
-- Run in the Supabase SQL editor. Safe to re-run (uses IF NOT EXISTS).
-- The table is small today so a plain CREATE INDEX is fine; switch to
-- CREATE INDEX CONCURRENTLY (outside any transaction) when the row count
-- grows large enough that a brief write lock would matter.

-- Sort "new" listings by created_at.
create index if not exists idx_listings_approved_created_at
  on listings (created_at desc)
  where approved;

-- Sort "popular"/"featured" listings by verified → review_count → created_at.
create index if not exists idx_listings_approved_featured_sort
  on listings (verified desc, review_count desc, created_at desc)
  where approved;

-- Group and count by category for the Popular Categories homepage tiles.
create index if not exists idx_listings_approved_category
  on listings (category)
  where approved;
