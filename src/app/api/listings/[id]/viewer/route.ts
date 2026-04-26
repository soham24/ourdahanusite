import { NextResponse } from 'next/server'

import { createClient } from '@/lib/supabase/server'

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id: listingId } = await context.params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({
      isLoggedIn: false,
      isOwner: false,
      userId: null,
      email: '',
      name: '',
      phone: '',
      isFavourited: false,
      isRecommended: false,
    })
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

  return NextResponse.json({
    isLoggedIn: true,
    isOwner: listingResult.data?.owner_id === user.id,
    userId: user.id,
    email: user.email ?? '',
    name: profileResult.data?.full_name || user.email?.split('@')[0] || '',
    phone: profileResult.data?.phone || '',
    isFavourited: !!favResult.data,
    isRecommended: !!recResult.data,
  })
}
