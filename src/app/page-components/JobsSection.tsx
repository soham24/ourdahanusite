import { Briefcase, MapPin, Clock, Plus } from 'lucide-react'
import SafeAppLink from '@/components/SafeAppLink'
import SectionHeader from '@/components/ui/SectionHeader'
import Button from '@/components/ui/Button'
import Card from '@/components/ui/Card'
import type { HomeJob } from '@/lib/data/home'

interface JobsSectionProps {
  recentJobs: HomeJob[]
  totalJobs: number
  jobCurrentPrice: number
  jobBasePrice: number
}

export default function JobsSection({
  recentJobs,
  totalJobs,
  jobCurrentPrice,
  jobBasePrice,
}: JobsSectionProps) {
  return (
    <section className="bg-[var(--color-muted)] py-16">
      <div className="max-w-[1160px] mx-auto px-6">
        <SectionHeader
          label="Opportunities"
          title="Jobs in Dahanu"
          sub={
            totalJobs > 0
              ? `${totalJobs} open ${totalJobs === 1 ? 'role' : 'roles'} for local people`
              : 'Local opportunities for local people'
          }
          viewAllHref="/jobs"
        />

        <div className="grid gap-6 lg:grid-cols-[1fr_260px] items-start">
          <div className="flex flex-col gap-2.5">
            {recentJobs.length > 0 ? (
              recentJobs.map((job) => (
                <Card
                  key={job.id}
                  padding="none"
                  hover
                  className="border-[var(--color-border)]"
                >
                  <SafeAppLink
                    href={`/jobs/${job.id}`}
                    className="group p-5 flex gap-4 items-start"
                  >
                    <div className="w-11 h-11 rounded-xl bg-[var(--color-muted)] flex items-center justify-center flex-shrink-0">
                      <Briefcase size={20} className="text-[var(--color-brand)]" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="text-[11px] font-semibold text-[var(--color-brand)] bg-[rgba(192,88,46,0.07)] rounded-full px-2 py-0.5">
                          {job.category}
                        </span>
                        <span className="text-[11px] text-[var(--color-text-muted)]">{job.type}</span>
                      </div>
                      <h3 className="font-bold text-[15px] text-[var(--color-bark)] group-hover:text-[var(--color-brand)] transition-colors">
                        {job.title}
                      </h3>
                      <p className="text-xs text-[var(--color-text-muted)] mt-0.5">{job.company}</p>
                      <div className="flex items-center gap-3 flex-wrap mt-2 text-xs text-[var(--color-text-muted)]">
                        {job.location && (
                          <span className="flex items-center gap-1">
                            <MapPin size={10} />
                            {job.location}
                          </span>
                        )}
                        {job.salary && (
                          <span className="font-semibold text-[var(--color-brand)]">₹ {job.salary}</span>
                        )}
                        <span className="flex items-center gap-1">
                          <Clock size={10} />
                          {job.type}
                        </span>
                      </div>
                    </div>
                  </SafeAppLink>
                </Card>
              ))
            ) : (
              <Card className="border-[var(--color-border)] p-10 text-center">
                <p className="text-sm text-[var(--color-text-muted)]">
                  No open jobs yet. Employers can post the first one today.
                </p>
              </Card>
            )}
          </div>

          {/* Post a job sidebar */}
          <div className="bg-[var(--color-bark)] rounded-3xl p-7 sticky top-[120px] text-[var(--color-cream)]">
            <p
              className="text-[11px] font-bold uppercase tracking-[0.1em] mb-2.5"
              style={{ color: 'rgba(232,196,154,0.5)' }}
            >
              Hiring locally?
            </p>
            <h3 className="font-display text-[22px] text-[var(--color-cream)] leading-[1.2] mb-2.5">
              Post a job in minutes
            </h3>
            <p
              className="text-[13px] leading-[1.6] mb-5"
              style={{ color: 'rgba(232,196,154,0.5)' }}
            >
              Reach job seekers around Dahanu without needing your own hiring page.
            </p>
            {jobBasePrice > jobCurrentPrice && (
              <div
                className="text-xs line-through mb-1"
                style={{ color: 'rgba(232,196,154,0.4)' }}
              >
                ₹{jobBasePrice} / posting
              </div>
            )}
            <div className="font-display text-[32px] text-[#F0C87A] leading-none mb-4">
              ₹{jobCurrentPrice}
            </div>
            <Button asChild className="bg-[#C8881E] hover:bg-[#D49A28] text-[var(--color-bark)] font-bold text-[13px] w-full">
              <SafeAppLink href="/jobs/submit">
                <Plus size={13} className="mr-2" />
                Post a Job
              </SafeAppLink>
            </Button>
          </div>
        </div>
      </div>
    </section>
  )
}
