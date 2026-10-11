-- Baseline schema for a fresh OurDahanu database.
--
-- This is the whole public schema as it stood on ourdahanu.in's production
-- database on 2026-10-11 -- tables, constraints, indexes, functions, the
-- public_profiles view, triggers, row level security policies, grants, the
-- uploads storage bucket and its policies, and the auth.users trigger that
-- creates a profile on sign-up. Structure only: no rows.
--
-- It replaces running supabase/schema.sql plus the loose add_*/patch_* files
-- by hand, which no longer reproduced the real database. Those files are kept
-- under supabase/legacy/ as history; do not run them on top of this.
--
-- Later schema changes go in new files in this folder, named
-- <timestamp>_<what>.sql, so `supabase db reset` replays them in order.

set check_function_bodies = off;
set search_path = public, extensions;

create extension if not exists "uuid-ossp" with schema extensions;
create extension if not exists pgcrypto with schema extensions;
-- Production has pg_trgm in public (a Supabase advisor warning); new installs
-- get it in extensions, which the migration search_path above still finds.
create extension if not exists pg_trgm with schema extensions;

-- ── Tables, constraints, indexes ──────────────────────────────────────────

create table public.appointment_date_overrides (
  id uuid default gen_random_uuid() not null,
  listing_id uuid not null,
  override_date date not null,
  closed boolean default true not null,
  windows jsonb,
  note text,
  created_at timestamp with time zone default now() not null
);

create table public.appointments (
  id uuid default uuid_generate_v4() not null,
  listing_id uuid not null,
  user_id uuid not null,
  booking_date date not null,
  slot_start time without time zone not null,
  slot_end time without time zone not null,
  user_name text not null,
  user_phone text not null,
  user_email text,
  notes text,
  booking_fee numeric(10,2) default 0 not null,
  razorpay_order_id text,
  razorpay_payment_id text,
  razorpay_signature text,
  payment_status text default 'pending'::text not null,
  status text default 'confirmed'::text not null,
  cancelled_by text,
  cancellation_reason text,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  customer_reminder_sent_at timestamp with time zone,
  owner_reminder_sent_at timestamp with time zone
);

create table public.classifieds (
  id uuid default uuid_generate_v4() not null,
  seller_id uuid,
  seller_name text,
  type text not null,
  title text not null,
  description text,
  price numeric(10,2),
  location text,
  image text,
  urgent boolean default false,
  active boolean default true,
  approved boolean default true,
  expires_at timestamp with time zone default (now() + '30 days'::interval),
  created_at timestamp with time zone default now()
);

create table public.cod_collections (
  id uuid default gen_random_uuid() not null,
  delivery_order_id uuid not null,
  rider_id uuid,
  amount_paise integer not null,
  settled boolean default false not null,
  created_at timestamp with time zone default now() not null
);

create table public.coupon_redemptions (
  id uuid default uuid_generate_v4() not null,
  coupon_id uuid,
  coupon_code text not null,
  user_id uuid,
  listing_id uuid,
  kind text not null,
  payment_status text not null,
  amount_paid integer default 0 not null,
  payment_id text,
  redeemed_at timestamp with time zone default now() not null
);

create table public.coupons (
  id uuid default gen_random_uuid() not null,
  code text not null,
  label text not null,
  final_price integer not null,
  enabled boolean default true not null,
  usage_count integer default 0 not null,
  created_at timestamp with time zone default now(),
  assigned_to text
);

create table public.delivery_order_items (
  id uuid default gen_random_uuid() not null,
  delivery_order_id uuid not null,
  listing_product_id uuid,
  name text not null,
  price_paise integer not null,
  quantity integer not null,
  line_total_paise integer not null
);

create table public.delivery_orders (
  id uuid default gen_random_uuid() not null,
  listing_id uuid not null,
  customer_id uuid not null,
  status text default 'placed'::text not null,
  payment_mode text not null,
  payment_status text default 'pending'::text not null,
  items_total_paise integer not null,
  delivery_fee_paise integer default 0 not null,
  grand_total_paise integer not null,
  customer_name text not null,
  customer_phone text not null,
  pickup_lat double precision,
  pickup_lng double precision,
  pickup_address text,
  drop_lat double precision,
  drop_lng double precision,
  drop_address text not null,
  distance_km numeric(5,2),
  rider_id uuid,
  handoff_otp text,
  notes text,
  razorpay_order_id text,
  razorpay_payment_id text,
  razorpay_signature text,
  assigned_at timestamp with time zone,
  picked_up_at timestamp with time zone,
  delivered_at timestamp with time zone,
  cancel_reason text,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  rider_rating smallint,
  rated boolean default false not null
);

create table public.emergency_alerts (
  id uuid default uuid_generate_v4() not null,
  title text not null,
  description text,
  severity text not null,
  category text,
  active boolean default true,
  expires_at timestamp with time zone,
  created_by uuid,
  created_at timestamp with time zone default now()
);

create table public.event_rsvps (
  id uuid default uuid_generate_v4() not null,
  event_id uuid,
  user_id uuid,
  created_at timestamp with time zone default now()
);

create table public.events (
  id uuid default uuid_generate_v4() not null,
  organizer_id uuid,
  title text not null,
  description text,
  date date not null,
  time_start time without time zone,
  time_end time without time zone,
  location text not null,
  category text not null,
  is_free boolean default true,
  price numeric(10,2),
  max_attendees integer,
  image_url text,
  approved boolean default false,
  created_at timestamp with time zone default now()
);

create table public.find_professionals (
  id uuid default gen_random_uuid() not null,
  name text not null,
  phone text not null,
  whatsapp boolean default false not null,
  profession_other text,
  locality text,
  note text,
  status text default 'pending'::text not null,
  is_active boolean default true not null,
  submitted_by uuid,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  professions text[] not null,
  business_listing_id uuid
);

