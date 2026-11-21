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
// 61 = 57 before 20261121100000, which dropped 18 policies on 9 tables and
// created 22: one SELECT per table (two on job_posts: anon and authenticated)
// plus INSERT/UPDATE/DELETE for each of the 4 split FOR ALL policies.
assert.equal(await count(`SELECT count(*) n FROM pg_policies WHERE schemaname = 'public'`), 61, 'public RLS policies (a change here should be deliberate)')
// What Supabase's advisor calls "multiple permissive policies": one role with
// two permissive policies that both apply to SELECT on the same table.
const overlappingSelects = (await db.query(`
  SELECT a.tablename, a.policyname AS a, b.policyname AS b
  FROM pg_policies a JOIN pg_policies b
    ON a.schemaname = b.schemaname AND a.tablename = b.tablename AND a.policyname < b.policyname
  WHERE a.schemaname = 'public' AND a.permissive = 'PERMISSIVE' AND b.permissive = 'PERMISSIVE'
    AND a.cmd IN ('SELECT', 'ALL') AND b.cmd IN ('SELECT', 'ALL')
    AND (a.roles && b.roles OR 'public' = ANY (a.roles) OR 'public' = ANY (b.roles))
`)).rows
assert.deepEqual(overlappingSelects, [], 'no role has two permissive SELECT policies on one table')
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
// D scores 10 early, then ties with E on 50 AFTER E got there: E must rank above D
// even though D's first round of the day is the earliest of all.
const compD = '00000000-0000-0000-0000-0000000000b4'
const compE = '00000000-0000-0000-0000-0000000000b5'
for (const [id, name] of [[compD, 'Player D'], [compE, 'Player E']]) {
  await db.query(`INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES ($1, $2, $3)`, [id, `${name.replace(' ', '').toLowerCase()}@example.test`, JSON.stringify({ full_name: name })])
}
await db.query(
  `INSERT INTO public.game_scores (user_id, score, played_at, competition_id) VALUES
     ($1, 10, '2026-11-21 08:00+00', $3), ($1, 50, '2026-11-21 12:00+00', $3), ($2, 50, '2026-11-21 09:30+00', $3)`,
  [compD, compE, competitionId],
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
    [['Player B', 50], ['Player E', 50], ['Player A', 50], ['Player D', 50]],
    `${role}: excluded player is hidden; ties go to whoever reached the score first, not who played first`,
  )
  assert.equal((await db.query(`SELECT public.get_competition_leaderboard($1, 1) AS r`, [competitionId])).rows[0].r.length, 1, 'limit applies')
  assert.ok(!JSON.stringify(board).includes('SAPOTA21'), `${role}: the code must never leave the database`)
  // The date-taking functions are for get_play_public only: a caller picking
  // the day could read a future competition's title and prize early.
  await assert.rejects(db.query(`SELECT public.get_today_competition('chikoo_catcher', '2026-11-21')`), /permission denied/, `${role}: cannot pick the day for today's competition`)
  await assert.rejects(db.query(`SELECT public.get_past_competitions('chikoo_catcher', '2026-11-22', 5)`), /permission denied/, `${role}: cannot pick the day for past winners`)
}
await db.exec('RESET ROLE')
{
  const today = (await db.query(`SELECT public.get_today_competition('chikoo_catcher', '2026-11-21') AS r`)).rows[0].r
  assert.equal(today.title, 'Chikoo Cup')
  assert.equal(today.prize, 'A box of chikoos')
  assert.equal((await db.query(`SELECT public.get_today_competition('chikoo_catcher', '2026-11-23') AS r`)).rows[0].r, null, 'no competition that day')
  const past = (await db.query(`SELECT public.get_past_competitions('chikoo_catcher', '2026-11-22', 5) AS r`)).rows[0].r
  assert.equal(past.length, 1)
  assert.deepEqual(past[0].top.map((r) => r.full_name), ['Player B', 'Player E', 'Player A'], 'podium matches the live board order and omits the excluded player')
  assert.equal((await db.query(`SELECT public.get_past_competitions('chikoo_catcher', '2026-11-21', 5) AS r`)).rows[0].r.length, 0, 'today is not past')
  for (const text of [JSON.stringify(today), JSON.stringify(past)]) {
    assert.ok(!text.includes('SAPOTA21'), 'the code must never leave the database')
  }
}
await db.query(`UPDATE public.game_competitions SET active = false WHERE id = $1`, [competitionId])
assert.equal((await db.query(`SELECT public.get_today_competition('chikoo_catcher', '2026-11-21') AS r`)).rows[0].r, null, 'inactive competitions are hidden')
assert.equal((await db.query(`SELECT public.get_past_competitions('chikoo_catcher', '2026-11-22', 5) AS r`)).rows[0].r.length, 0)
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

