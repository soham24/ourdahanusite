-- Two leftovers now that /play reads everything through get_play_public.
--
-- 1. get_today_competition and get_past_competitions take the day from the
--    caller, so anyone could ask for a future day and read its title and prize
--    before the owner announces it (never the code). The site no longer calls
--    them directly: get_play_public works out the India date itself and calls
--    them as the function owner. Visitors and signed-in players lose direct
--    access; get_play_public and the service role keep working.
--
-- 2. Nothing subscribes to Realtime any more (the notification bell polls
--    since PR #143), but while public.notifications is in the
--    supabase_realtime publication the Realtime server keeps decoding the
--    write-ahead log for it. Taking the table out stops that work. Adding it
--    back is one statement: alter publication supabase_realtime add table
--    public.notifications;
--
-- No data changes.

revoke execute on function public.get_today_competition(text, date) from public, anon, authenticated;
revoke execute on function public.get_past_competitions(text, date, integer) from public, anon, authenticated;

do $$
begin
  if exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notifications'
  ) then
    alter publication supabase_realtime drop table public.notifications;
  end if;
end
$$;
