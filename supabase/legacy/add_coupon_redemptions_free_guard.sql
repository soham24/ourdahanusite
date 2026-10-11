-- Free-coupon redemptions store payment_id = NULL and so are not covered by
-- idx_coupon_redemptions_payment_id. submitPaidListing is protected by the
-- subdomain UNIQUE check, but renewListing updates an existing row and has no
-- natural key — its findFinalizedIntentByPaymentId guard is inside if (!isFree)
-- and never runs on the free path. Without this index a double-submitted free
-- renewal writes two kind='renewal' rows.
--
-- NOTE: timestamptz::date is NOT immutable (it depends on the TimeZone setting)
-- and Postgres rejects it in an index. The AT TIME ZONE 'UTC' form below is
-- immutable and is what must be used.
CREATE UNIQUE INDEX IF NOT EXISTS idx_coupon_redemptions_free
  ON coupon_redemptions (listing_id, coupon_code, kind, ((redeemed_at AT TIME ZONE 'UTC')::date))
  WHERE payment_id IS NULL;
