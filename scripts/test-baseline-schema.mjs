// Proves supabase/migrations/ builds a working database from nothing.
//
// Supabase provides the auth and storage schemas, the API roles and the
// realtime publication; PGlite has none of them, so the smallest stand-ins the
// schema touches are created first. Then every migration runs in filename
// order, as `supabase db reset` would, and the result is checked for the
// things a fresh install depends on.
import assert from 'node:assert/strict'
import { readdir, readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'
import { pg_trgm } from '@electric-sql/pglite/contrib/pg_trgm'
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto'
import { uuid_ossp } from '@electric-sql/pglite/contrib/uuid_ossp'

const db = new PGlite({ extensions: { pg_trgm, pgcrypto, uuid_ossp } })

await db.exec(`
  CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
  CREATE SCHEMA extensions;
  CREATE SCHEMA auth;
  CREATE TABLE auth.users (id uuid PRIMARY KEY, email text, raw_user_meta_data jsonb);
  CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  GRANT USAGE ON SCHEMA auth TO anon, authenticated, service_role;
  GRANT USAGE ON SCHEMA public, extensions TO anon, authenticated, service_role;
  CREATE SCHEMA storage;
  CREATE TABLE storage.buckets (id text PRIMARY KEY, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
  CREATE TABLE storage.objects (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), bucket_id text, name text, owner uuid);
  ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
  CREATE PUBLICATION supabase_realtime;
`)

const dir = new URL('../supabase/migrations/', import.meta.url)
const files = (await readdir(dir)).filter((f) => f.endsWith('.sql')).sort()
assert.ok(files.length > 0, 'no migrations found')
for (const file of files) {
  try {
    await db.exec(await readFile(new URL(file, dir), 'utf8'))
  } catch (err) {
    throw new Error(`${file} failed: ${err.message}`)
  }
}

const count = async (sql) => Number((await db.query(sql)).rows[0].n)
assert.equal(await count(`SELECT count(*) n FROM pg_tables WHERE schemaname = 'public'`), 34, 'public tables')
assert.equal(await count(`SELECT count(*) n FROM pg_policies WHERE schemaname = 'public'`), 55, 'public RLS policies (a change here should be deliberate)')
assert.equal(
  await count(`SELECT count(*) n FROM pg_tables WHERE schemaname = 'public' AND NOT rowsecurity`),
  0,
  'every public table has row level security on',
)

// Signing up creates the profile, through the trigger on auth.users.
const userId = '00000000-0000-0000-0000-0000000000a1'
await db.query(`INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES ($1, 'new@example.test', '{"full_name":"New Person"}')`, [userId])
assert.equal((await db.query(`SELECT full_name FROM public.profiles WHERE id = $1`, [userId])).rows[0]?.full_name, 'New Person')

const otherId = '00000000-0000-0000-0000-0000000000a2'
await db.query(`INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES ($1, 'other@example.test', '{"full_name":"Other Person"}')`, [otherId])

// A signed-out visitor sees approved listings only, and no private profile columns.
await db.exec(`INSERT INTO public.listings (name, category, approved) VALUES ('Visible', 'shop', true), ('Hidden', 'shop', false)`)
await db.exec('SET ROLE anon')
assert.deepEqual((await db.query(`SELECT name FROM public.listings ORDER BY name`)).rows.map((r) => r.name), ['Visible'])
assert.equal((await db.query(`SELECT email FROM public.profiles`)).rows.length, 0, 'anon must not read profile emails')

// Names come back only for the ids asked about -- there is no way to list everyone.
assert.deepEqual(
  (await db.query(`SELECT id, full_name FROM public.get_profile_names($1)`, [[userId]])).rows,
  [{ id: userId, full_name: 'New Person' }],
)
await assert.rejects(db.query(`SELECT * FROM public.public_profiles`), /does not exist/, 'public_profiles must be gone')
await assert.rejects(db.query(`SELECT public.handle_new_user()`), /permission denied/, 'trigger functions are not callable')
await db.exec('RESET ROLE')

assert.equal((await db.query(`SELECT public FROM storage.buckets WHERE id = 'uploads'`)).rows[0]?.public, true, 'uploads bucket')

// ── Direct API writes the app never makes must be refused ────────────────
// Each of these is one hand-written PostgREST request with the public anon
// key, or a signed-in user's own token, skipping every server action.
const asUser = async (id) => {
  await db.exec('RESET ROLE')
  await db.query(`SELECT set_config('request.jwt.claim.sub', $1, false)`, [id ?? ''])
  await db.exec(id ? 'SET ROLE authenticated' : 'SET ROLE anon')
}
const ownerId = userId
const strangerId = otherId
const staffId = '00000000-0000-0000-0000-0000000000a3'
await db.exec('RESET ROLE')
await db.query(`INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES ($1, 'staff@example.test', '{}')`, [staffId])
await db.query(`UPDATE public.profiles SET role = 'admin' WHERE id = $1`, [staffId])
const listingId = (await db.query(
  `INSERT INTO public.listings (name, category, approved, owner_id, expires_at) VALUES ('Owned', 'shop', true, $1, now() + interval '30 days') RETURNING id`,
  [ownerId],
)).rows[0].id
const questionId = (await db.query(
  `INSERT INTO public.listing_questions (listing_id, user_id, question) VALUES ($1, $2, 'Open on Sunday?') RETURNING id`,
  [listingId, strangerId],
)).rows[0].id
const reviewId = (await db.query(
  `INSERT INTO public.reviews (listing_id, user_id, rating, comment) VALUES ($1, $2, 1, 'Bad') RETURNING id`,
  [listingId, strangerId],
)).rows[0].id
await db.query(`INSERT INTO public.coupons (code, label, final_price, enabled) VALUES ('secret50', 'Half off', 50, true)`)

// Q&A: signed out or a stranger cannot rewrite answers; the owner can.
const answerOf = async () => (await db.query(`SELECT answer FROM public.listing_questions WHERE id = $1`, [questionId])).rows[0].answer
await asUser(null)
await db.query(`UPDATE public.listing_questions SET answer = 'hacked' WHERE id = $1`, [questionId]).catch(() => {})
await asUser(strangerId)
await db.query(`UPDATE public.listing_questions SET answer = 'hacked' WHERE id = $1`, [questionId]).catch(() => {})
await db.exec('RESET ROLE')
assert.equal(await answerOf(), null, 'only the owner may answer a question')
await asUser(ownerId)
await db.query(`UPDATE public.listing_questions SET answer = 'Yes, 9 to 5', answered_at = now() WHERE id = $1`, [questionId])
await assert.rejects(db.query(`UPDATE public.listing_questions SET question = 'edited' WHERE id = $1`, [questionId]), /permission denied/)
await db.exec('RESET ROLE')
assert.equal(await answerOf(), 'Yes, 9 to 5', 'the owner can answer')

// Coupons: invisible to visitors and ordinary users, listed for staff.
await asUser(null)
await assert.rejects(db.query(`SELECT code FROM public.coupons`), /permission denied/)
await asUser(strangerId)
assert.equal((await db.query(`SELECT code FROM public.coupons`)).rows.length, 0, 'users cannot list coupons')
await asUser(staffId)
assert.equal((await db.query(`SELECT code FROM public.coupons`)).rows.length, 1, 'staff can list coupons')

// Listings: an owner edits their description but not billing, badges or rating.
await asUser(ownerId)
await db.query(`UPDATE public.listings SET description = 'Fresh bread daily' WHERE id = $1`, [listingId])
for (const assignment of ['expires_at = NULL', 'verified = true', "plan = 'premium'", 'rating = 5', 'appointments_enabled = true', "subdomain = 'stolen'"]) {
  await assert.rejects(db.query(`UPDATE public.listings SET ${assignment} WHERE id = $1`, [listingId]), /only be changed by the site/, assignment)
}
const inserted = (await db.query(
  `INSERT INTO public.listings (name, category, owner_id, verified, rating, appointments_enabled) VALUES ('Mine', 'shop', $1, true, 5, true) RETURNING verified, rating, appointments_enabled, approved`,
  [ownerId],
)).rows[0]
assert.deepEqual(inserted, { verified: false, rating: '0.0', appointments_enabled: false, approved: false }, 'insert cannot self-grant')
await asUser(staffId)
await db.query(`UPDATE public.listings SET verified = true WHERE id = $1`, [listingId])

// Reviews: the owner may reply, not rewrite; authors cannot fake a reply or a rating.
await asUser(ownerId)
await assert.rejects(
  db.query(`UPDATE public.reviews SET rating = 5, comment = 'Excellent', owner_reply = 'Thanks' WHERE id = $1`, [reviewId]),
  /Only the reply/,
)
await db.query(`UPDATE public.reviews SET owner_reply = 'Sorry, we will do better', owner_replied_at = now() WHERE id = $1`, [reviewId])
// The owner has not reviewed this listing, so only the rule under test can refuse these.
await asUser(ownerId)
await assert.rejects(
  db.query(`INSERT INTO public.reviews (listing_id, user_id, rating, owner_reply) VALUES ($1, $2, 5, 'Reply from the business')`, [listingId, ownerId]),
  /row-level security/,
)
await assert.rejects(db.query(`INSERT INTO public.reviews (listing_id, user_id, rating) VALUES ($1, $2, 1000)`, [listingId, ownerId]), /reviews_rating_check/)
// One review per person per business: the stranger already left one.
await asUser(strangerId)
await assert.rejects(
  db.query(`INSERT INTO public.reviews (listing_id, user_id, rating, comment) VALUES ($1, $2, 5, 'Changed my mind')`, [listingId, strangerId]),
  /already reviewed/,
)
await db.exec('RESET ROLE')
assert.deepEqual(
  (await db.query(`SELECT rating, owner_reply FROM public.reviews WHERE id = $1`, [reviewId])).rows[0],
  { rating: 1, owner_reply: 'Sorry, we will do better' },
)
// ── Marketplace order status ─────────────────────────────────────────────
// Cancelling returns the stock checkout took, once; settled orders stay settled.
await db.exec('RESET ROLE')
const productId = (await db.query(
  `INSERT INTO public.listing_products (listing_id, type, name, quantity_in_stock) VALUES ($1, 'product', 'Mango box', 3) RETURNING id`,
  [listingId],
)).rows[0].id
const orderFor = async (extra = {}) => (await db.query(
  `INSERT INTO public.orders (listing_id, product_id, quantity, status, is_test, fulfillment_issue, buyer_name, buyer_phone, service_name, service_price, amount_total)
   VALUES ($1, $2, 2, 'confirmed', $3, $4, 'Buyer', '9000000009', 'Mango box', 500, 1000) RETURNING id`,
  [listingId, productId, extra.isTest ?? false, extra.issue ?? null],
)).rows[0].id
const stock = async () => (await db.query(`SELECT quantity_in_stock FROM public.listing_products WHERE id = $1`, [productId])).rows[0].quantity_in_stock
const setStatus = async (id, status) => (await db.query(`SELECT public.set_marketplace_order_status($1, $2) AS r`, [id, status])).rows[0].r

const paidOrder = await orderFor()
assert.equal(await setStatus(paidOrder, 'cancelled'), 'updated')
assert.equal(await stock(), 5, 'cancelling returns the 2 units checkout took')
assert.equal(await setStatus(paidOrder, 'cancelled'), 'unchanged')
assert.equal(await stock(), 5, 'a second cancel does not return them again')
assert.equal(await setStatus(paidOrder, 'confirmed'), 'final', 'a cancelled order cannot be confirmed again')

const fulfilledOrder = await orderFor()
assert.equal(await setStatus(fulfilledOrder, 'fulfilled'), 'updated')
assert.equal(await setStatus(fulfilledOrder, 'cancelled'), 'final', 'a fulfilled order cannot be cancelled')

assert.equal(await setStatus(await orderFor({ isTest: true }), 'cancelled'), 'updated')
assert.equal(await setStatus(await orderFor({ issue: 'Insufficient stock after payment.' }), 'cancelled'), 'updated')
assert.equal(await stock(), 5, 'test orders and orders that took no stock return none')

await db.exec('SET ROLE anon')
await assert.rejects(db.query(`SELECT public.set_marketplace_order_status($1, 'cancelled')`, [paidOrder]), /permission denied/)
await db.exec('RESET ROLE')
await db.exec(`DELETE FROM public.orders; DELETE FROM public.listing_products;`)

await db.exec(`DELETE FROM public.reviews; DELETE FROM public.listing_questions; DELETE FROM public.coupons; DELETE FROM public.listings;`)

// The sample data loads on top, and moderation still hides what is unapproved.
await db.exec(`DELETE FROM public.listings`)
await db.exec(await readFile(new URL('../supabase/seed.sql', import.meta.url), 'utf8'))
await db.exec('SET ROLE anon')
assert.equal(await count(`SELECT count(*) n FROM public.listings`), 6, 'seeded approved listings visible to visitors')
assert.equal(await count(`SELECT count(*) n FROM public.events`), 2, 'seeded events')
await db.exec('RESET ROLE')

await db.close()
console.log(`Baseline schema builds from ${files.length} migration file(s) and passed its checks`)
