-- ============================================================
-- Selling setup hardening (whole-branch review follow-up)
--   - API roles cannot change listings.approved either: approval is
--     now the only gate before a business can take live payments.
--   - decrement_product_stock no longer refuses inactive items: it
--     runs only after Razorpay captured a payment.
--   - Suspension reasons move to a table only the service role reads.
-- Additive and idempotent: safe to run more than once.
-- ============================================================

CREATE OR REPLACE FUNCTION public.guard_listing_selling_columns()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF current_user NOT IN ('anon', 'authenticated') THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.approved := false;
    NEW.payments_enabled := false;
    NEW.payments_suspended_at := NULL;
    NEW.payments_suspended_reason := NULL;
    RETURN NEW;
  END IF;

  IF NEW.approved IS DISTINCT FROM OLD.approved
     OR NEW.payments_enabled IS DISTINCT FROM OLD.payments_enabled
     OR NEW.payments_suspended_at IS DISTINCT FROM OLD.payments_suspended_at
     OR NEW.payments_suspended_reason IS DISTINCT FROM OLD.payments_suspended_reason THEN
    RAISE EXCEPTION 'Listing approval and selling status can only be changed by OurDahanu.'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.decrement_product_stock(
  p_product_id uuid,
  p_quantity integer
)
RETURNS boolean
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_updated integer;
BEGIN
  -- No is_active filter: this runs only after Razorpay captured a payment,
  -- and hiding an item mid-payment must not refuse that order.
  UPDATE public.listing_products
  SET quantity_in_stock = quantity_in_stock - p_quantity
  WHERE id = p_product_id
    AND (quantity_in_stock IS NULL OR quantity_in_stock >= p_quantity);

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated > 0;
END;
$$;

CREATE TABLE IF NOT EXISTS public.listing_selling_suspensions (
  listing_id uuid PRIMARY KEY REFERENCES public.listings(id) ON DELETE CASCADE,
  reason text NOT NULL CHECK (char_length(reason) BETWEEN 1 AND 300),
  suspended_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.listing_selling_suspensions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.listing_selling_suspensions FROM anon, authenticated;

-- Carry over any reason already stored on the public row (none expected),
-- then clear the public copy.
INSERT INTO public.listing_selling_suspensions (listing_id, reason, suspended_at)
SELECT id, left(btrim(payments_suspended_reason), 300), coalesce(payments_suspended_at, now())
FROM public.listings
WHERE payments_suspended_reason IS NOT NULL AND btrim(payments_suspended_reason) <> ''
ON CONFLICT (listing_id) DO NOTHING;

UPDATE public.listings
SET payments_suspended_reason = NULL
WHERE payments_suspended_reason IS NOT NULL;