create table public.find_ratings (
  id uuid default gen_random_uuid() not null,
  professional_id uuid not null,
  user_id uuid not null,
  rating integer not null,
  comment text not null,
  used_service boolean default false not null,
  status text default 'pending'::text not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

create table public.forum_replies (
  id uuid default uuid_generate_v4() not null,
  thread_id uuid,
  author_id uuid,
  author_name text,
  body text not null,
  upvotes integer default 0,
  created_at timestamp with time zone default now()
);

create table public.forum_threads (
  id uuid default uuid_generate_v4() not null,
  author_id uuid,
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

create table public.game_scores (
  id uuid default gen_random_uuid() not null,
  user_id uuid not null,
  game text default 'chikoo_catcher'::text not null,
  score integer not null,
  played_at timestamp with time zone default now() not null
);

create table public.job_contact_reveals (
  post_id uuid not null,
  user_id uuid not null,
  created_at timestamp with time zone default now() not null
);

create table public.job_post_contacts (
  post_id uuid not null,
  phone text not null,
  whatsapp boolean default true not null,
  updated_at timestamp with time zone default now() not null
);

create table public.job_post_reports (
  id uuid default gen_random_uuid() not null,
  post_id uuid not null,
  user_id uuid not null,
  reason text not null,
  note text,
  created_at timestamp with time zone default now() not null
);

create table public.job_posts (
  id uuid default gen_random_uuid() not null,
  kind text not null,
  status text default 'pending'::text not null,
  posted_by uuid not null,
  listing_id uuid,
  collected_source text,
  title text not null,
  category text not null,
  work_types text[] not null,
  area text not null,
  description text,
  employer_name text,
  openings integer,
  pay_min integer,
  pay_max integer,
  pay_period text,
  timings text,
  display_name text,
  experience_years integer,
  review_flags text[] default '{}'::text[] not null,
  reject_reason text,
  reviewed_by uuid,
  reviewed_at timestamp with time zone,
  published_at timestamp with time zone,
  expires_at timestamp with time zone,
  reminder_sent_at timestamp with time zone,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

create table public.listing_delivery_config (
  listing_id uuid not null,
  delivery_enabled boolean default false not null,
  radius_km numeric(5,1) default 5 not null,
  base_fee_paise integer default 2000 not null,
  per_km_fee_paise integer default 1000 not null,
  free_above_paise integer,
  min_order_paise integer default 0 not null,
  prep_time_min integer default 20 not null,
  updated_at timestamp with time zone default now() not null
);

create table public.listing_events (
  id uuid default gen_random_uuid() not null,
  listing_id uuid not null,
  kind text not null,
  visitor_key text not null,
  day date not null,
  created_at timestamp with time zone default now() not null
);

create table public.listing_favourites (
  user_id uuid not null,
  listing_id uuid not null,
  created_at timestamp with time zone default now()
);

create table public.listing_payment_configs (
  listing_id uuid not null,
  razorpay_key_id text not null,
  razorpay_key_secret_encrypted text not null,
  razorpay_key_last4 text not null,
  test_mode boolean default true not null,
  verified_at timestamp with time zone,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

create table public.listing_product_options (
  id uuid default gen_random_uuid() not null,
  product_id uuid not null,
  label text not null,
  price_paise integer not null,
  quantity_in_stock integer,
  sort_order integer default 0 not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

create table public.listing_products (
  id uuid default uuid_generate_v4() not null,
  listing_id uuid not null,
  type text not null,
  name text not null,
  description text,
  price_paise integer,
  quantity_in_stock integer,
  image_url text,
  is_active boolean default true not null,
  sort_order integer default 0 not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  image_thumb_url text,
  price_note text,
  image_aspect text default 'square'::text not null,
  legacy_service_index integer
);

create table public.listing_questions (
  id uuid default gen_random_uuid() not null,
  listing_id uuid not null,
  user_id uuid,
  question text not null,
  answer text,
  answered_at timestamp with time zone,
  created_at timestamp with time zone default now()
);

create table public.listing_recommendations (
  user_id uuid not null,
  listing_id uuid not null,
  created_at timestamp with time zone default now()
);

create table public.listing_selling_suspensions (
  listing_id uuid not null,
  reason text not null,
  suspended_at timestamp with time zone default now() not null
);

create table public.listings (
  id uuid default uuid_generate_v4() not null,
  owner_id uuid,
  name text not null,
  description text,
  category text not null,
  phone text,
  address text,
  website text,
  plan text default 'basic'::text,
  verified boolean default false,
  approved boolean default false,
  rating numeric(3,1) default 0,
  review_count integer default 0,
  image_url text,
  created_at timestamp with time zone default now(),
  expires_at timestamp with time zone,
  subdomain text,
  payment_id text,
  payment_status text default 'unpaid'::text,
  coupon_used text,
  amount_paid integer,
  tagline text,
  whatsapp text,
  instagram text,
  facebook text,
  upi_id text,
  hours text,
  cover_image text,
  tags jsonb default '[]'::jsonb,
  updated_at timestamp with time zone default now(),
  views bigint default 0,
  lat double precision,
  lng double precision,
  map_url text,
  reminders_sent integer[] default '{}'::integer[],
  photos jsonb default '[]'::jsonb,
  offer_text text,
  offer_expires_at timestamp with time zone,
  pinned_announcement text,
  established_year integer,
  highlights jsonb default '[]'::jsonb,
  certifications jsonb default '[]'::jsonb,
  response_time text,
  video_url text,
  before_after jsonb,
  payment_methods jsonb default '[]'::jsonb,
  delivery_info jsonb,
  appointments_enabled boolean default false,
  appointment_booking_fee numeric(10,2) default 0,
  appointment_settings jsonb,
  payments_enabled boolean default false,
  image_thumb_url text,
  cover_image_thumb_url text,
  payments_suspended_at timestamp with time zone,
  payments_suspended_reason text
);

create table public.news_articles (
  id uuid default uuid_generate_v4() not null,
  author_id uuid,
  title text not null,
  excerpt text,
  content text,
  category text not null,
  image text,
  author text,
  date date default CURRENT_DATE,
  featured boolean default false,
  published boolean default false,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

create table public.newsletter_subscriptions (
  id uuid default uuid_generate_v4() not null,
  email text not null,
  subscribed boolean default true,
  created_at timestamp with time zone default now()
);

create table public.notification_preferences (
  user_id uuid not null,
  email_enabled boolean default true not null,
  in_app_enabled boolean default true not null,
  telegram_enabled boolean default false not null,
  whatsapp_enabled boolean default true not null,
  telegram_chat_id text,
  telegram_verified_at timestamp with time zone,
  muted_types text[] default '{}'::text[] not null,
  updated_at timestamp with time zone default now() not null
);

create table public.notifications (
  id uuid default uuid_generate_v4() not null,
  user_id uuid not null,
  type text not null,
  title text not null,
  body text not null,
  link text,
  icon text,
  metadata jsonb,
  read_at timestamp with time zone,
  created_at timestamp with time zone default now() not null
);

create table public.orders (
  id uuid default uuid_generate_v4() not null,
  listing_id uuid,
  buyer_id uuid,
  buyer_name text not null,
  buyer_phone text not null,
  delivery_address text,
  notes text,
  service_name text not null,
  service_price numeric not null,
  quantity integer default 1,
  amount_total numeric not null,
  payment_status text default 'pending'::text,
  status text default 'confirmed'::text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  product_id uuid,
  owner_razorpay_order_id text,
  owner_razorpay_payment_id text,
  owner_razorpay_signature text,
  is_test boolean default false not null,
  product_option_id uuid,
  option_label text,
  fulfillment_issue text
);

create table public.payment_intents (
  id uuid default uuid_generate_v4() not null,
  user_id uuid not null,
  flow text not null,
  razorpay_order_id text not null,
  razorpay_payment_id text,
  razorpay_signature text,
  amount_paise integer not null,
  currency text default 'INR'::text not null,
  payload jsonb default '{}'::jsonb not null,
  listing_id uuid,
  status text default 'created'::text not null,
  entity_id uuid,
  entity_table text,
  last_error text,
  retry_count integer default 0 not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  captured_at timestamp with time zone,
  finalized_at timestamp with time zone
);

create table public.poll_votes (
  id uuid default uuid_generate_v4() not null,
  poll_id uuid not null,
  user_id uuid not null,
  option_id text not null,
  created_at timestamp with time zone default now()
);

create table public.polls (
  id uuid default uuid_generate_v4() not null,
  title text not null,
  options jsonb default '[]'::jsonb not null,
  ends_at timestamp with time zone not null,
  created_by uuid,
  active boolean default true,
  created_at timestamp with time zone default now()
);

create table public.pricing_config (
  id integer default 1 not null,
  base_price integer default 500 not null,
  current_price integer default 210 not null,
  updated_at timestamp with time zone default now(),
  job_base_price integer default 70,
  job_current_price integer default 40
);

create table public.products (
  id uuid default uuid_generate_v4() not null,
  seller_id uuid,
  name text not null,
  description text,
  price numeric(10,2) not null,
  unit text default 'per piece'::text,
  category text not null,
  image_url text,
  in_stock boolean default true,
  created_at timestamp with time zone default now()
);

create table public.profiles (
  id uuid not null,
  full_name text,
  avatar_url text,
  email text,
  phone text,
  address text,
  created_at timestamp with time zone default now(),
  is_admin boolean default false,
  bio text,
  role text default 'user'::text,
  verified boolean default false
);

create table public.reviews (
  id uuid default uuid_generate_v4() not null,
  listing_id uuid,
  user_id uuid,
  rating integer,
  comment text,
  created_at timestamp with time zone default now(),
  owner_reply text,
  owner_replied_at timestamp with time zone
);

create table public.rider_assignments (
  id uuid default gen_random_uuid() not null,
  delivery_order_id uuid not null,
  rider_id uuid not null,
  status text default 'offered'::text not null,
  offered_at timestamp with time zone default now() not null,
  responded_at timestamp with time zone
);

create table public.rider_earnings (
  id uuid default gen_random_uuid() not null,
  rider_id uuid not null,
  delivery_order_id uuid,
  amount_paise integer not null,
  status text default 'pending'::text not null,
  created_at timestamp with time zone default now() not null
);

create table public.riders (
  id uuid default gen_random_uuid() not null,
  user_id uuid not null,
  full_name text not null,
  phone text not null,
  vehicle_type text default 'bike'::text not null,
  status text default 'pending'::text not null,
  is_online boolean default false not null,
  current_lat double precision,
  current_lng double precision,
  last_ping_at timestamp with time zone,
  rating numeric(2,1),
  payout_upi text,
  home_business_id uuid,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

create table public.site_settings (
  key text not null,
  value text,
  updated_at timestamp with time zone default now()
);

create table public.telegram_link_tokens (
  token text not null,
  user_id uuid not null,
  expires_at timestamp with time zone not null,
  consumed_at timestamp with time zone,
  created_at timestamp with time zone default now() not null
);

alter table only public.appointment_date_overrides add constraint appointment_date_overrides_pkey PRIMARY KEY (id);
alter table only public.appointment_date_overrides add constraint appointment_date_overrides_unique_day UNIQUE (listing_id, override_date);
alter table only public.appointments add constraint appointments_booking_fee_check CHECK ((booking_fee >= (0)::numeric));
alter table only public.appointments add constraint appointments_cancelled_by_check CHECK ((cancelled_by = ANY (ARRAY['user'::text, 'owner'::text, 'admin'::text])));
alter table only public.appointments add constraint appointments_check CHECK ((slot_end > slot_start));
alter table only public.appointments add constraint appointments_payment_status_check CHECK ((payment_status = ANY (ARRAY['pending'::text, 'paid'::text, 'free'::text])));
alter table only public.appointments add constraint appointments_pkey PRIMARY KEY (id);
alter table only public.appointments add constraint appointments_status_check CHECK ((status = ANY (ARRAY['confirmed'::text, 'completed'::text, 'cancelled'::text, 'no_show'::text])));
alter table only public.classifieds add constraint classifieds_pkey PRIMARY KEY (id);
alter table only public.classifieds add constraint classifieds_type_check CHECK ((type = ANY (ARRAY['For Sale'::text, 'Free Items'::text, 'Wanted'::text, 'Services'::text, 'Rentals'::text, 'Lost & Found'::text])));
alter table only public.cod_collections add constraint cod_collections_pkey PRIMARY KEY (id);
alter table only public.coupon_redemptions add constraint coupon_redemptions_amount_paid_check CHECK ((amount_paid >= 0));
alter table only public.coupon_redemptions add constraint coupon_redemptions_kind_check CHECK ((kind = ANY (ARRAY['new'::text, 'renewal'::text])));
alter table only public.coupon_redemptions add constraint coupon_redemptions_payment_status_check CHECK ((payment_status = ANY (ARRAY['paid'::text, 'free_coupon'::text])));
alter table only public.coupon_redemptions add constraint coupon_redemptions_pkey PRIMARY KEY (id);
alter table only public.coupons add constraint coupons_code_key UNIQUE (code);
alter table only public.coupons add constraint coupons_pkey PRIMARY KEY (id);
alter table only public.delivery_order_items add constraint delivery_order_items_pkey PRIMARY KEY (id);
alter table only public.delivery_order_items add constraint delivery_order_items_quantity_check CHECK ((quantity > 0));
alter table only public.delivery_orders add constraint delivery_orders_payment_mode_check CHECK ((payment_mode = ANY (ARRAY['cod'::text, 'online'::text])));
alter table only public.delivery_orders add constraint delivery_orders_payment_status_check CHECK ((payment_status = ANY (ARRAY['pending'::text, 'paid'::text, 'failed'::text, 'refunded'::text])));
alter table only public.delivery_orders add constraint delivery_orders_pkey PRIMARY KEY (id);
alter table only public.delivery_orders add constraint delivery_orders_rider_rating_check CHECK (((rider_rating >= 1) AND (rider_rating <= 5)));
alter table only public.delivery_orders add constraint delivery_orders_status_check CHECK ((status = ANY (ARRAY['placed'::text, 'accepted'::text, 'preparing'::text, 'ready_for_pickup'::text, 'rider_assigned'::text, 'picked_up'::text, 'out_for_delivery'::text, 'delivered'::text, 'cancelled'::text, 'delivery_failed'::text])));
alter table only public.emergency_alerts add constraint emergency_alerts_pkey PRIMARY KEY (id);
alter table only public.emergency_alerts add constraint emergency_alerts_severity_check CHECK ((severity = ANY (ARRAY['info'::text, 'warning'::text, 'critical'::text])));
alter table only public.event_rsvps add constraint event_rsvps_event_id_user_id_key UNIQUE (event_id, user_id);
alter table only public.event_rsvps add constraint event_rsvps_pkey PRIMARY KEY (id);
alter table only public.events add constraint events_pkey PRIMARY KEY (id);
alter table only public.find_professionals add constraint find_professionals_pkey PRIMARY KEY (id);
alter table only public.find_professionals add constraint find_professionals_professions_nonempty CHECK ((cardinality(professions) >= 1));
alter table only public.find_professionals add constraint find_professionals_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text])));
alter table only public.find_ratings add constraint find_ratings_pkey PRIMARY KEY (id);
alter table only public.find_ratings add constraint find_ratings_professional_id_user_id_key UNIQUE (professional_id, user_id);
alter table only public.find_ratings add constraint find_ratings_rating_check CHECK (((rating >= 1) AND (rating <= 5)));
alter table only public.find_ratings add constraint find_ratings_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text])));
alter table only public.forum_replies add constraint forum_replies_pkey PRIMARY KEY (id);
alter table only public.forum_threads add constraint forum_threads_pkey PRIMARY KEY (id);
alter table only public.game_scores add constraint game_scores_pkey PRIMARY KEY (id);
alter table only public.game_scores add constraint game_scores_score_check CHECK (((score >= 0) AND (score <= 500)));
alter table only public.job_contact_reveals add constraint job_contact_reveals_pkey PRIMARY KEY (post_id, user_id);
alter table only public.job_post_contacts add constraint job_post_contacts_phone_check CHECK ((phone ~ '^[1-9][0-9]{9}$'::text));
alter table only public.job_post_contacts add constraint job_post_contacts_pkey PRIMARY KEY (post_id);
alter table only public.job_post_contacts add constraint job_post_contacts_whatsapp_mobile CHECK (((NOT whatsapp) OR (phone ~ '^[6-9]'::text)));
alter table only public.job_post_reports add constraint job_post_reports_once UNIQUE (post_id, user_id);
alter table only public.job_post_reports add constraint job_post_reports_pkey PRIMARY KEY (id);
alter table only public.job_post_reports add constraint job_post_reports_reason_check CHECK ((reason = ANY (ARRAY['asks_for_money'::text, 'fake'::text, 'filled'::text, 'offensive'::text, 'my_number'::text, 'other'::text])));
alter table only public.job_posts add constraint job_posts_approved_dated CHECK (((status <> 'approved'::text) OR ((published_at IS NOT NULL) AND (expires_at IS NOT NULL))));
alter table only public.job_posts add constraint job_posts_experience_years_check CHECK (((experience_years >= 0) AND (experience_years <= 60)));
alter table only public.job_posts add constraint job_posts_kind_check CHECK ((kind = ANY (ARRAY['hiring'::text, 'seeking'::text])));
alter table only public.job_posts add constraint job_posts_kind_fields CHECK ((((kind = 'hiring'::text) AND (employer_name IS NOT NULL) AND (display_name IS NULL) AND (experience_years IS NULL)) OR ((kind = 'seeking'::text) AND (display_name IS NOT NULL) AND (employer_name IS NULL) AND (listing_id IS NULL) AND (collected_source IS NULL) AND (openings IS NULL) AND (pay_min IS NULL) AND (pay_max IS NULL) AND (pay_period IS NULL))));
alter table only public.job_posts add constraint job_posts_openings_check CHECK (((openings >= 1) AND (openings <= 500)));
alter table only public.job_posts add constraint job_posts_pay_max_check CHECK ((pay_max >= 1));
alter table only public.job_posts add constraint job_posts_pay_min_check CHECK ((pay_min >= 1));
alter table only public.job_posts add constraint job_posts_pay_order CHECK (((pay_min IS NULL) OR (pay_max IS NULL) OR (pay_max >= pay_min)));
alter table only public.job_posts add constraint job_posts_pay_period_check CHECK ((pay_period = ANY (ARRAY['month'::text, 'day'::text, 'hour'::text])));
alter table only public.job_posts add constraint job_posts_pkey PRIMARY KEY (id);
alter table only public.job_posts add constraint job_posts_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text, 'closed'::text, 'removed'::text])));
alter table only public.listing_delivery_config add constraint listing_delivery_config_pkey PRIMARY KEY (listing_id);
alter table only public.listing_events add constraint listing_events_kind_check CHECK ((kind = ANY (ARRAY['view'::text, 'phone'::text, 'whatsapp'::text])));
alter table only public.listing_events add constraint listing_events_pkey PRIMARY KEY (id);
alter table only public.listing_favourites add constraint listing_favourites_pkey PRIMARY KEY (user_id, listing_id);
alter table only public.listing_payment_configs add constraint listing_payment_configs_pkey PRIMARY KEY (listing_id);
alter table only public.listing_product_options add constraint listing_product_options_label_check CHECK (((char_length(label) >= 1) AND (char_length(label) <= 40)));
alter table only public.listing_product_options add constraint listing_product_options_pkey PRIMARY KEY (id);
alter table only public.listing_product_options add constraint listing_product_options_price_paise_check CHECK ((price_paise >= 100));
alter table only public.listing_product_options add constraint listing_product_options_quantity_in_stock_check CHECK (((quantity_in_stock IS NULL) OR (quantity_in_stock >= 0)));
alter table only public.listing_products add constraint listing_products_image_aspect_check CHECK ((image_aspect = ANY (ARRAY['square'::text, 'portrait'::text, 'landscape'::text])));
alter table only public.listing_products add constraint listing_products_pkey PRIMARY KEY (id);
alter table only public.listing_products add constraint listing_products_price_note_check CHECK (((price_note IS NULL) OR (char_length(price_note) <= 32)));
alter table only public.listing_products add constraint listing_products_price_paise_check CHECK (((price_paise IS NULL) OR (price_paise >= 100)));
alter table only public.listing_products add constraint listing_products_quantity_in_stock_check CHECK (((quantity_in_stock IS NULL) OR (quantity_in_stock >= 0)));
alter table only public.listing_products add constraint listing_products_type_check CHECK ((type = ANY (ARRAY['product'::text, 'service'::text])));
alter table only public.listing_questions add constraint listing_questions_pkey PRIMARY KEY (id);
alter table only public.listing_recommendations add constraint listing_recommendations_pkey PRIMARY KEY (user_id, listing_id);
alter table only public.listing_selling_suspensions add constraint listing_selling_suspensions_pkey PRIMARY KEY (listing_id);
alter table only public.listing_selling_suspensions add constraint listing_selling_suspensions_reason_check CHECK (((char_length(reason) >= 1) AND (char_length(reason) <= 300)));
alter table only public.listings add constraint chk_subdomain_lowercase CHECK ((subdomain = lower(subdomain)));
alter table only public.listings add constraint listings_payments_suspended_reason_length CHECK (((payments_suspended_reason IS NULL) OR (char_length(payments_suspended_reason) <= 300)));
alter table only public.listings add constraint listings_pkey PRIMARY KEY (id);
alter table only public.listings add constraint listings_subdomain_key UNIQUE (subdomain);
alter table only public.news_articles add constraint news_articles_pkey PRIMARY KEY (id);
alter table only public.newsletter_subscriptions add constraint newsletter_subscriptions_email_key UNIQUE (email);
alter table only public.newsletter_subscriptions add constraint newsletter_subscriptions_pkey PRIMARY KEY (id);
alter table only public.notification_preferences add constraint notification_preferences_pkey PRIMARY KEY (user_id);
alter table only public.notifications add constraint notifications_pkey PRIMARY KEY (id);
alter table only public.orders add constraint orders_option_label_check CHECK (((option_label IS NULL) OR (char_length(option_label) <= 40)));
alter table only public.orders add constraint orders_pkey PRIMARY KEY (id);
alter table only public.payment_intents add constraint payment_intents_amount_paise_check CHECK ((amount_paise >= 0));
alter table only public.payment_intents add constraint payment_intents_flow_check CHECK ((flow = ANY (ARRAY['listing'::text, 'job'::text, 'renew'::text, 'order'::text, 'marketplace'::text, 'appointment'::text, 'delivery'::text])));
alter table only public.payment_intents add constraint payment_intents_pkey PRIMARY KEY (id);
alter table only public.payment_intents add constraint payment_intents_razorpay_order_id_key UNIQUE (razorpay_order_id);
alter table only public.payment_intents add constraint payment_intents_status_check CHECK ((status = ANY (ARRAY['created'::text, 'captured'::text, 'finalized'::text, 'failed'::text, 'cancelled'::text])));
alter table only public.poll_votes add constraint poll_votes_pkey PRIMARY KEY (id);
alter table only public.poll_votes add constraint poll_votes_poll_id_user_id_key UNIQUE (poll_id, user_id);
alter table only public.polls add constraint polls_pkey PRIMARY KEY (id);
alter table only public.pricing_config add constraint pricing_config_pkey PRIMARY KEY (id);
alter table only public.pricing_config add constraint single_row CHECK ((id = 1));
alter table only public.products add constraint products_pkey PRIMARY KEY (id);
alter table only public.profiles add constraint profiles_pkey PRIMARY KEY (id);
alter table only public.profiles add constraint profiles_role_check CHECK ((role = ANY (ARRAY['admin'::text, 'moderator'::text, 'business_owner'::text, 'user'::text])));
alter table only public.profiles add constraint profiles_role_valid CHECK ((role = ANY (ARRAY['admin'::text, 'moderator'::text, 'business_owner'::text, 'job_reviewer'::text, 'user'::text])));
alter table only public.reviews add constraint reviews_pkey PRIMARY KEY (id);
alter table only public.reviews add constraint reviews_rating_check CHECK (((rating >= 1) AND (rating <= 5)));
alter table only public.rider_assignments add constraint rider_assignments_delivery_order_id_rider_id_key UNIQUE (delivery_order_id, rider_id);
alter table only public.rider_assignments add constraint rider_assignments_pkey PRIMARY KEY (id);
alter table only public.rider_assignments add constraint rider_assignments_status_check CHECK ((status = ANY (ARRAY['offered'::text, 'accepted'::text, 'declined'::text, 'expired'::text])));
alter table only public.rider_earnings add constraint rider_earnings_pkey PRIMARY KEY (id);
alter table only public.rider_earnings add constraint rider_earnings_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'settled'::text])));
alter table only public.riders add constraint riders_pkey PRIMARY KEY (id);
alter table only public.riders add constraint riders_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'suspended'::text])));
alter table only public.riders add constraint riders_user_id_key UNIQUE (user_id);
alter table only public.riders add constraint riders_vehicle_type_check CHECK ((vehicle_type = ANY (ARRAY['bike'::text, 'cycle'::text, 'scooter'::text, 'car'::text, 'foot'::text])));
alter table only public.site_settings add constraint site_settings_pkey PRIMARY KEY (key);
alter table only public.telegram_link_tokens add constraint telegram_link_tokens_pkey PRIMARY KEY (token);
alter table only public.appointment_date_overrides add constraint appointment_date_overrides_listing_id_fkey FOREIGN KEY (listing_id) REFERENCES listings(id) ON DELETE CASCADE;
alter table only public.appointments add constraint appointments_listing_id_fkey FOREIGN KEY (listing_id) REFERENCES listings(id) ON DELETE CASCADE;
alter table only public.appointments add constraint appointments_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
alter table only public.classifieds add constraint classifieds_seller_id_fkey FOREIGN KEY (seller_id) REFERENCES profiles(id) ON DELETE CASCADE;
alter table only public.cod_collections add constraint cod_collections_delivery_order_id_fkey FOREIGN KEY (delivery_order_id) REFERENCES delivery_orders(id) ON DELETE CASCADE;
alter table only public.cod_collections add constraint cod_collections_rider_id_fkey FOREIGN KEY (rider_id) REFERENCES riders(id) ON DELETE SET NULL;
alter table only public.coupon_redemptions add constraint coupon_redemptions_coupon_id_fkey FOREIGN KEY (coupon_id) REFERENCES coupons(id) ON DELETE SET NULL;
alter table only public.coupon_redemptions add constraint coupon_redemptions_listing_id_fkey FOREIGN KEY (listing_id) REFERENCES listings(id) ON DELETE SET NULL;
alter table only public.coupon_redemptions add constraint coupon_redemptions_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE SET NULL;
alter table only public.delivery_order_items add constraint delivery_order_items_delivery_order_id_fkey FOREIGN KEY (delivery_order_id) REFERENCES delivery_orders(id) ON DELETE CASCADE;
alter table only public.delivery_order_items add constraint delivery_order_items_listing_product_id_fkey FOREIGN KEY (listing_product_id) REFERENCES listing_products(id) ON DELETE SET NULL;
alter table only public.delivery_orders add constraint delivery_orders_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES auth.users(id) ON DELETE RESTRICT;
alter table only public.delivery_orders add constraint delivery_orders_listing_id_fkey FOREIGN KEY (listing_id) REFERENCES listings(id) ON DELETE RESTRICT;
alter table only public.delivery_orders add constraint delivery_orders_rider_id_fkey FOREIGN KEY (rider_id) REFERENCES riders(id) ON DELETE SET NULL;
alter table only public.emergency_alerts add constraint emergency_alerts_created_by_fkey FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL;
alter table only public.event_rsvps add constraint event_rsvps_event_id_fkey FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE;
alter table only public.event_rsvps add constraint event_rsvps_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
alter table only public.events add constraint events_organizer_id_fkey FOREIGN KEY (organizer_id) REFERENCES profiles(id) ON DELETE CASCADE;
alter table only public.find_professionals add constraint find_professionals_business_listing_id_fkey FOREIGN KEY (business_listing_id) REFERENCES listings(id) ON DELETE SET NULL;
alter table only public.find_professionals add constraint find_professionals_submitted_by_fkey FOREIGN KEY (submitted_by) REFERENCES auth.users(id) ON DELETE SET NULL;
alter table only public.find_ratings add constraint find_ratings_professional_id_fkey FOREIGN KEY (professional_id) REFERENCES find_professionals(id) ON DELETE CASCADE;
alter table only public.find_ratings add constraint find_ratings_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table only public.forum_replies add constraint forum_replies_author_id_fkey FOREIGN KEY (author_id) REFERENCES profiles(id) ON DELETE CASCADE;
alter table only public.forum_replies add constraint forum_replies_thread_id_fkey FOREIGN KEY (thread_id) REFERENCES forum_threads(id) ON DELETE CASCADE;
alter table only public.forum_threads add constraint forum_threads_author_id_fkey FOREIGN KEY (author_id) REFERENCES profiles(id) ON DELETE CASCADE;
alter table only public.game_scores add constraint game_scores_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table only public.job_contact_reveals add constraint job_contact_reveals_post_id_fkey FOREIGN KEY (post_id) REFERENCES job_posts(id) ON DELETE CASCADE;
alter table only public.job_contact_reveals add constraint job_contact_reveals_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table only public.job_post_contacts add constraint job_post_contacts_post_id_fkey FOREIGN KEY (post_id) REFERENCES job_posts(id) ON DELETE CASCADE;
alter table only public.job_post_reports add constraint job_post_reports_post_id_fkey FOREIGN KEY (post_id) REFERENCES job_posts(id) ON DELETE CASCADE;
alter table only public.job_post_reports add constraint job_post_reports_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table only public.job_posts add constraint job_posts_listing_id_fkey FOREIGN KEY (listing_id) REFERENCES listings(id) ON DELETE SET NULL;
alter table only public.job_posts add constraint job_posts_posted_by_fkey FOREIGN KEY (posted_by) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table only public.job_posts add constraint job_posts_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES auth.users(id) ON DELETE SET NULL;
alter table only public.listing_delivery_config add constraint listing_delivery_config_listing_id_fkey FOREIGN KEY (listing_id) REFERENCES listings(id) ON DELETE CASCADE;
alter table only public.listing_events add constraint listing_events_listing_id_fkey FOREIGN KEY (listing_id) REFERENCES listings(id) ON DELETE CASCADE;
alter table only public.listing_favourites add constraint listing_favourites_listing_id_fkey FOREIGN KEY (listing_id) REFERENCES listings(id) ON DELETE CASCADE;
alter table only public.listing_favourites add constraint listing_favourites_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table only public.listing_payment_configs add constraint listing_payment_configs_listing_id_fkey FOREIGN KEY (listing_id) REFERENCES listings(id) ON DELETE CASCADE;
alter table only public.listing_product_options add constraint listing_product_options_product_id_fkey FOREIGN KEY (product_id) REFERENCES listing_products(id) ON DELETE CASCADE;
alter table only public.listing_products add constraint listing_products_listing_id_fkey FOREIGN KEY (listing_id) REFERENCES listings(id) ON DELETE CASCADE;
alter table only public.listing_questions add constraint listing_questions_listing_id_fkey FOREIGN KEY (listing_id) REFERENCES listings(id) ON DELETE CASCADE;
alter table only public.listing_questions add constraint listing_questions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;
alter table only public.listing_recommendations add constraint listing_recommendations_listing_id_fkey FOREIGN KEY (listing_id) REFERENCES listings(id) ON DELETE CASCADE;
alter table only public.listing_recommendations add constraint listing_recommendations_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table only public.listing_selling_suspensions add constraint listing_selling_suspensions_listing_id_fkey FOREIGN KEY (listing_id) REFERENCES listings(id) ON DELETE CASCADE;
alter table only public.listings add constraint listings_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES profiles(id) ON DELETE CASCADE;
alter table only public.news_articles add constraint news_articles_author_id_fkey FOREIGN KEY (author_id) REFERENCES profiles(id) ON DELETE SET NULL;
alter table only public.notification_preferences add constraint notification_preferences_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
alter table only public.notifications add constraint notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
alter table only public.orders add constraint orders_buyer_id_fkey FOREIGN KEY (buyer_id) REFERENCES profiles(id) ON DELETE SET NULL;
alter table only public.orders add constraint orders_listing_id_fkey FOREIGN KEY (listing_id) REFERENCES listings(id) ON DELETE SET NULL;
alter table only public.orders add constraint orders_product_id_fkey FOREIGN KEY (product_id) REFERENCES listing_products(id) ON DELETE SET NULL;
alter table only public.orders add constraint orders_product_option_id_fkey FOREIGN KEY (product_option_id) REFERENCES listing_product_options(id) ON DELETE SET NULL;
alter table only public.payment_intents add constraint payment_intents_listing_id_fkey FOREIGN KEY (listing_id) REFERENCES listings(id) ON DELETE SET NULL;
alter table only public.payment_intents add constraint payment_intents_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
alter table only public.poll_votes add constraint poll_votes_poll_id_fkey FOREIGN KEY (poll_id) REFERENCES polls(id) ON DELETE CASCADE;
alter table only public.poll_votes add constraint poll_votes_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
alter table only public.polls add constraint polls_created_by_fkey FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL;
alter table only public.products add constraint products_seller_id_fkey FOREIGN KEY (seller_id) REFERENCES profiles(id) ON DELETE CASCADE;
alter table only public.profiles add constraint profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table only public.reviews add constraint reviews_listing_id_fkey FOREIGN KEY (listing_id) REFERENCES listings(id) ON DELETE CASCADE;
alter table only public.reviews add constraint reviews_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
alter table only public.rider_assignments add constraint rider_assignments_delivery_order_id_fkey FOREIGN KEY (delivery_order_id) REFERENCES delivery_orders(id) ON DELETE CASCADE;
alter table only public.rider_assignments add constraint rider_assignments_rider_id_fkey FOREIGN KEY (rider_id) REFERENCES riders(id) ON DELETE CASCADE;
alter table only public.rider_earnings add constraint rider_earnings_delivery_order_id_fkey FOREIGN KEY (delivery_order_id) REFERENCES delivery_orders(id) ON DELETE SET NULL;
alter table only public.rider_earnings add constraint rider_earnings_rider_id_fkey FOREIGN KEY (rider_id) REFERENCES riders(id) ON DELETE CASCADE;
alter table only public.riders add constraint riders_home_business_id_fkey FOREIGN KEY (home_business_id) REFERENCES listings(id) ON DELETE SET NULL;
alter table only public.riders add constraint riders_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table only public.telegram_link_tokens add constraint telegram_link_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
CREATE INDEX idx_appt_overrides_listing_date ON public.appointment_date_overrides USING btree (listing_id, override_date);
CREATE INDEX idx_appointments_confirmed_slot ON public.appointments USING btree (listing_id, booking_date, slot_start) WHERE (status = 'confirmed'::text);
CREATE INDEX idx_appointments_listing_slot ON public.appointments USING btree (listing_id, booking_date, slot_start);
CREATE UNIQUE INDEX idx_appointments_unique_active_user_slot ON public.appointments USING btree (listing_id, user_id, booking_date, slot_start) WHERE (status <> 'cancelled'::text);
CREATE INDEX idx_appointments_user_date ON public.appointments USING btree (user_id, booking_date);
CREATE INDEX cod_collections_rider_idx ON public.cod_collections USING btree (rider_id, settled);
CREATE INDEX idx_coupon_redemptions_code ON public.coupon_redemptions USING btree (coupon_code);
CREATE UNIQUE INDEX idx_coupon_redemptions_free ON public.coupon_redemptions USING btree (listing_id, coupon_code, kind, (((redeemed_at AT TIME ZONE 'UTC'::text))::date)) WHERE (payment_id IS NULL);
CREATE UNIQUE INDEX idx_coupon_redemptions_payment_id ON public.coupon_redemptions USING btree (payment_id) WHERE (payment_id IS NOT NULL);
CREATE INDEX idx_coupon_redemptions_redeemed_at ON public.coupon_redemptions USING btree (redeemed_at DESC);
CREATE INDEX delivery_order_items_order_idx ON public.delivery_order_items USING btree (delivery_order_id);
CREATE INDEX delivery_orders_customer_idx ON public.delivery_orders USING btree (customer_id);
CREATE INDEX delivery_orders_listing_idx ON public.delivery_orders USING btree (listing_id, status);
CREATE INDEX delivery_orders_rider_idx ON public.delivery_orders USING btree (rider_id);
CREATE INDEX delivery_orders_status_idx ON public.delivery_orders USING btree (status);
CREATE INDEX find_professionals_business_idx ON public.find_professionals USING btree (business_listing_id);
CREATE INDEX find_professionals_locality_trgm_idx ON public.find_professionals USING gin (locality gin_trgm_ops);
CREATE INDEX find_professionals_name_trgm_idx ON public.find_professionals USING gin (name gin_trgm_ops);
CREATE INDEX find_professionals_phone_trgm_idx ON public.find_professionals USING gin (phone gin_trgm_ops);
CREATE INDEX find_professionals_professions_gin ON public.find_professionals USING gin (professions);
CREATE INDEX find_professionals_status_active_idx ON public.find_professionals USING btree (status, is_active);
CREATE INDEX find_ratings_pending_idx ON public.find_ratings USING btree (status, created_at DESC);
CREATE INDEX find_ratings_professional_idx ON public.find_ratings USING btree (professional_id, status);
CREATE INDEX game_scores_leaderboard_idx ON public.game_scores USING btree (game, played_at DESC, score DESC);
CREATE INDEX game_scores_user_idx ON public.game_scores USING btree (user_id, game);
CREATE INDEX idx_job_contact_reveals_user ON public.job_contact_reveals USING btree (user_id, created_at DESC);
CREATE INDEX idx_job_post_reports_post ON public.job_post_reports USING btree (post_id, created_at DESC);
CREATE INDEX idx_job_posts_board ON public.job_posts USING btree (kind, published_at DESC) WHERE (status = 'approved'::text);
CREATE INDEX idx_job_posts_category ON public.job_posts USING btree (category) WHERE (status = 'approved'::text);
CREATE UNIQUE INDEX idx_job_posts_one_seeking_profile ON public.job_posts USING btree (posted_by) WHERE ((kind = 'seeking'::text) AND (status = ANY (ARRAY['pending'::text, 'approved'::text])));
CREATE INDEX idx_job_posts_pending ON public.job_posts USING btree (created_at) WHERE (status = 'pending'::text);
CREATE INDEX idx_job_posts_posted_by ON public.job_posts USING btree (posted_by, created_at DESC);
CREATE INDEX idx_job_posts_reminders ON public.job_posts USING btree (expires_at) WHERE ((status = 'approved'::text) AND (reminder_sent_at IS NULL));
CREATE UNIQUE INDEX idx_listing_events_daily ON public.listing_events USING btree (listing_id, kind, visitor_key, day);
CREATE INDEX idx_listing_events_listing_day ON public.listing_events USING btree (listing_id, day DESC);
CREATE INDEX idx_listing_favourites_listing ON public.listing_favourites USING btree (listing_id);
CREATE INDEX idx_listing_product_options_product_sort ON public.listing_product_options USING btree (product_id, sort_order);
CREATE INDEX idx_listing_products_listing_active_sort ON public.listing_products USING btree (listing_id, is_active, sort_order);
CREATE UNIQUE INDEX listing_products_legacy_service_index_key ON public.listing_products USING btree (listing_id, legacy_service_index) WHERE (legacy_service_index IS NOT NULL);
CREATE INDEX idx_listing_questions_listing_created ON public.listing_questions USING btree (listing_id, created_at DESC, id);
CREATE INDEX idx_listing_recommendations_listing ON public.listing_recommendations USING btree (listing_id);
CREATE INDEX idx_listings_approved_category ON public.listings USING btree (category) WHERE approved;
CREATE INDEX idx_listings_approved_category_rating ON public.listings USING btree (category, rating DESC, created_at DESC, id) WHERE approved;
CREATE INDEX idx_listings_approved_created_at ON public.listings USING btree (created_at DESC) WHERE approved;
CREATE INDEX idx_listings_approved_featured_sort ON public.listings USING btree (verified DESC, review_count DESC, created_at DESC) WHERE approved;
CREATE INDEX listings_subdomain_idx ON public.listings USING btree (subdomain);
CREATE INDEX idx_notifications_user_created ON public.notifications USING btree (user_id, created_at DESC);
CREATE INDEX idx_notifications_user_unread ON public.notifications USING btree (user_id, created_at DESC) WHERE (read_at IS NULL);
CREATE UNIQUE INDEX orders_owner_order_unique ON public.orders USING btree (owner_razorpay_order_id) WHERE (owner_razorpay_order_id IS NOT NULL);
CREATE UNIQUE INDEX orders_owner_payment_unique ON public.orders USING btree (owner_razorpay_payment_id) WHERE (owner_razorpay_payment_id IS NOT NULL);
CREATE UNIQUE INDEX idx_payment_intents_payment_id ON public.payment_intents USING btree (razorpay_payment_id) WHERE (razorpay_payment_id IS NOT NULL);
CREATE INDEX idx_payment_intents_status ON public.payment_intents USING btree (status) WHERE (status = ANY (ARRAY['created'::text, 'captured'::text]));
CREATE INDEX idx_payment_intents_user ON public.payment_intents USING btree (user_id, created_at DESC);
CREATE INDEX idx_poll_votes_poll_option ON public.poll_votes USING btree (poll_id, option_id);
CREATE INDEX idx_polls_active_ends ON public.polls USING btree (active, ends_at DESC) WHERE (active = true);
CREATE INDEX idx_profiles_role ON public.profiles USING btree (role);
CREATE INDEX idx_reviews_listing_created ON public.reviews USING btree (listing_id, created_at DESC, id);
CREATE INDEX rider_assignments_order_idx ON public.rider_assignments USING btree (delivery_order_id);
CREATE INDEX rider_assignments_rider_idx ON public.rider_assignments USING btree (rider_id, status);
CREATE INDEX rider_earnings_rider_idx ON public.rider_earnings USING btree (rider_id, status);
CREATE INDEX riders_home_business_idx ON public.riders USING btree (home_business_id);
CREATE INDEX riders_status_online_idx ON public.riders USING btree (status, is_online);
CREATE INDEX idx_tg_link_tokens_user ON public.telegram_link_tokens USING btree (user_id, created_at DESC);

