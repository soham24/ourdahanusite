-- Close writes that the app never makes but the public API allowed.
--
-- The anon key ships in every browser, so anything these policies permit
-- can be done with a hand-written request to /rest/v1, skipping every check
-- in the server actions. Each block below names the request it stops.
--
-- "Staff" throughout means a signed-in profile with role admin or
-- moderator. A signed-in user can read their own profile row
-- (profile_read_own), so the check works inside these policies and the
-- security-invoker triggers. The service role (server actions using the
-- admin client) is never restricted here.

-- ── listing_questions ───────────────────────────────────────────────────
-- "Owner can answer" was `for update to public using (true)`: anyone, even
-- signed out, could rewrite every question and answer on every listing.
drop policy if exists "Owner can answer" on public.listing_questions;
create policy "Owner can answer" on public.listing_questions
  for update to authenticated
  using (
    exists (select 1 from public.listings l where l.id = listing_id and l.owner_id = (select auth.uid()))
    or exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role in ('admin', 'moderator'))
  )
  with check (
    exists (select 1 from public.listings l where l.id = listing_id and l.owner_id = (select auth.uid()))
    or exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role in ('admin', 'moderator'))
  );
-- Answering touches two columns; nothing else may be changed through the API.
revoke update on public.listing_questions from anon, authenticated;
grant update (answer, answered_at) on public.listing_questions to authenticated;

-- ── coupons ─────────────────────────────────────────────────────────────
-- "Admin read coupons" was `using (true)`: every code, its price and who it
-- was given to were one GET away. Forms now ask the server about one code
-- (checkListingCoupon); only staff list them.
drop policy if exists "Admin read coupons" on public.coupons;
create policy "Staff read coupons" on public.coupons
  for select to authenticated
  using (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role in ('admin', 'moderator')));
revoke all on public.coupons from anon;

-- ── listings: columns owners must not set themselves ────────────────────
-- "Owners can manage own listings" lets an owner update their row, which
-- the edit form needs -- but with no column limit an owner could PATCH
-- expires_at to null (never expire, never pay), give themselves the
-- verified badge or premium plan, set their own rating, or switch on
-- appointments with no booking fee. guard_listing_selling_columns already
-- protects approval and selling status; this guards the rest. Every app
-- path that changes these columns runs as the service role or as staff.
create or replace function public.guard_listing_owner_columns()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user not in ('anon', 'authenticated') then
    return new;
  end if;
  if exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin', 'moderator')) then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.verified := false;
    new.rating := 0;
    new.review_count := 0;
    new.views := 0;
    new.reminders_sent := '{}';
    new.appointments_enabled := false;
    new.appointment_booking_fee := 0;
    return new;
  end if;

  if new.expires_at is distinct from old.expires_at
     or new.verified is distinct from old.verified
     or new.plan is distinct from old.plan
     or new.rating is distinct from old.rating
     or new.review_count is distinct from old.review_count
     or new.views is distinct from old.views
     or new.payment_id is distinct from old.payment_id
     or new.payment_status is distinct from old.payment_status
     or new.coupon_used is distinct from old.coupon_used
     or new.amount_paid is distinct from old.amount_paid
     or new.appointments_enabled is distinct from old.appointments_enabled
     or new.appointment_booking_fee is distinct from old.appointment_booking_fee
     or new.reminders_sent is distinct from old.reminders_sent
     or new.owner_id is distinct from old.owner_id
     or new.subdomain is distinct from old.subdomain then
    raise exception 'That listing field can only be changed by the site.'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_guard_listing_owner_columns on public.listings;
create trigger trg_guard_listing_owner_columns
  before insert or update on public.listings
  for each row execute function public.guard_listing_owner_columns();

revoke all on function public.guard_listing_owner_columns() from public, anon, authenticated;

-- ── reviews ─────────────────────────────────────────────────────────────
-- "Listing owner can reply once" only required owner_reply to be set
-- afterwards, so an owner could turn a customer's 1-star review into a
-- 5-star one in the same request. Owners may now change only the reply.
create or replace function public.guard_review_columns()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user not in ('anon', 'authenticated') then
    return new;
  end if;
  if exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin', 'moderator')) then
    return new;
  end if;

  if new.rating is distinct from old.rating
     or new.comment is distinct from old.comment
     or new.user_id is distinct from old.user_id
     or new.listing_id is distinct from old.listing_id
     or new.created_at is distinct from old.created_at then
    raise exception 'Only the reply on a review can be changed.'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_guard_review_columns on public.reviews;
create trigger trg_guard_review_columns
  before update on public.reviews
  for each row execute function public.guard_review_columns();

revoke all on function public.guard_review_columns() from public, anon, authenticated;

-- A review is written by its author with no reply yet. The insert policy
-- let an author plant a fake "reply from the business" and any rating.
-- (Ratings are already held to 1-5 by reviews_rating_check.)
alter policy "Authenticated users can leave reviews" on public.reviews
  with check ((select auth.uid()) = user_id and owner_reply is null and owner_replied_at is null);
