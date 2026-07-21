# Chikoo Catcher Mini-Game Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a simple canvas arcade mini-game ("Chikoo Catcher") at `/play` with a public This-Week / All-Time top-10 leaderboard, to give visitors a fun, on-brand reason to spend more time on the site.

**Architecture:** A plain `<canvas>` + `requestAnimationFrame` game loop (no game library, no new dependencies) running entirely client-side. Every completed round is stored as its own row in a new `game_scores` table (never overwritten — required so "this week" can be computed by date filtering without losing history). A `SECURITY DEFINER` Postgres RPC (`get_game_leaderboard`) aggregates to each player's personal-best for the requested scope and joins `profiles` for display names, mirroring the existing `get_homepage_stats()` pattern in this codebase. Saving a score requires sign-in; playing does not.

**Tech Stack:** Next.js 16 App Router (server components + `'use server'` actions), Supabase Postgres, plain Canvas 2D API, Tailwind CSS, lucide-react icons. No test framework in this project.

## Global Constraints

- No test framework in this repo — every task's verification is `npx tsc --noEmit`, `npx eslint <files>`, and for the final integration task, `npm run build` plus manual browser playtesting (this game is a highly interactive canvas UI that type-checking alone cannot verify).
- No new runtime dependencies — the game must be built with plain `<canvas>`/`requestAnimationFrame`, not a game library.
- Playing requires no login. Saving a score to the leaderboard requires sign-in.
- The public leaderboard must only ever display `profiles.full_name` (falling back to `"Anonymous Player"`) — never a `user_id` or email, since this page has no auth gate.
- The `game_scores.score` check constraint ceiling (`<= 500` below) is a starting value, not a final one — Task 6's manual playtest step is where this gets validated against an actual measured high score and adjusted if needed, per the design spec's explicit instruction not to ship a blind guess.
- Supabase project `slmbqngmxketyxjauxxk` is **live production** — the migration in Task 1 is additive-only (new table, new function), touching no existing schema.

---

### Task 1: Database migration — `game_scores` table, RLS, leaderboard RPC

**Files:**
- Migration: applied via the `apply_migration` MCP tool (project `slmbqngmxketyxjauxxk`) — no local migration files are tracked in this repo.
- Modify: `src/lib/database.types.ts` (regenerated, never hand-edited).

**Interfaces:**
- Produces: table `public.game_scores(id, user_id, game, score, played_at)`.
- Produces: Postgres function `get_game_leaderboard(p_game text, p_scope text)` returning `jsonb` — an array of `{ full_name: string | null, best_score: number }`, sorted descending, limited to 10. `p_scope` is `'this_week'` or `'all_time'`.
- Consumed by: `src/lib/data/game.ts` (Task 2) via `.rpc('get_game_leaderboard', { p_game, p_scope })`, and directly via `.from('game_scores')` for the per-user "best score" query and the `submitGameScore` action (Task 3).

- [ ] **Step 1: Apply the migration**

Call the `apply_migration` MCP tool with `project_id: "slmbqngmxketyxjauxxk"`, `name: "add_game_scores"`, and this `query`:

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

alter table public.game_scores enable row level security;

create policy "Users can submit their own score"
  on public.game_scores for insert
  with check (auth.uid() = user_id);

create policy "Scores are public"
  on public.game_scores for select
  using (true);

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

- [ ] **Step 2: Verify the table, policies, and function exist**

Call `execute_sql` with `project_id: "slmbqngmxketyxjauxxk"`:

```sql
select tablename, policyname, cmd from pg_policies where tablename = 'game_scores';
```

Expected: 2 rows — `("game_scores", "Users can submit their own score", "INSERT")` and `("game_scores", "Scores are public", "SELECT")`.

```sql
select get_game_leaderboard('chikoo_catcher', 'this_week');
select get_game_leaderboard('chikoo_catcher', 'all_time');
```

Expected: both return `[]` (the table is empty — this just confirms the function runs without a SQL error).

- [ ] **Step 3: Regenerate `src/lib/database.types.ts`**

