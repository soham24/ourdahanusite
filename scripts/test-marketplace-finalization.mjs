import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'
const db = new PGlite()
await db.exec(`
 CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
 CREATE TABLE listings(id uuid PRIMARY KEY);
 CREATE TABLE listing_products(id uuid PRIMARY KEY, listing_id uuid, quantity_in_stock integer);
 CREATE TABLE listing_product_options(id uuid PRIMARY KEY, product_id uuid, quantity_in_stock integer);
 CREATE TABLE orders(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), listing_id uuid, product_id uuid, product_option_id uuid, option_label text, buyer_id uuid, buyer_name text NOT NULL, buyer_phone text, delivery_address text, notes text, service_name text, service_price numeric, quantity integer, amount_total numeric, owner_razorpay_order_id text, owner_razorpay_payment_id text, owner_razorpay_signature text, payment_status text, status text, is_test boolean);
 CREATE TABLE payment_intents(razorpay_order_id text PRIMARY KEY, user_id uuid, status text, entity_id uuid, entity_table text, finalized_at timestamptz, last_error text, razorpay_payment_id text, razorpay_signature text, captured_at timestamptz);
 INSERT INTO listings VALUES ('00000000-0000-0000-0000-000000000001');
 INSERT INTO listing_products VALUES ('00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000001',5);
 INSERT INTO payment_intents(razorpay_order_id,user_id,status) VALUES ('order_1','00000000-0000-0000-0000-000000000003','created');
`)
await db.exec(await readFile('supabase/atomic_marketplace_finalization.sql','utf8'))
const order = {listing_id:'00000000-0000-0000-0000-000000000001',product_id:'00000000-0000-0000-0000-000000000002',buyer_id:'00000000-0000-0000-0000-000000000003',buyer_name:'Buyer',buyer_phone:'9999999999',service_name:'Rice',service_price:100,quantity:2,amount_total:200,owner_razorpay_order_id:'order_1',owner_razorpay_payment_id:'pay_1',owner_razorpay_signature:'verified',is_test:false}
const finalize = (value) => db.query('SELECT public.finalize_marketplace_order($1::jsonb) AS result',[JSON.stringify(value)])
const a = (await finalize(order)).rows[0].result
const b = (await finalize(order)).rows[0].result
assert.equal(a.orderId,b.orderId)
assert.equal(b.created,false)
assert.equal((await db.query('SELECT quantity_in_stock FROM listing_products')).rows[0].quantity_in_stock,3)
assert.equal((await db.query('SELECT count(*)::int AS n FROM orders')).rows[0].n,1)
assert.deepEqual((await db.query('SELECT status,entity_id,razorpay_payment_id FROM payment_intents')).rows[0],{status:'finalized',entity_id:a.orderId,razorpay_payment_id:'pay_1'})
await assert.rejects(finalize({...order,buyer_id:'00000000-0000-0000-0000-000000000004'}), /another order/)
// Constraint failure after stock mutation must roll back stock too.
await assert.rejects(finalize({...order,owner_razorpay_order_id:'order_bad',owner_razorpay_payment_id:'pay_bad',buyer_name:null}))
assert.equal((await db.query('SELECT quantity_in_stock FROM listing_products')).rows[0].quantity_in_stock,3)
const soldOut = (await finalize({...order,quantity:4,amount_total:400,owner_razorpay_order_id:'order_2',owner_razorpay_payment_id:'pay_2'})).rows[0].result
assert.equal(soldOut.issue,'Insufficient stock after payment. Contact the buyer to arrange fulfillment or a refund.')
assert.equal((await db.query('SELECT quantity_in_stock FROM listing_products')).rows[0].quantity_in_stock,3)
await finalize({...order,is_test:true,owner_razorpay_order_id:'order_test',owner_razorpay_payment_id:'pay_test'})
assert.equal((await db.query('SELECT quantity_in_stock FROM listing_products')).rows[0].quantity_in_stock,3)
await db.exec("INSERT INTO listing_product_options VALUES ('00000000-0000-0000-0000-000000000005','00000000-0000-0000-0000-000000000002',5)")
const optionOrder = {...order,option_id:'00000000-0000-0000-0000-000000000005',owner_razorpay_order_id:'order_option',owner_razorpay_payment_id:'pay_option'}
await finalize(optionOrder)
await finalize(optionOrder)
assert.equal((await db.query('SELECT quantity_in_stock FROM listing_product_options')).rows[0].quantity_in_stock,3)
assert.equal((await db.query('SELECT quantity_in_stock FROM listing_products')).rows[0].quantity_in_stock,3)
await db.exec('DELETE FROM listing_product_options')
const removedOption = (await finalize({...optionOrder,owner_razorpay_order_id:'order_removed_option',owner_razorpay_payment_id:'pay_removed_option'})).rows[0].result
assert.match(removedOption.issue,/Option was removed/)
await db.exec('DELETE FROM listing_products')
const deleted = (await finalize({...order,owner_razorpay_order_id:'order_deleted',owner_razorpay_payment_id:'pay_deleted'})).rows[0].result
assert.ok(deleted.issue)
assert.equal((await db.query("SELECT product_id FROM orders WHERE owner_razorpay_payment_id='pay_deleted'")).rows[0].product_id,null)
await db.exec('SET ROLE authenticated')
await assert.rejects(finalize(order), /permission denied/)
await db.exec('RESET ROLE; GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA public TO service_role; SET ROLE service_role')
assert.equal((await finalize(order)).rows[0].result.orderId,a.orderId)
await db.close()
console.log('Atomic payment replay, rollback, stock shortage, test mode and removed-product tests passed')
