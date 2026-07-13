'use server'

import { after } from 'next/server'

import { revalidateFindCache } from '@/lib/cache-tags'
import { createClient } from '@/lib/supabase/server'
import { isValidProfession } from '@/lib/find/professions'
import { sendNotificationToAdmins } from '@/lib/notifications'
import { rateLimit } from '@/lib/rate-limit'
import { createFindActions, type SubmitProfessionalInput, type SubmitRatingInput } from './find-core'
import { createInsertProfessional, createRequestScopedFindActions } from './find-adapters'

// NOTE: this is a 'use server' module — it may export ONLY async functions.
// The SubmitProfessionalInput / SubmitRatingInput types are imported above for
// the signatures below; import them from './find-core' elsewhere. Re-exporting
// them here (even as `export type`) makes Next's server-action transform emit a
// runtime reference to a type that doesn't exist → "SubmitProfessionalInput is
// not defined" at module evaluation → every submit/rating POST 500s.

const actions = createRequestScopedFindActions(createClient, (supabase) =>
  createFindActions({
    async getUser() { return (await supabase.auth.getUser()).data.user },
    rateLimit,
    isValidProfession,
    insertProfessional: createInsertProfessional(supabase),
    async findProfessional(id) { const { data } = await supabase.from('find_professionals').select('id, name').eq('id', id).eq('status', 'approved').eq('is_active', true).maybeSingle(); return data },
    async upsertRating(row) { return supabase.from('find_ratings').upsert(row, { onConflict: 'professional_id,user_id' }) },
    // Deliver admin notifications AFTER the response via `after()`, and await
    // every channel (awaitDelivery) so the serverless function stays alive
    // until the Telegram/email fetches actually complete. The find submit
    // action returns almost immediately, so a plain fire-and-forget was frozen
    // before delivery finished — no in-app row and no Telegram were sent.
    notify: (type, payload) => {
      after(() => sendNotificationToAdmins(type, payload, { awaitDelivery: true }))
    },
  }),
)

export async function submitProfessional(input: SubmitProfessionalInput) { return actions.submitProfessional(input) }

export async function submitRating(input: SubmitRatingInput) {
  const result = await actions.submitRating(input)
  // A re-rating resets the user's previously APPROVED rating back to pending,
  // which changes the public page (it drops out of the average) with no admin
  // action involved — so the cached find pages must refresh here too. New
  // professional submissions stay pending and never affect public pages, so
  // submitProfessional needs no invalidation.
  if (result.ok) revalidateFindCache()
  return result
}
