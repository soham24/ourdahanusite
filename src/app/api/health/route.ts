/**
 * Health check for uptime monitoring (.github/workflows/uptime.yml, or any
 * external monitor): 200 when the app can read the database, 503 when it
 * cannot. One tiny public read; never cached; says nothing a visitor could
 * not already see.
 */

import { connection } from 'next/server'

import { createPublicClient } from '@/lib/supabase/public'

export async function GET() {
  await connection()

  const started = Date.now()
  let database: 'ok' | 'down' = 'down'
  try {
    const { error } = await createPublicClient().from('pricing_config').select('id').eq('id', 1).maybeSingle()
    if (!error) database = 'ok'
  } catch {
    // Not configured or unreachable: reported as down below.
  }

  const ok = database === 'ok'
  return Response.json(
    {
      ok,
      database,
      ms: Date.now() - started,
      // Which deployment answered, so an alert says what was live at the time.
      commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? null,
    },
    { status: ok ? 200 : 503, headers: { 'Cache-Control': 'no-store' } },
  )
}
