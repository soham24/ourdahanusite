-- Apply before deploying the finalizer caller. Existing duplicate payment IDs
-- cause this transaction to fail safely: investigate them, never delete blindly.
BEGIN;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS fulfillment_issue text;
CREATE UNIQUE INDEX IF NOT EXISTS orders_owner_payment_unique
  ON public.orders(owner_razorpay_payment_id) WHERE owner_razorpay_payment_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS orders_owner_order_unique
  ON public.orders(owner_razorpay_order_id) WHERE owner_razorpay_order_id IS NOT NULL;

-- Only a trusted server that has verified Razorpay capture may invoke this.
CREATE OR REPLACE FUNCTION public.finalize_marketplace_order(p_order jsonb)
RETURNS jsonb LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE
  v_order public.orders%ROWTYPE;
  v_existing public.orders%ROWTYPE;
  v_stock integer;
  v_issue text;
  v_id uuid;
BEGIN
  v_order := jsonb_populate_record(NULL::public.orders, p_order);
  IF nullif(v_order.owner_razorpay_order_id, '') IS NULL
     OR nullif(v_order.owner_razorpay_payment_id, '') IS NULL
     OR v_order.buyer_id IS NULL
     OR v_order.quantity IS NULL OR v_order.quantity NOT BETWEEN 1 AND 99
     OR v_order.service_price IS NULL OR v_order.service_price <= 0
     OR v_order.amount_total IS DISTINCT FROM v_order.service_price * v_order.quantity THEN
    RAISE EXCEPTION 'Invalid verified order';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(v_order.owner_razorpay_order_id, 0));
  SELECT * INTO v_existing FROM public.orders
    WHERE owner_razorpay_order_id = v_order.owner_razorpay_order_id
       OR owner_razorpay_payment_id = v_order.owner_razorpay_payment_id;
  IF FOUND THEN
    IF v_existing.buyer_id IS DISTINCT FROM v_order.buyer_id
       OR v_existing.owner_razorpay_payment_id IS DISTINCT FROM v_order.owner_razorpay_payment_id THEN
      RAISE EXCEPTION 'Payment already belongs to another order';
    END IF;
    RETURN jsonb_build_object('orderId', v_existing.id, 'created', false, 'issue', v_existing.fulfillment_issue);
  END IF;

  -- Lock the item/option until insert and intent finalization commit together.
  PERFORM 1 FROM public.listing_products WHERE id = v_order.product_id AND listing_id = v_order.listing_id FOR UPDATE;
  IF NOT FOUND THEN
    v_order.product_id := NULL;
    v_order.product_option_id := NULL;
    v_issue := 'Item was removed after payment. Contact the buyer to arrange fulfillment or a refund.';
  ELSIF nullif(p_order->>'option_id', '') IS NOT NULL THEN
    SELECT quantity_in_stock INTO v_stock FROM public.listing_product_options
      WHERE id = (p_order->>'option_id')::uuid AND product_id = v_order.product_id FOR UPDATE;
    IF NOT FOUND THEN
      v_order.product_option_id := NULL;
      v_issue := 'Option was removed after payment. Contact the buyer to arrange fulfillment or a refund.';
    ELSE
      v_order.product_option_id := (p_order->>'option_id')::uuid;
      IF NOT coalesce(v_order.is_test, false) AND v_stock IS NOT NULL THEN
        IF v_stock < v_order.quantity THEN
          v_issue := 'Insufficient stock after payment. Contact the buyer to arrange fulfillment or a refund.';
        ELSE
          UPDATE public.listing_product_options SET quantity_in_stock = quantity_in_stock - v_order.quantity WHERE id = v_order.product_option_id;
        END IF;
      END IF;
    END IF;
  ELSE
    SELECT quantity_in_stock INTO v_stock FROM public.listing_products WHERE id = v_order.product_id;
    IF NOT coalesce(v_order.is_test, false) AND v_stock IS NOT NULL THEN
      IF v_stock < v_order.quantity THEN
        v_issue := 'Insufficient stock after payment. Contact the buyer to arrange fulfillment or a refund.';
      ELSE
        UPDATE public.listing_products SET quantity_in_stock = quantity_in_stock - v_order.quantity WHERE id = v_order.product_id;
      END IF;
    END IF;
  END IF;

  INSERT INTO public.orders(listing_id, product_id, product_option_id, option_label, buyer_id, buyer_name, buyer_phone,
    delivery_address, notes, service_name, service_price, quantity, amount_total, owner_razorpay_order_id,
    owner_razorpay_payment_id, owner_razorpay_signature, payment_status, status, is_test, fulfillment_issue)
  VALUES(v_order.listing_id, v_order.product_id, v_order.product_option_id, v_order.option_label, v_order.buyer_id,
    v_order.buyer_name, v_order.buyer_phone, v_order.delivery_address, v_order.notes, v_order.service_name,
    v_order.service_price, v_order.quantity, v_order.amount_total, v_order.owner_razorpay_order_id,
    v_order.owner_razorpay_payment_id, v_order.owner_razorpay_signature, 'paid', 'confirmed', coalesce(v_order.is_test, false), v_issue)
  RETURNING id INTO v_id;
  UPDATE public.payment_intents SET status = 'finalized', entity_id = v_id, entity_table = 'orders',
    razorpay_payment_id = v_order.owner_razorpay_payment_id,
    razorpay_signature = v_order.owner_razorpay_signature,
    captured_at = coalesce(captured_at, now()),
    finalized_at = now(), last_error = v_issue
    WHERE razorpay_order_id = v_order.owner_razorpay_order_id AND user_id = v_order.buyer_id;
  RETURN jsonb_build_object('orderId', v_id, 'created', true, 'issue', v_issue);
END;
$$;
REVOKE ALL ON FUNCTION public.finalize_marketplace_order(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_marketplace_order(jsonb) TO service_role;
COMMIT;
