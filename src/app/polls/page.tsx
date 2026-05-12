import type { Metadata } from 'next'
import Link from 'next/link'
import { BarChart3, ArrowLeft } from 'lucide-react'

import { getAllPolls } from '@/lib/data/polls'
import PollsList from './PollsList'

export const metadata: Metadata = {
  title: 'Community Polls - OurDahanu',
  description: 'Vote on community polls and see what Dahanu thinks.',
}

export default async function PollsPage() {
  const polls = await getAllPolls()

  return (
    <div className="min-h-screen bg-[#FDFAF6]">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
        <div className="flex items-center gap-3 mb-8">
          <Link href="/" className="text-gray-400 hover:text-brand transition-colors">
            <ArrowLeft size={18} />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-ink flex items-center gap-2">
              <BarChart3 size={22} className="text-brand" />
              Community Polls
            </h1>
            <p className="text-sm text-ink-2 mt-0.5">
              Vote and see what Dahanu thinks
            </p>
          </div>
        </div>

        <PollsList polls={polls} />
      </div>
    </div>
  )
}
