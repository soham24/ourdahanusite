-- /play in two round trips instead of nine.
--
-- get_play_public: everything public on the page in one call -- both
-- leaderboards, today's competition with its top 10, and past winners. The
-- India date is computed here, so a caller cannot ask about future days. The
-- site caches the result briefly and shares it between all visitors.
--
-- get_play_me: the signed-in player's own numbers in one call -- best this
-- week, best ever, whether they have a display name, and when they last
-- played (for the save cooldown). Returns null when nobody is signed in.
--
-- Additive: new functions only, existing objects untouched.

create or replace function public.get_play_public(p_game text)
 returns jsonb
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  with today as (
    select (now() at time zone 'Asia/Kolkata')::date as day
  ),
  comp as (
    select c.id, c.title, c.prize, c.day
    from game_competitions c, today t
    where c.game = p_game and c.day = t.day and c.active
  )
  select jsonb_build_object(
    'weekly', get_game_leaderboard(p_game, 'this_week'),
    'all_time', get_game_leaderboard(p_game, 'all_time'),
    'today', (
      select jsonb_build_object(
        'id', comp.id, 'title', comp.title, 'prize', comp.prize, 'day', comp.day,
        'board', get_competition_leaderboard(comp.id, 10)
      )
      from comp
    ),
    'past', get_past_competitions(p_game, (select day from today), 5)
  )
$function$;

create or replace function public.get_play_me(p_game text)
 returns jsonb
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select case when auth.uid() is null then null else jsonb_build_object(
    'best_week', (
      select max(gs.score) from game_scores gs
      where gs.user_id = auth.uid() and gs.game = p_game
        and gs.played_at >= date_trunc('week', now())
    ),
    'best_all', (
      select max(gs.score) from game_scores gs
      where gs.user_id = auth.uid() and gs.game = p_game
    ),
    'last_played_at', (
      select max(gs.played_at) from game_scores gs
      where gs.user_id = auth.uid() and gs.game = p_game
    ),
    'has_name', coalesce((
      select length(trim(p.full_name)) > 0 from profiles p where p.id = auth.uid()
    ), false)
  ) end
$function$;

revoke all on function public.get_play_public(text) from public, anon, authenticated;
revoke all on function public.get_play_me(text) from public, anon, authenticated;
grant execute on function public.get_play_public(text) to anon, authenticated, service_role;
grant execute on function public.get_play_me(text) to authenticated, service_role;
