-- READ ONLY. Run in the target project's SQL editor before either new migration.
-- Save the output privately alongside a database backup. No customer rows or secrets.
SELECT table_name, column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('profiles', 'orders', 'payment_intents', 'listing_products', 'listing_product_options')
ORDER BY table_name, ordinal_position;

SELECT tablename, policyname, roles, cmd, qual, with_check
FROM pg_policies WHERE schemaname = 'public'
  AND tablename IN ('profiles', 'orders', 'payment_intents', 'listing_payment_configs')
ORDER BY tablename, policyname;

SELECT grantee, table_name, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public' AND table_name IN ('profiles', 'orders')
  AND grantee IN ('anon', 'authenticated', 'service_role');

-- Both must be zero before installing the unique indexes. Investigate conflicts;
-- never delete financial records merely to make a migration pass.
SELECT 'payment' AS duplicate_kind, count(*) AS duplicate_groups FROM (
  SELECT owner_razorpay_payment_id FROM public.orders
  WHERE owner_razorpay_payment_id IS NOT NULL GROUP BY owner_razorpay_payment_id HAVING count(*) > 1
) duplicates
UNION ALL
SELECT 'order', count(*) FROM (
  SELECT owner_razorpay_order_id FROM public.orders
  WHERE owner_razorpay_order_id IS NOT NULL GROUP BY owner_razorpay_order_id HAVING count(*) > 1
) duplicates;
