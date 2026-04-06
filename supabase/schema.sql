-- OurDahanu Database Schema
-- Run this in your Supabase SQL editor

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Profiles table (auto-created on Google sign in)
create table if not exists profiles (
  id uuid references auth.users on delete cascade primary key,
  full_name text,
  avatar_url text,
  email text,
  phone text,
  address text,
  created_at timestamp with time zone default now()
);

-- Products table
create table if not exists products (
  id uuid default uuid_generate_v4() primary key,
  seller_id uuid references profiles(id) on delete cascade,
  name text not null,
  description text,
  price numeric(10,2) not null,
  unit text default 'per piece',
  category text not null,
  image_url text,
  in_stock boolean default true,
  created_at timestamp with time zone default now()
);

-- Events table
create table if not exists events (
  id uuid default uuid_generate_v4() primary key,
  organizer_id uuid references profiles(id) on delete cascade,
  title text not null,
  description text,
  date date not null,
  time_start time,
  time_end time,
  location text not null,
  category text not null,
  is_free boolean default true,
  price numeric(10,2),
  max_attendees integer,
  image_url text,
  approved boolean default false,
  created_at timestamp with time zone default now()
);

-- Business Listings table
create table if not exists listings (
  id uuid default uuid_generate_v4() primary key,
  owner_id uuid references profiles(id) on delete cascade,
  name text not null,
  description text,
  category text not null,
  phone text,
  address text,
  website text,
  plan text default 'basic', -- basic, featured, premium
  verified boolean default false,
  approved boolean default false,
  rating numeric(3,1) default 0,
  review_count integer default 0,
  image_url text,
  created_at timestamp with time zone default now(),
  expires_at timestamp with time zone
);

-- Reviews table
create table if not exists reviews (
  id uuid default uuid_generate_v4() primary key,
  listing_id uuid references listings(id) on delete cascade,
  user_id uuid references profiles(id) on delete cascade,
  rating integer check (rating >= 1 and rating <= 5),
  comment text,
  created_at timestamp with time zone default now()
);

-- Orders table
create table if not exists orders (
  id uuid default uuid_generate_v4() primary key,
  buyer_id uuid references profiles(id) on delete cascade,
  product_id uuid references products(id),
  quantity integer default 1,
  total_price numeric(10,2),
  status text default 'pending', -- pending, confirmed, shipped, delivered, cancelled
  created_at timestamp with time zone default now()
);

-- Row Level Security Policies

alter table profiles enable row level security;
alter table products enable row level security;
alter table events enable row level security;
alter table listings enable row level security;
alter table reviews enable row level security;
alter table orders enable row level security;

-- Profiles: users can view all, but only update their own
create policy "Profiles are viewable by everyone" on profiles for select using (true);
create policy "Users can update own profile" on profiles for update using (auth.uid() = id);
create policy "Users can insert own profile" on profiles for insert with check (auth.uid() = id);

-- Products: viewable by all, editable by owner
create policy "Products are viewable by everyone" on products for select using (true);
create policy "Sellers can manage own products" on products for all using (auth.uid() = seller_id);

-- Events: approved events viewable by all, owners manage their own
create policy "Approved events are public" on events for select using (approved = true or auth.uid() = organizer_id);
create policy "Organizers can manage own events" on events for all using (auth.uid() = organizer_id);

-- Listings: approved listings viewable by all
create policy "Approved listings are public" on listings for select using (approved = true or auth.uid() = owner_id);
create policy "Owners can manage own listings" on listings for all using (auth.uid() = owner_id);

-- Reviews: public view, authenticated insert
create policy "Reviews are public" on reviews for select using (true);
create policy "Authenticated users can leave reviews" on reviews for insert with check (auth.uid() = user_id);

-- Orders: only buyer and seller can see
create policy "Users can view own orders" on orders for select using (auth.uid() = buyer_id);
create policy "Users can place orders" on orders for insert with check (auth.uid() = buyer_id);