Call the `generate_typescript_types` MCP tool with `project_id: "slmbqngmxketyxjauxxk"`. Read the current file with the Read tool first (required before Write can overwrite it), then Write the tool's full output over it.

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/lib/database.types.ts
git commit -m "feat(game): add game_scores table, RLS, and leaderboard RPC"
```

---

### Task 2: Leaderboard data fetchers

**Files:**
- Create: `src/lib/data/game.ts`

**Interfaces:**
- Consumes: `createPublicClient` from `@/lib/supabase/public` (existing); `get_game_leaderboard` RPC and `game_scores` table (Task 1).
- Produces: `export type LeaderboardScope = 'this_week' | 'all_time'`, `export interface LeaderboardEntry { name: string; score: number }`, `export async function getGameLeaderboard(scope: LeaderboardScope): Promise<LeaderboardEntry[]>`, `export async function getUserBestScore(userId: string, scope: LeaderboardScope): Promise<number | null>` — all consumed by `page.tsx` (Task 6) and `LeaderboardEntry` also consumed by `Leaderboard.tsx` (Task 5, as a type-only import — do not redefine this interface there).

- [ ] **Step 1: Create the file**

```ts
import 'server-only'

import { createPublicClient } from '@/lib/supabase/public'

export type LeaderboardScope = 'this_week' | 'all_time'

export interface LeaderboardEntry {
  name: string
  score: number
}

const GAME_ID = 'chikoo_catcher'

export async function getGameLeaderboard(scope: LeaderboardScope): Promise<LeaderboardEntry[]> {
  try {
    const supabase = createPublicClient()
    const { data } = await supabase.rpc('get_game_leaderboard', {
      p_game: GAME_ID,
      p_scope: scope,
    })
    const rows = (data ?? []) as { full_name: string | null; best_score: number }[]
    return rows.map((r) => ({
      name: r.full_name?.trim() || 'Anonymous Player',
      score: r.best_score,
    }))
  } catch {
    return []
  }
}

function startOfThisWeekUtc(): Date {
  const now = new Date()
  const day = now.getUTCDay()
  const diffToMonday = (day + 6) % 7
  const monday = new Date(now)
  monday.setUTCDate(now.getUTCDate() - diffToMonday)
  monday.setUTCHours(0, 0, 0, 0)
  return monday
}

export async function getUserBestScore(userId: string, scope: LeaderboardScope): Promise<number | null> {
  try {
    const supabase = createPublicClient()
    let query = supabase
      .from('game_scores')
      .select('score')
      .eq('user_id', userId)
      .eq('game', GAME_ID)
      .order('score', { ascending: false })
      .limit(1)

    if (scope === 'this_week') {
      query = query.gte('played_at', startOfThisWeekUtc().toISOString())
    }

    const { data } = await query.maybeSingle()
    return (data as { score: number } | null)?.score ?? null
  } catch {
    return null
  }
}
```

`startOfThisWeekUtc()` computes the Monday-start-of-week in UTC to match Postgres's `date_trunc('week', ...)`, which truncates to the ISO-8601 Monday of the current week — this keeps the JS-side "this week" filter consistent with the RPC's SQL-side one.

- [ ] **Step 2: Type-check and lint**

Run: `npx tsc --noEmit && npx eslint src/lib/data/game.ts`
Expected: no errors, no warnings.

- [ ] **Step 3: Commit**

```bash
git add src/lib/data/game.ts
git commit -m "feat(game): add leaderboard and best-score data fetchers"
```

---

### Task 3: `submitGameScore` server action

**Files:**
- Create: `src/app/actions/game.ts`

**Interfaces:**
- Consumes: `createClient` from `@/lib/supabase/server` (existing, session-aware client — same pattern as `castVote` in `src/app/actions/polls.ts`).
- Produces: `export async function submitGameScore(score: number): Promise<{ error?: string; isNewBest?: boolean }>`, consumed by `ChikooCatcherGame.tsx` (Task 4).

- [ ] **Step 1: Create the file**

```ts
'use server'

import { createClient } from '@/lib/supabase/server'

const GAME_ID = 'chikoo_catcher'
const MAX_SCORE = 500
const COOLDOWN_MS = 20_000

