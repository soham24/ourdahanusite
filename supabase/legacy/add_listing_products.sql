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
