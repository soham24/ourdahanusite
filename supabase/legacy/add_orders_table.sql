-- Marketplace orders table
-- Run this in Supabase SQL editor

CREATE TABLE IF NOT EXISTS orders (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  listing_id uuid REFERENCES listings(id) ON DELETE SET NULL,
  buyer_id uuid REFERENCES profiles(id) ON DELETE SET NULL,

  -- Buyer info (captured at order time)
  buyer_name text NOT NULL,
  buyer_phone text NOT NULL,
  delivery_address text,
  notes text,

  -- Item info (snapshot at order time)
  service_name text NOT NULL,
  service_price numeric NOT NULL,
  quantity integer DEFAULT 1,
  amount_total numeric NOT NULL,           -- service_price * quantity

  -- Commission
  commission_rate numeric DEFAULT 0.03,
  commission_amount numeric NOT NULL,      -- amount_total * 0.03
  seller_payout_amount numeric NOT NULL,   -- amount_total * 0.97
  seller_upi_id text NOT NULL,             -- snapshot of listing upi_id at order time

  -- Razorpay payment
  razorpay_order_id text,
  razorpay_payment_id text,
  razorpay_signature text,
  payment_status text DEFAULT 'pending',   -- 'pending' | 'paid' | 'failed'

  -- Payout
  payout_status text DEFAULT 'pending',    -- 'pending' | 'processing' | 'paid' | 'failed'
  razorpay_payout_id text,
  payout_error text,

  -- Order fulfillment
  status text DEFAULT 'confirmed',         -- 'confirmed' | 'fulfilled' | 'cancelled'

  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- RLS
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

-- Buyers can see their own orders
CREATE POLICY "buyer_can_select_own_orders" ON orders
  FOR SELECT USING (buyer_id = auth.uid());

-- Sellers can see orders for their listings
CREATE POLICY "seller_can_select_listing_orders" ON orders
  FOR SELECT USING (
    listing_id IN (SELECT id FROM listings WHERE owner_id = auth.uid())
  );

-- Only service role (server) can insert/update
-- (no client-facing insert policy — all writes go through server actions with admin client)