// /play bundles: everything public in one call, the player's own numbers in another.
const indiaToday = (await db.query(`SELECT ((now() AT TIME ZONE 'Asia/Kolkata')::date)::text AS d`)).rows[0].d
const direct = (await db.query(`SELECT public.get_today_competition('chikoo_catcher', $1::date) AS r`, [indiaToday])).rows[0].r
for (const role of ['anon', 'authenticated']) {
  await asUser(role === 'anon' ? null : compA)
  const bundle = (await db.query(`SELECT public.get_play_public('chikoo_catcher') AS r`)).rows[0].r
  assert.ok(Array.isArray(bundle.weekly) && Array.isArray(bundle.all_time) && Array.isArray(bundle.past), `${role}: bundle has every list`)
  assert.ok(bundle.all_time.some((row) => row.full_name === 'Player A'), `${role}: all-time board is filled`)
  assert.equal(bundle.today?.id ?? null, direct?.id ?? null, `${role}: "today" is the India date, decided by the database`)
  assert.ok(!JSON.stringify(bundle).includes('SAPOTA21'), `${role}: the code never leaves the database`)
}
await asUser(null)
await assert.rejects(db.query(`SELECT public.get_play_me('chikoo_catcher') AS r`), /permission denied/, 'signed-out visitors have no personal numbers to ask for')
await asUser(compA)
const me = (await db.query(`SELECT public.get_play_me('chikoo_catcher') AS r`)).rows[0].r
assert.equal(me.best_all, 50, 'best ever counts competition rounds too')
assert.equal(me.has_name, true)
assert.ok(me.last_played_at, 'last play time is there for the cooldown')
await db.exec('RESET ROLE')

// ── Who reads and writes what (merged SELECT policies) ───────────────────
// 20261121100000 folded each table's overlapping permissive SELECT policies
// into one and split "manage own" FOR ALL policies into INSERT / UPDATE /
// DELETE. These were written against the schema before that migration and
// must pass unchanged after it: same rows for every viewer, same writes.
await db.exec('RESET ROLE')
await db.query(`UPDATE public.profiles SET is_admin = true WHERE id = $1`, [staffId])
const insertId = async (sql, params = []) => (await db.query(`${sql} RETURNING id::text AS id`, params)).rows[0].id
const viewers = { anon: null, owner: ownerId, stranger: strangerId, admin: staffId }
// Which of the labelled rows the current role can SELECT.
const visibleOf = async (table, labelled) => {
  const byId = new Map(Object.entries(labelled).map(([label, id]) => [id, label]))
  const rows = (await db.query(`SELECT id::text AS id FROM public.${table} WHERE id = ANY($1::uuid[])`, [[...byId.keys()]])).rows
  return rows.map((r) => byId.get(r.id)).sort()
}
const expectVisible = async (table, labelled, expected) => {
  for (const [viewer, id] of Object.entries(viewers)) {
    await asUser(id)
    assert.deepEqual(await visibleOf(table, labelled), expected[viewer], `${table}: what ${viewer} can read`)
  }
  await db.exec('RESET ROLE')
}
const affected = async (sql, params = []) => (await db.query(sql, params)).affectedRows
const rlsRefused = /row-level security|permission denied/

