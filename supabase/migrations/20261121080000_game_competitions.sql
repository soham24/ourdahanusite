-- Daily "Today's competition" for Chikoo Catcher.
-- Admins schedule one competition per day (title, prize, a shared code). Players
-- who enter the code have their rounds tagged with competition_id by the server.
-- The code never leaves the database: it lives in a table nobody but the
-- service role can read, and the public functions below never select it.
-- Additive and idempotent: existing rows are untouched.

create table if not exists public.game_competitions (
  id uuid primary key default gen_random_uuid(),
  game text not null default 'chikoo_catcher',
  day date not null,
  title text not null check (char_length(title) between 1 and 80),
  prize text not null check (char_length(prize) between 1 and 200),
  code text not null check (code ~ '^[A-Z0-9]{3,24}$'),
  active boolean not null default true,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (game, day)
);
alter table public.game_competitions enable row level security;
revoke all on table public.game_competitions from public, anon, authenticated;
grant all on table public.game_competitions to service_role;

alter table public.game_scores
  add column if not exists competition_id uuid references public.game_competitions (id) on delete set null;
create index if not exists game_scores_competition_idx
  on public.game_scores (competition_id, score desc, played_at);

create table if not exists public.game_competition_exclusions (
  competition_id uuid not null references public.game_competitions (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  reason text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (competition_id, user_id)
);
alter table public.game_competition_exclusions enable row level security;
revoke all on table public.game_competition_exclusions from public, anon, authenticated;
grant all on table public.game_competition_exclusions to service_role;

-- Players can only insert plain scores from the API; competition entries are
-- tagged by the server (service role) after it checks the code.
alter policy "Users can submit their own score" on public.game_scores
  with check ((select auth.uid()) = user_id and competition_id is null);

create or replace function public.get_today_competition(p_game text, p_day date)
 returns jsonb
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select (
    select jsonb_build_object('id', c.id, 'title', c.title, 'prize', c.prize, 'day', c.day)
    from game_competitions c
    where c.game = p_game and c.day = p_day and c.active
  )
$function$;

-- One ranking for the live board and the past podium, so they cannot drift:
-- best score first, then whoever reached that best score earliest, then user id.
-- Internal: not granted to anyone but the functions below (which run as owner).
create or replace function public.competition_standings(p_competition uuid)
 returns table (user_id uuid, full_name text, best_score int, reached_at timestamptz, rank bigint)
 language sql
 stable
 set search_path to 'public'
as $function$
  select s.user_id, s.full_name, s.best_score, s.reached_at,
         row_number() over (order by s.best_score desc, s.reached_at asc, s.user_id) as rank
  from (
    select
      gs.user_id,
      p.full_name,
      max(gs.score)::int as best_score,
      min(gs.played_at) filter (where gs.score = (
        select max(g2.score) from game_scores g2
        where g2.competition_id = p_competition and g2.user_id = gs.user_id
      )) as reached_at
    from game_scores gs
    join profiles p on p.id = gs.user_id
    where gs.competition_id = p_competition
      and not exists (
        select 1 from game_competition_exclusions e
        where e.competition_id = p_competition and e.user_id = gs.user_id
      )
    group by gs.user_id, p.full_name
  ) s
$function$;

create or replace function public.get_competition_leaderboard(p_competition uuid, p_limit int)
 returns jsonb
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select coalesce(jsonb_agg(row_to_json(t) order by t.rank), '[]'::jsonb)
  from (
    select st.full_name, st.best_score, st.reached_at, st.rank
    from competition_standings(p_competition) st
    order by st.rank
    limit least(greatest(coalesce(p_limit, 10), 0), 50)
  ) t
$function$;

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
          limit 3
        ) t
      ) as top
    from game_competitions gc
    where gc.game = p_game and gc.active and gc.day < p_before
    order by gc.day desc
    limit least(greatest(coalesce(p_limit, 10), 0), 20)
  ) c
$function$;

revoke all on function public.competition_standings(uuid) from public, anon, authenticated;

revoke all on function public.get_today_competition(text, date) from public, anon, authenticated;
revoke all on function public.get_competition_leaderboard(uuid, int) from public, anon, authenticated;
revoke all on function public.get_past_competitions(text, date, int) from public, anon, authenticated;
grant execute on function public.get_today_competition(text, date) to anon, authenticated, service_role;
grant execute on function public.get_competition_leaderboard(uuid, int) to anon, authenticated, service_role;
grant execute on function public.get_past_competitions(text, date, int) to anon, authenticated, service_role;
