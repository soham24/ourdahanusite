-- ============================================================
-- Payment Intents — robust paid-but-not-created recovery
--
-- Records every payment intent the moment a Razorpay order is
-- created, so that we can recover the listing/job/order/appointment
-- if the page closes, the network drops, or the server action
-- crashes after the user has been charged.
--
-- Lifecycle:
--   created    — Razorpay order created, payload stored, no payment yet
--   captured   — Webhook or client confirmed payment is captured at Razorpay
--   finalized  — Local entity (listing/job/order/...) created successfully
--   failed     — Permanent failure recorded (admin intervention)
--   cancelled  — User cancelled before paying or refunded
--
-- Idempotency:
--   - razorpay_order_id is UNIQUE
--   - razorpay_payment_id is unique when set
--   - finalize step looks up by razorpay_payment_id first; if a
--     payment_intent is already 'finalized', we return the existing
--     entity_id instead of creating a duplicate.
-- ============================================================

CREATE TABLE IF NOT EXISTS payment_intents (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- Which flow this intent belongs to
  flow text NOT NULL CHECK (flow IN (
    'listing', 'job', 'renew', 'order', 'marketplace', 'appointment'
  )),

  -- Razorpay identifiers
  razorpay_order_id text NOT NULL UNIQUE,
  razorpay_payment_id text,
  razorpay_signature text,

  -- Money + currency
  amount_paise integer NOT NULL CHECK (amount_paise >= 0),
  currency text NOT NULL DEFAULT 'INR',

  -- Payload required to (re-)create the entity if the client never
  -- comes back. Kept as jsonb so any flow's input fits.
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,

  -- For marketplace flow we may need the owner key id we used so
  -- recovery can re-fetch the order with the right credentials.
  listing_id uuid REFERENCES listings(id) ON DELETE SET NULL,

  -- State machine
  status text NOT NULL DEFAULT 'created' CHECK (status IN (
    'created', 'captured', 'finalized', 'failed', 'cancelled'
  )),

  -- Once finalized, where the entity lives
  entity_id uuid,
  entity_table text,

  -- Diagnostic / retry support
  last_error text,
  retry_count integer NOT NULL DEFAULT 0,

  -- Timestamps
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  captured_at timestamptz,
  finalized_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_payment_intents_user
  ON payment_intents (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_payment_intents_status
  ON payment_intents (status)
  WHERE status IN ('created', 'captured');

CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_intents_payment_id
  ON payment_intents (razorpay_payment_id)
  WHERE razorpay_payment_id IS NOT NULL;

ALTER TABLE payment_intents ENABLE ROW LEVEL SECURITY;

-- Owners can read their own intents (so the recovery UI can show them)
DROP POLICY IF EXISTS "Users read own payment intents" ON payment_intents;
CREATE POLICY "Users read own payment intents" ON payment_intents
  FOR SELECT USING (auth.uid() = user_id);

-- All writes go through the service-role admin client only.

CREATE OR REPLACE FUNCTION public.touch_payment_intents_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS payment_intents_set_updated_at ON payment_intents;

CREATE TRIGGER payment_intents_set_updated_at
  BEFORE UPDATE ON payment_intents
  FOR EACH ROW
  EXECUTE PROCEDURE public.touch_payment_intents_updated_at();
