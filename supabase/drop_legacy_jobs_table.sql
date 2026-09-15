-- Remove the legacy jobs board table.
--
-- The /jobs feature was deleted from the app on 2026-07-16 (b4e0b1e); only
-- this empty table was left behind. Verified 2026-09-14 with the service
-- role: 0 rows in public.jobs, 0 profiles with role 'job_reviewer'.
--
-- ORDER MATTERS. get_homepage_stats is LANGUAGE sql with a plain dollar-quoted body, so
-- Postgres does not record that it reads jobs: DROP TABLE alone would succeed,
-- and the function would then fail on every call. src/lib/data/home.ts ignores
-- that error, so the homepage would silently render 0 businesses, no featured
-- listing and no category counts - and cache it. The function is therefore
-- replaced first, inside the same transaction.
--
-- No CASCADE on the drop: if anything else still depends on jobs, the drop
-- fails loudly and the whole transaction rolls back, function included.

BEGIN;

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

GRANT EXECUTE ON FUNCTION public.get_homepage_stats() TO anon, authenticated;

DROP TABLE IF EXISTS public.jobs;

COMMIT;
