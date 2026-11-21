import 'server-only'

import { cacheLife, cacheTag } from 'next/cache'
import { cookies } from 'next/headers'

import { CACHE_TAGS } from '@/lib/cache-tags'
import { readOrThrow } from '@/lib/data/read'
import { createClient } from '@/lib/supabase/server'
import { createPublicClient } from '@/lib/supabase/public'
import { EMPTY_PLAY_PUBLIC, toPlayMe, toPlayPublic, type PlayMe, type PlayPublic } from './play-shape'

export type { PlayMe, PlayPublic }

const GAME_ID = 'chikoo_catcher'

/** The bundle functions are newer than the generated types; narrow to the call shape used. */
type RpcClient = {
  rpc(fn: string, args: Record<string, unknown>): PromiseLike<{ data: unknown; error: { message: string } | null }>
}

async function loadPlayPublic(): Promise<PlayPublic> {
  'use cache: remote'

  // Serve for 30 s, then refresh in the background while visitors keep getting
  // the last good copy. A failed read throws, so it is never cached as "empty".
  cacheLife({ stale: 30, revalidate: 30, expire: 3600 })
  cacheTag(CACHE_TAGS.game)

  const client = createPublicClient() as unknown as RpcClient
  const data = readOrThrow(await client.rpc('get_play_public', { p_game: GAME_ID }), 'play page')
  return toPlayPublic(data)
}

export async function getPlayPublic(): Promise<PlayPublic> {
  try {
    return await loadPlayPublic()
  } catch {
    return EMPTY_PLAY_PUBLIC
  }
}

const AUTH_COOKIE = /^sb-[A-Za-z0-9_-]+-auth-token(?:\.\d+)?$/

/**
 * The signed-in player's numbers, or null. Visitors without a sign-in cookie
 * cost nothing; signed-in ones cost one call (PostgREST checks the session
 * token itself, so there is no separate auth-server round trip).
 */
export async function getPlayMe(): Promise<PlayMe | null> {
  const cookieStore = await cookies()
  if (!cookieStore.getAll().some((c) => AUTH_COOKIE.test(c.name))) return null
  try {
    const supabase = (await createClient()) as unknown as RpcClient
    const { data, error } = await supabase.rpc('get_play_me', { p_game: GAME_ID })
    if (error) return null
    return toPlayMe(data)
  } catch {
    return null
  }
}

/** The same numbers from inside a server action that already has a client. */
export async function readPlayMe(client: unknown): Promise<PlayMe | null> {
  const { data, error } = await (client as RpcClient).rpc('get_play_me', { p_game: GAME_ID })
  if (error) throw new Error(`Could not read player stats: ${error.message}`)
  return toPlayMe(data)
}
