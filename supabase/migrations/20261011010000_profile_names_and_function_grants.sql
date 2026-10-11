-- Reviewer names without a list of every user.
--
-- public_profiles exposed id, full_name and avatar_url for every account to
-- anyone holding the anon key -- which is every visitor, since the key ships
-- in the browser bundle. The app never needs the whole list: each caller has
-- a handful of user ids (the authors of the reviews it is showing) and wants
-- their names. get_profile_names answers exactly that and nothing more.
--
-- The view itself is dropped by the next migration, once the app no longer
-- reads it.

create or replace function public.get_profile_names(p_ids uuid[])
returns table (id uuid, full_name text)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.full_name
  from public.profiles p
  -- Capped so one call cannot be used to page through the table; callers
  -- ask for one page of reviews at a time, well under this.
  where p.id = any (p_ids[1:200])
$$;

comment on function public.get_profile_names(uuid[]) is
  'Display names for the given user ids only (max 200 per call). Security definer by design: anon may not read profiles directly.';

revoke all on function public.get_profile_names(uuid[]) from public, anon, authenticated;
grant execute on function public.get_profile_names(uuid[]) to anon, authenticated, service_role;

-- Trigger functions run from their triggers whatever EXECUTE grants say, so
-- nothing needs to call these through the API. Supabase's default grants
-- exposed them at /rest/v1/rpc/* anyway.
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.increment_reply_count() from public, anon, authenticated;

-- These tables have row level security on and no policies on purpose: only
-- server code using the service role touches them. Say so, so nobody "fixes"
-- them by adding a permissive policy.
comment on table public.job_contact_reveals is 'Server-only (service role). RLS on with no policies by design: denies anon and authenticated.';
comment on table public.job_post_contacts is 'Server-only (service role). RLS on with no policies by design: denies anon and authenticated.';
comment on table public.job_post_reports is 'Server-only (service role). RLS on with no policies by design: denies anon and authenticated.';
comment on table public.listing_events is 'Server-only (service role). RLS on with no policies by design: denies anon and authenticated.';
comment on table public.listing_selling_suspensions is 'Server-only (service role). RLS on with no policies by design: denies anon and authenticated.';
comment on table public.telegram_link_tokens is 'Server-only (service role). RLS on with no policies by design: denies anon and authenticated.';