export async function submitGameScore(
  score: number,
): Promise<{ error?: string; isNewBest?: boolean }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Please sign in to save your score.' }

  if (!Number.isInteger(score) || score < 0 || score > MAX_SCORE) {
    return { error: 'Invalid score.' }
  }

  const { data: recent } = await supabase
    .from('game_scores')
    .select('played_at')
    .eq('user_id', user.id)
    .eq('game', GAME_ID)
    .order('played_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (recent?.played_at) {
    const elapsed = Date.now() - new Date(recent.played_at as string).getTime()
    if (elapsed < COOLDOWN_MS) {
      return { error: 'Please wait a moment before submitting again.' }
    }
  }

  const { data: best } = await supabase
    .from('game_scores')
    .select('score')
    .eq('user_id', user.id)
    .eq('game', GAME_ID)
    .order('score', { ascending: false })
    .limit(1)
    .maybeSingle()

  const previousBest = (best as { score: number } | null)?.score ?? 0

  const { error } = await supabase.from('game_scores').insert({
    user_id: user.id,
    game: GAME_ID,
    score,
  })

  if (error) return { error: 'Could not save your score. Please try again.' }

  return { isNewBest: score > previousBest }
}
```

This uses the regular session client (not the admin client) for the insert — the `"Users can submit their own score"` RLS policy from Task 1 (`with check (auth.uid() = user_id)`) enforces that a signed-in user can only insert rows for themselves, exactly like `castVote` in `src/app/actions/polls.ts` relies on RLS for `poll_votes`.

- [ ] **Step 2: Type-check and lint**

Run: `npx tsc --noEmit && npx eslint src/app/actions/game.ts`
Expected: no errors, no warnings.

- [ ] **Step 3: Commit**

```bash
git add src/app/actions/game.ts
git commit -m "feat(game): add submitGameScore server action"
```

---

### Task 4: `ChikooCatcherGame` — the canvas game

**Files:**
- Create: `src/app/play/ChikooCatcherGame.tsx`

**Interfaces:**
- Consumes: `submitGameScore` from `@/app/actions/game` (Task 3); `buildAbsoluteUrl` from `@/lib/site` (existing).
- Produces: `export default function ChikooCatcherGame({ isSignedIn }: { isSignedIn: boolean })`, consumed by `page.tsx` (Task 6).

- [ ] **Step 1: Create the file**

```tsx
'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { PointerEvent } from 'react'
import { useRouter } from 'next/navigation'
import { submitGameScore } from '@/app/actions/game'
import { buildAbsoluteUrl } from '@/lib/site'

const CANVAS_WIDTH = 360
const CANVAS_HEIGHT = 520
const BASKET_WIDTH = 70
const BASKET_HEIGHT = 36
const BASKET_Y = CANVAS_HEIGHT - 50
const ITEM_RADIUS = 16
const BAD_ITEM_CHANCE = 0.25
const BASE_FALL_SPEED = 110 // px/sec
const MAX_FALL_SPEED = 340
const BASE_SPAWN_INTERVAL = 950 // ms
const MIN_SPAWN_INTERVAL = 380
const RAMP_INTERVAL_MS = 10_000
const RAMP_SPEED_FACTOR = 1.08
const RAMP_SPAWN_FACTOR = 0.93
const MAX_MISSES = 3
const MAX_BAD_CATCHES = 3
const KEY_SPEED = 260 // px/sec

interface FallingItem {
  id: number
  x: number
  y: number
  isBad: boolean
}

type GameState = 'idle' | 'playing' | 'over'
type SubmitState = 'idle' | 'saving' | 'saved' | 'best' | 'error'

