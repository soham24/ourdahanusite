-- Per-listing view and contact-tap events, deduped to one per visitor per day.
-- Additive only: no existing table or row is touched.
CREATE TABLE IF NOT EXISTS listing_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('view', 'phone', 'whatsapp')),
  -- Random per-browser identifier from localStorage. No PII: it exists only
  -- to answer "have we already counted this person today".
  visitor_key text NOT NULL,
  -- IST date, not UTC. A UTC day would roll over at 5:30am local time and
  -- split a single evening's browsing across two days.
  day date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- The dedupe itself. A client that fires twice, or someone calling the
-- endpoint in a loop, collides here and the duplicate is discarded.
CREATE UNIQUE INDEX IF NOT EXISTS idx_listing_events_daily
  ON listing_events (listing_id, kind, visitor_key, day);

-- Serves the owner's month aggregates and the retention prune.
CREATE INDEX IF NOT EXISTS idx_listing_events_listing_day
  ON listing_events (listing_id, day DESC);

ALTER TABLE listing_events ENABLE ROW LEVEL SECURITY;

-- No policy of any kind. Owners read aggregates through an ownership-checked
-- server action, and writes go through the service-role client, which
-- bypasses RLS. With RLS on and no policies, anon and authenticated clients
-- can neither read nor write this table directly.

-- Atomic lifetime view counter. A read-then-write from the application would
-- drop concurrent increments; this cannot.
CREATE OR REPLACE FUNCTION public.increment_listing_views(p_listing_id uuid)
RETURNS void
LANGUAGE sql
AS $$
  UPDATE listings
  SET views = COALESCE(views, 0) + 1
  WHERE id = p_listing_id;
$$;
