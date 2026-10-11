-- ============================================================
-- One catalog (commerce roadmap piece 2)
--   - listing_products: optional price, price note, photo shape and
--     legacy_service_index (old /s/ links + idempotent copy)
--   - listing_product_options: up to 6 priced options per item
--     (the limit is enforced by the only writer, the server action)
--   - orders: which option was bought
--   - decrement_option_stock: option stock after a captured payment
--   - one-time copy of listings.services into listing_products
-- Additive and idempotent: safe to run more than once.
-- listings.services is left untouched for the mobile app.
-- ============================================================

ALTER TABLE public.listing_products
  ADD COLUMN IF NOT EXISTS price_note text,
  ADD COLUMN IF NOT EXISTS image_aspect text NOT NULL DEFAULT 'square',
  ADD COLUMN IF NOT EXISTS legacy_service_index integer;

ALTER TABLE public.listing_products DROP CONSTRAINT IF EXISTS listing_products_price_note_check;
ALTER TABLE public.listing_products
  ADD CONSTRAINT listing_products_price_note_check
  CHECK (price_note IS NULL OR char_length(price_note) <= 32);

ALTER TABLE public.listing_products DROP CONSTRAINT IF EXISTS listing_products_image_aspect_check;
ALTER TABLE public.listing_products
  ADD CONSTRAINT listing_products_image_aspect_check
  CHECK (image_aspect IN ('square', 'portrait', 'landscape'));

CREATE UNIQUE INDEX IF NOT EXISTS listing_products_legacy_service_index_key
  ON public.listing_products (listing_id, legacy_service_index)
  WHERE legacy_service_index IS NOT NULL;

-- No fixed price means the item cannot be bought online.
ALTER TABLE public.listing_products ALTER COLUMN price_paise DROP NOT NULL;
ALTER TABLE public.listing_products DROP CONSTRAINT IF EXISTS listing_products_price_paise_check;
ALTER TABLE public.listing_products
  ADD CONSTRAINT listing_products_price_paise_check
  CHECK (price_paise IS NULL OR price_paise >= 100);

CREATE TABLE IF NOT EXISTS public.listing_product_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.listing_products(id) ON DELETE CASCADE,
  label text NOT NULL CHECK (char_length(label) BETWEEN 1 AND 40),
  price_paise integer NOT NULL CHECK (price_paise >= 100),
  quantity_in_stock integer CHECK (quantity_in_stock IS NULL OR quantity_in_stock >= 0),
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_listing_product_options_product_sort
  ON public.listing_product_options (product_id, sort_order);

ALTER TABLE public.listing_product_options ENABLE ROW LEVEL SECURITY;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.listing_product_options FROM anon, authenticated;
GRANT SELECT ON public.listing_product_options TO anon, authenticated;

DROP POLICY IF EXISTS "Public reads options of active products on approved listings" ON public.listing_product_options;
CREATE POLICY "Public reads options of active products on approved listings" ON public.listing_product_options
  FOR SELECT USING (
    EXISTS (
      SELECT 1
      FROM public.listing_products p
      JOIN public.listings l ON l.id = p.listing_id
      WHERE p.id = listing_product_options.product_id
        AND p.is_active = true
        AND l.approved = true
    )
  );

DROP POLICY IF EXISTS "Owners read own product options" ON public.listing_product_options;
CREATE POLICY "Owners read own product options" ON public.listing_product_options
  FOR SELECT USING (
    EXISTS (
      SELECT 1
      FROM public.listing_products p
      JOIN public.listings l ON l.id = p.listing_id
      WHERE p.id = listing_product_options.product_id
        AND l.owner_id = (SELECT auth.uid())
    )
  );

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS product_option_id uuid
    REFERENCES public.listing_product_options(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS option_label text;

ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_option_label_check;
ALTER TABLE public.orders
  ADD CONSTRAINT orders_option_label_check
  CHECK (option_label IS NULL OR char_length(option_label) <= 40);

CREATE OR REPLACE FUNCTION public.decrement_option_stock(
  p_option_id uuid,
  p_quantity integer
)
RETURNS boolean
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_updated integer;
BEGIN
  -- Runs only after Razorpay captured a payment, so there is no visibility
  -- filter: hiding an item mid-payment must not refuse that order.
  UPDATE public.listing_product_options
  SET quantity_in_stock = quantity_in_stock - p_quantity,
      updated_at = now()
  WHERE id = p_option_id
    AND (quantity_in_stock IS NULL OR quantity_in_stock >= p_quantity);

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated > 0;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.decrement_option_stock(uuid, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.decrement_option_stock(uuid, integer) TO service_role;

-- One-time copy. A listing that already has any copied row is skipped,
-- so running this again inserts nothing.
WITH eligible AS (
  SELECT l.id AS listing_id, l.services
  FROM public.listings l
  WHERE jsonb_typeof(l.services) = 'array'
    AND jsonb_array_length(l.services) > 0
    AND NOT EXISTS (
      SELECT 1 FROM public.listing_products p
      WHERE p.listing_id = l.id AND p.legacy_service_index IS NOT NULL
    )
),
base AS (
  SELECT e.listing_id, COALESCE(MAX(p.sort_order) + 1, 0) AS start_order
  FROM eligible e
  LEFT JOIN public.listing_products p ON p.listing_id = e.listing_id
  GROUP BY e.listing_id
),
items AS (
  SELECT e.listing_id,
         (s.ord - 1)::int AS legacy_index,
         s.elem,
         btrim(COALESCE(s.elem->>'price', '')) AS price_text
  FROM eligible e
  CROSS JOIN LATERAL jsonb_array_elements(e.services) WITH ORDINALITY AS s(elem, ord)
  WHERE jsonb_typeof(s.elem) = 'object'
    AND btrim(COALESCE(s.elem->>'name', '')) <> ''
),
priced AS (
  SELECT i.*,
         CASE
           WHEN i.price_text ~* '^(₹|rs\.?)?\s*[0-9][0-9,]*(\.[0-9]{1,2})?\s*(/-)?$'
           THEN replace(regexp_replace(i.price_text, '^(₹|rs\.?)\s*|\s*/-$', '', 'gi'), ',', '')::numeric
         END AS rupees
  FROM items i
)
INSERT INTO public.listing_products (
  listing_id, type, name, description, price_paise, price_note, quantity_in_stock,
  image_url, image_thumb_url, image_aspect, is_active, sort_order, legacy_service_index
)
SELECT
  p.listing_id,
  CASE WHEN p.elem->>'type' = 'service' THEN 'service' ELSE 'product' END,
  left(btrim(p.elem->>'name'), 80),
  NULLIF(left(btrim(COALESCE(p.elem->>'desc', '')), 280), ''),
  CASE WHEN p.rupees BETWEEN 1 AND 10000000 THEN round(p.rupees * 100)::int END,
  CASE WHEN p.rupees BETWEEN 1 AND 10000000 THEN NULL ELSE NULLIF(left(p.price_text, 32), '') END,
  NULL,
  NULLIF(btrim(COALESCE(p.elem->>'image', '')), ''),
  NULLIF(btrim(COALESCE(p.elem->>'image', '')), ''),
  CASE WHEN p.elem->>'imageAspect' IN ('square', 'portrait', 'landscape')
       THEN p.elem->>'imageAspect' ELSE 'landscape' END,
  true,
  b.start_order + p.legacy_index,
  p.legacy_index
FROM priced p
JOIN base b ON b.listing_id = p.listing_id;