-- ── Functions, view, triggers, RLS policies, grants, storage, realtime ────

CREATE OR REPLACE FUNCTION public.accept_delivery_offer(p_order_id uuid, p_rider_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_locked public.delivery_orders%rowtype;
begin
  -- Lock the order row so concurrent accepts serialize.
  select * into v_locked from public.delivery_orders
    where id = p_order_id for update;
  if not found then return false; end if;

  -- Already claimed by someone → reject.
  if v_locked.rider_id is not null then return false; end if;

  -- The accepting rider must have a live offer.
  if not exists (
    select 1 from public.rider_assignments
    where delivery_order_id = p_order_id and rider_id = p_rider_id and status = 'offered'
  ) then
    return false;
  end if;

  update public.delivery_orders
    set rider_id = p_rider_id, status = 'rider_assigned', assigned_at = now(), updated_at = now()
    where id = p_order_id;

  update public.rider_assignments
    set status = 'accepted', responded_at = now()
    where delivery_order_id = p_order_id and rider_id = p_rider_id;

  -- Expire any other live offers for this order.
  update public.rider_assignments
    set status = 'expired', responded_at = now()
    where delivery_order_id = p_order_id and rider_id <> p_rider_id and status = 'offered';

  return true;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.create_appointment_booking(p_listing_id uuid, p_user_id uuid, p_booking_date date, p_slot_start time without time zone, p_slot_end time without time zone, p_user_name text, p_user_phone text, p_user_email text, p_notes text, p_booking_fee numeric, p_razorpay_order_id text, p_razorpay_payment_id text, p_razorpay_signature text, p_payment_status text)
 RETURNS uuid
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  v_appointment_id uuid;
  v_capacity integer := 1;
  v_settings jsonb;
  v_existing integer := 0;
BEGIN
  PERFORM pg_advisory_xact_lock(
    hashtext(p_listing_id::text || '|' || p_booking_date::text || '|' || p_slot_start::text)
  );

  SELECT appointment_settings
  INTO v_settings
  FROM listings
  WHERE id = p_listing_id
    AND approved = true
    AND appointments_enabled = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Appointments are not enabled for this listing';
  END IF;

  v_capacity := GREATEST(
    1,
    COALESCE(NULLIF(v_settings->>'capacity', '')::integer, 1)
  );

  SELECT COUNT(*)
  INTO v_existing
  FROM appointments
  WHERE listing_id = p_listing_id
    AND booking_date = p_booking_date
    AND slot_start = p_slot_start
    AND status = 'confirmed';

  IF v_existing >= v_capacity THEN
    RAISE EXCEPTION 'Selected slot is already full';
  END IF;

  INSERT INTO appointments (
    listing_id,
    user_id,
    booking_date,
    slot_start,
    slot_end,
    user_name,
    user_phone,
    user_email,
    notes,
    booking_fee,
    razorpay_order_id,
    razorpay_payment_id,
    razorpay_signature,
    payment_status,
    status
  )
  VALUES (
    p_listing_id,
    p_user_id,
    p_booking_date,
    p_slot_start,
    p_slot_end,
    p_user_name,
    p_user_phone,
    p_user_email,
    p_notes,
    COALESCE(p_booking_fee, 0),
    p_razorpay_order_id,
    p_razorpay_payment_id,
    p_razorpay_signature,
    p_payment_status,
    'confirmed'
  )
  RETURNING id INTO v_appointment_id;

  RETURN v_appointment_id;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.decrement_option_stock(p_option_id uuid, p_quantity integer)
 RETURNS boolean
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
DECLARE
  v_updated integer;
BEGIN
  -- Runs only after Razorpay captured a payment, so there is no visibility
  -- filter: hiding an item mid-payment must not refuse that order.
  UPDATE public.listing_product_options
  SET quantity_in_stock = quantity_in_stock - p_quantity,
      updated_at = now()
  WHERE id = p_option_id
    AND (quantity_in_stock IS NULL OR quantity_in_stock >= p_quantity);

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated > 0;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.decrement_product_stock(p_product_id uuid, p_quantity integer)
 RETURNS boolean
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
DECLARE
  v_updated integer;
BEGIN
  -- No is_active filter: this runs only after Razorpay captured a payment,
  -- and hiding an item mid-payment must not refuse that order.
  UPDATE public.listing_products
  SET quantity_in_stock = quantity_in_stock - p_quantity
  WHERE id = p_product_id
    AND (quantity_in_stock IS NULL OR quantity_in_stock >= p_quantity);

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated > 0;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.finalize_marketplace_order(p_order jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
DECLARE
  v_order public.orders%ROWTYPE;
  v_existing public.orders%ROWTYPE;
  v_stock integer;
  v_issue text;
  v_id uuid;
BEGIN
  v_order := jsonb_populate_record(NULL::public.orders, p_order);
  IF nullif(v_order.owner_razorpay_order_id, '') IS NULL
     OR nullif(v_order.owner_razorpay_payment_id, '') IS NULL
     OR v_order.buyer_id IS NULL
     OR v_order.quantity IS NULL OR v_order.quantity NOT BETWEEN 1 AND 99
     OR v_order.service_price IS NULL OR v_order.service_price <= 0
     OR v_order.amount_total IS DISTINCT FROM v_order.service_price * v_order.quantity THEN
    RAISE EXCEPTION 'Invalid verified order';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(v_order.owner_razorpay_order_id, 0));
  SELECT * INTO v_existing FROM public.orders
    WHERE owner_razorpay_order_id = v_order.owner_razorpay_order_id
       OR owner_razorpay_payment_id = v_order.owner_razorpay_payment_id;
  IF FOUND THEN
    IF v_existing.buyer_id IS DISTINCT FROM v_order.buyer_id
       OR v_existing.owner_razorpay_payment_id IS DISTINCT FROM v_order.owner_razorpay_payment_id THEN
      RAISE EXCEPTION 'Payment already belongs to another order';
    END IF;
    RETURN jsonb_build_object('orderId', v_existing.id, 'created', false, 'issue', v_existing.fulfillment_issue);
  END IF;

  PERFORM 1 FROM public.listing_products WHERE id = v_order.product_id AND listing_id = v_order.listing_id FOR UPDATE;
  IF NOT FOUND THEN
    v_order.product_id := NULL;
    v_order.product_option_id := NULL;
    v_issue := 'Item was removed after payment. Contact the buyer to arrange fulfillment or a refund.';
  ELSIF nullif(p_order->>'option_id', '') IS NOT NULL THEN
    SELECT quantity_in_stock INTO v_stock FROM public.listing_product_options
      WHERE id = (p_order->>'option_id')::uuid AND product_id = v_order.product_id FOR UPDATE;
    IF NOT FOUND THEN
      v_order.product_option_id := NULL;
      v_issue := 'Option was removed after payment. Contact the buyer to arrange fulfillment or a refund.';
    ELSE
      v_order.product_option_id := (p_order->>'option_id')::uuid;
      IF NOT coalesce(v_order.is_test, false) AND v_stock IS NOT NULL THEN
        IF v_stock < v_order.quantity THEN
          v_issue := 'Insufficient stock after payment. Contact the buyer to arrange fulfillment or a refund.';
        ELSE
          UPDATE public.listing_product_options SET quantity_in_stock = quantity_in_stock - v_order.quantity WHERE id = v_order.product_option_id;
        END IF;
      END IF;
    END IF;
  ELSE
    SELECT quantity_in_stock INTO v_stock FROM public.listing_products WHERE id = v_order.product_id;
    IF NOT coalesce(v_order.is_test, false) AND v_stock IS NOT NULL THEN
      IF v_stock < v_order.quantity THEN
        v_issue := 'Insufficient stock after payment. Contact the buyer to arrange fulfillment or a refund.';
      ELSE
        UPDATE public.listing_products SET quantity_in_stock = quantity_in_stock - v_order.quantity WHERE id = v_order.product_id;
      END IF;
    END IF;
  END IF;

  INSERT INTO public.orders(listing_id, product_id, product_option_id, option_label, buyer_id, buyer_name, buyer_phone,
    delivery_address, notes, service_name, service_price, quantity, amount_total, owner_razorpay_order_id,
    owner_razorpay_payment_id, owner_razorpay_signature, payment_status, status, is_test, fulfillment_issue)
  VALUES(v_order.listing_id, v_order.product_id, v_order.product_option_id, v_order.option_label, v_order.buyer_id,
    v_order.buyer_name, v_order.buyer_phone, v_order.delivery_address, v_order.notes, v_order.service_name,
    v_order.service_price, v_order.quantity, v_order.amount_total, v_order.owner_razorpay_order_id,
    v_order.owner_razorpay_payment_id, v_order.owner_razorpay_signature, 'paid', 'confirmed', coalesce(v_order.is_test, false), v_issue)
  RETURNING id INTO v_id;
  UPDATE public.payment_intents SET status = 'finalized', entity_id = v_id, entity_table = 'orders',
    razorpay_payment_id = v_order.owner_razorpay_payment_id,
    razorpay_signature = v_order.owner_razorpay_signature,
    captured_at = coalesce(captured_at, now()),
    finalized_at = now(), last_error = v_issue
    WHERE razorpay_order_id = v_order.owner_razorpay_order_id AND user_id = v_order.buyer_id;
  RETURN jsonb_build_object('orderId', v_id, 'created', true, 'issue', v_issue);
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_admin_find_counts()
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select jsonb_build_object(
    'pending', (select count(*)::int from find_professionals where status = 'pending'),
    'approved', (select count(*)::int from find_professionals where status = 'approved'),
    'rejected', (select count(*)::int from find_professionals where status = 'rejected'),
    'inactive', (select count(*)::int from find_professionals where is_active = false),
    'total', (select count(*)::int from find_professionals),
    'pending_ratings', (select count(*)::int from find_ratings where status = 'pending')
  );
$function$
;

CREATE OR REPLACE FUNCTION public.get_game_leaderboard(p_game text, p_scope text)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select coalesce(jsonb_agg(row_to_json(t)), '[]'::jsonb)
  from (
    select
      p.full_name,
      max(gs.score) as best_score
    from game_scores gs
    join profiles p on p.id = gs.user_id
    where gs.game = p_game
      and (p_scope = 'all_time' or gs.played_at >= date_trunc('week', now()))
    group by p.full_name, gs.user_id
    order by best_score desc
    limit 10
  ) t
$function$
;

CREATE OR REPLACE FUNCTION public.get_homepage_stats()
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT jsonb_build_object(
    'category_counts', COALESCE((
      SELECT jsonb_object_agg(category, cnt)
      FROM (
        SELECT category, count(*)::int AS cnt
        FROM listings
        WHERE approved = true AND category IS NOT NULL
        GROUP BY category
      ) t
    ), '{}'::jsonb),
    'total_listings', COALESCE((
      SELECT count(*)::int
      FROM listings
      WHERE approved = true
    ), 0),
    'featured_listing', (
      SELECT jsonb_build_object(
        'id', l.id,
        'name', l.name,
        'category', l.category,
        'address', l.address,
        'rating', l.rating,
        'review_count', l.review_count,
        'image_url', l.image_url,
        'image_thumb_url', l.image_thumb_url,
        'tagline', l.tagline,
        'subdomain', l.subdomain,
        'verified', l.verified,
        'phone', l.phone
      )
      FROM site_settings s
      JOIN listings l
        ON l.subdomain = s.value
        AND l.approved = true
      WHERE s.key = 'featured_listing_subdomain'
      LIMIT 1
    )
  );
$function$
;

CREATE OR REPLACE FUNCTION public.guard_listing_selling_columns()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
BEGIN
  IF current_user NOT IN ('anon', 'authenticated') THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.approved := false;
    NEW.payments_enabled := false;
    NEW.payments_suspended_at := NULL;
    NEW.payments_suspended_reason := NULL;
    RETURN NEW;
  END IF;

  IF NEW.approved IS DISTINCT FROM OLD.approved
     OR NEW.payments_enabled IS DISTINCT FROM OLD.payments_enabled
     OR NEW.payments_suspended_at IS DISTINCT FROM OLD.payments_suspended_at
     OR NEW.payments_suspended_reason IS DISTINCT FROM OLD.payments_suspended_reason THEN
    RAISE EXCEPTION 'Listing approval and selling status can only be changed by OurDahanu.'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.guard_profile_privileges()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
BEGIN
  IF current_user NOT IN ('anon', 'authenticated') THEN RETURN NEW; END IF;
  IF TG_OP = 'INSERT' THEN
    IF coalesce(NEW.role, 'user') <> 'user'
       OR coalesce(NEW.is_admin, false) OR coalesce(NEW.verified, false) THEN
      RAISE EXCEPTION 'Privileged profile fields can only be changed by an administrator.' USING ERRCODE = '42501';
    END IF;
  ELSIF NEW.role IS DISTINCT FROM OLD.role
     OR NEW.is_admin IS DISTINCT FROM OLD.is_admin
     OR NEW.verified IS DISTINCT FROM OLD.verified THEN
    RAISE EXCEPTION 'Privileged profile fields can only be changed by an administrator.' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.increment_listing_views(p_listing_id uuid)
 RETURNS void
 LANGUAGE sql
 SET search_path TO 'public'
AS $function$
  UPDATE listings
  SET views = COALESCE(views, 0) + 1
  WHERE id = p_listing_id;
$function$
;

CREATE OR REPLACE FUNCTION public.increment_reply_count()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  update forum_threads
  set reply_count = reply_count + 1,
      last_activity_at = now()
  where id = new.thread_id;
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.lowercase_subdomain()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.subdomain IS NOT NULL THEN
    NEW.subdomain := lower(NEW.subdomain);
  END IF;
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.touch_appointments_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.touch_listing_payment_configs_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.touch_listing_products_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.touch_notif_prefs_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.touch_payment_intents_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$
;

create view public.public_profiles with (security_barrier=true) as
 SELECT id,
    full_name,
    avatar_url
   FROM profiles;

CREATE TRIGGER appointments_set_updated_at BEFORE UPDATE ON appointments FOR EACH ROW EXECUTE FUNCTION touch_appointments_updated_at();
CREATE TRIGGER on_forum_reply_created AFTER INSERT ON forum_replies FOR EACH ROW EXECUTE FUNCTION increment_reply_count();
CREATE TRIGGER listing_payment_configs_set_updated_at BEFORE UPDATE ON listing_payment_configs FOR EACH ROW EXECUTE FUNCTION touch_listing_payment_configs_updated_at();
CREATE TRIGGER listing_products_set_updated_at BEFORE UPDATE ON listing_products FOR EACH ROW EXECUTE FUNCTION touch_listing_products_updated_at();
CREATE TRIGGER trg_guard_listing_selling_columns BEFORE INSERT OR UPDATE ON listings FOR EACH ROW EXECUTE FUNCTION guard_listing_selling_columns();
CREATE TRIGGER trg_lowercase_subdomain BEFORE INSERT OR UPDATE OF subdomain ON listings FOR EACH ROW EXECUTE FUNCTION lowercase_subdomain();
CREATE TRIGGER notif_prefs_set_updated_at BEFORE UPDATE ON notification_preferences FOR EACH ROW EXECUTE FUNCTION touch_notif_prefs_updated_at();
CREATE TRIGGER payment_intents_set_updated_at BEFORE UPDATE ON payment_intents FOR EACH ROW EXECUTE FUNCTION touch_payment_intents_updated_at();
CREATE TRIGGER protect_profile_privileges BEFORE INSERT OR UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION guard_profile_privileges();
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION handle_new_user();
alter table public.appointment_date_overrides enable row level security;
alter table public.appointments enable row level security;
alter table public.classifieds enable row level security;
alter table public.cod_collections enable row level security;
alter table public.coupon_redemptions enable row level security;
alter table public.coupons enable row level security;
alter table public.delivery_order_items enable row level security;
alter table public.delivery_orders enable row level security;
alter table public.emergency_alerts enable row level security;
alter table public.event_rsvps enable row level security;
alter table public.events enable row level security;
alter table public.find_professionals enable row level security;
alter table public.find_ratings enable row level security;
alter table public.forum_replies enable row level security;
alter table public.forum_threads enable row level security;
alter table public.game_scores enable row level security;
alter table public.job_contact_reveals enable row level security;
alter table public.job_post_contacts enable row level security;
alter table public.job_post_reports enable row level security;
alter table public.job_posts enable row level security;
alter table public.listing_delivery_config enable row level security;
alter table public.listing_events enable row level security;
alter table public.listing_favourites enable row level security;
alter table public.listing_payment_configs enable row level security;
alter table public.listing_product_options enable row level security;
alter table public.listing_products enable row level security;
alter table public.listing_questions enable row level security;
alter table public.listing_recommendations enable row level security;
alter table public.listing_selling_suspensions enable row level security;
alter table public.listings enable row level security;
alter table public.news_articles enable row level security;
alter table public.newsletter_subscriptions enable row level security;
alter table public.notification_preferences enable row level security;
alter table public.notifications enable row level security;
alter table public.orders enable row level security;
alter table public.payment_intents enable row level security;
alter table public.poll_votes enable row level security;
alter table public.polls enable row level security;
alter table public.pricing_config enable row level security;
alter table public.products enable row level security;
alter table public.profiles enable row level security;
alter table public.reviews enable row level security;
alter table public.rider_assignments enable row level security;
alter table public.rider_earnings enable row level security;
alter table public.riders enable row level security;
alter table public.site_settings enable row level security;
alter table public.telegram_link_tokens enable row level security;
create policy "Anyone can read overrides for approved listings" on public.appointment_date_overrides as permissive for select to public
  using ((EXISTS ( SELECT 1
   FROM listings
  WHERE ((listings.id = appointment_date_overrides.listing_id) AND (listings.approved = true)))));
create policy "Owners can read appointments for own listings" on public.appointments as permissive for select to public
  using ((EXISTS ( SELECT 1
   FROM listings
  WHERE ((listings.id = appointments.listing_id) AND (listings.owner_id = ( SELECT auth.uid() AS uid))))));
create policy "Users can read own appointments" on public.appointments as permissive for select to public
  using ((( SELECT auth.uid() AS uid) = user_id));
create policy "Active classifieds are public" on public.classifieds as permissive for select to public
  using (((active = true) AND (approved = true)));
create policy "Sellers can manage own classifieds" on public.classifieds as permissive for all to public
  using ((( SELECT auth.uid() AS uid) = seller_id));
create policy "Rider reads own cod" on public.cod_collections as permissive for select to public
  using ((rider_id IN ( SELECT r.id
   FROM riders r
  WHERE (r.user_id = ( SELECT auth.uid() AS uid)))));
create policy "Admin read coupon redemptions" on public.coupon_redemptions as permissive for select to public
  using ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = ANY (ARRAY['admin'::text, 'moderator'::text]))))));
