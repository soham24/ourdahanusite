-- find.ourdahanu.in — professionals directory + moderated ratings
-- Both tables use a pending|approved|rejected moderation status.

create table if not exists find_professionals (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text not null,
  whatsapp boolean not null default false,
  profession text not null,
  profession_other text,
  locality text,
  note text,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  is_active boolean not null default true,
  submitted_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists find_ratings (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null references find_professionals(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  rating int not null check (rating between 1 and 5),
  comment text not null,
  used_service boolean not null default false,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (professional_id, user_id)
);

create index if not exists find_professionals_public_idx
  on find_professionals (status, is_active, profession);
create index if not exists find_ratings_professional_idx
  on find_ratings (professional_id, status);
create index if not exists find_ratings_pending_idx
  on find_ratings (status, created_at desc);

alter table find_professionals enable row level security;
alter table find_ratings enable row level security;

-- Professionals: public sees approved+active; users see their own submissions.
create policy "Find approved professionals are public" on find_professionals
  for select using ((status = 'approved' and is_active = true) or auth.uid() = submitted_by);
-- Users may submit; must be pending and owned by them.
create policy "Users can submit professionals" on find_professionals
  for insert with check (auth.uid() = submitted_by and status = 'pending');

-- Ratings: public sees approved; users see their own.
create policy "Find approved ratings are public" on find_ratings
  for select using (status = 'approved' or auth.uid() = user_id);
-- Users insert their own rating (forced pending).
create policy "Users can submit ratings" on find_ratings
  for insert with check (auth.uid() = user_id and status = 'pending');
-- Users update their own rating (forced pending on resubmit).
create policy "Users can update own ratings" on find_ratings
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id and status = 'pending');

-- Note: all admin status changes / edits go through the service-role client,
-- which bypasses RLS, so no admin policies are needed here.
