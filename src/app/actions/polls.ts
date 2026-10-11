'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin-client'
import { getUserRole } from '@/app/actions/admin'
import { revalidatePollsCache } from '@/lib/cache-tags'
import { getLivePollVoteTotals } from '@/lib/data/polls'

type PollFormState = {
  error?: string
  success?: boolean
  fields?: {
    title: string
    options: string
    ends_at: string
  }
}

/**
 * Cast or change a vote on a poll.
 * Upserts into poll_votes — handles both first vote and vote change.
 */
export async function castVote(
  pollId: string,
  optionId: string,
): Promise<{
  error?: string
  optionId?: string
  vote_counts?: Record<string, number>
  total_votes?: number
}> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Sign in to vote.' }

  // Fetch poll to validate it exists, is active, and not ended
  const admin = createAdminClient()
  if (!admin) return { error: 'Server configuration error' }

  const { data: poll } = await admin
    .from('polls')
    .select('id, options, ends_at, active')
    .eq('id', pollId)
    .single()

  if (!poll || !poll.active) return { error: 'Poll not found.' }

  if (new Date(poll.ends_at) < new Date()) {
    return { error: 'This poll has ended.' }
  }

  // Validate optionId exists in the poll's options
  const options = (poll.options as { id: string; label: string }[]) ?? []
  if (!options.some(o => o.id === optionId)) {
    return { error: 'Invalid option.' }
  }

  // Upsert: insert or update the user's vote
  const { error } = await supabase
    .from('poll_votes')
    .upsert(
      { poll_id: pollId, user_id: user.id, option_id: optionId },
      { onConflict: 'poll_id,user_id' },
    )

  if (error) return { error: error.message }

  // The poll pages cache their totals; without this a reload showed the old
  // counts (the voter's own vote "vanishing") for up to a day.
  revalidatePollsCache()

  const totals = await getLivePollVoteTotals(pollId, options)
  return { optionId, ...totals }
}

/**
 * Admin: create a new poll.
 */
export async function createPoll(
  _prev: PollFormState,
  formData: FormData,
): Promise<PollFormState> {
  void _prev

  const supabase = await createClient()
  const { user, role } = await getUserRole(supabase)
  if (role !== 'admin') return { error: 'Admin access required' }

  const title = (formData.get('title') as string)?.trim() ?? ''
  const optionsRaw = (formData.get('options') as string)?.trim() ?? ''
  const endsAt = (formData.get('ends_at') as string) ?? ''
  const endsAtUtc = (formData.get('ends_at_utc') as string)?.trim() ?? ''
  const fields = { title, options: optionsRaw, ends_at: endsAt }

  if (!title) return { error: 'Title is required.', fields }
  if (!optionsRaw) return { error: 'Options are required.', fields }
  if (!endsAt) return { error: 'End time is required.', fields }
  if (!endsAtUtc) return { error: 'Could not determine your local end time. Please try again.', fields }

  const parsedEndsAt = new Date(endsAtUtc)
  if (Number.isNaN(parsedEndsAt.getTime())) {
    return { error: 'Choose a valid end time.', fields }
  }

  if (parsedEndsAt <= new Date()) return { error: 'End time must be in the future.', fields }

  // Parse options — one per line
  const lines = optionsRaw
    .split('\n')
    .map(l => l.trim())
    .filter(Boolean)

  if (lines.length < 2) return { error: 'At least 2 options are required.', fields }
  if (lines.length > 10) return { error: 'Maximum 10 options allowed.', fields }

  const options = lines.map((label, i) => ({
    id: `opt_${i + 1}`,
    label,
  }))

  const admin = createAdminClient()
  if (!admin) return { error: 'Server configuration error — missing service role key.', fields }

  const { error } = await admin.from('polls').insert({
    title,
    options,
    ends_at: parsedEndsAt.toISOString(),
    created_by: user?.id ?? null,
    active: true,
  })

  if (error) return { error: error.message, fields }

  revalidatePollsCache()
  return { success: true }
}

/**
 * Admin: soft-delete a poll (set active = false).
 */
export async function deletePoll(
  pollId: string,
  _prev: { error?: string; success?: boolean },
  _formData?: FormData,
): Promise<{ error?: string; success?: boolean }> {
  void _prev
  void _formData

  const supabase = await createClient()
  const { role } = await getUserRole(supabase)
  if (role !== 'admin') return { error: 'Admin access required' }

  const admin = createAdminClient()
  if (!admin) return { error: 'Server configuration error' }

  const { error } = await admin
    .from('polls')
    .update({ active: false })
    .eq('id', pollId)

  if (error) return { error: error.message }

  revalidatePollsCache()
  return { success: true }
}
