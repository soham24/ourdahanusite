import { NextResponse } from 'next/server'

import { createClient } from '@/lib/supabase/server'

const ANON_VIEWER = {
  isLoggedIn: false,
  userVote: null,
} as const

// Never edge-cached, even signed out: the URL is the same for signed-in
// voters, and a shared signed-out answer could hide their vote. PollCard only
// calls this with a session cookie, so this case is just expired sessions.
const ANON_CACHE_HEADERS = {
  'Cache-Control': 'private, no-store',
} as const

const PRIVATE_HEADERS = {
  'Cache-Control': 'private, no-store',
} as const

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id: pollId } = await context.params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json(ANON_VIEWER, { headers: ANON_CACHE_HEADERS })
  }

  const { data: vote } = await supabase
    .from('poll_votes')
    .select('option_id')
    .eq('poll_id', pollId)
    .eq('user_id', user.id)
    .maybeSingle()

  return NextResponse.json(
    {
      isLoggedIn: true,
      userVote: vote?.option_id ?? null,
    },
    { headers: PRIVATE_HEADERS },
  )
}