create policy "Admin read coupons" on public.coupons as permissive for select to public
  using (true);
create policy "Read items of visible orders" on public.delivery_order_items as permissive for select to public
  using ((EXISTS ( SELECT 1
   FROM delivery_orders o
  WHERE (o.id = delivery_order_items.delivery_order_id))));
create policy "Customer reads own delivery orders" on public.delivery_orders as permissive for select to public
  using ((( SELECT auth.uid() AS uid) = customer_id));
create policy "Owner reads listing delivery orders" on public.delivery_orders as permissive for select to public
  using ((EXISTS ( SELECT 1
   FROM listings l
  WHERE ((l.id = delivery_orders.listing_id) AND (l.owner_id = ( SELECT auth.uid() AS uid))))));
create policy "Rider reads assigned or offered orders" on public.delivery_orders as permissive for select to public
  using (((rider_id IN ( SELECT r.id
   FROM riders r
  WHERE (r.user_id = ( SELECT auth.uid() AS uid)))) OR (EXISTS ( SELECT 1
   FROM (rider_assignments a
     JOIN riders r ON ((r.id = a.rider_id)))
  WHERE ((a.delivery_order_id = delivery_orders.id) AND (r.user_id = ( SELECT auth.uid() AS uid)))))));
create policy "Active alerts are public" on public.emergency_alerts as permissive for select to public
  using ((active = true));
