-- ============================================================
-- Step 2 of dropping the old payment route: remove what the mobile
-- API and the "pay OurDahanu, we pay the business" route left behind.
-- Run only after the code removal is deployed (see
-- docs/superpowers/specs/2026-09-16-drop-mobile-api-design.md).
--   - device_tokens: push tokens for an app that was never built
--   - listings.services: the frozen old item list, copied into
--     listing_products by add_one_catalog.sql
--   - eleven orders columns: payouts, commission and the old route's
--     Razorpay fields (the live route uses owner_razorpay_*)
-- Guarded and idempotent: it refuses to run if either dead thing
-- turns out to have data, and re-running it changes nothing.
-- ============================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'payment_flow'
  ) AND EXISTS (
    SELECT 1 FROM public.orders WHERE payment_flow = 'platform_upi_payout'
  ) THEN
    RAISE EXCEPTION 'Orders exist on the old payment route — stopping instead of dropping.';
  END IF;

  IF to_regclass('public.device_tokens') IS NOT NULL
     AND EXISTS (SELECT 1 FROM public.device_tokens) THEN
    RAISE EXCEPTION 'Device tokens exist — stopping instead of dropping.';
  END IF;
END $$;

DROP TABLE IF EXISTS public.device_tokens;

ALTER TABLE public.listings DROP COLUMN IF EXISTS services;

ALTER TABLE public.orders
  DROP COLUMN IF EXISTS payment_flow,
  DROP COLUMN IF EXISTS commission_rate,
  DROP COLUMN IF EXISTS commission_amount,
  DROP COLUMN IF EXISTS seller_payout_amount,
  DROP COLUMN IF EXISTS seller_upi_id,
  DROP COLUMN IF EXISTS payout_status,
  DROP COLUMN IF EXISTS razorpay_payout_id,
  DROP COLUMN IF EXISTS payout_error,
  DROP COLUMN IF EXISTS razorpay_order_id,
  DROP COLUMN IF EXISTS razorpay_payment_id,
  DROP COLUMN IF EXISTS razorpay_signature;