export default function ChikooCatcherGame({ isSignedIn }: { isSignedIn: boolean }) {
  const router = useRouter()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [gameState, setGameState] = useState<GameState>('idle')
  const [score, setScore] = useState(0)
  const [misses, setMisses] = useState(0)
  const [badCatches, setBadCatches] = useState(0)
  const [submitState, setSubmitState] = useState<SubmitState>('idle')
  const [submitError, setSubmitError] = useState('')

  // Mutable game state that must not trigger a re-render every frame.
  const basketXRef = useRef(CANVAS_WIDTH / 2)
  const itemsRef = useRef<FallingItem[]>([])
  const nextIdRef = useRef(0)
  const lastSpawnRef = useRef(0)
  const lastFrameRef = useRef(0)
  const elapsedRef = useRef(0)
  const rafRef = useRef<number | null>(null)
  const scoreRef = useRef(0)
  const missesRef = useRef(0)
  const badCatchesRef = useRef(0)

  const draw = useCallback((ctx: CanvasRenderingContext2D) => {
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)

    ctx.fillStyle = '#FBF0DC'
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)

    for (const item of itemsRef.current) {
      ctx.beginPath()
      ctx.arc(item.x, item.y, ITEM_RADIUS, 0, Math.PI * 2)
      ctx.fillStyle = item.isBad ? '#6b7280' : '#C0582E'
      ctx.fill()
      if (item.isBad) {
        ctx.beginPath()
        ctx.arc(item.x - 5, item.y - 4, 3, 0, Math.PI * 2)
        ctx.fillStyle = '#374151'
        ctx.fill()
      }
    }

    const basketX = basketXRef.current
    ctx.fillStyle = '#7A4520'
    ctx.fillRect(basketX - BASKET_WIDTH / 2, BASKET_Y, BASKET_WIDTH, BASKET_HEIGHT)
    ctx.strokeStyle = '#3D1A08'
    ctx.lineWidth = 2
    ctx.strokeRect(basketX - BASKET_WIDTH / 2, BASKET_Y, BASKET_WIDTH, BASKET_HEIGHT)
  }, [])

  const endGame = useCallback((finalScore: number) => {
    setGameState('over')
    if (rafRef.current) cancelAnimationFrame(rafRef.current)

    if (!isSignedIn) return

    setSubmitState('saving')
    submitGameScore(finalScore).then((res) => {
      if (res.error) {
        setSubmitError(res.error)
        setSubmitState('error')
        return
      }
      setSubmitState(res.isNewBest ? 'best' : 'saved')
      router.refresh()
    })
  }, [isSignedIn, router])

  const tick = useCallback((time: number) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    if (!lastFrameRef.current) lastFrameRef.current = time
    const dt = Math.min(time - lastFrameRef.current, 50)
    lastFrameRef.current = time
    elapsedRef.current += dt

    const ramps = Math.floor(elapsedRef.current / RAMP_INTERVAL_MS)
    const fallSpeed = Math.min(BASE_FALL_SPEED * Math.pow(RAMP_SPEED_FACTOR, ramps), MAX_FALL_SPEED)
    const spawnInterval = Math.max(BASE_SPAWN_INTERVAL * Math.pow(RAMP_SPAWN_FACTOR, ramps), MIN_SPAWN_INTERVAL)

    if (time - lastSpawnRef.current > spawnInterval) {
      lastSpawnRef.current = time
      itemsRef.current.push({
        id: nextIdRef.current++,
        x: ITEM_RADIUS + Math.random() * (CANVAS_WIDTH - ITEM_RADIUS * 2),
        y: -ITEM_RADIUS,
        isBad: Math.random() < BAD_ITEM_CHANCE,
      })
    }

    const remaining: FallingItem[] = []
    for (const item of itemsRef.current) {
      const newY = item.y + fallSpeed * (dt / 1000)
      const caught =
        newY + ITEM_RADIUS >= BASKET_Y &&
        newY - ITEM_RADIUS <= BASKET_Y + BASKET_HEIGHT &&
        item.x >= basketXRef.current - BASKET_WIDTH / 2 &&
        item.x <= basketXRef.current + BASKET_WIDTH / 2

      if (caught) {
        if (item.isBad) {
          badCatchesRef.current += 1
          setBadCatches(badCatchesRef.current)
        } else {
          scoreRef.current += 1
          setScore(scoreRef.current)
        }
        continue
      }

      if (newY - ITEM_RADIUS > CANVAS_HEIGHT) {
        if (!item.isBad) {
          missesRef.current += 1
          setMisses(missesRef.current)
        }
        continue
      }

      remaining.push({ ...item, y: newY })
    }
    itemsRef.current = remaining

    draw(ctx)

    if (missesRef.current >= MAX_MISSES || badCatchesRef.current >= MAX_BAD_CATCHES) {
      endGame(scoreRef.current)
      return
    }

    rafRef.current = requestAnimationFrame(tick)
  }, [draw, endGame])

  const startGame = useCallback(() => {
    scoreRef.current = 0
    missesRef.current = 0
    badCatchesRef.current = 0
    itemsRef.current = []
    nextIdRef.current = 0
    lastSpawnRef.current = 0
    lastFrameRef.current = 0
    elapsedRef.current = 0
    basketXRef.current = CANVAS_WIDTH / 2
    setScore(0)
    setMisses(0)
    setBadCatches(0)
    setSubmitState('idle')
    setSubmitError('')
    setGameState('playing')
    rafRef.current = requestAnimationFrame(tick)
  }, [tick])

  // Initial paint so the canvas isn't blank-white before the first round starts.
  useEffect(() => {
    const ctx = canvasRef.current?.getContext('2d')
    if (ctx) draw(ctx)
  }, [draw])

  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [])

  useEffect(() => {
    if (gameState !== 'playing') return
    const held = new Set<string>()
    let keyFrame: number
    let lastKeyTime = 0

    const moveLoop = (time: number) => {
      if (!lastKeyTime) lastKeyTime = time
      const dt = (time - lastKeyTime) / 1000
      lastKeyTime = time
      if (held.has('ArrowLeft')) {
        basketXRef.current = Math.max(BASKET_WIDTH / 2, basketXRef.current - KEY_SPEED * dt)
      }
      if (held.has('ArrowRight')) {
        basketXRef.current = Math.min(CANVAS_WIDTH - BASKET_WIDTH / 2, basketXRef.current + KEY_SPEED * dt)
      }
      keyFrame = requestAnimationFrame(moveLoop)
    }
    keyFrame = requestAnimationFrame(moveLoop)

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') held.add(e.key)
    }
    const onKeyUp = (e: KeyboardEvent) => {
      held.delete(e.key)
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    return () => {
      cancelAnimationFrame(keyFrame)
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
    }
  }, [gameState])

  const handlePointerMove = (e: PointerEvent<HTMLCanvasElement>) => {
    if (gameState !== 'playing') return
    const rect = e.currentTarget.getBoundingClientRect()
    const scaleX = CANVAS_WIDTH / rect.width
    const x = (e.clientX - rect.left) * scaleX
    basketXRef.current = Math.max(BASKET_WIDTH / 2, Math.min(CANVAS_WIDTH - BASKET_WIDTH / 2, x))
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex w-full max-w-[360px] items-center justify-between text-sm font-semibold text-[var(--od-ink)]">
        <span>Score: {score}</span>
        <span>Misses: {misses}/{MAX_MISSES} · Bad catches: {badCatches}/{MAX_BAD_CATCHES}</span>
      </div>

      <div className="relative w-full max-w-[360px]">
        <canvas
          ref={canvasRef}
          width={CANVAS_WIDTH}
          height={CANVAS_HEIGHT}
          onPointerMove={handlePointerMove}
          className="w-full touch-none rounded-2xl border border-[var(--od-border)] shadow-sm"
          style={{ aspectRatio: `${CANVAS_WIDTH} / ${CANVAS_HEIGHT}` }}
        />

        {gameState !== 'playing' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 rounded-2xl bg-[rgba(61,26,8,0.75)] px-6 text-center text-white">
            {gameState === 'idle' && (
              <>
                <p className="text-lg font-bold">🧺 Chikoo Catcher</p>
                <p className="text-sm text-white/80">
                  Catch the good chikoos, dodge the rotten ones. 3 misses or 3 bad
                  catches ends the round.
                </p>
                <button type="button" onClick={startGame} className="od-button-primary px-5 py-2.5">
                  Start
                </button>
              </>
            )}

            {gameState === 'over' && (
              <>
                <p className="text-lg font-bold">Game over — score {score}</p>
                {isSignedIn ? (
                  <p className="text-sm text-white/80">
                    {submitState === 'saving' && 'Saving your score…'}
                    {submitState === 'best' && '🎉 New personal best!'}
                    {submitState === 'saved' && 'Score saved.'}
                    {submitState === 'error' && submitError}
                  </p>
                ) : (
                  <a
                    href={buildAbsoluteUrl(`/login?next=${encodeURIComponent('/play')}`)}
                    className="text-sm font-semibold text-[var(--od-brand)] underline"
                  >
                    Sign in to save your score →
                  </a>
                )}
                <button type="button" onClick={startGame} className="od-button-primary px-5 py-2.5">
                  Play again
                </button>
              </>
            )}
          </div>
        )}
      </div>

      <p className="text-xs text-[var(--od-muted)]">
        Desktop: arrow keys or mouse. Mobile: drag on the board.
      </p>
    </div>
  )
}
```

- [ ] **Step 2: Type-check and lint**

Run: `npx tsc --noEmit && npx eslint src/app/play/ChikooCatcherGame.tsx`
Expected: no errors, no warnings.

- [ ] **Step 3: Commit**

```bash
git add src/app/play/ChikooCatcherGame.tsx
git commit -m "feat(game): add Chikoo Catcher canvas game"
```

---

### Task 5: `Leaderboard` component

**Files:**
- Create: `src/app/play/Leaderboard.tsx`

**Interfaces:**
- Consumes: `type LeaderboardEntry` from `@/lib/data/game` (Task 2) — type-only import, do not redefine this interface locally.
- Produces: `export default function Leaderboard({ weekly, allTime, yourBestWeek, yourBestAllTime }: { weekly: LeaderboardEntry[]; allTime: LeaderboardEntry[]; yourBestWeek: number | null; yourBestAllTime: number | null })`, consumed by `page.tsx` (Task 6).

- [ ] **Step 1: Create the file**

```tsx
'use client'