create policy "Admins can manage alerts" on public.emergency_alerts as permissive for all to public
  using ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.is_admin = true)))));
create policy "Authenticated users can RSVP" on public.event_rsvps as permissive for insert to public
  with check ((( SELECT auth.uid() AS uid) = user_id));
create policy "Users can cancel own RSVP" on public.event_rsvps as permissive for delete to public
  using ((( SELECT auth.uid() AS uid) = user_id));
create policy "Users can view own RSVPs" on public.event_rsvps as permissive for select to public
  using ((( SELECT auth.uid() AS uid) = user_id));
create policy "Approved events are public" on public.events as permissive for select to public
  using (((approved = true) OR (( SELECT auth.uid() AS uid) = organizer_id)));
create policy "Organizers can manage own events" on public.events as permissive for all to public
  using ((( SELECT auth.uid() AS uid) = organizer_id));
create policy "Find approved professionals are public" on public.find_professionals as permissive for select to public
  using ((((status = 'approved'::text) AND (is_active = true)) OR (auth.uid() = submitted_by)));
create policy "Users can submit professionals" on public.find_professionals as permissive for insert to public
  with check (((auth.uid() = submitted_by) AND (status = 'pending'::text)));
create policy "Find approved ratings are public" on public.find_ratings as permissive for select to public
  using (((status = 'approved'::text) OR (auth.uid() = user_id)));
