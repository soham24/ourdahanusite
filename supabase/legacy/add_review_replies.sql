-- ============================================================
-- Owner replies to reviews
--   - Adds reply columns to the `reviews` table.
--   - Server actions enforce "one reply per review" using the admin
--     client (same pattern as submitReview), so no extra RLS policy
--     is required. SELECT continues to be public; INSERT continues
--     to be authenticated-user-only on their own user_id.
-- ============================================================

ALTER TABLE reviews
  ADD COLUMN IF NOT EXISTS owner_reply text,
  ADD COLUMN IF NOT EXISTS owner_replied_at timestamptz;

-- Defense-in-depth: allow the listing owner to set their reply once via
-- the regular anon/authenticated client (in case we ever skip the admin
-- client). USING gates the source row; WITH CHECK gates the new row.
-- Column freezing is enforced in the server action, not here.
DROP POLICY IF EXISTS "Listing owner can reply once" ON reviews;
CREATE POLICY "Listing owner can reply once" ON reviews
  FOR UPDATE
  USING (
    owner_reply IS NULL
    AND EXISTS (
      SELECT 1 FROM listings
      WHERE listings.id = reviews.listing_id
        AND listings.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    owner_reply IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM listings
      WHERE listings.id = reviews.listing_id
        AND listings.owner_id = auth.uid()
    )
  );