import { useState } from 'react'
import type { LeaderboardEntry } from '@/lib/data/game'

export default function Leaderboard({
  weekly,
  allTime,
  yourBestWeek,
  yourBestAllTime,
}: {
  weekly: LeaderboardEntry[]
  allTime: LeaderboardEntry[]
  yourBestWeek: number | null
  yourBestAllTime: number | null
}) {
  const [tab, setTab] = useState<'week' | 'all_time'>('week')

  const renderTable = (entries: LeaderboardEntry[], yourBest: number | null) => (
    <div className="rounded-2xl border border-[var(--od-border)] bg-white p-4">
      {entries.length === 0 ? (
        <p className="py-6 text-center text-sm text-[var(--od-muted)]">
          No scores yet — be the first!
        </p>
      ) : (
        <ol className="space-y-1.5">
          {entries.map((entry, i) => (
            <li
              key={`${entry.name}-${i}`}
              className="flex items-center justify-between rounded-lg px-3 py-2 text-sm"
            >
              <span className="flex items-center gap-2">
                <span className="w-5 text-right font-bold text-[var(--od-brand)]">{i + 1}</span>
                <span className="font-medium text-[var(--od-ink)]">{entry.name}</span>
              </span>
              <span className="font-semibold">{entry.score}</span>
            </li>
          ))}
        </ol>
      )}
      {yourBest !== null && (
        <p className="mt-3 border-t border-[var(--od-border)] pt-3 text-center text-xs text-[var(--od-muted)]">
          Your best: <span className="font-semibold text-[var(--od-ink)]">{yourBest}</span>
        </p>
      )}
    </div>
  )

  return (
    <div className="w-full max-w-[420px]">
      <div className="mb-3 flex gap-2 md:hidden">
        <button
          type="button"
          onClick={() => setTab('week')}
          className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold ${
            tab === 'week' ? 'bg-[var(--od-ink)] text-white' : 'bg-gray-100 text-gray-700'
          }`}
        >
          This Week
        </button>
        <button
          type="button"
          onClick={() => setTab('all_time')}
          className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold ${
            tab === 'all_time' ? 'bg-[var(--od-ink)] text-white' : 'bg-gray-100 text-gray-700'
          }`}
        >
          All-Time
        </button>
      </div>

      <div className="hidden gap-4 md:grid md:grid-cols-2">
        <div>
          <h3 className="mb-2 text-center text-sm font-bold text-[var(--od-ink)]">This Week</h3>
          {renderTable(weekly, yourBestWeek)}
        </div>
        <div>
          <h3 className="mb-2 text-center text-sm font-bold text-[var(--od-ink)]">All-Time</h3>
          {renderTable(allTime, yourBestAllTime)}
        </div>
      </div>

      <div className="md:hidden">
        {tab === 'week' ? renderTable(weekly, yourBestWeek) : renderTable(allTime, yourBestAllTime)}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Type-check and lint**

Run: `npx tsc --noEmit && npx eslint src/app/play/Leaderboard.tsx`
Expected: no errors, no warnings.

- [ ] **Step 3: Commit**

```bash
git add src/app/play/Leaderboard.tsx
git commit -m "feat(game): add Leaderboard component"
```

---

### Task 6: `/play` page — integration + manual playtest

**Files:**
- Create: `src/app/play/page.tsx`

**Interfaces:**
- Consumes: `createClient` from `@/lib/supabase/server` (existing); `getGameLeaderboard`, `getUserBestScore` from `@/lib/data/game` (Task 2); `ChikooCatcherGame` (Task 4); `Leaderboard` (Task 5).
- Produces: the rendered `/play` route — nothing downstream consumes this file.

- [ ] **Step 1: Create the file**

```tsx
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { getGameLeaderboard, getUserBestScore } from '@/lib/data/game'
import ChikooCatcherGame from './ChikooCatcherGame'
import Leaderboard from './Leaderboard'

export const metadata: Metadata = {
  title: 'Chikoo Catcher — A Dahanu Mini-Game',
  description:
    "Catch falling chikoos, dodge the rotten ones, and climb the OurDahanu leaderboard. A quick, fun mini-game themed around Dahanu's signature fruit.",
}

export default async function PlayPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [weekly, allTime, yourBestWeek, yourBestAllTime] = await Promise.all([
    getGameLeaderboard('this_week'),
    getGameLeaderboard('all_time'),
    user ? getUserBestScore(user.id, 'this_week') : Promise.resolve(null),
    user ? getUserBestScore(user.id, 'all_time') : Promise.resolve(null),
  ])

  return (
    <div className="mx-auto flex max-w-4xl flex-col items-center gap-8 px-4 py-10">
      <div className="text-center">
        <h1 className="font-display text-3xl font-bold text-[var(--od-ink)]">
          🧺 Chikoo Catcher
        </h1>
        <p className="mt-2 text-sm text-[var(--od-muted)]">
          Catch the good chikoos, dodge the rotten ones — a quick Dahanu mini-game.
        </p>
      </div>

      <ChikooCatcherGame isSignedIn={Boolean(user)} />

      <Leaderboard
        weekly={weekly}
        allTime={allTime}
        yourBestWeek={yourBestWeek}
        yourBestAllTime={yourBestAllTime}
      />
    </div>
  )
}
```

- [ ] **Step 2: Type-check, lint, and build**

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `npx eslint src/app/play/page.tsx`
Expected: no errors, no warnings.

Run: `rm -rf .next && npm run build`
Expected: build succeeds; `/play` appears in the route table.

- [ ] **Step 3: Manual playtest in a real browser**

Start the dev server (`npm run dev`) and open `http://localhost:3000/play`.

1. **Signed out:** click Start, play a round (arrow keys or mouse on desktop, drag on a narrow/mobile-width window). Confirm the round ends after 3 misses or 3 bad catches, and confirm the game-over overlay shows "Sign in to save your score →" instead of a save confirmation.
2. **Signed in:** repeat, and confirm the game-over overlay shows "Saving your score…" then either "🎉 New personal best!" or "Score saved.", and that the leaderboard below updates (via `router.refresh()`) to include your new entry without a full page reload.
3. **Play several rounds signed in**, deliberately trying to maximize score, to find a realistic achievable high score. Compare it against the `score <= 500` check constraint from Task 1 and the `MAX_SCORE = 500` constant in `src/app/actions/game.ts` (Task 3) — per the Global Constraints, this ceiling should be picked from this measurement (roughly 2-3x your best measured score), not left as a blind guess. If your best playtested score is meaningfully far from 500 (e.g. under 60), lower both constants to a more realistic ceiling (e.g. 150) via a follow-up migration (`alter table game_scores drop constraint ...; alter table game_scores add constraint ... check (score >= 0 and score <= <new_value>);`) and a one-line edit to `MAX_SCORE` in `src/app/actions/game.ts` — otherwise, leave both at 500 and note the measured score in your task report.
4. **Cooldown:** immediately after a successful submission, quickly play and finish a second short round — confirm the second submission is rejected with "Please wait a moment before submitting again." if within 20 seconds of the first.
5. **Mobile width:** resize the browser to ~375px wide (or use a real mobile-width check) — confirm the canvas scales down proportionally (no overflow/cutoff), the leaderboard shows as tabs (This Week / All-Time) rather than side-by-side, and dragging on the canvas moves the basket.
6. **Empty state:** if this is the very first play ever recorded, confirm the leaderboard correctly shows "No scores yet — be the first!" before your first submission, and your entry after.

- [ ] **Step 4: Commit**

```bash
git add src/app/play/page.tsx
git commit -m "feat(game): add /play page integrating game and leaderboard"
```

(If Step 3's playtest changed the score ceiling, include that migration and the `MAX_SCORE` edit in this same commit, or a follow-up commit — controller's call based on the task report.)

---

### Task 7: Navigation wiring

**Files:**
- Modify: `src/components/Navbar.tsx`
- Modify: `src/components/BottomTabBar.tsx`
- Modify: `src/app/sitemap.ts`

**Interfaces:**
- No new exports — this task only adds links to existing navigation structures.

- [ ] **Step 1: Add a Play link to `Navbar.tsx`**

In `src/components/Navbar.tsx`, add a `Gamepad2` import to the existing lucide-react import line:

```tsx
import { Plus, Search, ShieldAlert, Store, UsersRound, Gamepad2 } from 'lucide-react'
```

Add a new entry to `NAV_LINKS` (after the existing `/search` entry):

```tsx
const NAV_LINKS = [
  { href: buildAbsoluteUrl('/listings'), label: 'Businesses' },
  { href: buildAbsoluteUrl('/search'), label: 'Search' },
  { href: buildAbsoluteUrl('/play'), label: 'Play' },
  { href: buildAbsoluteUrl('/about'), label: 'About' },
]
```

Add a new entry to `MOBILE_NAV` (after `/search`, before `/about`):

```tsx
const MOBILE_NAV = [
  { href: buildAbsoluteUrl('/listings'), label: 'Explore Businesses', icon: Store },
  { href: buildAbsoluteUrl('/search'), label: 'Search Everything', icon: Search },
  { href: buildAbsoluteUrl('/play'), label: 'Chikoo Catcher Game', icon: Gamepad2 },
  { href: buildAbsoluteUrl('/about'), label: 'About OurDahanu', icon: UsersRound },
  { href: buildAbsoluteUrl('/listings/submit'), label: 'Add Business', icon: Plus },
]
```

- [ ] **Step 2: Add a Play tab to `BottomTabBar.tsx`**

In `src/components/BottomTabBar.tsx`, add `Gamepad2` to the lucide-react import:

```tsx
import { Home, Store, Search, UserRound, Gamepad2 } from 'lucide-react'
```

Add a new entry to `TABS` (after `/search`, before `/dashboard`):

```tsx
const TABS = [
  { href: buildAbsoluteUrl('/'), matchPath: '/', label: 'Home', icon: Home },
  { href: buildAbsoluteUrl('/listings'), matchPath: '/listings', label: 'Listings', icon: Store },
  { href: buildAbsoluteUrl('/search'), matchPath: '/search', label: 'Search', icon: Search },
  { href: buildAbsoluteUrl('/play'), matchPath: '/play', label: 'Play', icon: Gamepad2 },
  { href: buildAbsoluteUrl('/dashboard'), matchPath: '/dashboard', label: 'Profile', icon: UserRound },
]
```

Change the grid from 4 columns to 5, since there are now 5 tabs:

```tsx
<div className="grid grid-cols-5">
```

- [ ] **Step 3: Add `/play` to the sitemap**

In `src/app/sitemap.ts`, add an entry to `staticRoutes` (after `/about`, before `/emergency`):

```ts
const staticRoutes: MetadataRoute.Sitemap = [
    { url: base, lastModified: STATIC_LAST_MODIFIED, changeFrequency: 'daily', priority: 1 },
    { url: `${base}/listings`, lastModified: STATIC_LAST_MODIFIED, changeFrequency: 'daily', priority: 0.9 },
    { url: `${base}/about`, lastModified: STATIC_LAST_MODIFIED, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${base}/play`, lastModified: STATIC_LAST_MODIFIED, changeFrequency: 'weekly', priority: 0.6 },
    { url: `${base}/emergency`, lastModified: STATIC_LAST_MODIFIED, changeFrequency: 'weekly', priority: 0.6 },
  ]
