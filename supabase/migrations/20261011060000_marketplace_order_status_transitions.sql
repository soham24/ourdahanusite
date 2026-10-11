-- Changing a marketplace order's status, in one locked step.
--
-- updateMarketplaceOrderStatus used to write the new status directly, so:
--   * cancelling never gave back the stock finalize_marketplace_order took,
--     leaving items "Only N left" or "Sold out" that were really available;
--   * any status could follow any other -- a cancelled order confirmed
--     again, a fulfilled one cancelled.
--
-- fulfilled and cancelled are now final. Cancelling returns exactly what
-- checkout took: finalize_marketplace_order decrements stock only for a
-- non-test order whose item tracks stock and had enough, and it records a
-- fulfillment_issue in every case where it took nothing (item or option
-- removed, stock short). That note is only cleared when an order reaches a
-- final state, so at cancellation it still says whether stock was taken.
-- The row lock makes a double click restore once.
--
-- Called by the server action with the service role after it has checked
-- the caller owns the listing or is staff; not callable through the API.
create or replace function public.set_marketplace_order_status(p_order_id uuid, p_status text)
returns text
language plpgsql
set search_path = ''
as $$
declare
  v_order public.orders%rowtype;
begin
  if p_status not in ('confirmed', 'fulfilled', 'cancelled') then
    raise exception 'Invalid order status';
  end if;

  select * into v_order from public.orders where id = p_order_id for update;
  if not found then
    return 'not_found';
  end if;

  if v_order.status = p_status then
    return 'unchanged';
  end if;
  if v_order.status in ('fulfilled', 'cancelled') then
    return 'final';
  end if;

  update public.orders
  set status = p_status,
      fulfillment_issue = case when p_status in ('fulfilled', 'cancelled') then null else fulfillment_issue end,
      updated_at = now()
  where id = p_order_id;

  if p_status = 'cancelled'
     and not coalesce(v_order.is_test, false)
     and v_order.fulfillment_issue is null then
    if v_order.product_option_id is not null then
      update public.listing_product_options
      set quantity_in_stock = quantity_in_stock + v_order.quantity
      where id = v_order.product_option_id and quantity_in_stock is not null;
    elsif v_order.product_id is not null then
      update public.listing_products
      set quantity_in_stock = quantity_in_stock + v_order.quantity
      where id = v_order.product_id and quantity_in_stock is not null;
    end if;
  end if;

  return 'updated';
end;
$$;

revoke all on function public.set_marketplace_order_status(uuid, text) from public, anon, authenticated;
grant execute on function public.set_marketplace_order_status(uuid, text) to service_role;
