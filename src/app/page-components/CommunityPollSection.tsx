import { Suspense } from 'react'
import SectionHeader from '@/components/ui/SectionHeader'
import HomepagePollCard, { HomepagePollCardFallback } from '@/components/HomepagePollCard'
import type { PollWithResults } from '@/lib/data/polls'

interface CommunityPollSectionProps {
  activePoll: PollWithResults | null
}

export default function CommunityPollSection({ activePoll }: CommunityPollSectionProps) {
  if (!activePoll) return null

  return (
    <section className="py-16">
      <div className="max-w-[1160px] mx-auto px-6">
        <SectionHeader
          label="Community"
          title="Community Poll"
          sub="Have your say — vote and see what Dahanu thinks"
          viewAllHref="/polls"
        />
        <div className="max-w-xl">
          <Suspense fallback={<HomepagePollCardFallback />}>
            <HomepagePollCard poll={activePoll} />
          </Suspense>
        </div>
      </div>
    </section>
  )
}