create policy "Users can submit ratings" on public.find_ratings as permissive for insert to public
  with check (((auth.uid() = user_id) AND (status = 'pending'::text)));
create policy "Users can update own ratings" on public.find_ratings as permissive for update to public
  using ((auth.uid() = user_id))
  with check (((auth.uid() = user_id) AND (status = 'pending'::text)));
create policy "Authenticated users can reply" on public.forum_replies as permissive for insert to public
  with check ((( SELECT auth.uid() AS uid) = author_id));
create policy "Authors can delete own replies" on public.forum_replies as permissive for delete to public
  using ((( SELECT auth.uid() AS uid) = author_id));
create policy "Forum replies are public" on public.forum_replies as permissive for select to public
  using (true);
create policy "Approved threads are public" on public.forum_threads as permissive for select to public
  using ((approved = true));
create policy "Authors can manage own threads" on public.forum_threads as permissive for all to public
  using ((( SELECT auth.uid() AS uid) = author_id));
create policy "Scores are public" on public.game_scores as permissive for select to public
  using (true);
create policy "Users can submit their own score" on public.game_scores as permissive for insert to public
  with check ((auth.uid() = user_id));
create policy "Live job posts are public" on public.job_posts as permissive for select to anon, authenticated
  using (((status = 'approved'::text) AND (expires_at > now())));
create policy "Posters can read their own job posts" on public.job_posts as permissive for select to authenticated
  using ((posted_by = auth.uid()));
