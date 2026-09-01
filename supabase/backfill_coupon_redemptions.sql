-- ============================================================
-- One-time backfill of historical coupon redemptions.
--
-- Idempotent: the NOT EXISTS guard means re-running inserts nothing.
--
-- KNOWN INACCURACY: every backfilled row is recorded as kind='new'.
-- renewListing overwrites listings.coupon_used on the same row, so past
-- renewals are unrecoverable from the database. Data from the deploy
-- forward is exact; this is a best-effort reconstruction of what the
-- column still holds.
--
-- The coupon_used IS NOT NULL filter also excludes the three 'manual'
-- admin-created listings automatically — all of them have a NULL coupon.
-- Every matching row is payment_status='paid', so the CHECK cannot fail.
-- ============================================================

INSERT INTO coupon_redemptions (
  coupon_id, coupon_code, user_id, listing_id,
  kind, payment_status, amount_paid, payment_id, redeemed_at
)
SELECT
  c.id,                                   -- NULL when the coupon was deleted
  lower(l.coupon_used),
  l.owner_id,
  l.id,
  'new',
  'paid',
  COALESCE(l.amount_paid, 0),
  l.payment_id,
  l.created_at
FROM listings l
LEFT JOIN coupons c ON c.code = lower(l.coupon_used)
WHERE l.coupon_used IS NOT NULL
  AND l.payment_status = 'paid'
  AND NOT EXISTS (
    SELECT 1 FROM coupon_redemptions r WHERE r.listing_id = l.id
  );
