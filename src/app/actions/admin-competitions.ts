'use server'

import { revalidatePath } from 'next/cache'
import { revalidateGameCache } from '@/lib/cache-tags'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin-client'
import { getUserRole } from '@/app/actions/admin'
import { validateCompetitionInput } from '@/lib/game/competition'
import { getIndiaToday } from '@/lib/india-time'

export type CompetitionFormState = {
  error?: string
  success?: boolean
  fields?: {
    day: string
    title: string
    prize: string
    code: string
    active: boolean
  }
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

async function requireAdminRole() {
  const supabase = await createClient()
  const { user, role } = await getUserRole(supabase)
  if (!user || role !== 'admin') return { user: null }
  return { user }
}

function revalidateCompetitionPages() {
  // The public /play bundle is cached; refresh it now so admin changes show at once.
  revalidateGameCache()
  revalidatePath('/play')
  revalidatePath('/admin/competitions')
}

type AdminClient = NonNullable<ReturnType<typeof createAdminClient>>

/** How many saved rounds are tagged with this competition. */
async function countCompetitionEntries(admin: AdminClient, id: string) {
  const { count, error } = await admin
    .from('game_scores')
    .select('id', { count: 'exact', head: true })
    .eq('competition_id', id)
  return { count: count ?? 0, error }
}

/**
 * Admin: create a competition, or update one when `id` is present.
 */
export async function saveCompetition(
  _prev: CompetitionFormState,
  formData: FormData,
): Promise<CompetitionFormState> {
  void _prev

  const { user } = await requireAdminRole()
  if (!user) return { error: 'Admin access required' }

  const id = ((formData.get('id') as string | null) ?? '').trim()
  const fields = {
    day: ((formData.get('day') as string | null) ?? '').trim(),
    title: (formData.get('title') as string | null) ?? '',
    prize: (formData.get('prize') as string | null) ?? '',
    code: (formData.get('code') as string | null) ?? '',
    active: formData.get('active') === 'on',
  }

  if (id && !UUID_PATTERN.test(id)) return { error: 'Competition not found.', fields }

  const admin = createAdminClient()
  if (!admin) return { error: 'Server configuration error — missing service role key.', fields }

  const today = getIndiaToday()

  // On update, a day already in the past is allowed only if it is unchanged
  // (e.g. fixing the prize on yesterday's competition). Validate against the
  // stored day in that case so the other fields are still checked.
  let validationToday = today
  if (id) {
    const { data: existing, error: loadError } = await admin
      .from('game_competitions')
      .select('id, day')
      .eq('id', id)
      .maybeSingle()
    if (loadError) return { error: loadError.message, fields }
    if (!existing) return { error: 'Competition not found.', fields }
    if (existing.day === fields.day && fields.day < today) validationToday = fields.day
    if (existing.day !== fields.day) {
      const { count, error: countError } = await countCompetitionEntries(admin, id)
      if (countError) return { error: countError.message, fields }
      if (count > 0) {
        return { error: "This competition already has entries, so its date can't change.", fields }
      }
    }
  }

  const result = validateCompetitionInput(fields, validationToday)
  if (!result.ok) return { error: result.error, fields }
  const value = result.value

  if (id) {
    const { error } = await admin
      .from('game_competitions')
      .update({
        day: value.day,
        title: value.title,
        prize: value.prize,
        code: value.code,
        active: value.active,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
    if (error) {
      if (error.code === '23505') return { error: 'There is already a competition on that date.', fields }
      return { error: error.message, fields }
    }
  } else {
    const { error } = await admin.from('game_competitions').insert({
      day: value.day,
      title: value.title,
      prize: value.prize,
      code: value.code,
      active: value.active,
      created_by: user.id,
    })
    if (error) {
      if (error.code === '23505') return { error: 'There is already a competition on that date.', fields }
      return { error: error.message, fields }
    }
  }

  revalidateCompetitionPages()
  return { success: true }
}

/**
 * Admin: switch a competition on or off.
 */
export async function setCompetitionActive(id: string, active: boolean): Promise<{ error?: string }> {
  const { user } = await requireAdminRole()
  if (!user) return { error: 'Admin access required' }
  if (!UUID_PATTERN.test(id)) return { error: 'Competition not found.' }

  const admin = createAdminClient()
  if (!admin) return { error: 'Server configuration error' }

  const { error } = await admin
    .from('game_competitions')
    .update({ active: active === true, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) return { error: error.message }

  revalidateCompetitionPages()
  return {}
}

/**
 * Admin: delete a competition that nobody has scored in yet.
 */
export async function deleteCompetition(id: string): Promise<{ error?: string }> {
  const { user } = await requireAdminRole()
  if (!user) return { error: 'Admin access required' }
  if (!UUID_PATTERN.test(id)) return { error: 'Competition not found.' }

  const admin = createAdminClient()
  if (!admin) return { error: 'Server configuration error' }

  const { count, error: countError } = await countCompetitionEntries(admin, id)
  if (countError) return { error: countError.message }
  if (count > 0) return { error: 'This competition has scores. Switch it off instead.' }

  const { error } = await admin.from('game_competitions').delete().eq('id', id)
  if (error) return { error: error.message }

  revalidateCompetitionPages()
  return {}
}

/**
 * Admin: disqualify a player from a competition, or undo it.
 */
export async function setExclusion(
  competitionId: string,
  userId: string,
  excluded: boolean,
  reason?: string,
): Promise<{ error?: string }> {
  const { user } = await requireAdminRole()
  if (!user) return { error: 'Admin access required' }
  if (!UUID_PATTERN.test(competitionId) || !UUID_PATTERN.test(userId)) return { error: 'Player not found.' }

  const admin = createAdminClient()
  if (!admin) return { error: 'Server configuration error' }

  if (excluded) {
    const trimmed = typeof reason === 'string' ? reason.trim().slice(0, 500) : ''
    const { error } = await admin
      .from('game_competition_exclusions')
      .upsert(
        {
          competition_id: competitionId,
          user_id: userId,
          reason: trimmed || null,
          created_by: user.id,
        },
        { onConflict: 'competition_id,user_id', ignoreDuplicates: true },
      )
    if (error) return { error: error.message }
  } else {
    const { error } = await admin
      .from('game_competition_exclusions')
      .delete()
      .eq('competition_id', competitionId)
      .eq('user_id', userId)
    if (error) return { error: error.message }
  }

  revalidateCompetitionPages()
  revalidatePath(`/admin/competitions/${competitionId}`)
  return {}
}
