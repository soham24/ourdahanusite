-- ════════════════════════════════════════════════════════════════════════
-- CONSOLIDATED MIGRATION — Listing Payments + Marketplace + Notifications
--
-- Paste this whole file into the Supabase SQL editor and click Run.
-- It applies all 4 migrations in dependency order, inside one transaction
-- so failures roll back cleanly.
--
-- Safe to re-run: uses CREATE TABLE IF NOT EXISTS, CREATE POLICY IF NOT
-- EXISTS guards, and ALTER TABLE ADD COLUMN IF NOT EXISTS.
-- ════════════════════════════════════════════════════════════════════════

BEGIN;

-- ═══ 1. add_listing_payments.sql ═══════════════════════════════════════
-- ============================================================
-- Listing payments feature
--   - Admin toggles payments_enabled per listing.
--   - Owner submits their own Razorpay Key ID + Secret (encrypted).
--   - Checkout uses owner's keys; money flows direct to owner's Razorpay account.
-- ============================================================

ALTER TABLE listings
  ADD COLUMN IF NOT EXISTS payments_enabled boolean DEFAULT false;

CREATE TABLE IF NOT EXISTS listing_payment_configs (
  listing_id uuid PRIMARY KEY REFERENCES listings(id) ON DELETE CASCADE,
  razorpay_key_id text NOT NULL,
  razorpay_key_secret_encrypted text NOT NULL,
  razorpay_key_last4 text NOT NULL,
  test_mode boolean NOT NULL DEFAULT true,
  verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE listing_payment_configs ENABLE ROW LEVEL SECURITY;

-- Owners can read their own config row (secret is ciphertext, useless without server key).
DROP POLICY IF EXISTS "Owners read own payment config" ON listing_payment_configs;
CREATE POLICY "Owners read own payment config" ON listing_payment_configs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM listings
      WHERE listings.id = listing_payment_configs.listing_id
        AND listings.owner_id = auth.uid()
    )
  );

-- No client INSERT/UPDATE/DELETE — all writes go through server actions using the service-role client.

CREATE OR REPLACE FUNCTION public.touch_listing_payment_configs_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS listing_payment_configs_set_updated_at ON listing_payment_configs;

CREATE TRIGGER listing_payment_configs_set_updated_at
  BEFORE UPDATE ON listing_payment_configs
  FOR EACH ROW
  EXECUTE PROCEDURE public.touch_listing_payment_configs_updated_at();

-- ═══ 2. add_listing_products.sql ═══════════════════════════════════════
-- ============================================================
-- Listing products & services catalog
--   - Each listing can have many products/services.
--   - price_paise stored as integer to avoid float rounding.
--   - quantity_in_stock: NULL means unlimited (typical for services).
-- ============================================================

CREATE TABLE IF NOT EXISTS listing_products (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  listing_id uuid NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('product', 'service')),
  name text NOT NULL,
  description text,
  price_paise integer NOT NULL CHECK (price_paise >= 0),
  quantity_in_stock integer CHECK (quantity_in_stock IS NULL OR quantity_in_stock >= 0),
  image_url text,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE listing_products ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON listing_products TO anon, authenticated;

CREATE INDEX IF NOT EXISTS idx_listing_products_listing_active_sort
  ON listing_products (listing_id, is_active, sort_order);

-- Public read: only active products on approved listings.
DROP POLICY IF EXISTS "Public reads active products on approved listings" ON listing_products;
CREATE POLICY "Public reads active products on approved listings" ON listing_products
  FOR SELECT USING (
    is_active = true
    AND EXISTS (
      SELECT 1 FROM listings
      WHERE listings.id = listing_products.listing_id
        AND listings.approved = true
    )
  );

-- Owners read all own products (including inactive).
DROP POLICY IF EXISTS "Owners read own products" ON listing_products;
CREATE POLICY "Owners read own products" ON listing_products
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM listings
      WHERE listings.id = listing_products.listing_id
        AND listings.owner_id = auth.uid()
    )
  );

-- Mutations go through server actions using the admin client.

CREATE OR REPLACE FUNCTION public.touch_listing_products_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS listing_products_set_updated_at ON listing_products;

CREATE TRIGGER listing_products_set_updated_at
  BEFORE UPDATE ON listing_products
  FOR EACH ROW
  EXECUTE PROCEDURE public.touch_listing_products_updated_at();

