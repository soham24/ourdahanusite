-- Show the top 20 instead of the top 10 on today's competition board and
-- instead of the podium (top 3) for each past competition.
--
-- Same functions, same arguments and the same permissions (create or replace
-- keeps the existing grants, so get_past_competitions stays closed to
-- visitors and players). Only two limits change. No data changes.

create or replace function public.get_past_competitions(p_game text, p_before date, p_limit int)
 returns jsonb
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select coalesce(jsonb_agg(row_to_json(c) order by c.day desc), '[]'::jsonb)
  from (
    select
      gc.id, gc.title, gc.prize, gc.day,
      (
        select coalesce(jsonb_agg(row_to_json(t) order by t.rank), '[]'::jsonb)
        from (
          select st.full_name, st.best_score, st.rank
          from competition_standings(gc.id) st
          order by st.rank
          limit 20
        ) t
      ) as top
    from game_competitions gc
    where gc.game = p_game and gc.active and gc.day < p_before
    order by gc.day desc
    limit least(greatest(coalesce(p_limit, 10), 0), 20)
  ) c
$function$;

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
        'board', get_competition_leaderboard(comp.id, 20)
      )
      from comp
    ),
    'past', get_past_competitions(p_game, (select day from today), 5)
  )
$function$;
