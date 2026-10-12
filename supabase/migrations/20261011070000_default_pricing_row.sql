-- The listing fee lives in a single pricing_config row (id 1). The baseline
-- creates the table but no row, so a fresh install charged the code's
-- fallback price and the admin's "update pricing" changed nothing until
-- someone inserted the row by hand. These values match FALLBACK_PRICING in
-- src/lib/data/pricing.ts; set your own from the admin pricing page. A
-- database that already has the row (production does) is left as it is.
insert into public.pricing_config (id, base_price, current_price)
values (1, 1500, 750)
on conflict (id) do nothing;
