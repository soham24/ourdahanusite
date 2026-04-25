import { Briefcase, MapPin, Clock, Plus, Sparkles } from 'lucide-react'
import SafeAppLink from '@/components/SafeAppLink'
import SectionHeader from '@/components/ui/SectionHeader'
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
    <section
      className="relative py-16 border-y border-[var(--color-border)]"
      style={{
        background:
          'linear-gradient(180deg, #F6EDDD 0%, #FBF5EC 100%)',
      }}
    >
      <div
        className="absolute inset-0 opacity-[0.18] pointer-events-none warli-bg"
        aria-hidden
      />
      <div className="relative max-w-[1160px] mx-auto px-6">
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

        <div className="grid gap-6 lg:grid-cols-[1fr_280px] items-start">
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
                    <div
                      className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 border border-[rgba(192,88,46,0.18)]"
                      style={{
                        background:
                          'linear-gradient(135deg, #FBF0DC 0%, #F0D9B0 100%)',
                      }}
                    >
                      <Briefcase size={20} className="text-[var(--color-brand-strong)]" />
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
          <div
            className="relative overflow-hidden rounded-3xl p-7 sticky top-[120px] border border-[rgba(192,88,46,0.22)]"
            style={{
              background:
                'linear-gradient(160deg, #FBF0DC 0%, #F4DDB4 60%, #EDC98A 100%)',
              boxShadow:
                '0 22px 48px rgba(46,18,5,0.18), inset 0 1px 0 rgba(255,255,255,0.5)',
            }}
          >
            <span
              className="pointer-events-none absolute -top-16 -right-16 w-40 h-40 rounded-full opacity-60"
              style={{
                background:
                  'radial-gradient(circle, rgba(240,200,122,0.7) 0%, transparent 70%)',
              }}
              aria-hidden
            />

            <div className="relative">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[rgba(192,88,46,0.12)] border border-[rgba(192,88,46,0.25)] mb-3">
                <Sparkles size={11} className="text-[var(--color-brand-strong)]" />
                <p className="text-[10.5px] font-bold uppercase tracking-[0.1em] text-[var(--color-brand-strong)]">
                  Hiring locally?
                </p>
              </div>

              <h3 className="font-display text-[24px] text-[var(--color-bark)] leading-[1.15] mb-2.5 tracking-tight">
                Post a job in minutes
              </h3>
              <p className="text-[13px] leading-[1.55] mb-5 text-[var(--color-brown)]">
                Reach job seekers around Dahanu without needing your own hiring page.
              </p>

              <div className="mb-5 pb-5 border-b border-[rgba(46,18,5,0.12)]">
                {jobBasePrice > jobCurrentPrice && (
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs line-through text-[var(--color-brown)] opacity-70">
                      ₹{jobBasePrice}
                    </span>
                    <span className="text-[10px] font-bold uppercase tracking-wide text-[var(--color-brand-strong)] bg-[rgba(192,88,46,0.12)] px-1.5 py-0.5 rounded">
                      Launch price
                    </span>
                  </div>
                )}
                <div className="flex items-baseline gap-1.5">
                  <span className="font-display text-[36px] text-[var(--color-bark)] leading-none tracking-tight">
                    ₹{jobCurrentPrice}
                  </span>
                  <span className="text-[12px] text-[var(--color-brown)] font-medium">
                    / posting
                  </span>
                </div>
              </div>

              <SafeAppLink
                href="/jobs/submit"
                className="group/btn relative inline-flex items-center justify-center gap-2 w-full px-5 py-3 rounded-xl font-bold text-[13px] text-[var(--color-cream)] transition-all duration-200 active:scale-[0.98] hover:-translate-y-[1px]"
                style={{
                  background:
                    'linear-gradient(180deg, #3A1A09 0%, #2E1205 100%)',
                  boxShadow:
                    '0 10px 24px rgba(46,18,5,0.28), inset 0 1px 0 rgba(240,200,122,0.18)',
                }}
              >
                <Plus size={14} className="text-[var(--color-gold-light)]" strokeWidth={2.5} />
                Post a Job
              </SafeAppLink>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
