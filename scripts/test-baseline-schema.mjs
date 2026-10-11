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
assert.equal(await count(`SELECT count(*) n FROM pg_tables WHERE schemaname = 'public'`), 47, 'public tables')
assert.equal(await count(`SELECT count(*) n FROM pg_policies WHERE schemaname = 'public'`) >= 81, true, 'public RLS policies')
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
await assert.rejects(db.query(`SELECT public.increment_reply_count()`), /permission denied/, 'trigger functions are not callable')
await db.exec('RESET ROLE')

assert.equal((await db.query(`SELECT public FROM storage.buckets WHERE id = 'uploads'`)).rows[0]?.public, true, 'uploads bucket')

// The sample data loads on top, and moderation still hides what is unapproved.
await db.exec(`DELETE FROM public.listings`)
await db.exec(await readFile(new URL('../supabase/seed.sql', import.meta.url), 'utf8'))
await db.exec('SET ROLE anon')
assert.equal(await count(`SELECT count(*) n FROM public.listings`), 6, 'seeded approved listings visible to visitors')
assert.equal(await count(`SELECT count(*) n FROM public.events`), 2, 'seeded events')
await db.exec('RESET ROLE')

await db.close()
console.log(`Baseline schema builds from ${files.length} migration file(s) and passed its checks`)
