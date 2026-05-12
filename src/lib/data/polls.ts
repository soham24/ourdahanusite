import 'server-only'

import { cacheLife, cacheTag } from 'next/cache'

import { CACHE_TAGS } from '@/lib/cache-tags'
import { PUBLIC_CONTENT_CACHE } from '@/lib/cache-policy'
import { logCacheRegeneration } from '@/lib/isr-debug'
import { createAdminClient } from '@/lib/supabase/admin-client'
import { createPublicClient } from '@/lib/supabase/public'

export interface PollOption {
  id: string
  label: string
}

export interface Poll {
  id: string
  title: string
  options: PollOption[]
  ends_at: string
  created_at: string
  active: boolean
}

export interface PollWithResults extends Poll {
  vote_counts: Record<string, number>
  total_votes: number
}

type PollRow = {
  id: string
  title: string
  options: PollOption[]
  ends_at: string
  created_at: string
  active: boolean
}

/** Count votes per option from a flat array of vote rows */
function countVotes(
  votes: { option_id: string }[],
  options: PollOption[],
): { vote_counts: Record<string, number>; total_votes: number } {
  const vote_counts: Record<string, number> = {}
  for (const opt of options) vote_counts[opt.id] = 0
  for (const v of votes) {
    vote_counts[v.option_id] = (vote_counts[v.option_id] ?? 0) + 1
  }
  return { vote_counts, total_votes: votes.length }
}

export async function getLivePollVoteTotals(
  pollId: string,
  options: PollOption[],
): Promise<{ vote_counts: Record<string, number>; total_votes: number }> {
  const voteReader = getVoteReader()

  const { data: voteData } = await voteReader
    .from('poll_votes')
    .select('option_id')
    .eq('poll_id', pollId)

  const votes = (voteData ?? []) as { option_id: string }[]
  return countVotes(votes, options)
}

function getVoteReader() {
  return createAdminClient() ?? createPublicClient()
}

function toPollWithResults(
  poll: PollRow,
  votes: { option_id: string }[],
): PollWithResults {
  const options = poll.options ?? []
  const counts = countVotes(votes, options)

  return {
    id: poll.id,
    title: poll.title,
    options,
    ends_at: poll.ends_at,
    created_at: poll.created_at,
    active: poll.active,
    ...counts,
  }
}

/**
 * Get the most recent active poll (for the homepage).
 * Returns null if no active poll exists.
 */
export async function getActivePoll(): Promise<PollWithResults | null> {
  'use cache'
  cacheLife(PUBLIC_CONTENT_CACHE)
  cacheTag(CACHE_TAGS.polls)
  cacheTag(CACHE_TAGS.home)
  logCacheRegeneration({ scope: 'polls:active', tags: [CACHE_TAGS.polls, CACHE_TAGS.home] })

  const supabase = createPublicClient()

  const { data: pollData } = await supabase
    .from('polls')
    .select('*')
    .eq('active', true)
    .order('created_at', { ascending: false })
    .order('id', { ascending: true })
    .limit(1)
    .maybeSingle()

  const poll = pollData as PollRow | null
  if (!poll) return null

  const totals = await getLivePollVoteTotals(poll.id, poll.options ?? [])
  return { ...poll, ...totals }
}

export async function getPollById(id: string): Promise<PollWithResults | null> {
  'use cache'
  cacheLife(PUBLIC_CONTENT_CACHE)
  cacheTag(CACHE_TAGS.polls)
  logCacheRegeneration({
    scope: 'polls:detail',
    tags: [CACHE_TAGS.polls],
    detail: { pollId: id },
  })

  const supabase = createPublicClient()

  const { data: pollData } = await supabase
    .from('polls')
    .select('*')
    .eq('id', id)
    .eq('active', true)
    .maybeSingle()

  const poll = pollData as PollRow | null
  if (!poll) return null

  const totals = await getLivePollVoteTotals(poll.id, poll.options ?? [])
  return { ...poll, ...totals }
}

/**
 * Get all active polls (for the /polls page).
 * Includes ended polls that are still active (not soft-deleted).
 */
export async function getAllPolls(): Promise<PollWithResults[]> {
  'use cache'
  cacheLife(PUBLIC_CONTENT_CACHE)
  cacheTag(CACHE_TAGS.polls)
  logCacheRegeneration({ scope: 'polls:list', tags: [CACHE_TAGS.polls] })

  const supabase = createPublicClient()
  type VoteRow = { poll_id: string; option_id: string }

  const { data: pollsData } = await supabase
    .from('polls')
    .select('*')
    .eq('active', true)
    .order('created_at', { ascending: false })
    .order('id', { ascending: true })

  const polls = (pollsData ?? []) as PollRow[]
  if (polls.length === 0) return []

  const pollIds = polls.map(p => p.id)
  const voteReader = getVoteReader()

  const { data: allVotesData } = await voteReader
    .from('poll_votes')
    .select('poll_id, option_id')
    .in('poll_id', pollIds)

  const allVotes = (allVotesData ?? []) as VoteRow[]

  // Group votes by poll_id
  const votesByPoll: Record<string, VoteRow[]> = {}
  for (const v of allVotes) {
    if (!votesByPoll[v.poll_id]) votesByPoll[v.poll_id] = []
    votesByPoll[v.poll_id].push(v)
  }

  return polls.map(poll => {
    return toPollWithResults(poll, votesByPoll[poll.id] ?? [])
  })
}
