-- ============================================================
-- Coupon Redemptions — append-only ledger
--
-- Replaces coupons.usage_count, which reads 0 for every coupon
-- because (a) the coupons table has no UPDATE RLS policy so the
-- write was silently rejected, (b) the increment was a dangling
-- promise in a serverless function, and (c) it fired at Razorpay
-- order-creation rather than on successful payment.
--
-- One row per SUCCESSFUL redemption. Never updated, never deleted
-- by application code.
--
-- Why both coupon_id AND coupon_code:
--   deleteCoupon() hard-deletes. Three already-deleted codes
--   (ourdahanu, coreourdahanu, manas) account for 18 of the 32
--   historical redemptions. The FK enables joins while the coupon
--   exists; the text snapshot preserves history after it is gone.
--   ON DELETE SET NULL (never CASCADE) for the same reason.
--
-- payment_status is CHECKed to ('paid','free_coupon') only.
--   listings.payment_status has a third value, 'manual', written by
--   admin-created listings (src/app/actions/admin-listings.ts:66).
--   Every 'manual' row has coupon_used IS NULL and that path never
--   applies a coupon, so it cannot reach this table. If admin-created
--   listings ever gain coupon support, widen this CHECK first.
-- ============================================================

CREATE TABLE IF NOT EXISTS coupon_redemptions (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Nullable + SET NULL so deleting a coupon never destroys history.
  coupon_id uuid REFERENCES coupons(id) ON DELETE SET NULL,
  -- Lowercase snapshot of the code at redemption time. Survives deletion.
  coupon_code text NOT NULL,

  -- Originally NOT NULL ... ON DELETE CASCADE. Since profiles.id -> auth.users(id)
  -- is also CASCADE, that let deleting one auth user silently delete their
  -- redemption rows through two hops, contradicting the append-only design
  -- described above for coupon_id/listing_id. Fixed to nullable + SET NULL by
  -- supabase/fix_coupon_redemptions_user_fk.sql — see that file for the
  -- migration; the column below reflects the corrected, current shape.
  user_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  -- SET NULL so deleting a listing does not erase that money came in.
  listing_id uuid REFERENCES listings(id) ON DELETE SET NULL,

  kind text NOT NULL CHECK (kind IN ('new', 'renewal')),
  payment_status text NOT NULL CHECK (payment_status IN ('paid', 'free_coupon')),

  -- Rupees, matching listings.amount_paid and SubmissionCharge.finalPrice.
  amount_paid integer NOT NULL DEFAULT 0 CHECK (amount_paid >= 0),
  -- Razorpay payment id. NULL for free-coupon redemptions.
  payment_id text,

  redeemed_at timestamptz NOT NULL DEFAULT now()
);

-- Idempotency: a retried or replayed payment cannot double-count.
-- Does not cover free redemptions (payment_id IS NULL) — accepted:
-- production has zero free_coupon listings, and the write happens once
-- in the same guarded code path that creates the listing.
CREATE UNIQUE INDEX IF NOT EXISTS idx_coupon_redemptions_payment_id
  ON coupon_redemptions (payment_id)
  WHERE payment_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_coupon_redemptions_code
  ON coupon_redemptions (coupon_code);

CREATE INDEX IF NOT EXISTS idx_coupon_redemptions_redeemed_at
  ON coupon_redemptions (redeemed_at DESC);

ALTER TABLE coupon_redemptions ENABLE ROW LEVEL SECURITY;

-- Admin/moderator read only. There is deliberately NO insert policy:
-- all writes go through the service-role client, so redemption counts
-- cannot be forged by a user crafting requests.
--
-- DELIBERATE DIVERGENCE from the neighbouring coupons table: its policy
-- is named "Admin read coupons" but its USING clause is literally `true`,
-- so anyone can read it. That is intentional there — the public listing
-- submit form resolves coupon codes through createPublicClient(). It is
-- NOT acceptable here: these rows tie a user id to a payment, so a
-- `true` qual would publish who bought what. Do not "make it consistent".
DROP POLICY IF EXISTS "Admin read coupon redemptions" ON coupon_redemptions;
CREATE POLICY "Admin read coupon redemptions" ON coupon_redemptions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role IN ('admin', 'moderator')
    )
  );

-- The person a coupon was handed to, e.g. 'Ajay Bari'. Groups
-- mukul100 + mukul150 under one person in the roll-up. Nullable:
-- existing coupons have no value.
ALTER TABLE coupons ADD COLUMN IF NOT EXISTS assigned_to text;
