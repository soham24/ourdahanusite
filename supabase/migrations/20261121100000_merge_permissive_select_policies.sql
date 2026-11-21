-- One SELECT policy per role per table.
--
-- Supabase's performance advisor flags "multiple permissive policies": when a
-- role has two permissive policies for the same command, Postgres evaluates
-- both on every row it reads. Permissive policies are OR-ed together, so the
-- fix that changes nothing about who sees what is to replace them with one
-- policy whose USING is the OR of the old ones.
--
-- Tables whose second SELECT rule came from a FOR ALL "manage own ..." policy
-- also lose that FOR ALL policy: it is split into INSERT, UPDATE and DELETE
-- policies with the same expression, and its SELECT half is folded into the
-- merged SELECT policy. A FOR ALL policy with only USING applies that
-- expression as WITH CHECK too (to INSERT and to the new row of an UPDATE), so
-- the split policies spell out the same WITH CHECK explicitly.
--
-- Every role list is kept: TO public stays TO public. job_posts is the one
-- table whose two policies name different roles; see there.
--
-- Drops and creates run in the one transaction the migration runs in, so no
-- request ever sees a table with the old policies gone and the new ones
-- missing. scripts/test-baseline-schema.mjs checks, for each table, which rows
-- a signed-out visitor, the owner, an unrelated user and an admin can read and
-- which writes each can make; those checks were written against the old
-- policies and pass unchanged against these.

-- ── appointments ────────────────────────────────────────────────────────
-- Was: "Users can read own appointments"          (select, public): the booker
--      "Owners can read appointments for own listings" (select, public)
drop policy if exists "Users can read own appointments" on public.appointments;
drop policy if exists "Owners can read appointments for own listings" on public.appointments;
drop policy if exists "Bookers and listing owners read appointments" on public.appointments;
create policy "Bookers and listing owners read appointments" on public.appointments
  as permissive for select to public
  using (
    ((select auth.uid()) = user_id)
    or (exists (
      select 1 from public.listings
      where listings.id = appointments.listing_id
        and listings.owner_id = (select auth.uid())
    ))
  );

-- ── emergency_alerts ────────────────────────────────────────────────────
-- Was: "Active alerts are public" (select, public): active = true
--      "Admins can manage alerts" (ALL, public):    caller is an admin
-- SELECT becomes active OR admin; the admin rule keeps INSERT/UPDATE/DELETE.
drop policy if exists "Active alerts are public" on public.emergency_alerts;
drop policy if exists "Admins can manage alerts" on public.emergency_alerts;
drop policy if exists "Active alerts are public, admins read all" on public.emergency_alerts;
drop policy if exists "Admins can create alerts" on public.emergency_alerts;
drop policy if exists "Admins can update alerts" on public.emergency_alerts;
drop policy if exists "Admins can delete alerts" on public.emergency_alerts;
create policy "Active alerts are public, admins read all" on public.emergency_alerts
  as permissive for select to public
  using (
    (active = true)
    or (exists (
      select 1 from public.profiles
      where profiles.id = (select auth.uid()) and profiles.is_admin = true
    ))
  );
create policy "Admins can create alerts" on public.emergency_alerts
  as permissive for insert to public
  with check (exists (
    select 1 from public.profiles
    where profiles.id = (select auth.uid()) and profiles.is_admin = true
  ));
create policy "Admins can update alerts" on public.emergency_alerts
  as permissive for update to public
  using (exists (
    select 1 from public.profiles
    where profiles.id = (select auth.uid()) and profiles.is_admin = true
  ))
  with check (exists (
    select 1 from public.profiles
    where profiles.id = (select auth.uid()) and profiles.is_admin = true
  ));
create policy "Admins can delete alerts" on public.emergency_alerts
  as permissive for delete to public
  using (exists (
    select 1 from public.profiles
    where profiles.id = (select auth.uid()) and profiles.is_admin = true
  ));

-- ── events ──────────────────────────────────────────────────────────────
-- Was: "Approved events are public"       (select, public): approved OR organizer
--      "Organizers can manage own events" (ALL, public):    organizer
-- (approved OR organizer) OR organizer is approved OR organizer, so the
-- merged SELECT reads exactly like the old public policy.
drop policy if exists "Approved events are public" on public.events;
drop policy if exists "Organizers can manage own events" on public.events;
drop policy if exists "Approved events are public, organizers read own" on public.events;
drop policy if exists "Organizers can create own events" on public.events;
drop policy if exists "Organizers can update own events" on public.events;
drop policy if exists "Organizers can delete own events" on public.events;
create policy "Approved events are public, organizers read own" on public.events
  as permissive for select to public
  using ((approved = true) or ((select auth.uid()) = organizer_id));
create policy "Organizers can create own events" on public.events
  as permissive for insert to public
  with check ((select auth.uid()) = organizer_id);
create policy "Organizers can update own events" on public.events
  as permissive for update to public
  using ((select auth.uid()) = organizer_id)
  with check ((select auth.uid()) = organizer_id);
create policy "Organizers can delete own events" on public.events
  as permissive for delete to public
  using ((select auth.uid()) = organizer_id);

