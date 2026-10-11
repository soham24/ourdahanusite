-- RPC that bundles the "stats" portion of src/lib/data/home.ts into a single
-- round-trip. Before this change the homepage fired four separate Supabase
-- calls for things Postgres can compute in one query:
--
--   1. SELECT category FROM listings WHERE approved  -- full scan, counted in Node
--   2. SELECT count(*) FROM listings WHERE approved
--   3. SELECT count(*) FROM jobs WHERE approved AND status IN ('open','hiring')
--   4. SELECT value FROM site_settings WHERE key='featured_listing_subdomain'
--      (then a SERIAL follow-up SELECT * FROM listings WHERE subdomain=...)
--
-- Call 1 was O(N) bandwidth — the full category column streamed back to Node
-- just to build a {category -> count} object. Calls 2+3 are cheap but add
-- round-trips. Call 4 triggered a sequential listing lookup, adding another
-- full RTT to the critical path whenever a featured listing is configured.
--
-- Everything here is STABLE read-only SQL that relies on the partial indexes
-- added in add_listings_homepage_indexes.sql for fast count / group-by paths.
--
-- Run in the Supabase SQL editor. Safe to re-run (CREATE OR REPLACE).
--
-- 2026-09-14: the total_jobs key was removed along with the legacy jobs
-- table (see drop_legacy_jobs_table.sql). Nothing on the web read it.

CREATE OR REPLACE FUNCTION public.get_homepage_stats()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'category_counts', COALESCE((
      SELECT jsonb_object_agg(category, cnt)
      FROM (
        SELECT category, count(*)::int AS cnt
        FROM listings
        WHERE approved = true AND category IS NOT NULL
        GROUP BY category
      ) t
    ), '{}'::jsonb),
    'total_listings', COALESCE((
      SELECT count(*)::int
      FROM listings
      WHERE approved = true
    ), 0),
    -- Only expose the columns the homepage actually renders. `to_jsonb(l.*)`
    -- would leak every column (including admin/private fields) to anon.
    'featured_listing', (
      SELECT jsonb_build_object(
        'id', l.id,
        'name', l.name,
        'category', l.category,
        'address', l.address,
        'rating', l.rating,
        'review_count', l.review_count,
        'image_url', l.image_url,
        'image_thumb_url', l.image_thumb_url,
        'tagline', l.tagline,
        'subdomain', l.subdomain,
        'verified', l.verified,
        'phone', l.phone
      )
      FROM site_settings s
      JOIN listings l
        ON l.subdomain = s.value
        AND l.approved = true
      WHERE s.key = 'featured_listing_subdomain'
      LIMIT 1
    )
  );
$$;

-- Homepage is public; anon + authenticated both need to call this.
GRANT EXECUTE ON FUNCTION public.get_homepage_stats() TO anon, authenticated;
