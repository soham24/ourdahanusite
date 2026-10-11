-- ============================================================
-- Patch existing poll policies to protect voter privacy and
-- enforce poll validity at the database layer.
-- ============================================================

REVOKE SELECT ON poll_votes FROM anon;
GRANT SELECT ON poll_votes TO authenticated;

DROP POLICY IF EXISTS "Vote counts are public" ON poll_votes;
DROP POLICY IF EXISTS "Authenticated users can vote" ON poll_votes;
DROP POLICY IF EXISTS "Users can update own vote" ON poll_votes;
DROP POLICY IF EXISTS "Users can read own votes" ON poll_votes;
DROP POLICY IF EXISTS "Authenticated users can vote on active polls" ON poll_votes;
DROP POLICY IF EXISTS "Users can update own active vote" ON poll_votes;

CREATE POLICY "Users can read own votes" ON poll_votes
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Authenticated users can vote on active polls" ON poll_votes
  FOR INSERT WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1
      FROM polls p
      WHERE p.id = poll_id
        AND p.active = true
        AND p.ends_at > now()
        AND EXISTS (
          SELECT 1
          FROM jsonb_array_elements(p.options) AS opt
          WHERE opt->>'id' = option_id
        )
    )
  );

CREATE POLICY "Users can update own active vote" ON poll_votes
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1
      FROM polls p
      WHERE p.id = poll_id
        AND p.active = true
        AND p.ends_at > now()
        AND EXISTS (
          SELECT 1
          FROM jsonb_array_elements(p.options) AS opt
          WHERE opt->>'id' = option_id
        )
    )
  );
