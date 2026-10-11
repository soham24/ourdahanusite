-- Retire public_profiles, now that the app reads names through
-- get_profile_names. On production this must run only after the code that
-- stopped reading the view is deployed, or reviewer names disappear until it
-- is.
drop view if exists public.public_profiles;