// Listings: L1 approved (owner's), L2 unapproved (owner's), L3 unapproved (stranger's), L4 unapproved, no owner.
const L = {
  L1: await insertId(`INSERT INTO public.listings (name, category, approved, owner_id) VALUES ('RLS L1', 'shop', true, $1)`, [ownerId]),
  L2: await insertId(`INSERT INTO public.listings (name, category, approved, owner_id) VALUES ('RLS L2', 'shop', false, $1)`, [ownerId]),
  L3: await insertId(`INSERT INTO public.listings (name, category, approved, owner_id) VALUES ('RLS L3', 'shop', false, $1)`, [strangerId]),
  L4: await insertId(`INSERT INTO public.listings (name, category, approved) VALUES ('RLS L4', 'shop', false)`),
}
await expectVisible('listings', L, { anon: ['L1'], owner: ['L1', 'L2'], stranger: ['L1', 'L3'], admin: ['L1'] })
await asUser(ownerId)
const ownNewListing = await insertId(`INSERT INTO public.listings (name, category, owner_id) VALUES ('RLS mine', 'shop', $1)`, [ownerId])
await assert.rejects(db.query(`INSERT INTO public.listings (name, category, owner_id) VALUES ('x', 'shop', $1)`, [strangerId]), rlsRefused, 'listing for someone else')
await assert.rejects(db.query(`INSERT INTO public.listings (name, category) VALUES ('x', 'shop')`), rlsRefused, 'listing with no owner')
assert.equal(await affected(`UPDATE public.listings SET description = 'own' WHERE id = $1`, [L.L2]), 1, 'owner updates own unapproved listing')
assert.equal(await affected(`UPDATE public.listings SET description = 'x' WHERE id = ANY($1::uuid[])`, [[L.L3, L.L4]]), 0, 'owner cannot update others')
assert.equal(await affected(`DELETE FROM public.listings WHERE id = ANY($1::uuid[])`, [[L.L3, L.L4]]), 0, 'owner cannot delete others')
assert.equal(await affected(`DELETE FROM public.listings WHERE id = $1`, [ownNewListing]), 1, 'owner deletes own listing')
await asUser(strangerId)
assert.equal(await affected(`UPDATE public.listings SET description = 'x' WHERE id = $1`, [L.L1]), 0, 'a visible listing is still not editable by others')
assert.equal(await affected(`DELETE FROM public.listings WHERE id = $1`, [L.L1]), 0)
await asUser(null)
await assert.rejects(db.query(`INSERT INTO public.listings (name, category) VALUES ('x', 'shop')`), rlsRefused, 'signed out cannot create listings')
assert.equal(await affected(`UPDATE public.listings SET description = 'x' WHERE id = $1`, [L.L1]), 0)
assert.equal(await affected(`DELETE FROM public.listings WHERE id = $1`, [L.L1]), 0)
await db.exec('RESET ROLE')

// Products and options: public when active on an approved listing; owners see all of their own.
const P = {
  P1: await insertId(`INSERT INTO public.listing_products (listing_id, type, name, is_active) VALUES ($1, 'product', 'p1', true)`, [L.L1]),
  P2: await insertId(`INSERT INTO public.listing_products (listing_id, type, name, is_active) VALUES ($1, 'product', 'p2', false)`, [L.L1]),
  P3: await insertId(`INSERT INTO public.listing_products (listing_id, type, name, is_active) VALUES ($1, 'product', 'p3', true)`, [L.L2]),
  P4: await insertId(`INSERT INTO public.listing_products (listing_id, type, name, is_active) VALUES ($1, 'product', 'p4', true)`, [L.L4]),
  P5: await insertId(`INSERT INTO public.listing_products (listing_id, type, name, is_active) VALUES ($1, 'product', 'p5', true)`, [L.L3]),
}
await expectVisible('listing_products', P, { anon: ['P1'], owner: ['P1', 'P2', 'P3'], stranger: ['P1', 'P5'], admin: ['P1'] })
const O = {}
for (const [i, key] of Object.keys(P).entries()) {
  O[`O${i + 1}`] = await insertId(`INSERT INTO public.listing_product_options (product_id, label, price_paise) VALUES ($1, 'opt', 1000)`, [P[key]])
}
await expectVisible('listing_product_options', O, { anon: ['O1'], owner: ['O1', 'O2', 'O3'], stranger: ['O1', 'O5'], admin: ['O1'] })
await asUser(ownerId)
await assert.rejects(db.query(`INSERT INTO public.listing_products (listing_id, type, name) VALUES ($1, 'product', 'x')`, [L.L1]), rlsRefused, 'products are written by the site only')
assert.equal(await affected(`UPDATE public.listing_products SET name = 'x' WHERE id = $1`, [P.P2]), 0)
assert.equal(await affected(`DELETE FROM public.listing_products WHERE id = $1`, [P.P2]), 0)
await assert.rejects(db.query(`INSERT INTO public.listing_product_options (product_id, label, price_paise) VALUES ($1, 'x', 1000)`, [P.P1]), rlsRefused)
await assert.rejects(db.query(`UPDATE public.listing_product_options SET label = 'x' WHERE id = $1`, [O.O1]), rlsRefused)
await db.exec('RESET ROLE')

