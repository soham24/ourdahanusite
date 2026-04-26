-- ============================================================
-- Listing thumbnails
--   - Store a small (240x240) thumb of the logo and a smaller (640w)
--     thumb of the cover banner so card grids and admin tables can
--     load fast without going through Vercel's Image Optimization API.
--   - Backfilled by scripts/backfill-listing-thumbs.mjs.
-- ============================================================

ALTER TABLE listings
  ADD COLUMN IF NOT EXISTS image_thumb_url text;

ALTER TABLE listings
  ADD COLUMN IF NOT EXISTS cover_image_thumb_url text;

ALTER TABLE listing_products
  ADD COLUMN IF NOT EXISTS image_thumb_url text;
