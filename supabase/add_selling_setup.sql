-- ============================================================
-- Selling setup (commerce roadmap piece 1)
--   - Admins can suspend a listing's online selling.
--   - Orders paid with Razorpay test keys are marked as tests.
--   - API roles cannot change the selling columns directly; only
--     server code using the service role can.
-- Additive and idempotent: safe to run more than once.
-- ============================================================

ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS payments_suspended_at timestamptz,
  ADD COLUMN IF NOT EXISTS payments_suspended_reason text;

ALTER TABLE public.listings
  DROP CONSTRAINT IF EXISTS listings_payments_suspended_reason_length;
ALTER TABLE public.listings
  ADD CONSTRAINT listings_payments_suspended_reason_length
  CHECK (payments_suspended_reason IS NULL OR char_length(payments_suspended_reason) <= 300);

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS is_test boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.guard_listing_selling_columns()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF current_user NOT IN ('anon', 'authenticated') THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.payments_enabled := false;
    NEW.payments_suspended_at := NULL;
    NEW.payments_suspended_reason := NULL;
    RETURN NEW;
  END IF;

  IF NEW.payments_enabled IS DISTINCT FROM OLD.payments_enabled
     OR NEW.payments_suspended_at IS DISTINCT FROM OLD.payments_suspended_at
     OR NEW.payments_suspended_reason IS DISTINCT FROM OLD.payments_suspended_reason THEN
    RAISE EXCEPTION 'Selling status can only be changed by OurDahanu.'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_listing_selling_columns ON public.listings;
CREATE TRIGGER trg_guard_listing_selling_columns
  BEFORE INSERT OR UPDATE ON public.listings
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_listing_selling_columns();
