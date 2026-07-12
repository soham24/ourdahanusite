'use server'

import { createClient } from '@/lib/supabase/server'
import { isValidProfession } from '@/lib/find/professions'
import { sendNotificationToAdmins } from '@/lib/notifications'
import { rateLimit } from '@/lib/rate-limit'
import { createFindActions, type SubmitProfessionalInput, type SubmitRatingInput } from './find-core'
import { createInsertProfessional, createRequestScopedFindActions } from './find-adapters'

export type { SubmitProfessionalInput, SubmitRatingInput }

const actions = createRequestScopedFindActions(createClient, (supabase) =>
  createFindActions({
    async getUser() { return (await supabase.auth.getUser()).data.user },
    rateLimit,
    isValidProfession,
    insertProfessional: createInsertProfessional(supabase),
    async findProfessional(id) { const { data } = await supabase.from('find_professionals').select('id, name').eq('id', id).eq('status', 'approved').eq('is_active', true).maybeSingle(); return data },
    async upsertRating(row) { return supabase.from('find_ratings').upsert(row, { onConflict: 'professional_id,user_id' }) },
    notify: sendNotificationToAdmins,
  }),
)

export async function submitProfessional(input: SubmitProfessionalInput) { return actions.submitProfessional(input) }
export async function submitRating(input: SubmitRatingInput) { return actions.submitRating(input) }
