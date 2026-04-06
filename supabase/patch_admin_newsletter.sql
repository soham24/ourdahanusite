-- ============================================================
-- OurDahanu — Admin & Newsletter Patch
-- Run this in Supabase SQL Editor
-- ============================================================

-- 1. Add is_admin flag to profiles
alter table profiles add column if not exists is_admin boolean default false;

-- 2. Make YOURSELF admin — replace with your actual Google sign-in email
--    After running this, you can access /admin on the site
update profiles
set is_admin = true
where email = 'YOUR_EMAIL_HERE';

-- 3. Fix newsletter subscriptions — allow anyone to subscribe
--    (the API route validates email format before inserting)
drop policy if exists "No public access to subscriptions" on newsletter_subscriptions;
drop policy if exists "Anyone can subscribe" on newsletter_subscriptions;

create policy "Anyone can subscribe" on newsletter_subscriptions
  for insert with check (true);

-- Admins can read subscriber list
drop policy if exists "Admins can view subscriptions" on newsletter_subscriptions;
create policy "Admins can view subscriptions" on newsletter_subscriptions
  for select using (
    exists (
      select 1 from profiles
      where profiles.id = auth.uid()
      and profiles.is_admin = true
    )
  );

-- 4. Add open select policy to emergency_alerts
--    (active alerts must be readable by everyone, including unauthenticated)
drop policy if exists "Active alerts are public" on emergency_alerts;
create policy "Active alerts are public" on emergency_alerts
  for select using (active = true);

-- 5. Allow admins to insert/update emergency alerts
drop policy if exists "Admins can manage alerts" on emergency_alerts;
create policy "Admins can manage alerts" on emergency_alerts
  for all using (
    exists (
      select 1 from profiles
      where profiles.id = auth.uid()
      and profiles.is_admin = true
    )
  );
