-- Two performance fixes from Supabase's performance advisor. Neither changes
-- who can read or write what.
--
-- 1. auth.uid() written bare in a policy is re-evaluated for every row the
--    query touches. Wrapped as (select auth.uid()) Postgres evaluates it once
--    per statement. Same predicates, same roles, same commands -- only the
--    wrapping changes.
alter policy "Find approved professionals are public" on public.find_professionals
  using (((status = 'approved'::text) and (is_active = true)) or ((select auth.uid()) = submitted_by));
alter policy "Users can submit professionals" on public.find_professionals
  with check (((select auth.uid()) = submitted_by) and (status = 'pending'::text));
alter policy "Find approved ratings are public" on public.find_ratings
  using ((status = 'approved'::text) or ((select auth.uid()) = user_id));
alter policy "Users can submit ratings" on public.find_ratings
  with check (((select auth.uid()) = user_id) and (status = 'pending'::text));
alter policy "Users can update own ratings" on public.find_ratings
  using ((select auth.uid()) = user_id)
  with check (((select auth.uid()) = user_id) and (status = 'pending'::text));
alter policy "Users can submit their own score" on public.game_scores
  with check ((select auth.uid()) = user_id);
alter policy "Posters can read their own job posts" on public.job_posts
  using (posted_by = (select auth.uid()));
alter policy "Admin read coupon redemptions" on public.coupon_redemptions
  using (exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.role = any (array['admin'::text, 'moderator'::text])
  ));

-- 2. Foreign keys the app filters or joins on, which had no index. Each of
--    these backs a real query: "my listings", a user's reviews/ratings/votes,
--    a buyer's or a listing's orders, payment recovery by listing, a
--    listing's jobs, coupon reporting. Foreign keys on tables the app no
--    longer reads (the old delivery/rider and forum tables) are left alone.
create index if not exists idx_listings_owner_id on public.listings (owner_id);
create index if not exists idx_reviews_user_id on public.reviews (user_id);
create index if not exists idx_orders_buyer_id on public.orders (buyer_id);
create index if not exists idx_orders_listing_id on public.orders (listing_id);
create index if not exists idx_payment_intents_listing_id on public.payment_intents (listing_id);
create index if not exists idx_job_posts_listing_id on public.job_posts (listing_id);
create index if not exists idx_coupon_redemptions_coupon_id on public.coupon_redemptions (coupon_id);
create index if not exists idx_coupon_redemptions_user_id on public.coupon_redemptions (user_id);
create index if not exists idx_find_ratings_user_id on public.find_ratings (user_id);
create index if not exists idx_find_professionals_submitted_by on public.find_professionals (submitted_by);
create index if not exists idx_poll_votes_user_id on public.poll_votes (user_id);
create index if not exists idx_listing_questions_user_id on public.listing_questions (user_id);
