create table if not exists jobs (
  id            uuid default gen_random_uuid() primary key,
  title         text not null,
  company       text not null,
  category      text not null,
  type          text not null default 'Full-time',
  location      text,
  salary        text,
  description   text not null,
  requirements  text,
  contact_email text,
  contact_phone text,
  posted_by     uuid references auth.users(id),
  approved      boolean default false,
  payment_id    text,
  payment_status text default 'pending',
  created_at    timestamp with time zone default now()
);

-- Allow anyone to read approved jobs
create policy "Public can read approved jobs"
  on jobs for select
  using (approved = true);

-- Logged-in users can insert
create policy "Authenticated users can post jobs"
  on jobs for insert
  with check (auth.uid() = posted_by);

-- Enable RLS
alter table jobs enable row level security;

-- ─── If the table already exists, run these to add payment columns: ───────────
-- alter table jobs add column if not exists payment_id text;
-- alter table jobs add column if not exists payment_status text default 'pending';