```

- [ ] **Step 4: Type-check, lint, and build**

Run: `npx tsc --noEmit && npx eslint src/components/Navbar.tsx src/components/BottomTabBar.tsx src/app/sitemap.ts`
Expected: no errors, no warnings.

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 5: Manual check**

Load the homepage in a real browser at both desktop and mobile widths. Confirm: "Play" appears in the desktop Navbar and links to `/play`; the mobile bottom tab bar shows 5 evenly-spaced tabs including "Play" with a game-controller icon; clicking/tapping it navigates to `/play`.

- [ ] **Step 6: Commit**

```bash
git add src/components/Navbar.tsx src/components/BottomTabBar.tsx src/app/sitemap.ts
git commit -m "feat(game): wire up /play in navigation and sitemap"
```

## Self-Review Notes

- **Spec coverage:** every section of the design spec (game mechanics, data model, RLS, RPC, server action, file list, testing approach) maps to a task above. The privacy requirement (never show `user_id`/email on the public leaderboard) is enforced in Task 2's `getGameLeaderboard` (`full_name` only, `"Anonymous Player"` fallback applied in the application layer as specified).
- **Placeholder scan:** no TBD/TODO markers. The one deliberately-flagged "starting value, not final" item (the `500` score ceiling) is explicitly called out with exact instructions for how to resolve it (Task 6, Step 3) rather than left vague.
- **Type consistency:** `LeaderboardEntry` is defined once (Task 2, `src/lib/data/game.ts`) and imported as a type in `Leaderboard.tsx` (Task 5) rather than redefined; `LeaderboardScope` (`'this_week' | 'all_time'`) is used identically in `getGameLeaderboard`, `getUserBestScore`, and `page.tsx`'s calls to both; `submitGameScore`'s return shape (`{ error?, isNewBest? }`) matches exactly between Task 3's definition and Task 4's consumption in `ChikooCatcherGame.tsx`.