-- ── job_posts ───────────────────────────────────────────────────────────
-- Was: "Live job posts are public"            (select, anon + authenticated)
--      "Posters can read their own job posts" (select, authenticated only)
-- Only authenticated had two policies. Merging them into one policy for both
-- roles would let an anon request that carries a user id read that user's
-- pending posts, so anon keeps the live-only rule on its own and
-- authenticated gets live OR own.
drop policy if exists "Live job posts are public" on public.job_posts;
drop policy if exists "Posters can read their own job posts" on public.job_posts;
drop policy if exists "Live job posts are public to visitors" on public.job_posts;
drop policy if exists "Live job posts are public, posters read own" on public.job_posts;
create policy "Live job posts are public to visitors" on public.job_posts
  as permissive for select to anon
  using ((status = 'approved'::text) and (expires_at > now()));
create policy "Live job posts are public, posters read own" on public.job_posts
  as permissive for select to authenticated
  using (
    ((status = 'approved'::text) and (expires_at > now()))
    or (posted_by = (select auth.uid()))
  );

-- ── listing_favourites ──────────────────────────────────────────────────
-- Was: "Anyone can view favourites count" (select, public): true
--      "Users manage own favourites"      (ALL, public):    own row
-- true OR anything is true: SELECT stays open to everyone (the counts need
-- it); the own-row rule keeps INSERT/UPDATE/DELETE.
drop policy if exists "Anyone can view favourites count" on public.listing_favourites;
drop policy if exists "Users manage own favourites" on public.listing_favourites;
drop policy if exists "Anyone can view favourites" on public.listing_favourites;
drop policy if exists "Users add own favourites" on public.listing_favourites;
drop policy if exists "Users update own favourites" on public.listing_favourites;
drop policy if exists "Users remove own favourites" on public.listing_favourites;
create policy "Anyone can view favourites" on public.listing_favourites
  as permissive for select to public
  using (true);
create policy "Users add own favourites" on public.listing_favourites
  as permissive for insert to public
  with check ((select auth.uid()) = user_id);
create policy "Users update own favourites" on public.listing_favourites
  as permissive for update to public
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "Users remove own favourites" on public.listing_favourites
  as permissive for delete to public
  using ((select auth.uid()) = user_id);

-- ── listing_product_options ─────────────────────────────────────────────
-- Was: "Public reads options of active products on approved listings" (select, public)
--      "Owners read own product options"                               (select, public)
drop policy if exists "Public reads options of active products on approved listings" on public.listing_product_options;
drop policy if exists "Owners read own product options" on public.listing_product_options;
drop policy if exists "Public reads live options, owners read own" on public.listing_product_options;
create policy "Public reads live options, owners read own" on public.listing_product_options
  as permissive for select to public
  using (
    (exists (
      select 1 from public.listing_products p
      join public.listings l on l.id = p.listing_id
      where p.id = listing_product_options.product_id
        and p.is_active = true and l.approved = true
    ))
    or (exists (
      select 1 from public.listing_products p
      join public.listings l on l.id = p.listing_id
      where p.id = listing_product_options.product_id
        and l.owner_id = (select auth.uid())
    ))
  );

-- ── listing_products ────────────────────────────────────────────────────
-- Was: "Public reads active products on approved listings" (select, public)
--      "Owners read own products"                          (select, public)
drop policy if exists "Public reads active products on approved listings" on public.listing_products;
drop policy if exists "Owners read own products" on public.listing_products;
drop policy if exists "Public reads live products, owners read own" on public.listing_products;
create policy "Public reads live products, owners read own" on public.listing_products
  as permissive for select to public
  using (
    ((is_active = true) and (exists (
      select 1 from public.listings
      where listings.id = listing_products.listing_id and listings.approved = true
    )))
    or (exists (
      select 1 from public.listings
      where listings.id = listing_products.listing_id
        and listings.owner_id = (select auth.uid())
    ))
  );

-- ── listings ────────────────────────────────────────────────────────────
-- Was: "Approved listings are public"   (select, public): approved OR owner
--      "Owners can manage own listings" (ALL, public):    owner
-- As with events, the old public policy already contained the owner rule.
-- trg_guard_listing_owner_columns and trg_guard_listing_selling_columns still
-- limit which columns an owner's INSERT/UPDATE may set.
drop policy if exists "Approved listings are public" on public.listings;
drop policy if exists "Owners can manage own listings" on public.listings;
drop policy if exists "Approved listings are public, owners read own" on public.listings;
drop policy if exists "Owners can create own listings" on public.listings;
drop policy if exists "Owners can update own listings" on public.listings;
drop policy if exists "Owners can delete own listings" on public.listings;
create policy "Approved listings are public, owners read own" on public.listings
  as permissive for select to public
  using ((approved = true) or ((select auth.uid()) = owner_id));
create policy "Owners can create own listings" on public.listings
  as permissive for insert to public
  with check ((select auth.uid()) = owner_id);
create policy "Owners can update own listings" on public.listings
  as permissive for update to public
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);
create policy "Owners can delete own listings" on public.listings
  as permissive for delete to public
  using ((select auth.uid()) = owner_id);

-- ── orders ──────────────────────────────────────────────────────────────
-- Was: buyer_can_select_own_orders     (select, public): buyer
--      seller_can_select_listing_orders (select, public): owner of the listing
drop policy if exists buyer_can_select_own_orders on public.orders;
drop policy if exists seller_can_select_listing_orders on public.orders;
drop policy if exists buyer_or_seller_can_select_orders on public.orders;
create policy buyer_or_seller_can_select_orders on public.orders
  as permissive for select to public
  using (
    (buyer_id = (select auth.uid()))
    or (listing_id in (
      select listings.id from public.listings
      where listings.owner_id = (select auth.uid())
    ))
  );
