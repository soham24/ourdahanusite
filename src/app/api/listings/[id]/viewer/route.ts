import { NextResponse } from 'next/server'

import { createClient } from '@/lib/supabase/server'

const ANON_VIEWER = {
  isLoggedIn: false,
  isOwner: false,
  userId: null,
  email: '',
  name: '',
  phone: '',
  isFavourited: false,
  isRecommended: false,
} as const

// Never edge-cached, even signed out. The URL is the same for signed-in
// users, and a shared cached signed-out answer could be served to them,
// hiding their name, votes and favourites. The client only calls this when
// it has a session cookie, so the signed-out case is just expired sessions.
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
  const { id: listingId } = await context.params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json(ANON_VIEWER, { headers: ANON_CACHE_HEADERS })
  }

  const [profileResult, listingResult, favResult, recResult] = await Promise.all([
    supabase.from('profiles').select('full_name, phone').eq('id', user.id).maybeSingle(),
    supabase.from('listings').select('owner_id').eq('id', listingId).maybeSingle(),
    supabase
      .from('listing_favourites')
      .select('listing_id')
      .eq('user_id', user.id)
      .eq('listing_id', listingId)
      .maybeSingle(),
    supabase
      .from('listing_recommendations')
      .select('listing_id')
      .eq('user_id', user.id)
      .eq('listing_id', listingId)
      .maybeSingle(),
  ])

  return NextResponse.json(
    {
      isLoggedIn: true,
      isOwner: listingResult.data?.owner_id === user.id,
      userId: user.id,
      email: user.email ?? '',
      name: profileResult.data?.full_name || user.email?.split('@')[0] || '',
      phone: profileResult.data?.phone || '',
      isFavourited: !!favResult.data,
      isRecommended: !!recResult.data,
    },
    { headers: PRIVATE_HEADERS },
  )
}