-- Trigger: auto-create profile on user signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name, avatar_url, email)
  values (
    new.id,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'avatar_url',
    new.email
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ============================================================
-- NEWS & ANNOUNCEMENTS
-- ============================================================
create table if not exists news_articles (
  id uuid default uuid_generate_v4() primary key,
  author_id uuid references profiles(id) on delete set null,
  title text not null,
  excerpt text,
  content text,
  category text not null, -- Council Update, Agriculture, Infrastructure, Schools, Health, Environment, Development, Community, Traffic
  image text,             -- emoji or image URL
  author text,            -- display name override (for editorial bylines)
  date date default current_date,
  featured boolean default false,
  published boolean default false,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

alter table news_articles enable row level security;

create policy "Published articles are public" on news_articles
  for select using (published = true or auth.uid() = author_id);

create policy "Authors can manage own articles" on news_articles
  for all using (auth.uid() = author_id);

-- ============================================================
-- COMMUNITY FORUM
-- ============================================================
create table if not exists forum_threads (
  id uuid default uuid_generate_v4() primary key,
  author_id uuid references profiles(id) on delete cascade,
  author_name text,
  category text not null,     -- General Chat, Local Issues, Recommendations, etc.
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

create policy "Approved threads are public" on forum_threads
  for select using (approved = true);
create policy "Authors can manage own threads" on forum_threads
  for all using (auth.uid() = author_id);

create policy "Forum replies are public" on forum_replies
  for select using (true);
create policy "Authenticated users can reply" on forum_replies
  for insert with check (auth.uid() = author_id);
create policy "Authors can delete own replies" on forum_replies
  for delete using (auth.uid() = author_id);

-- Auto-update reply count when a new reply is added
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
  price numeric(10,2),           -- null = free / wanted / lost&found
  location text,
  image text,                    -- emoji or image URL
  urgent boolean default false,
  active boolean default true,
  approved boolean default true,
  expires_at timestamp with time zone default (now() + interval '30 days'),
  created_at timestamp with time zone default now()
);

alter table classifieds enable row level security;

create policy "Active classifieds are public" on classifieds
  for select using (active = true and approved = true);
create policy "Sellers can manage own classifieds" on classifieds
  for all using (auth.uid() = seller_id);

-- ============================================================
-- EVENT RSVPs  (extend existing events table)
-- ============================================================
create table if not exists event_rsvps (
  id uuid default uuid_generate_v4() primary key,
  event_id uuid references events(id) on delete cascade,
  user_id uuid references profiles(id) on delete cascade,
  created_at timestamp with time zone default now(),
  unique (event_id, user_id)
);

alter table event_rsvps enable row level security;

create policy "Users can view own RSVPs" on event_rsvps
  for select using (auth.uid() = user_id);
create policy "Authenticated users can RSVP" on event_rsvps
  for insert with check (auth.uid() = user_id);
create policy "Users can cancel own RSVP" on event_rsvps
  for delete using (auth.uid() = user_id);

-- ============================================================
-- EMERGENCY ALERTS  (admin-managed)
-- ============================================================
create table if not exists emergency_alerts (
  id uuid default uuid_generate_v4() primary key,
  title text not null,
  description text,
  severity text not null check (severity in ('info', 'warning', 'critical')),  -- info | warning | critical
  category text,     -- Natural Disaster, Crime, Traffic, Infrastructure, Public Health, General
  active boolean default true,
  expires_at timestamp with time zone,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamp with time zone default now()
);

alter table emergency_alerts enable row level security;

create policy "Active alerts are public" on emergency_alerts
  for select using (active = true);

-- ============================================================
-- NEWSLETTER SUBSCRIPTIONS
-- ============================================================
create table if not exists newsletter_subscriptions (
  id uuid default uuid_generate_v4() primary key,
  email text not null unique,
  subscribed boolean default true,
  created_at timestamp with time zone default now()
);
