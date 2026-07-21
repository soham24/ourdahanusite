# Chikoo Catcher Mini-Game

**Date:** 2026-07-21
**Status:** Design approved, ready for implementation plan

## Summary

A simple, replayable HTML5 canvas arcade game on a new `/play` page: catch falling
chikoos (Dahanu's signature fruit crop) in a basket, avoid rotten ones and pests,
game ends after 3 misses or 3 bad catches. Anyone can play without logging in;
signed-in players get their score saved to a public leaderboard (This Week / All-Time,
top 10 each, one row per player showing their personal best). Goal: give people a
quick, fun, on-brand reason to open the site and come back — not a core business
feature.

## Goals

- A genuinely easy-to-pick-up, replayable game themed around Dahanu (chikoo farming).
- Works well on mobile (drag-to-move) and desktop (arrow keys / mouse-move) — this
  site's traffic skews mobile.
- Public leaderboard: This Week top 10 and All-Time top 10, one row per player
  (their personal best), refreshed on every page load.
- No login required to play; login required only to save a score.
- No new runtime dependencies — plain `<canvas>` + `requestAnimationFrame`.

## Non-Goals (YAGNI)

- No server-authoritative game simulation or replay verification — this is a fun
  side feature, not a competition with real stakes. Anti-cheat is limited to a
  sane score ceiling (derived from the game's own difficulty math) and a short
  per-user submission cooldown, both enforced in the `submitGameScore` server
  action. A determined attacker could still fake a request; not worth building
  more for this.
- No difficulty levels, power-ups, sound effects, or multiple game modes for v1.
- No per-user score *history* view (just "your best this week" / "your best
  all-time" shown next to the leaderboard, not a full play log) — revisit if
  requested later.
- No admin moderation UI for scores — if abuse ever happens, it's a manual DB
  fix, not worth building tooling for at this scale.
- Does not touch any existing page, nav structure beyond adding one link, or
  other feature area.

## Game Design

**Canvas game** (`ChikooCatcherGame.tsx`, client component):

- A `<canvas>` roughly 360×560 (scales to container width, capped so it doesn't
  get absurdly tall on desktop).
- A basket sprite (simple drawn shape + 🧺 or similar) at the bottom, moved via:
  - **Desktop:** left/right arrow keys, or mouse-move (basket follows cursor x
    position, clamped to canvas bounds).
  - **Mobile:** touch-drag anywhere on the canvas moves the basket to the touch
    x position.
- Falling objects spawn from the top at random x positions:
  - **Good chikoos** (🟤/🥝-style drawn circle, or an emoji-based sprite) — catching
    one is `+1` to score.
  - **Bad drops** (rotten chikoo / pest, visually distinct — greyed out or with a
    bug icon) — catching one counts as a "bad catch."
  - Roughly 1-in-4 spawns are bad, tunable during implementation.
- **Difficulty ramp:** fall speed and spawn rate both increase gradually with
  elapsed time (e.g. every 10 seconds, speed +8%, spawn interval -5%, both capped
  at a maximum so the game doesn't become physically unplayable). This is also
  what keeps a legitimate score bounded — see Anti-abuse below.
- **Game over condition:** 3 "misses" (a good chikoo reaches the bottom
  uncaught) OR 3 "bad catches" (basket touches a bad drop) — whichever comes
  first. A HUD shows current score and remaining lives (of each kind, or a
  single combined "3 strikes" counter — implementation's call, doesn't need a
  design decision here since it's cosmetic).
- **Score** = total good chikoos caught in the round.
- On game over: show final score, and:
  - **Signed in:** immediately call `submitGameScore(score)` (server action);
    show "Saved to the leaderboard!" or "New personal best!" (compare against
    the player's previous best, fetched once per page load) once it resolves.
    Show a subtle error state if the submission fails (e.g. rate-limited) —
    the score isn't lost from view, just not saved.
  - **Signed out:** show "Sign in to save your score to the leaderboard" with a
    link to `/login?next=/play` (same redirect-back pattern used elsewhere on
    the site, e.g. `AppointmentBooking.tsx`, `QASection.tsx`).
  - A "Play again" button resets and starts a fresh round either way.

## Data Model

**New table `game_scores`** (one row per play, not per player — required so the
weekly leaderboard can filter by date without destroying history the way an
upsert-to-best model would):

```sql
create table public.game_scores (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  game text not null default 'chikoo_catcher',
  score int not null check (score >= 0 and score <= 500),
  played_at timestamptz not null default now()
);

create index game_scores_leaderboard_idx on public.game_scores (game, played_at desc, score desc);
create index game_scores_user_idx on public.game_scores (user_id, game);
```

- `game` column is included (even though there's only one game today) so a
  future second mini-game can reuse this table instead of needing a migration —
  cheap to add now, not scope creep since it's a single default-valued column.
- The `score <= 500` check is the sanity ceiling: at the difficulty ramp's
  fastest sustainable catch rate, ~500 is comfortably above what's achievable
  in a realistic multi-minute round, so it rejects obviously-forged submissions
  without constraining real play. Exact number gets tuned once the game's
  actual difficulty curve is implemented and playtested — the plan should
  treat this as "pick a number ~2-3x the highest score a careful human
  playtester can reach," not a hardcoded guess shipped blind.

**RLS policies** (mirroring the existing `poll_votes` pattern in this project):

```sql
alter table public.game_scores enable row level security;

create policy "Users can submit their own score"
  on public.game_scores for insert
  with check (auth.uid() = user_id);

create policy "Scores are public"
  on public.game_scores for select
  using (true);
```

**Leaderboard RPC** (same style as `get_homepage_stats()` / `get_admin_find_counts()`
— `SECURITY DEFINER` so it can join `profiles` for display names without needing
a broad public SELECT policy on `profiles`):

```sql
create or replace function public.get_game_leaderboard(p_game text, p_scope text)
returns jsonb
language sql
stable
security definer
set search_path to 'public'
as $$
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
$$;
```

- `p_scope` is `'this_week'` or `'all_time'`. Called twice per page load (once
  per scope) — cheap enough at this table size not to warrant combining into
  one call.
- Only ever returns `full_name` and `best_score` — never `user_id` or `email`,
  since this is rendered on a public page. If `full_name` is null (rare —
  Google OAuth normally populates it), the fetcher substitutes `"Anonymous
  Player"` in the application layer, not the SQL, so the fallback string lives
  in one place (`src/lib/data/game.ts`) rather than duplicated per query.

## Server Action — `submitGameScore`

`src/app/actions/game.ts`:

```ts
'use server'

export async function submitGameScore(score: number): Promise<{ error?: string; isNewBest?: boolean }>
```

- Requires an authenticated user (via the normal `createClient()` session
  client) — returns `{ error: 'Please sign in to save your score.' }` if not
  signed in (the client only calls this when signed in anyway, so this is a
  defensive check, not the primary gate).
- Validates `score` is an integer in `[0, 500]` (matching the DB check
  constraint — reject before hitting the DB for a clearer error message).
- **Cooldown:** rejects with `{ error: 'Please wait a moment before submitting again.' }`
  if the same user submitted a score for this game within the last 20 seconds
  (a plausible minimum real-game-round duration) — a cheap query for the
  user's most recent `played_at` before inserting.
- Inserts the row via the session client (RLS enforces `user_id = auth.uid()`,
  no admin client needed).
- Computes `isNewBest` by comparing against the user's previous max score
  (queried before the insert) so the UI can show "New personal best!"
  specifically, not just "Saved."
- No `revalidatePath` needed — the leaderboard is read fresh via `page.tsx`'s
  own server-side fetch on next navigation; the game page itself will
  re-fetch leaderboard data via `router.refresh()` after a successful
  submission so the just-played user sees the board update without a full
  reload.

## Files

- **New migration:** `game_scores` table, indexes, RLS policies,
  `get_game_leaderboard()` function (applied via the Supabase MCP
  `apply_migration` tool, same as prior migrations in this project —
  no local migration files are tracked in this repo).
- **New:** `src/app/play/page.tsx` — server component. Fetches both
  leaderboard scopes (and, if signed in, the current user's own best score
  for each scope) via `src/lib/data/game.ts`, renders the page shell +
  `<ChikooCatcherGame>` + `<Leaderboard>`.
- **New:** `src/app/play/ChikooCatcherGame.tsx` — client component: canvas
  game loop, input handling, game-over UI, calls `submitGameScore`.
- **New:** `src/app/play/Leaderboard.tsx` — presentational component:
  renders the This-Week / All-Time tables (tabs on mobile width, side-by-side
  on desktop) from server-fetched data; also renders "your rank" info if
  provided.
- **New:** `src/lib/data/game.ts` — `getGameLeaderboard(scope)`,
  `getUserBestScore(userId, scope)` — thin wrappers around the RPC /
  `game_scores` queries.
- **New:** `src/app/actions/game.ts` — `submitGameScore()`.
- **Modify:** `src/components/Navbar.tsx` — add a `Play` link (using the
  existing `buildAbsoluteUrl()` pattern, consistent with every other nav
  link in this file) to `NAV_LINKS` and `MOBILE_NAV`.
- **Modify:** `src/components/BottomTabBar.tsx` — add a `Play` tab (the plan
  should check this file's current tab count/grid layout before adding one,
  the same way the Jobs-removal work earlier adjusted `grid-cols-5` →
  `grid-cols-4` when a tab was removed — adding one here likely needs the
  reverse adjustment).
- **Modify:** `src/app/sitemap.ts` — add a static entry for `/play` (weekly
  change frequency, matching `/listings`'s treatment — it's evergreen,
  user-facing content).

## Testing

No test framework in this project — verification is `npx tsc --noEmit`,
`npx eslint <touched files>`, `npm run build`, and manual browser play-testing
(signed in and signed out, desktop and mobile-width) since this is a highly
interactive canvas UI that automated type-checking can't meaningfully verify.
Playtesting also directly informs the final score-ceiling constant (see Data
Model above) — it should be picked from an actual measured high score during
this manual testing pass, not guessed.
