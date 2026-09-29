import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft, BarChart3 } from 'lucide-react'
import { notFound } from 'next/navigation'

import PollCard from '@/components/PollCard'
import { getPollById } from '@/lib/data/polls'
import { buildAbsoluteUrl } from '@/lib/site'
import { siteConfig } from '@/lib/site'

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
      title: `Poll Not Found - ${siteConfig.name}`,
    }
  }

  const pollUrl = buildAbsoluteUrl(`/polls/${poll.id}`)

  return {
    title: `${poll.title} - Community Poll - ${siteConfig.name}`,
    description: `Vote on this community poll and see what ${siteConfig.town} thinks.`,
    alternates: {
      canonical: pollUrl,
    },
    openGraph: {
      title: poll.title,
      description: `Vote on this community poll and see what ${siteConfig.town} thinks.`,
      url: pollUrl,
      type: 'article',
      images: [{ url: 'https://ourdahanu.in/logo.png' }],
    },
    twitter: {
      card: 'summary',
      title: poll.title,
      description: `Vote on this community poll and see what ${siteConfig.town} thinks.`,
      images: ['https://ourdahanu.in/logo.png'],
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

  return (
    <div className="min-h-screen bg-[#FDFAF6]">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
        <div className="flex items-center gap-3 mb-3">
          <Link href="/polls" className="text-gray-400 hover:text-brand transition-colors">
            <ArrowLeft size={18} />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-ink flex items-center gap-2">
              <BarChart3 size={22} className="text-brand" />
              Community Poll
            </h1>
            <p className="text-sm text-ink-2 mt-0.5">
              Share this page directly with anyone in {siteConfig.town}.
            </p>
          </div>
        </div>

        <p className="mb-6 break-all text-xs text-gray-400">
          Standalone URL:{' '}
          <a href={pollUrl} className="text-brand hover:underline">
            {pollUrl}
          </a>
        </p>

        <PollCard
          poll={poll}
          userVote={null}
          isLoggedIn={false}
          loginNextPath={`/polls/${poll.id}`}
          pollHref={null}
        />
      </div>
    </div>
  )
}
