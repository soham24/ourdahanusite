-- ============================================================
-- Listing payments feature
--   - Admin toggles payments_enabled per listing.
--   - Owner submits their own Razorpay Key ID + Secret (encrypted).
--   - Checkout uses owner's keys; money flows direct to owner's Razorpay account.
-- ============================================================

ALTER TABLE listings
  ADD COLUMN IF NOT EXISTS payments_enabled boolean DEFAULT false;

CREATE TABLE IF NOT EXISTS listing_payment_configs (
  listing_id uuid PRIMARY KEY REFERENCES listings(id) ON DELETE CASCADE,
  razorpay_key_id text NOT NULL,
  razorpay_key_secret_encrypted text NOT NULL,
  razorpay_key_last4 text NOT NULL,
  test_mode boolean NOT NULL DEFAULT true,
  verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE listing_payment_configs ENABLE ROW LEVEL SECURITY;

-- Owners can read their own config row (secret is ciphertext, useless without server key).
DROP POLICY IF EXISTS "Owners read own payment config" ON listing_payment_configs;
CREATE POLICY "Owners read own payment config" ON listing_payment_configs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM listings
      WHERE listings.id = listing_payment_configs.listing_id
        AND listings.owner_id = auth.uid()
    )
  );

-- No client INSERT/UPDATE/DELETE — all writes go through server actions using the service-role client.

CREATE OR REPLACE FUNCTION public.touch_listing_payment_configs_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS listing_payment_configs_set_updated_at ON listing_payment_configs;

CREATE TRIGGER listing_payment_configs_set_updated_at
  BEFORE UPDATE ON listing_payment_configs
  FOR EACH ROW
  EXECUTE PROCEDURE public.touch_listing_payment_configs_updated_at();
