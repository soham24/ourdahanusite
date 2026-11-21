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
  -- Supabase's own helper: the folder segments of an object name, without the file.
  CREATE FUNCTION storage.foldername(name text) RETURNS text[] LANGUAGE sql IMMUTABLE AS $$
    SELECT (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1]
  $$;
  GRANT USAGE ON SCHEMA storage TO anon, authenticated, service_role;
  GRANT SELECT, INSERT ON storage.objects TO authenticated;
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
assert.equal(await count(`SELECT count(*) n FROM pg_tables WHERE schemaname = 'public'`), 37, 'public tables')
assert.equal(await count(`SELECT count(*) n FROM pg_policies WHERE schemaname = 'public'`), 57, 'public RLS policies (a change here should be deliberate)')
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

// Enquiries: only the sender and the listing's owner can read one; nobody
// signed out can send or read, and nothing can be edited.
await asUser(strangerId)
await db.query(`INSERT INTO public.listing_enquiries (listing_id, user_id, name, phone, message) VALUES ($1, $2, 'Ravi', '9876543210', 'Open Sunday?')`, [listingId, strangerId])
await assert.rejects(
  db.query(`INSERT INTO public.listing_enquiries (listing_id, user_id, name, phone, message) VALUES ($1, $2, 'Fake', '9876543210', 'x')`, [listingId, ownerId]),
  /row-level security/,
  'cannot send as someone else',
)
assert.equal(await count(`SELECT count(*) n FROM public.listing_enquiries`), 1, 'the sender sees their enquiry')
await assert.rejects(db.query(`UPDATE public.listing_enquiries SET message = 'edited'`), /permission denied/)
await asUser(ownerId)
assert.equal(await count(`SELECT count(*) n FROM public.listing_enquiries`), 1, 'the owner sees it')
await asUser(staffId)
assert.equal(await count(`SELECT count(*) n FROM public.listing_enquiries`), 0, 'nobody else does')
await asUser(null)
await assert.rejects(db.query(`SELECT count(*) n FROM public.listing_enquiries`), /permission denied/, 'signed out: nothing')
await db.exec('RESET ROLE')

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

// Uploads: a signed-in user writes only into public/<their own id>/.
await asUser(ownerId)
for (const name of [`public/${ownerId}/1-a-photo.jpg`, `public/${ownerId}/1-a-photo-thumb.jpg`]) {
  await db.query(`INSERT INTO storage.objects (bucket_id, name, owner) VALUES ('uploads', $1, $2)`, [name, ownerId])
}
for (const name of ['public/1700000000-flat.jpg', `public/${strangerId}/x.jpg`, `other/${ownerId}/x.jpg`, `public/x/${ownerId}/y.jpg`]) {
  await assert.rejects(
    db.query(`INSERT INTO storage.objects (bucket_id, name, owner) VALUES ('uploads', $1, $2)`, [name, ownerId]),
    /row-level security/,
    name,
  )
}
await db.exec('RESET ROLE')

// The sample data loads on top, and moderation still hides what is unapproved.
await db.exec(`DELETE FROM public.listings`)
await db.exec(await readFile(new URL('../supabase/seed.sql', import.meta.url), 'utf8'))
await db.exec('SET ROLE anon')
assert.equal(await count(`SELECT count(*) n FROM public.listings`), 6, 'seeded approved listings visible to visitors')
assert.equal(await count(`SELECT count(*) n FROM public.events`), 2, 'seeded events')
// Search tolerates a typo, and like the directory never returns what is unapproved.
const searchNames = async (q) => (await db.query(`SELECT listing_name FROM public.search_directory($1)`, [q])).rows.map((r) => r.listing_name)
assert.ok((await searchNames('seaside thaali')).includes('Seaside Thali House'), 'typo-tolerant search')
assert.deepEqual(await searchNames(''), [], 'empty query returns nothing')
await db.exec('RESET ROLE')
await db.exec(`INSERT INTO public.listings (name, category, approved) VALUES ('Hidden Thali Kitchen', 'Restaurants', false)`)
await db.exec('SET ROLE anon')
assert.ok(!(await searchNames('thali kitchen')).includes('Hidden Thali Kitchen'), 'unapproved listings stay hidden')
await db.exec('RESET ROLE')