create policy "Anyone reads delivery config" on public.listing_delivery_config as permissive for select to public
  using (true);
create policy "Owner manages delivery config" on public.listing_delivery_config as permissive for all to public
  using ((EXISTS ( SELECT 1
   FROM listings l
  WHERE ((l.id = listing_delivery_config.listing_id) AND (l.owner_id = ( SELECT auth.uid() AS uid))))))
  with check ((EXISTS ( SELECT 1
   FROM listings l
  WHERE ((l.id = listing_delivery_config.listing_id) AND (l.owner_id = ( SELECT auth.uid() AS uid))))));
create policy "Anyone can view favourites count" on public.listing_favourites as permissive for select to public
  using (true);
create policy "Users manage own favourites" on public.listing_favourites as permissive for all to public
  using ((( SELECT auth.uid() AS uid) = user_id));
create policy "Owners read own payment config" on public.listing_payment_configs as permissive for select to public
  using ((EXISTS ( SELECT 1
   FROM listings
  WHERE ((listings.id = listing_payment_configs.listing_id) AND (listings.owner_id = ( SELECT auth.uid() AS uid))))));
create policy "Owners read own product options" on public.listing_product_options as permissive for select to public
  using ((EXISTS ( SELECT 1
   FROM (listing_products p
     JOIN listings l ON ((l.id = p.listing_id)))
  WHERE ((p.id = listing_product_options.product_id) AND (l.owner_id = ( SELECT auth.uid() AS uid))))));
create policy "Public reads options of active products on approved listings" on public.listing_product_options as permissive for select to public
  using ((EXISTS ( SELECT 1
   FROM (listing_products p
     JOIN listings l ON ((l.id = p.listing_id)))
  WHERE ((p.id = listing_product_options.product_id) AND (p.is_active = true) AND (l.approved = true)))));
create policy "Owners read own products" on public.listing_products as permissive for select to public
  using ((EXISTS ( SELECT 1
   FROM listings
  WHERE ((listings.id = listing_products.listing_id) AND (listings.owner_id = ( SELECT auth.uid() AS uid))))));
create policy "Public reads active products on approved listings" on public.listing_products as permissive for select to public
  using (((is_active = true) AND (EXISTS ( SELECT 1
   FROM listings
  WHERE ((listings.id = listing_products.listing_id) AND (listings.approved = true))))));
create policy "Anyone can view questions" on public.listing_questions as permissive for select to public
  using (true);
create policy "Authenticated can ask" on public.listing_questions as permissive for insert to public
  with check ((( SELECT auth.uid() AS uid) = user_id));
create policy "Owner can answer" on public.listing_questions as permissive for update to public
  using (true);
create policy "Anyone can view recommendations" on public.listing_recommendations as permissive for select to public
  using (true);
create policy "Authenticated can recommend" on public.listing_recommendations as permissive for insert to public
  with check ((( SELECT auth.uid() AS uid) = user_id));
create policy "Users delete own recommendations" on public.listing_recommendations as permissive for delete to public
  using ((( SELECT auth.uid() AS uid) = user_id));
create policy "Approved listings are public" on public.listings as permissive for select to public
  using (((approved = true) OR (( SELECT auth.uid() AS uid) = owner_id)));
create policy "Owners can manage own listings" on public.listings as permissive for all to public
  using ((( SELECT auth.uid() AS uid) = owner_id));
create policy "Authors can manage own articles" on public.news_articles as permissive for all to public
  using ((( SELECT auth.uid() AS uid) = author_id));
create policy "Published articles are public" on public.news_articles as permissive for select to public
  using (((published = true) OR (( SELECT auth.uid() AS uid) = author_id)));
create policy "Admins can view subscriptions" on public.newsletter_subscriptions as permissive for select to public
  using ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.is_admin = true)))));
create policy "Anyone can subscribe" on public.newsletter_subscriptions as permissive for insert to public
  with check (true);
create policy "Users insert own notif prefs" on public.notification_preferences as permissive for insert to public
  with check ((( SELECT auth.uid() AS uid) = user_id));
create policy "Users read own notif prefs" on public.notification_preferences as permissive for select to public
  using ((( SELECT auth.uid() AS uid) = user_id));
create policy "Users update own notif prefs" on public.notification_preferences as permissive for update to public
  using ((( SELECT auth.uid() AS uid) = user_id))
  with check ((( SELECT auth.uid() AS uid) = user_id));
create policy "Users mark own notifications read" on public.notifications as permissive for update to public
  using ((( SELECT auth.uid() AS uid) = user_id))
  with check ((( SELECT auth.uid() AS uid) = user_id));
create policy "Users read own notifications" on public.notifications as permissive for select to public
  using ((( SELECT auth.uid() AS uid) = user_id));
create policy buyer_can_select_own_orders on public.orders as permissive for select to public
  using ((buyer_id = ( SELECT auth.uid() AS uid)));
create policy seller_can_select_listing_orders on public.orders as permissive for select to public
  using ((listing_id IN ( SELECT listings.id
   FROM listings
  WHERE (listings.owner_id = ( SELECT auth.uid() AS uid)))));
create policy "Users read own payment intents" on public.payment_intents as permissive for select to public
  using ((( SELECT auth.uid() AS uid) = user_id));
create policy "Authenticated users can vote" on public.poll_votes as permissive for insert to public
  with check ((( SELECT auth.uid() AS uid) = user_id));
create policy "Users can update own vote" on public.poll_votes as permissive for update to public
  using ((( SELECT auth.uid() AS uid) = user_id));
create policy "Vote counts are public" on public.poll_votes as permissive for select to public
  using (true);
create policy "Active polls are public" on public.polls as permissive for select to public
  using ((active = true));
create policy "Admin read pricing" on public.pricing_config as permissive for select to public
  using (true);
create policy "Products are viewable by everyone" on public.products as permissive for select to public
  using (true);
create policy "Sellers can manage own products" on public.products as permissive for all to public
  using ((( SELECT auth.uid() AS uid) = seller_id));
create policy profile_insert_own on public.profiles as permissive for insert to authenticated
  with check ((id = ( SELECT auth.uid() AS uid)));
create policy profile_read_own on public.profiles as permissive for select to authenticated
  using ((id = ( SELECT auth.uid() AS uid)));
create policy profile_update_own on public.profiles as permissive for update to authenticated
  using ((id = ( SELECT auth.uid() AS uid)))
  with check ((id = ( SELECT auth.uid() AS uid)));
create policy "Authenticated users can leave reviews" on public.reviews as permissive for insert to public
  with check ((( SELECT auth.uid() AS uid) = user_id));
create policy "Listing owner can reply once" on public.reviews as permissive for update to public
  using (((owner_reply IS NULL) AND (EXISTS ( SELECT 1
   FROM listings
  WHERE ((listings.id = reviews.listing_id) AND (listings.owner_id = ( SELECT auth.uid() AS uid)))))))
  with check (((owner_reply IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM listings
  WHERE ((listings.id = reviews.listing_id) AND (listings.owner_id = ( SELECT auth.uid() AS uid)))))));
create policy "Reviews are public" on public.reviews as permissive for select to public
  using (true);
create policy "Rider reads own assignments" on public.rider_assignments as permissive for select to public
  using ((rider_id IN ( SELECT r.id
   FROM riders r
  WHERE (r.user_id = ( SELECT auth.uid() AS uid)))));
create policy "Rider reads own earnings" on public.rider_earnings as permissive for select to public
  using ((rider_id IN ( SELECT r.id
   FROM riders r
  WHERE (r.user_id = ( SELECT auth.uid() AS uid)))));
create policy "Riders insert own row" on public.riders as permissive for insert to public
  with check ((( SELECT auth.uid() AS uid) = user_id));
create policy "Riders read own row" on public.riders as permissive for select to public
  using ((( SELECT auth.uid() AS uid) = user_id));
create policy "Riders update own row" on public.riders as permissive for update to public
  using ((( SELECT auth.uid() AS uid) = user_id))
  with check ((( SELECT auth.uid() AS uid) = user_id));
create policy public_read on public.site_settings as permissive for select to public
  using (true);
create policy "Authenticated users can upload images" on storage.objects as permissive for insert to authenticated
  with check ((bucket_id = 'uploads'::text));
create policy "Public can view images" on storage.objects as permissive for select to public
  using ((bucket_id = 'uploads'::text));
