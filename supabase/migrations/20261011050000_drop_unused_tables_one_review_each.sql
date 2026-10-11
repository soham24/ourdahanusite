-- Two decisions made on 2026-10-11.
--
-- 1. Drop what the app no longer uses.
--
-- The delivery/rider tables are left over from the delivery feature and
-- mobile API removed in September; forum, news, classifieds, event RSVPs
-- and the original `products` table never got pages. Nothing in src/ reads
-- or writes any of them, no table still in use has a foreign key into
-- them, and on production eleven were empty -- the other two held one test
-- row each, saved before this ran. They shipped to every fork through the
-- baseline and showed up in Supabase's advisors as unused indexes and
-- unindexed foreign keys. One statement drops them together -- their
-- policies refer to each other -- and still refuses, with no CASCADE, if
-- anything outside this list depends on them.
drop table if exists
  public.delivery_order_items,
  public.rider_assignments,
  public.rider_earnings,
  public.cod_collections,
  public.delivery_orders,
  public.riders,
  public.listing_delivery_config,
  public.forum_replies,
  public.forum_threads,
  public.news_articles,
  public.event_rsvps,
  public.classifieds,
  public.products;

-- Functions that only served those tables.
drop function if exists public.accept_delivery_offer(uuid, uuid);
drop function if exists public.increment_reply_count();

-- 2. One review per person per business.
--
-- Production has eleven people with more than one review on the same
-- business. Those are real reviews and are kept; a unique index would
-- refuse to build over them, so the rule applies to new reviews: a second
-- review from the same person is refused. The advisory lock makes two
-- simultaneous submissions wait for each other instead of both passing
-- the check. submitReview asks first and shows a friendly message; this is
-- the backstop for direct API calls.
create or replace function public.one_review_per_user()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  perform pg_advisory_xact_lock(hashtextextended(new.listing_id::text || ':' || new.user_id::text, 0));
  if exists (
    select 1 from public.reviews r
    where r.listing_id = new.listing_id and r.user_id = new.user_id
  ) then
    raise exception 'You have already reviewed this business.'
      using errcode = '23505';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_one_review_per_user on public.reviews;
create trigger trg_one_review_per_user
  before insert on public.reviews
  for each row execute function public.one_review_per_user();

revoke all on function public.one_review_per_user() from public, anon, authenticated;