// ── Daily game competition ───────────────────────────────────────────────
// The code is a shared secret: no public function may ever return it, and
// players cannot tag their own scores with a competition from the API.
await db.exec('RESET ROLE')
const [compA, compB, compC] = [
  '00000000-0000-0000-0000-0000000000b1',
  '00000000-0000-0000-0000-0000000000b2',
  '00000000-0000-0000-0000-0000000000b3',
]
for (const [id, name] of [[compA, 'Player A'], [compB, 'Player B'], [compC, 'Player C']]) {
  await db.query(`INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES ($1, $2, $3)`, [id, `${name.replace(' ', '').toLowerCase()}@example.test`, JSON.stringify({ full_name: name })])
}
const competitionId = (await db.query(
  `INSERT INTO public.game_competitions (day, title, prize, code) VALUES ('2026-11-21', 'Chikoo Cup', 'A box of chikoos', 'SAPOTA21') RETURNING id`,
)).rows[0].id
await db.query(
  `INSERT INTO public.game_scores (user_id, score, played_at, competition_id) VALUES
     ($1, 50, '2026-11-21 10:00+00', $4), ($2, 50, '2026-11-21 09:00+00', $4), ($3, 70, '2026-11-21 11:00+00', $4)`,
  [compA, compB, compC, competitionId],
)
await db.query(`INSERT INTO public.game_competition_exclusions (competition_id, user_id, reason) VALUES ($1, $2, 'cheating')`, [competitionId, compC])
await assert.rejects(
  db.query(`INSERT INTO public.game_competitions (day, title, prize, code) VALUES ('2026-11-22', 'Bad', 'x', 'lower')`),
  /game_competitions_code_check/,
  'code must be upper-case letters and digits',
)
await assert.rejects(
  db.query(`INSERT INTO public.game_competitions (day, title, prize, code) VALUES ('2026-11-21', 'Dup', 'x', 'ABC')`),
  /duplicate key/,
  'one competition per game per day',
)

for (const role of ['anon', 'authenticated']) {
  await db.exec(`SET ROLE ${role}`)
  const board = (await db.query(`SELECT public.get_competition_leaderboard($1, 10) AS r`, [competitionId])).rows[0].r
  assert.deepEqual(
    board.map((r) => [r.full_name, r.best_score]),
    [['Player B', 50], ['Player A', 50]],
    `${role}: excluded player is hidden and the earlier tie wins`,
  )
  assert.equal((await db.query(`SELECT public.get_competition_leaderboard($1, 1) AS r`, [competitionId])).rows[0].r.length, 1, 'limit applies')
  const today = (await db.query(`SELECT public.get_today_competition('chikoo_catcher', '2026-11-21') AS r`)).rows[0].r
  assert.equal(today.title, 'Chikoo Cup')
  assert.equal(today.prize, 'A box of chikoos')
  assert.equal((await db.query(`SELECT public.get_today_competition('chikoo_catcher', '2026-11-23') AS r`)).rows[0].r, null, 'no competition that day')
  const past = (await db.query(`SELECT public.get_past_competitions('chikoo_catcher', '2026-11-22', 5) AS r`)).rows[0].r
  assert.equal(past.length, 1)
  assert.equal(past[0].top.length, 2, 'excluded player is not on the podium')
  assert.equal(past[0].top[0].full_name, 'Player B')
  assert.equal((await db.query(`SELECT public.get_past_competitions('chikoo_catcher', '2026-11-21', 5) AS r`)).rows[0].r.length, 0, 'today is not past')
  for (const text of [JSON.stringify(today), JSON.stringify(past), JSON.stringify(board)]) {
    assert.ok(!text.includes('SAPOTA21'), `${role}: the code must never leave the database`)
  }
}
await db.exec('RESET ROLE')
await db.query(`UPDATE public.game_competitions SET active = false WHERE id = $1`, [competitionId])
await db.exec('SET ROLE anon')
assert.equal((await db.query(`SELECT public.get_today_competition('chikoo_catcher', '2026-11-21') AS r`)).rows[0].r, null, 'inactive competitions are hidden')
assert.equal((await db.query(`SELECT public.get_past_competitions('chikoo_catcher', '2026-11-22', 5) AS r`)).rows[0].r.length, 0)
await db.exec('RESET ROLE')
await db.query(`UPDATE public.game_competitions SET active = true WHERE id = $1`, [competitionId])

await asUser(compA)
await assert.rejects(
  db.query(`INSERT INTO public.game_scores (user_id, score, competition_id) VALUES ($1, 10, $2)`, [compA, competitionId]),
  /row-level security/,
  'a player cannot tag their own score with a competition',
)
await db.query(`INSERT INTO public.game_scores (user_id, score) VALUES ($1, 10)`, [compA])
await assert.rejects(db.query(`SELECT * FROM public.game_competitions`), /permission denied/, 'competitions (and the code) are not readable')
await assert.rejects(db.query(`SELECT * FROM public.game_competition_exclusions`), /permission denied/)
await db.exec('RESET ROLE')

await db.close()
console.log(`Baseline schema builds from ${files.length} migration file(s) and passed its checks`)
