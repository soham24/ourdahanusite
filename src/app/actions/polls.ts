'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin-client'
import { getUserRole } from '@/app/actions/admin'
import { revalidatePollsCache } from '@/lib/cache-tags'

/**
 * Cast or change a vote on a poll.
 * Upserts into poll_votes — handles both first vote and vote change.
 */
export async function castVote(
  pollId: string,
  optionId: string,
): Promise<{ error?: string; optionId?: string }> {
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

  revalidatePollsCache()
  return { optionId }
}

/**
 * Admin: create a new poll.
 */
export async function createPoll(formData: FormData): Promise<void> {
  const supabase = await createClient()
  const { user, role } = await getUserRole(supabase)
  if (role !== 'admin') return

  const title = (formData.get('title') as string)?.trim()
  const optionsRaw = (formData.get('options') as string)?.trim()
  const endsAt = formData.get('ends_at') as string

  if (!title || !optionsRaw || !endsAt) return
  if (new Date(endsAt) <= new Date()) return

  // Parse options — one per line
  const lines = optionsRaw
    .split('\n')
    .map(l => l.trim())
    .filter(Boolean)

  if (lines.length < 2 || lines.length > 10) return

  const options = lines.map((label, i) => ({
    id: `opt_${i + 1}`,
    label,
  }))

  const admin = createAdminClient()
  if (!admin) return

  await admin.from('polls').insert({
    title,
    options,
    ends_at: new Date(endsAt).toISOString(),
    created_by: user?.id ?? null,
    active: true,
  })

  revalidatePollsCache()
  revalidatePath('/admin/polls')
}

/**
 * Admin: soft-delete a poll (set active = false).
 */
export async function deletePoll(pollId: string, _formData?: FormData): Promise<void> {
  const supabase = await createClient()
  const { role } = await getUserRole(supabase)
  if (role !== 'admin') return

  const admin = createAdminClient()
  if (!admin) return

  await admin
    .from('polls')
    .update({ active: false })
    .eq('id', pollId)

  revalidatePollsCache()
  revalidatePath('/admin/polls')
}
