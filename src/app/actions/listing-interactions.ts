'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePublicListingDetail } from '@/lib/cache-tags'
import { normalizeInlineText, normalizeMultilineText } from '@/lib/listing-content'

function revalidateListing(listingId: string) {
  revalidatePublicListingDetail(listingId)
}

// ── Favourites ───────────────────────────────────────────────────────────────

export async function toggleFavourite(
  listingId: string,
  subdomain?: string | null,
): Promise<{ isFavourited: boolean; error?: string }> {
  void subdomain
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { isFavourited: false, error: 'Sign in to save favourites.' }

  const { data: existing } = await supabase
    .from('listing_favourites')
    .select('listing_id')
    .eq('user_id', user.id)
    .eq('listing_id', listingId)
    .maybeSingle()

  if (existing) {
    await supabase.from('listing_favourites')
      .delete().eq('user_id', user.id).eq('listing_id', listingId)
    return { isFavourited: false }
  } else {
    await supabase.from('listing_favourites')
      .insert({ user_id: user.id, listing_id: listingId })
    return { isFavourited: true }
  }
}

// ── Recommendations ──────────────────────────────────────────────────────────

export async function toggleRecommendation(
  listingId: string,
  subdomain?: string | null,
): Promise<{ isRecommended: boolean; error?: string }> {
  void subdomain
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { isRecommended: false, error: 'Sign in to recommend.' }

  const { data: existing } = await supabase
    .from('listing_recommendations')
    .select('listing_id')
    .eq('user_id', user.id)
    .eq('listing_id', listingId)
    .maybeSingle()

  if (existing) {
    await supabase.from('listing_recommendations')
      .delete().eq('user_id', user.id).eq('listing_id', listingId)
    return { isRecommended: false }
  } else {
    await supabase.from('listing_recommendations')
      .insert({ user_id: user.id, listing_id: listingId })
    return { isRecommended: true }
  }
}

// ── Q&A ──────────────────────────────────────────────────────────────────────

export async function askQuestion(
  listingId: string,
  question: string,
  subdomain?: string | null,
): Promise<{ error?: string }> {
  void subdomain
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Sign in to ask a question.' }
  const normalizedQuestion = normalizeInlineText(question, 220)
  if (!normalizedQuestion) return { error: 'Question cannot be empty.' }

  const { error } = await supabase.from('listing_questions').insert({
    listing_id: listingId,
    user_id: user.id,
    question: normalizedQuestion,
  })

  if (error) return { error: error.message }
  revalidateListing(listingId)
  return {}
}

export async function answerQuestion(
  questionId: string,
  answer: string,
  listingId: string,
  subdomain?: string | null,
): Promise<{ error?: string }> {
  void subdomain
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated.' }
  const normalizedAnswer = normalizeMultilineText(answer, 500)
  if (!normalizedAnswer) return { error: 'Answer cannot be empty.' }

  const { data: listing } = await supabase
    .from('listings')
    .select('owner_id')
    .eq('id', listingId)
    .single()

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  const isAdmin = profile?.role === 'admin' || profile?.role === 'moderator'
  if (listing?.owner_id !== user.id && !isAdmin) return { error: 'Not authorized.' }

  const { error } = await supabase.from('listing_questions').update({
    answer: normalizedAnswer,
    answered_at: new Date().toISOString(),
  }).eq('id', questionId)

  if (error) return { error: error.message }
  revalidateListing(listingId)
  return {}
}