-- ============================================================
-- Extend existing orders table for the new owner-razorpay flow.
--   Old rows remain payment_flow='platform_upi_payout'.
--   New rows use payment_flow='owner_razorpay'.
-- ============================================================

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS product_id uuid REFERENCES listing_products(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS payment_flow text NOT NULL DEFAULT 'platform_upi_payout',
  ADD COLUMN IF NOT EXISTS owner_razorpay_order_id text,
  ADD COLUMN IF NOT EXISTS owner_razorpay_payment_id text,
  ADD COLUMN IF NOT EXISTS owner_razorpay_signature text;

-- Allow either flow value.
ALTER TABLE orders
  DROP CONSTRAINT IF EXISTS orders_payment_flow_check;

ALTER TABLE orders
  ADD CONSTRAINT orders_payment_flow_check
  CHECK (payment_flow IN ('platform_upi_payout', 'owner_razorpay'));

-- Atomic stock decrement helper used by marketplace order placement.
CREATE OR REPLACE FUNCTION public.decrement_product_stock(
  p_product_id uuid,
  p_quantity integer
)
RETURNS boolean
LANGUAGE plpgsql
AS $$
DECLARE
  v_updated integer;
BEGIN
  UPDATE listing_products
  SET quantity_in_stock = quantity_in_stock - p_quantity
  WHERE id = p_product_id
    AND is_active = true
    AND (quantity_in_stock IS NULL OR quantity_in_stock >= p_quantity);

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated > 0;
END;
$$;

-- ═══ 3. add_notifications.sql ═════════════════════════════════════════
-- ============================================================
-- Unified notification engine
--   - notifications: durable inbox, one row per user per event channel.
--   - notification_preferences: per-user channel toggles + telegram chat_id.
-- ============================================================

CREATE TABLE IF NOT EXISTS notifications (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type text NOT NULL,
  title text NOT NULL,
  body text NOT NULL,
  link text,
  icon text,
  metadata jsonb,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

GRANT SELECT, UPDATE ON notifications TO authenticated;

CREATE INDEX IF NOT EXISTS idx_notifications_user_created
  ON notifications (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
  ON notifications (user_id, created_at DESC)
  WHERE read_at IS NULL;

DROP POLICY IF EXISTS "Users read own notifications" ON notifications;
CREATE POLICY "Users read own notifications" ON notifications
  FOR SELECT USING (auth.uid() = user_id);

-- Users can only mark their own rows as read (sets read_at). Other columns frozen.
DROP POLICY IF EXISTS "Users mark own notifications read" ON notifications;
CREATE POLICY "Users mark own notifications read" ON notifications
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- All INSERTs go through server via admin client.

-- Enable Supabase Realtime for live bell-icon updates.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
  END IF;
END
$$;

-- ============================================================
-- Notification preferences
-- ============================================================

CREATE TABLE IF NOT EXISTS notification_preferences (
  user_id uuid PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  email_enabled boolean NOT NULL DEFAULT true,
  in_app_enabled boolean NOT NULL DEFAULT true,
  telegram_enabled boolean NOT NULL DEFAULT false,
  whatsapp_enabled boolean NOT NULL DEFAULT true,
  telegram_chat_id text,
  telegram_verified_at timestamptz,
  muted_types text[] NOT NULL DEFAULT '{}',
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE ON notification_preferences TO authenticated;

DROP POLICY IF EXISTS "Users read own notif prefs" ON notification_preferences;
CREATE POLICY "Users read own notif prefs" ON notification_preferences
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users insert own notif prefs" ON notification_preferences;
CREATE POLICY "Users insert own notif prefs" ON notification_preferences
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users update own notif prefs" ON notification_preferences;
CREATE POLICY "Users update own notif prefs" ON notification_preferences
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.touch_notif_prefs_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notif_prefs_set_updated_at ON notification_preferences;

CREATE TRIGGER notif_prefs_set_updated_at
  BEFORE UPDATE ON notification_preferences
  FOR EACH ROW
  EXECUTE PROCEDURE public.touch_notif_prefs_updated_at();

-- ═══ 4. add_telegram_link_tokens.sql ══════════════════════════════════
-- ============================================================
-- Telegram link tokens
--   User clicks "Connect Telegram" → server generates a token →
--   user opens t.me/<bot>?start=<token> → bot webhook matches
--   the token to user_id and saves their chat_id to
--   notification_preferences.telegram_chat_id.
-- ============================================================

CREATE TABLE IF NOT EXISTS telegram_link_tokens (
  token text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE telegram_link_tokens ENABLE ROW LEVEL SECURITY;

-- No client access; all reads/writes go through the server using the admin client.

CREATE INDEX IF NOT EXISTS idx_tg_link_tokens_user
  ON telegram_link_tokens (user_id, created_at DESC);

COMMIT;