// Orders: the buyer and the listing's owner, nobody else.
const R = {
  R1: await insertId(`INSERT INTO public.orders (listing_id, buyer_id, buyer_name, buyer_phone, service_name, service_price, amount_total) VALUES ($1, $2, 'b', '9', 's', 1, 1)`, [L.L1, strangerId]),
  R2: await insertId(`INSERT INTO public.orders (listing_id, buyer_id, buyer_name, buyer_phone, service_name, service_price, amount_total) VALUES ($1, NULL, 'b', '9', 's', 1, 1)`, [L.L1]),
  R3: await insertId(`INSERT INTO public.orders (listing_id, buyer_id, buyer_name, buyer_phone, service_name, service_price, amount_total) VALUES ($1, $2, 'b', '9', 's', 1, 1)`, [L.L4, strangerId]),
  R4: await insertId(`INSERT INTO public.orders (listing_id, buyer_id, buyer_name, buyer_phone, service_name, service_price, amount_total) VALUES ($1, NULL, 'b', '9', 's', 1, 1)`, [L.L4]),
  R5: await insertId(`INSERT INTO public.orders (listing_id, buyer_id, buyer_name, buyer_phone, service_name, service_price, amount_total) VALUES ($1, $2, 'b', '9', 's', 1, 1)`, [L.L3, ownerId]),
}
await expectVisible('orders', R, { anon: [], owner: ['R1', 'R2', 'R5'], stranger: ['R1', 'R3', 'R5'], admin: [] })
await asUser(strangerId)
await assert.rejects(db.query(`UPDATE public.orders SET status = 'cancelled' WHERE id = $1`, [R.R1]), rlsRefused, 'orders are written by the site only')
await db.exec('RESET ROLE')

// Appointments: the person who booked and the listing's owner.
const appt = (listing, user) => insertId(
  `INSERT INTO public.appointments (listing_id, user_id, booking_date, slot_start, slot_end, user_name, user_phone) VALUES ($1, $2, '2026-12-01', '10:00', '10:30', 'n', '9')`,
  [listing, user],
)
const A = { A1: await appt(L.L1, strangerId), A2: await appt(L.L4, strangerId), A3: await appt(L.L1, staffId), A4: await appt(L.L4, staffId) }
await expectVisible('appointments', A, { anon: [], owner: ['A1', 'A3'], stranger: ['A1', 'A2'], admin: ['A3', 'A4'] })
await asUser(strangerId)
await assert.rejects(
  db.query(`INSERT INTO public.appointments (listing_id, user_id, booking_date, slot_start, slot_end, user_name, user_phone) VALUES ($1, $2, '2026-12-02', '10:00', '10:30', 'n', '9')`, [L.L1, strangerId]),
  rlsRefused,
  'appointments are booked by the site only',
)
assert.equal(await affected(`UPDATE public.appointments SET notes = 'x' WHERE id = $1`, [A.A1]), 0)
assert.equal(await affected(`DELETE FROM public.appointments WHERE id = $1`, [A.A1]), 0)
await db.exec('RESET ROLE')

