import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'

const db = new PGlite()
await db.exec(`
  CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
  CREATE SCHEMA auth;
  CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  GRANT USAGE ON SCHEMA auth TO anon, authenticated;
  CREATE TABLE public.profiles (id uuid PRIMARY KEY, full_name text, avatar_url text, email text, phone text, address text, role text DEFAULT 'user', is_admin boolean DEFAULT false, verified boolean DEFAULT false);
  CREATE TABLE public.orders (id uuid PRIMARY KEY, buyer_id uuid, payment_status text);
  GRANT ALL ON public.profiles, public.orders TO anon, authenticated, service_role;
  ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
  CREATE POLICY public_read ON public.profiles FOR SELECT USING (true);
  CREATE POLICY own_update ON public.profiles FOR UPDATE USING (auth.uid() = id);
  CREATE POLICY own_insert ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
  INSERT INTO public.profiles VALUES ('00000000-0000-0000-0000-000000000001', 'Public name', NULL, 'private@example.test', 'private', 'private', 'user', false, false);
`)
// Exercise actual SQL privileges, including bypasses of the application UI.
await db.exec(await readFile('supabase/legacy/harden_profile_access.sql', 'utf8'))
await db.exec(`SET ROLE anon`)
assert.equal((await db.query('SELECT email FROM public.profiles')).rows.length, 0, 'anonymous users must not read private profile rows')
await db.exec(`RESET ROLE; SET ROLE authenticated; SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', false)`)
for (const assignment of ["role = 'admin'", 'is_admin = true', 'verified = true']) {
  await assert.rejects(db.exec(`UPDATE public.profiles SET ${assignment} WHERE id = auth.uid()`), /privileged profile fields/i)
}
await db.exec(`UPDATE public.profiles SET full_name = 'Updated name' WHERE id = auth.uid()`)
assert.equal((await db.query('SELECT full_name FROM public.profiles')).rows[0].full_name, 'Updated name')
await assert.rejects(db.exec(`INSERT INTO public.orders VALUES ('00000000-0000-0000-0000-000000000002', auth.uid(), 'paid')`), /permission denied/)
await db.exec(`RESET ROLE; SET ROLE anon`)
assert.deepEqual((await db.query('SELECT * FROM public.public_profiles')).rows, [{id:'00000000-0000-0000-0000-000000000001',full_name:'Updated name',avatar_url:null}])
await assert.rejects(db.query('SELECT email FROM public.public_profiles'), /does not exist/)
await db.exec('RESET ROLE; SET ROLE service_role')
await db.exec("UPDATE public.profiles SET role = 'admin', verified = true")
await db.exec('RESET ROLE')
// Reapplying must preserve privileges and remain safe.
await db.exec(await readFile('supabase/legacy/harden_profile_access.sql', 'utf8'))
await db.close()
console.log('Profile privacy, protected roles and order-write permissions passed')
