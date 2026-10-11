-- Per-date exceptions to a business's weekly appointment schedule.
-- Additive only: no existing table or row is touched.
CREATE TABLE IF NOT EXISTS appointment_date_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  override_date date NOT NULL,
  closed boolean NOT NULL DEFAULT true,
  -- When closed = false, the windows that replace the weekday's normal hours.
  -- Shape: [{"start":"HH:MM","end":"HH:MM"}, ...]
  windows jsonb,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT appointment_date_overrides_unique_day UNIQUE (listing_id, override_date)
);

CREATE INDEX IF NOT EXISTS idx_appt_overrides_listing_date
  ON appointment_date_overrides (listing_id, override_date);

ALTER TABLE appointment_date_overrides ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON appointment_date_overrides TO anon, authenticated;

-- Opening hours are public information, but only for listings that are live.
-- All writes go through server actions on the service-role client, so no
-- INSERT/UPDATE/DELETE policy exists by design.
DROP POLICY IF EXISTS "Anyone can read overrides for approved listings" ON appointment_date_overrides;

CREATE POLICY "Anyone can read overrides for approved listings" ON appointment_date_overrides
  FOR SELECT USING (
    EXISTS (
      SELECT 1
      FROM listings
      WHERE listings.id = appointment_date_overrides.listing_id
        AND listings.approved = true
    )
  );
