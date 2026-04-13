-- ============================================================
-- Appointments feature
-- ============================================================

ALTER TABLE listings
  ADD COLUMN IF NOT EXISTS appointments_enabled boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS appointment_booking_fee numeric(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS appointment_settings jsonb DEFAULT null;

CREATE TABLE IF NOT EXISTS appointments (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  listing_id uuid NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  booking_date date NOT NULL,
  slot_start time NOT NULL,
  slot_end time NOT NULL,
  user_name text NOT NULL,
  user_phone text NOT NULL,
  user_email text,
  notes text,
  booking_fee numeric(10,2) NOT NULL DEFAULT 0,
  razorpay_order_id text,
  razorpay_payment_id text,
  razorpay_signature text,
  payment_status text NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'free')),
  status text NOT NULL DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'completed', 'cancelled', 'no_show')),
  cancelled_by text CHECK (cancelled_by IN ('user', 'owner', 'admin')),
  cancellation_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (slot_end > slot_start),
  CHECK (booking_fee >= 0)
);

ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON appointments TO anon, authenticated;

CREATE INDEX IF NOT EXISTS idx_appointments_listing_slot
  ON appointments (listing_id, booking_date, slot_start);

CREATE INDEX IF NOT EXISTS idx_appointments_user_date
  ON appointments (user_id, booking_date);

CREATE INDEX IF NOT EXISTS idx_appointments_confirmed_slot
  ON appointments (listing_id, booking_date, slot_start)
  WHERE status = 'confirmed';

CREATE UNIQUE INDEX IF NOT EXISTS idx_appointments_unique_active_user_slot
  ON appointments (listing_id, user_id, booking_date, slot_start)
  WHERE status <> 'cancelled';

DROP POLICY IF EXISTS "Users can read own appointments" ON appointments;
DROP POLICY IF EXISTS "Owners can read appointments for own listings" ON appointments;

CREATE POLICY "Users can read own appointments" ON appointments
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Owners can read appointments for own listings" ON appointments
  FOR SELECT USING (
    EXISTS (
      SELECT 1
      FROM listings
      WHERE listings.id = appointments.listing_id
        AND listings.owner_id = auth.uid()
    )
  );

CREATE OR REPLACE FUNCTION public.touch_appointments_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS appointments_set_updated_at ON appointments;

CREATE TRIGGER appointments_set_updated_at
  BEFORE UPDATE ON appointments
  FOR EACH ROW
  EXECUTE PROCEDURE public.touch_appointments_updated_at();

CREATE OR REPLACE FUNCTION public.create_appointment_booking(
  p_listing_id uuid,
  p_user_id uuid,
  p_booking_date date,
  p_slot_start time,
  p_slot_end time,
  p_user_name text,
  p_user_phone text,
  p_user_email text,
  p_notes text,
  p_booking_fee numeric,
  p_razorpay_order_id text,
  p_razorpay_payment_id text,
  p_razorpay_signature text,
  p_payment_status text
)
RETURNS uuid
LANGUAGE plpgsql
AS $$
DECLARE
  v_appointment_id uuid;
  v_capacity integer := 1;
  v_settings jsonb;
  v_existing integer := 0;
BEGIN
  PERFORM pg_advisory_xact_lock(
    hashtext(p_listing_id::text || '|' || p_booking_date::text || '|' || p_slot_start::text)
  );

  SELECT appointment_settings
  INTO v_settings
  FROM listings
  WHERE id = p_listing_id
    AND approved = true
    AND appointments_enabled = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Appointments are not enabled for this listing';
  END IF;

  v_capacity := GREATEST(
    1,
    COALESCE(NULLIF(v_settings->>'capacity', '')::integer, 1)
  );

  SELECT COUNT(*)
  INTO v_existing
  FROM appointments
  WHERE listing_id = p_listing_id
    AND booking_date = p_booking_date
    AND slot_start = p_slot_start
    AND status = 'confirmed';

  IF v_existing >= v_capacity THEN
    RAISE EXCEPTION 'Selected slot is already full';
  END IF;

  INSERT INTO appointments (
    listing_id,
    user_id,
    booking_date,
    slot_start,
    slot_end,
    user_name,
    user_phone,
    user_email,
    notes,
    booking_fee,
    razorpay_order_id,
    razorpay_payment_id,
    razorpay_signature,
    payment_status,
    status
  )
  VALUES (
    p_listing_id,
    p_user_id,
    p_booking_date,
    p_slot_start,
    p_slot_end,
    p_user_name,
    p_user_phone,
    p_user_email,
    p_notes,
    COALESCE(p_booking_fee, 0),
    p_razorpay_order_id,
    p_razorpay_payment_id,
    p_razorpay_signature,
    p_payment_status,
    'confirmed'
  )
  RETURNING id INTO v_appointment_id;

  RETURN v_appointment_id;
END;
$$;
