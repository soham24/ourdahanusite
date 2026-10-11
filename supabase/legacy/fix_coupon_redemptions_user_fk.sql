-- coupon_redemptions.user_id was declared NOT NULL REFERENCES profiles(id)
-- ON DELETE CASCADE. Since profiles.id -> auth.users(id) is also CASCADE,
-- deleting one auth user would silently delete their redemption rows through
-- two hops, changing historical revenue totals with no trace. This
-- contradicts the append-only design that add_coupon_redemptions.sql already
-- applies to coupon_id and listing_id (nullable + ON DELETE SET NULL, "never
-- CASCADE" — deleting a coupon or listing must never destroy history).
--
-- No application code deletes users today (all auth.admin.* call sites are
-- read-only), so this is latent, but it defeats the ledger's stated purpose.
-- This migration makes user_id nullable and switches its FK to SET NULL,
-- matching its siblings. Idempotent: safe to run more than once.

DO $$
DECLARE
  fk_name text;
BEGIN
  SELECT conname INTO fk_name
  FROM pg_constraint
  WHERE conrelid = 'coupon_redemptions'::regclass
    AND contype = 'f'
    AND confrelid = 'profiles'::regclass
    AND pg_get_constraintdef(oid) LIKE '%(user_id)%';

  IF fk_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE coupon_redemptions DROP CONSTRAINT %I', fk_name);
  END IF;
END $$;

ALTER TABLE coupon_redemptions ALTER COLUMN user_id DROP NOT NULL;

ALTER TABLE coupon_redemptions
  ADD CONSTRAINT coupon_redemptions_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE SET NULL;
