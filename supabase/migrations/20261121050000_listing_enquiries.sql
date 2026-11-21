-- Private enquiries from a signed-in visitor to a business. Unlike Q&A they
-- are not public: only the business's owner and the sender can read one.
-- The owner replies by phone or WhatsApp, so the sender leaves a number.
--
-- Writes go through the sendEnquiry server action, which rate-limits and
-- notifies the owner; the insert policy still holds a hand-written API call
-- to the sender's own id and an approved listing.
create table if not exists public.listing_enquiries (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  phone text not null check (char_length(phone) between 6 and 20),
  message text not null check (char_length(message) between 1 and 1000),
  created_at timestamptz not null default now()
);

create index if not exists idx_listing_enquiries_listing_created on public.listing_enquiries (listing_id, created_at desc);
create index if not exists idx_listing_enquiries_user_created on public.listing_enquiries (user_id, created_at desc);

alter table public.listing_enquiries enable row level security;

drop policy if exists "Senders create enquiries to approved listings" on public.listing_enquiries;
create policy "Senders create enquiries to approved listings" on public.listing_enquiries
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.listings l where l.id = listing_id and l.approved = true)
  );

drop policy if exists "Owners and senders read enquiries" on public.listing_enquiries;
create policy "Owners and senders read enquiries" on public.listing_enquiries
  for select to authenticated
  using (
    user_id = (select auth.uid())
    or exists (select 1 from public.listings l where l.id = listing_id and l.owner_id = (select auth.uid()))
  );

-- New tables inherit broad default grants; enquiries are never edited or
-- deleted through the API, and visitors who are not signed in get nothing.
revoke all on table public.listing_enquiries from anon, authenticated;
grant select, insert on table public.listing_enquiries to authenticated;
grant all on table public.listing_enquiries to service_role;