// Emergency alerts: active ones for everyone; admins see and manage all.
const E = {
  E1: await insertId(`INSERT INTO public.emergency_alerts (title, severity, active) VALUES ('e1', 'critical', true)`),
  E2: await insertId(`INSERT INTO public.emergency_alerts (title, severity, active) VALUES ('e2', 'critical', false)`),
  E3: await insertId(`INSERT INTO public.emergency_alerts (title, severity, active) VALUES ('e3', 'critical', NULL)`),
}
await expectVisible('emergency_alerts', E, { anon: ['E1'], owner: ['E1'], stranger: ['E1'], admin: ['E1', 'E2', 'E3'] })
await asUser(staffId)
const adminAlert = await insertId(`INSERT INTO public.emergency_alerts (title, severity, active) VALUES ('new', 'info', false)`)
assert.equal(await affected(`UPDATE public.emergency_alerts SET title = 'edited' WHERE id = $1`, [E.E2]), 1, 'admin updates an alert')
assert.equal(await affected(`DELETE FROM public.emergency_alerts WHERE id = $1`, [adminAlert]), 1, 'admin deletes an alert')
for (const id of [ownerId, null]) {
  await asUser(id)
  await assert.rejects(db.query(`INSERT INTO public.emergency_alerts (title, severity) VALUES ('fake', 'critical')`), rlsRefused, 'only admins post alerts')
  assert.equal(await affected(`UPDATE public.emergency_alerts SET title = 'x' WHERE id = $1`, [E.E1]), 0)
  assert.equal(await affected(`DELETE FROM public.emergency_alerts WHERE id = $1`, [E.E1]), 0)
}
await db.exec('RESET ROLE')

// Events: approved ones for everyone; organizers see and manage their own.
const V = {
  V1: await insertId(`INSERT INTO public.events (title, date, location, category, approved, organizer_id) VALUES ('v1', '2026-12-01', 'x', 'c', true, $1)`, [ownerId]),
  V2: await insertId(`INSERT INTO public.events (title, date, location, category, approved, organizer_id) VALUES ('v2', '2026-12-01', 'x', 'c', false, $1)`, [ownerId]),
  V3: await insertId(`INSERT INTO public.events (title, date, location, category, approved, organizer_id) VALUES ('v3', '2026-12-01', 'x', 'c', false, $1)`, [strangerId]),
  V4: await insertId(`INSERT INTO public.events (title, date, location, category, approved) VALUES ('v4', '2026-12-01', 'x', 'c', NULL)`),
}
await expectVisible('events', V, { anon: ['V1'], owner: ['V1', 'V2'], stranger: ['V1', 'V3'], admin: ['V1'] })
await asUser(ownerId)
const ownEvent = await insertId(`INSERT INTO public.events (title, date, location, category, organizer_id) VALUES ('mine', '2026-12-01', 'x', 'c', $1)`, [ownerId])
await assert.rejects(db.query(`INSERT INTO public.events (title, date, location, category, organizer_id) VALUES ('x', '2026-12-01', 'x', 'c', $1)`, [strangerId]), rlsRefused)
await assert.rejects(db.query(`INSERT INTO public.events (title, date, location, category) VALUES ('x', '2026-12-01', 'x', 'c')`), rlsRefused)
assert.equal(await affected(`UPDATE public.events SET title = 'edited' WHERE id = $1`, [V.V2]), 1, 'organizer edits own event')
await assert.rejects(db.query(`UPDATE public.events SET organizer_id = $2 WHERE id = $1`, [V.V2, strangerId]), rlsRefused, 'cannot hand an event to someone else')
assert.equal(await affected(`UPDATE public.events SET title = 'x' WHERE id = ANY($1::uuid[])`, [[V.V3, V.V4]]), 0)
assert.equal(await affected(`DELETE FROM public.events WHERE id = ANY($1::uuid[])`, [[V.V3, V.V4]]), 0)
assert.equal(await affected(`DELETE FROM public.events WHERE id = $1`, [ownEvent]), 1, 'organizer deletes own event')
await asUser(strangerId)
assert.equal(await affected(`UPDATE public.events SET title = 'x' WHERE id = $1`, [V.V1]), 0, 'a visible event is still not editable by others')
assert.equal(await affected(`DELETE FROM public.events WHERE id = $1`, [V.V1]), 0)
await asUser(null)
await assert.rejects(db.query(`INSERT INTO public.events (title, date, location, category) VALUES ('x', '2026-12-01', 'x', 'c')`), rlsRefused)
await db.exec('RESET ROLE')

