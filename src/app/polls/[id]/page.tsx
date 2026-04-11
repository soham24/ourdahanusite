import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft, BarChart3 } from 'lucide-react'
import { notFound } from 'next/navigation'

import PollCard from '@/components/PollCard'
import { getPollById } from '@/lib/data/polls'
import { buildAbsoluteUrl } from '@/lib/site'
import { createClient } from '@/lib/supabase/server'

type PollPageProps = {
  params: Promise<{ id: string }>
}

export async function generateMetadata({
  params,
}: PollPageProps): Promise<Metadata> {
  const { id } = await params
  const poll = await getPollById(id)

  if (!poll) {
    return {
      title: 'Poll Not Found - OurDahanu',
    }
  }

  const pollUrl = buildAbsoluteUrl(`/polls/${poll.id}`)

  return {
    title: `${poll.title} - Community Poll - OurDahanu`,
    description: 'Vote on this community poll and see what Dahanu thinks.',
    alternates: {
      canonical: pollUrl,
    },
    openGraph: {
      title: poll.title,
      description: 'Vote on this community poll and see what Dahanu thinks.',
      url: pollUrl,
      type: 'article',
    },
    twitter: {
      card: 'summary',
      title: poll.title,
      description: 'Vote on this community poll and see what Dahanu thinks.',
    },
  }
}

export default async function PollDetailPage({
  params,
}: PollPageProps) {
  const { id } = await params
  const poll = await getPollById(id)

  if (!poll) {
    notFound()
  }

  const pollUrl = buildAbsoluteUrl(`/polls/${poll.id}`)

  let userId: string | null = null
  let userVote: string | null = null

  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    userId = user?.id ?? null

    if (userId) {
      const { data: vote } = await supabase
        .from('poll_votes')
        .select('option_id')
        .eq('poll_id', poll.id)
        .eq('user_id', userId)
        .maybeSingle()

      userVote = vote?.option_id ?? null
    }
  } catch {
    // Treat auth lookup failures as logged out.
  }

  return (
    <div className="min-h-screen bg-[#FDFAF6]">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
        <div className="flex items-center gap-3 mb-3">
          <Link href="/polls" className="text-gray-400 hover:text-warli-terra transition-colors">
            <ArrowLeft size={18} />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-chikoo-bark flex items-center gap-2">
              <BarChart3 size={22} className="text-warli-terra" />
              Community Poll
            </h1>
            <p className="text-sm text-chikoo-brown mt-0.5">
              Share this page directly with anyone in Dahanu.
            </p>
          </div>
        </div>

        <p className="mb-6 break-all text-xs text-gray-400">
          Standalone URL:{' '}
          <a href={pollUrl} className="text-warli-terra hover:underline">
            {pollUrl}
          </a>
        </p>

        <PollCard
          poll={poll}
          userVote={userVote}
          isLoggedIn={!!userId}
          loginNextPath={`/polls/${poll.id}`}
          pollHref={null}
        />
      </div>
    </div>
  )
}