revoke all on table public.appointment_date_overrides from public, anon, authenticated, service_role;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.appointment_date_overrides to anon;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.appointment_date_overrides to authenticated;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.appointment_date_overrides to service_role;
revoke all on table public.appointments from public, anon, authenticated, service_role;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.appointments to anon;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.appointments to authenticated;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.appointments to service_role;
revoke all on table public.classifieds from public, anon, authenticated, service_role;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.classifieds to anon;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.classifieds to authenticated;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.classifieds to service_role;
revoke all on table public.cod_collections from public, anon, authenticated, service_role;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.cod_collections to anon;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.cod_collections to authenticated;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.cod_collections to service_role;
revoke all on table public.coupon_redemptions from public, anon, authenticated, service_role;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.coupon_redemptions to anon;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.coupon_redemptions to authenticated;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.coupon_redemptions to service_role;
revoke all on table public.coupons from public, anon, authenticated, service_role;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.coupons to anon;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.coupons to authenticated;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.coupons to service_role;
revoke all on table public.delivery_order_items from public, anon, authenticated, service_role;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.delivery_order_items to anon;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.delivery_order_items to authenticated;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.delivery_order_items to service_role;
revoke all on table public.delivery_orders from public, anon, authenticated, service_role;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.delivery_orders to anon;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.delivery_orders to authenticated;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.delivery_orders to service_role;
revoke all on table public.emergency_alerts from public, anon, authenticated, service_role;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.emergency_alerts to anon;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.emergency_alerts to authenticated;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.emergency_alerts to service_role;
revoke all on table public.event_rsvps from public, anon, authenticated, service_role;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.event_rsvps to anon;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.event_rsvps to authenticated;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.event_rsvps to service_role;
revoke all on table public.events from public, anon, authenticated, service_role;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.events to anon;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.events to authenticated;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.events to service_role;
revoke all on table public.find_professionals from public, anon, authenticated, service_role;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.find_professionals to anon;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.find_professionals to authenticated;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.find_professionals to service_role;
revoke all on table public.find_ratings from public, anon, authenticated, service_role;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.find_ratings to anon;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.find_ratings to authenticated;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.find_ratings to service_role;
revoke all on table public.forum_replies from public, anon, authenticated, service_role;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.forum_replies to anon;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.forum_replies to authenticated;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.forum_replies to service_role;
revoke all on table public.forum_threads from public, anon, authenticated, service_role;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.forum_threads to anon;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.forum_threads to authenticated;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.forum_threads to service_role;
revoke all on table public.game_scores from public, anon, authenticated, service_role;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.game_scores to anon;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.game_scores to authenticated;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.game_scores to service_role;
revoke all on table public.job_contact_reveals from public, anon, authenticated, service_role;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.job_contact_reveals to service_role;
revoke all on table public.job_post_contacts from public, anon, authenticated, service_role;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.job_post_contacts to service_role;
revoke all on table public.job_post_reports from public, anon, authenticated, service_role;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.job_post_reports to service_role;
revoke all on table public.job_posts from public, anon, authenticated, service_role;
grant SELECT on table public.job_posts to anon;
grant SELECT on table public.job_posts to authenticated;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.job_posts to service_role;
revoke all on table public.listing_delivery_config from public, anon, authenticated, service_role;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.listing_delivery_config to anon;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.listing_delivery_config to authenticated;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.listing_delivery_config to service_role;
revoke all on table public.listing_events from public, anon, authenticated, service_role;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.listing_events to anon;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.listing_events to authenticated;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.listing_events to service_role;
revoke all on table public.listing_favourites from public, anon, authenticated, service_role;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.listing_favourites to anon;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.listing_favourites to authenticated;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.listing_favourites to service_role;
revoke all on table public.listing_payment_configs from public, anon, authenticated, service_role;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.listing_payment_configs to anon;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.listing_payment_configs to authenticated;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.listing_payment_configs to service_role;
revoke all on table public.listing_product_options from public, anon, authenticated, service_role;
grant REFERENCES, SELECT, TRIGGER on table public.listing_product_options to anon;
grant REFERENCES, SELECT, TRIGGER on table public.listing_product_options to authenticated;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.listing_product_options to service_role;
revoke all on table public.listing_products from public, anon, authenticated, service_role;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.listing_products to anon;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.listing_products to authenticated;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.listing_products to service_role;
revoke all on table public.listing_questions from public, anon, authenticated, service_role;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.listing_questions to anon;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.listing_questions to authenticated;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.listing_questions to service_role;
revoke all on table public.listing_recommendations from public, anon, authenticated, service_role;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.listing_recommendations to anon;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.listing_recommendations to authenticated;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.listing_recommendations to service_role;
revoke all on table public.listing_selling_suspensions from public, anon, authenticated, service_role;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.listing_selling_suspensions to service_role;
revoke all on table public.listings from public, anon, authenticated, service_role;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.listings to anon;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.listings to authenticated;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.listings to service_role;
revoke all on table public.news_articles from public, anon, authenticated, service_role;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.news_articles to anon;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.news_articles to authenticated;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.news_articles to service_role;
revoke all on table public.newsletter_subscriptions from public, anon, authenticated, service_role;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.newsletter_subscriptions to anon;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.newsletter_subscriptions to authenticated;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.newsletter_subscriptions to service_role;
revoke all on table public.notification_preferences from public, anon, authenticated, service_role;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.notification_preferences to anon;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.notification_preferences to authenticated;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.notification_preferences to service_role;
revoke all on table public.notifications from public, anon, authenticated, service_role;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.notifications to anon;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.notifications to authenticated;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.notifications to service_role;
revoke all on table public.orders from public, anon, authenticated, service_role;
grant REFERENCES, SELECT, TRIGGER on table public.orders to anon;
grant REFERENCES, SELECT, TRIGGER on table public.orders to authenticated;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.orders to service_role;
revoke all on table public.payment_intents from public, anon, authenticated, service_role;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.payment_intents to anon;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.payment_intents to authenticated;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.payment_intents to service_role;
revoke all on table public.poll_votes from public, anon, authenticated, service_role;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.poll_votes to anon;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.poll_votes to authenticated;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.poll_votes to service_role;
revoke all on table public.polls from public, anon, authenticated, service_role;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.polls to anon;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.polls to authenticated;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.polls to service_role;
revoke all on table public.pricing_config from public, anon, authenticated, service_role;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.pricing_config to anon;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.pricing_config to authenticated;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.pricing_config to service_role;
revoke all on table public.products from public, anon, authenticated, service_role;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.products to anon;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.products to authenticated;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.products to service_role;
revoke all on table public.profiles from public, anon, authenticated, service_role;
grant INSERT, SELECT, UPDATE on table public.profiles to anon;
grant INSERT, SELECT, UPDATE on table public.profiles to authenticated;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.profiles to service_role;
revoke all on table public.public_profiles from public, anon, authenticated, service_role;
grant SELECT on table public.public_profiles to anon;
grant SELECT on table public.public_profiles to authenticated;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.public_profiles to service_role;
revoke all on table public.reviews from public, anon, authenticated, service_role;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.reviews to anon;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.reviews to authenticated;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.reviews to service_role;
revoke all on table public.rider_assignments from public, anon, authenticated, service_role;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.rider_assignments to anon;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.rider_assignments to authenticated;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.rider_assignments to service_role;
revoke all on table public.rider_earnings from public, anon, authenticated, service_role;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.rider_earnings to anon;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.rider_earnings to authenticated;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.rider_earnings to service_role;
revoke all on table public.riders from public, anon, authenticated, service_role;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.riders to anon;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.riders to authenticated;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.riders to service_role;
revoke all on table public.site_settings from public, anon, authenticated, service_role;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.site_settings to anon;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.site_settings to authenticated;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.site_settings to service_role;
revoke all on table public.telegram_link_tokens from public, anon, authenticated, service_role;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.telegram_link_tokens to anon;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.telegram_link_tokens to authenticated;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.telegram_link_tokens to service_role;
revoke all on function public.accept_delivery_offer(p_order_id uuid, p_rider_id uuid) from public, anon, authenticated, service_role;
grant execute on function public.accept_delivery_offer(p_order_id uuid, p_rider_id uuid) to service_role;
revoke all on function public.create_appointment_booking(p_listing_id uuid, p_user_id uuid, p_booking_date date, p_slot_start time without time zone, p_slot_end time without time zone, p_user_name text, p_user_phone text, p_user_email text, p_notes text, p_booking_fee numeric, p_razorpay_order_id text, p_razorpay_payment_id text, p_razorpay_signature text, p_payment_status text) from public, anon, authenticated, service_role;
grant execute on function public.create_appointment_booking(p_listing_id uuid, p_user_id uuid, p_booking_date date, p_slot_start time without time zone, p_slot_end time without time zone, p_user_name text, p_user_phone text, p_user_email text, p_notes text, p_booking_fee numeric, p_razorpay_order_id text, p_razorpay_payment_id text, p_razorpay_signature text, p_payment_status text) to anon;
grant execute on function public.create_appointment_booking(p_listing_id uuid, p_user_id uuid, p_booking_date date, p_slot_start time without time zone, p_slot_end time without time zone, p_user_name text, p_user_phone text, p_user_email text, p_notes text, p_booking_fee numeric, p_razorpay_order_id text, p_razorpay_payment_id text, p_razorpay_signature text, p_payment_status text) to authenticated;
grant execute on function public.create_appointment_booking(p_listing_id uuid, p_user_id uuid, p_booking_date date, p_slot_start time without time zone, p_slot_end time without time zone, p_user_name text, p_user_phone text, p_user_email text, p_notes text, p_booking_fee numeric, p_razorpay_order_id text, p_razorpay_payment_id text, p_razorpay_signature text, p_payment_status text) to public;
grant execute on function public.create_appointment_booking(p_listing_id uuid, p_user_id uuid, p_booking_date date, p_slot_start time without time zone, p_slot_end time without time zone, p_user_name text, p_user_phone text, p_user_email text, p_notes text, p_booking_fee numeric, p_razorpay_order_id text, p_razorpay_payment_id text, p_razorpay_signature text, p_payment_status text) to service_role;
revoke all on function public.decrement_option_stock(p_option_id uuid, p_quantity integer) from public, anon, authenticated, service_role;
grant execute on function public.decrement_option_stock(p_option_id uuid, p_quantity integer) to service_role;
revoke all on function public.decrement_product_stock(p_product_id uuid, p_quantity integer) from public, anon, authenticated, service_role;
grant execute on function public.decrement_product_stock(p_product_id uuid, p_quantity integer) to anon;
grant execute on function public.decrement_product_stock(p_product_id uuid, p_quantity integer) to authenticated;
grant execute on function public.decrement_product_stock(p_product_id uuid, p_quantity integer) to public;
grant execute on function public.decrement_product_stock(p_product_id uuid, p_quantity integer) to service_role;
revoke all on function public.finalize_marketplace_order(p_order jsonb) from public, anon, authenticated, service_role;
grant execute on function public.finalize_marketplace_order(p_order jsonb) to service_role;
revoke all on function public.get_admin_find_counts() from public, anon, authenticated, service_role;
grant execute on function public.get_admin_find_counts() to service_role;
revoke all on function public.get_game_leaderboard(p_game text, p_scope text) from public, anon, authenticated, service_role;
grant execute on function public.get_game_leaderboard(p_game text, p_scope text) to anon;
grant execute on function public.get_game_leaderboard(p_game text, p_scope text) to authenticated;
grant execute on function public.get_game_leaderboard(p_game text, p_scope text) to public;
grant execute on function public.get_game_leaderboard(p_game text, p_scope text) to service_role;
revoke all on function public.get_homepage_stats() from public, anon, authenticated, service_role;
grant execute on function public.get_homepage_stats() to anon;
grant execute on function public.get_homepage_stats() to authenticated;
grant execute on function public.get_homepage_stats() to public;
grant execute on function public.get_homepage_stats() to service_role;
revoke all on function public.guard_listing_selling_columns() from public, anon, authenticated, service_role;
grant execute on function public.guard_listing_selling_columns() to anon;
grant execute on function public.guard_listing_selling_columns() to authenticated;
grant execute on function public.guard_listing_selling_columns() to public;
grant execute on function public.guard_listing_selling_columns() to service_role;
revoke all on function public.guard_profile_privileges() from public, anon, authenticated, service_role;
grant execute on function public.guard_profile_privileges() to anon;
grant execute on function public.guard_profile_privileges() to authenticated;
grant execute on function public.guard_profile_privileges() to public;
grant execute on function public.guard_profile_privileges() to service_role;
revoke all on function public.handle_new_user() from public, anon, authenticated, service_role;
grant execute on function public.handle_new_user() to anon;
grant execute on function public.handle_new_user() to authenticated;
grant execute on function public.handle_new_user() to public;
grant execute on function public.handle_new_user() to service_role;
revoke all on function public.increment_listing_views(p_listing_id uuid) from public, anon, authenticated, service_role;
grant execute on function public.increment_listing_views(p_listing_id uuid) to service_role;
revoke all on function public.increment_reply_count() from public, anon, authenticated, service_role;
grant execute on function public.increment_reply_count() to anon;
grant execute on function public.increment_reply_count() to authenticated;
grant execute on function public.increment_reply_count() to public;
grant execute on function public.increment_reply_count() to service_role;
revoke all on function public.lowercase_subdomain() from public, anon, authenticated, service_role;
grant execute on function public.lowercase_subdomain() to anon;
grant execute on function public.lowercase_subdomain() to authenticated;
grant execute on function public.lowercase_subdomain() to public;
grant execute on function public.lowercase_subdomain() to service_role;
revoke all on function public.touch_appointments_updated_at() from public, anon, authenticated, service_role;
grant execute on function public.touch_appointments_updated_at() to anon;
grant execute on function public.touch_appointments_updated_at() to authenticated;
grant execute on function public.touch_appointments_updated_at() to public;
grant execute on function public.touch_appointments_updated_at() to service_role;
revoke all on function public.touch_listing_payment_configs_updated_at() from public, anon, authenticated, service_role;
grant execute on function public.touch_listing_payment_configs_updated_at() to anon;
grant execute on function public.touch_listing_payment_configs_updated_at() to authenticated;
grant execute on function public.touch_listing_payment_configs_updated_at() to public;
grant execute on function public.touch_listing_payment_configs_updated_at() to service_role;
revoke all on function public.touch_listing_products_updated_at() from public, anon, authenticated, service_role;
grant execute on function public.touch_listing_products_updated_at() to anon;
grant execute on function public.touch_listing_products_updated_at() to authenticated;
grant execute on function public.touch_listing_products_updated_at() to public;
grant execute on function public.touch_listing_products_updated_at() to service_role;
revoke all on function public.touch_notif_prefs_updated_at() from public, anon, authenticated, service_role;
grant execute on function public.touch_notif_prefs_updated_at() to anon;
grant execute on function public.touch_notif_prefs_updated_at() to authenticated;
grant execute on function public.touch_notif_prefs_updated_at() to public;
grant execute on function public.touch_notif_prefs_updated_at() to service_role;
revoke all on function public.touch_payment_intents_updated_at() from public, anon, authenticated, service_role;
grant execute on function public.touch_payment_intents_updated_at() to anon;
grant execute on function public.touch_payment_intents_updated_at() to authenticated;
grant execute on function public.touch_payment_intents_updated_at() to public;
grant execute on function public.touch_payment_intents_updated_at() to service_role;
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values ('uploads', 'uploads', true, 2097152, '{image/*}'::text[]) on conflict (id) do nothing;
alter publication supabase_realtime add table public.notifications;
