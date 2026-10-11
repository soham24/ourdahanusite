-- ============================================================
-- OurDahanu — NEW TABLES MIGRATION
-- Run this if you already ran the original schema.sql
-- Safe to run: all statements use IF NOT EXISTS / OR REPLACE
-- ============================================================

-- ============================================================
-- NEWS & ANNOUNCEMENTS
-- ============================================================
create table if not exists news_articles (
  id uuid default uuid_generate_v4() primary key,
  author_id uuid references profiles(id) on delete set null,
  title text not null,
  excerpt text,
  content text,
  category text not null,
  image text,
  author text,
  date date default current_date,
  featured boolean default false,
  published boolean default false,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

alter table news_articles enable row level security;

drop policy if exists "Published articles are public" on news_articles;
create policy "Published articles are public" on news_articles
  for select using (published = true or auth.uid() = author_id);

drop policy if exists "Authors can manage own articles" on news_articles;
create policy "Authors can manage own articles" on news_articles
  for all using (auth.uid() = author_id);

-- ============================================================
-- COMMUNITY FORUM
-- ============================================================
create table if not exists forum_threads (
  id uuid default uuid_generate_v4() primary key,
  author_id uuid references profiles(id) on delete cascade,
  author_name text,
  category text not null,
  category_slug text not null,
  title text not null,
  body text,
  reply_count integer default 0,
  view_count integer default 0,
  upvotes integer default 0,
  pinned boolean default false,
  approved boolean default true,
  last_activity_at timestamp with time zone default now(),
  created_at timestamp with time zone default now()
);

create table if not exists forum_replies (
  id uuid default uuid_generate_v4() primary key,
  thread_id uuid references forum_threads(id) on delete cascade,
  author_id uuid references profiles(id) on delete cascade,
  author_name text,
  body text not null,
  upvotes integer default 0,
  created_at timestamp with time zone default now()
);

alter table forum_threads enable row level security;
alter table forum_replies enable row level security;

drop policy if exists "Approved threads are public" on forum_threads;
create policy "Approved threads are public" on forum_threads
  for select using (approved = true);

drop policy if exists "Authors can manage own threads" on forum_threads;
create policy "Authors can manage own threads" on forum_threads
  for all using (auth.uid() = author_id);

drop policy if exists "Forum replies are public" on forum_replies;
create policy "Forum replies are public" on forum_replies
  for select using (true);

drop policy if exists "Authenticated users can reply" on forum_replies;
create policy "Authenticated users can reply" on forum_replies
  for insert with check (auth.uid() = author_id);

drop policy if exists "Authors can delete own replies" on forum_replies;
create policy "Authors can delete own replies" on forum_replies
  for delete using (auth.uid() = author_id);

-- Auto-increment reply count on new reply
create or replace function public.increment_reply_count()
returns trigger as $$
begin
  update forum_threads
  set reply_count = reply_count + 1,
      last_activity_at = now()
  where id = new.thread_id;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_forum_reply_created on forum_replies;
create trigger on_forum_reply_created
  after insert on forum_replies
  for each row execute procedure public.increment_reply_count();

-- ============================================================
-- CLASSIFIEDS / MARKETPLACE
-- ============================================================
create table if not exists classifieds (
  id uuid default uuid_generate_v4() primary key,
  seller_id uuid references profiles(id) on delete cascade,
  seller_name text,
  type text not null check (type in ('For Sale', 'Free Items', 'Wanted', 'Services', 'Rentals', 'Lost & Found')),
  title text not null,
  description text,
  price numeric(10,2),
  location text,
  image text,
  urgent boolean default false,
  active boolean default true,
  approved boolean default true,
  expires_at timestamp with time zone default (now() + interval '30 days'),
  created_at timestamp with time zone default now()
);

alter table classifieds enable row level security;

drop policy if exists "Active classifieds are public" on classifieds;
create policy "Active classifieds are public" on classifieds
  for select using (active = true and approved = true);

drop policy if exists "Sellers can manage own classifieds" on classifieds;
create policy "Sellers can manage own classifieds" on classifieds
  for all using (auth.uid() = seller_id);

-- ============================================================
-- EVENT RSVPs
-- ============================================================
create table if not exists event_rsvps (
  id uuid default uuid_generate_v4() primary key,
  event_id uuid references events(id) on delete cascade,
  user_id uuid references profiles(id) on delete cascade,
  created_at timestamp with time zone default now(),
  unique (event_id, user_id)
);

alter table event_rsvps enable row level security;

drop policy if exists "Users can view own RSVPs" on event_rsvps;
create policy "Users can view own RSVPs" on event_rsvps
  for select using (auth.uid() = user_id);

drop policy if exists "Authenticated users can RSVP" on event_rsvps;
create policy "Authenticated users can RSVP" on event_rsvps
  for insert with check (auth.uid() = user_id);

drop policy if exists "Users can cancel own RSVP" on event_rsvps;
create policy "Users can cancel own RSVP" on event_rsvps
  for delete using (auth.uid() = user_id);

-- ============================================================
-- EMERGENCY ALERTS
-- ============================================================
create table if not exists emergency_alerts (
  id uuid default uuid_generate_v4() primary key,
  title text not null,
  description text,
  severity text not null check (severity in ('info', 'warning', 'critical')),
  category text,
  active boolean default true,
  expires_at timestamp with time zone,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamp with time zone default now()
);

alter table emergency_alerts enable row level security;

drop policy if exists "Active alerts are public" on emergency_alerts;
create policy "Active alerts are public" on emergency_alerts
  for select using (active = true);

drop policy if exists "Admins can manage alerts" on emergency_alerts;
create policy "Admins can manage alerts" on emergency_alerts
  for all using (auth.uid() = created_by);

-- ============================================================
-- NEWSLETTER SUBSCRIPTIONS
-- ============================================================
create table if not exists newsletter_subscriptions (
  id uuid default uuid_generate_v4() primary key,
  email text not null unique,
  subscribed boolean default true,
  created_at timestamp with time zone default now()
);

-- No RLS needed — inserts go through the API route (service role key)
-- But enable it so anon can't enumerate emails
alter table newsletter_subscriptions enable row level security;

drop policy if exists "No public access to subscriptions" on newsletter_subscriptions;
create policy "No public access to subscriptions" on newsletter_subscriptions
  for select using (false);
