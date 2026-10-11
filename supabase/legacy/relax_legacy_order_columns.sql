-- ============================================================
-- Step 1 of dropping the old payment route: make the legacy order
-- columns optional, so the site keeps saving orders in the window
-- between deploying the code removal and dropping the columns.
--   - commission_amount, seller_payout_amount and seller_upi_id are
--     NOT NULL with no default; the new insert stops writing them.
--   - payment_flow still defaults to the old route's value, which
--     would mislabel any order saved in that window.
-- The columns themselves are dropped in drop_mobile_api.sql once the
-- code is live. Safe to run more than once.
-- ============================================================

ALTER TABLE public.orders ALTER COLUMN commission_amount DROP NOT NULL;
ALTER TABLE public.orders ALTER COLUMN seller_payout_amount DROP NOT NULL;
ALTER TABLE public.orders ALTER COLUMN seller_upi_id DROP NOT NULL;
ALTER TABLE public.orders ALTER COLUMN payment_flow SET DEFAULT 'owner_razorpay';