// Job posts: live ones for anon and signed-in users; posters (signed in) also see their own.
const job = (status, by, expires) => insertId(
  `INSERT INTO public.job_posts (kind, status, posted_by, title, category, work_types, area, employer_name, published_at, expires_at)
   VALUES ('hiring', $1, $2, 't', 'c', '{full_time}', 'a', 'e', now() - interval '1 day', now() + $3::interval)`,
  [status, by, expires],
)
const J = { J1: await job('approved', strangerId, '10 days'), J2: await job('pending', ownerId, '10 days'), J3: await job('approved', ownerId, '-1 day'), J4: await job('approved', ownerId, '10 days') }
await expectVisible('job_posts', J, { anon: ['J1', 'J4'], owner: ['J1', 'J2', 'J3', 'J4'], stranger: ['J1', 'J4'], admin: ['J1', 'J4'] })
// The poster rule is for signed-in users only: even an anon request carrying the owner's id sees live posts alone.
await db.query(`SELECT set_config('request.jwt.claim.sub', $1, false)`, [ownerId])
await db.exec('SET ROLE anon')
assert.deepEqual(await visibleOf('job_posts', J), ['J1', 'J4'], 'job_posts: anon role never gets the poster rule')
await db.exec('RESET ROLE')

// Favourites: everyone reads every row (for counts); people manage only their own.
await db.query(`INSERT INTO public.listing_favourites (user_id, listing_id) VALUES ($1, $3), ($2, $3), ($2, $4)`, [ownerId, strangerId, L.L1, L.L4])
const favs = async () => (await db.query(
  `SELECT user_id::text || '/' || listing_id::text AS k FROM public.listing_favourites WHERE listing_id = ANY($1::uuid[]) ORDER BY 1`,
  [Object.values(L)],
)).rows.map((r) => r.k)
const allFavs = [`${ownerId}/${L.L1}`, `${strangerId}/${L.L1}`, `${strangerId}/${L.L4}`].sort()
for (const id of Object.values(viewers)) {
  await asUser(id)
  assert.deepEqual(await favs(), allFavs, `listing_favourites: everyone reads every favourite (${id ?? 'anon'})`)
}
await asUser(ownerId)
await db.query(`INSERT INTO public.listing_favourites (user_id, listing_id) VALUES ($1, $2)`, [ownerId, L.L2])
await assert.rejects(db.query(`INSERT INTO public.listing_favourites (user_id, listing_id) VALUES ($1, $2)`, [strangerId, L.L2]), rlsRefused, 'cannot favourite as someone else')
assert.equal(await affected(`UPDATE public.listing_favourites SET listing_id = $3 WHERE user_id = $1 AND listing_id = $2`, [ownerId, L.L2, L.L3]), 1, 'own favourite is editable')
await assert.rejects(db.query(`UPDATE public.listing_favourites SET user_id = $2 WHERE user_id = $1 AND listing_id = $3`, [ownerId, strangerId, L.L3]), rlsRefused, 'cannot hand a favourite to someone else')
assert.equal(await affected(`UPDATE public.listing_favourites SET created_at = now() WHERE user_id = $1`, [strangerId]), 0)
assert.equal(await affected(`DELETE FROM public.listing_favourites WHERE user_id = $1`, [strangerId]), 0, 'cannot remove others\' favourites')
assert.equal(await affected(`DELETE FROM public.listing_favourites WHERE user_id = $1 AND listing_id = $2`, [ownerId, L.L3]), 1, 'removes own favourite')
await asUser(null)
await assert.rejects(db.query(`INSERT INTO public.listing_favourites (user_id, listing_id) VALUES ($1, $2)`, [ownerId, L.L2]), rlsRefused)
assert.equal(await affected(`DELETE FROM public.listing_favourites`), 0, 'signed out deletes nothing')
await db.exec('RESET ROLE')

await db.exec('RESET ROLE')
assert.equal((await db.query("SELECT count(*)::int AS n FROM pg_publication_tables WHERE pubname = 'supabase_realtime'")).rows[0].n, 0, 'nothing is streamed over Realtime: the notification bell polls')
await db.close()
console.log(`Baseline schema builds from ${files.length} migration file(s) and passed its checks`)
