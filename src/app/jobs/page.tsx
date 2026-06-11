import { Suspense } from 'react'
import Link from 'next/link'
import { Briefcase, MapPin, Clock, Users, Plus, CheckCircle } from 'lucide-react'

import { getJobsBoardData } from '@/lib/data/jobs'

const TYPE_COLORS: Record<string, string> = {
  'Full-time': 'bg-blue-100 text-blue-700',
  'Part-time': 'bg-purple-100 text-purple-700',
  Contract: 'bg-orange-100 text-orange-700',
  'Daily Wage': 'bg-yellow-100 text-yellow-700',
  Internship: 'bg-pink-100 text-pink-700',
  Volunteer: 'bg-teal-100 text-teal-700',
  Remote: 'bg-indigo-100 text-indigo-700',
}

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  open: { label: 'Hiring', cls: 'bg-green-100 text-green-700' },
  hiring: { label: 'Hiring in Progress', cls: 'bg-amber-100 text-amber-700' },
}

// The x-forwarded-host header sample is required because the root layout's
// SiteChrome components read the request host (to hide generic chrome on
// business subdomains). /jobs only exists on the main domain.
export const unstable_instant = {
  prefetch: 'runtime',
  samples: [
    {
      searchParams: { category: null, type: null, submitted: null },
      headers: [['x-forwarded-host', 'ourdahanu.in']],
    },
    {
      searchParams: { category: 'Restaurants', type: 'Full-time', submitted: '1' },
      headers: [['x-forwarded-host', 'ourdahanu.in']],
    },
  ],
}

function formatPostedDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function JobsPageFallback() {
  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="h-10 w-52 rounded-xl bg-gray-100" />
      <div className="mt-3 h-5 w-72 rounded-lg bg-gray-100" />
      <div className="mt-8 flex gap-3 flex-wrap">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="h-9 w-24 rounded-full bg-gray-100" />
        ))}
      </div>
      <div className="mt-6 space-y-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="h-36 rounded-2xl bg-gray-100" />
        ))}
      </div>
    </div>
  )
}

async function JobsPageContent({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; type?: string; submitted?: string }>
}) {
  const { category: rawCat, type: rawType, submitted } = await searchParams
  const activeCategory = rawCat && rawCat !== 'All' ? rawCat : null
  const activeType = rawType && rawType !== 'All' ? rawType : null

  const { jobs, categories, totalCount } = await getJobsBoardData(activeCategory, activeType)

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      {submitted === '1' ? (
        <div className="mb-6 bg-green-50 border border-green-200 rounded-xl px-5 py-4 flex items-center gap-3">
          <CheckCircle size={20} className="text-green-600 flex-shrink-0" />
          <div>
            <p className="font-semibold text-green-800">Job submitted for review!</p>
            <p className="text-green-600 text-sm">We&apos;ll review it and publish within a few hours.</p>
          </div>
        </div>
      ) : null}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Jobs in Dahanu</h1>
          <p className="text-gray-500 mt-1">
            {totalCount > 0 ? `${totalCount} open position${totalCount !== 1 ? 's' : ''} in the community` : 'Find local opportunities'}
          </p>
        </div>
        <Link
          href="/jobs/submit"
          className="inline-flex items-center gap-2 bg-brand hover:bg-brand-strong text-bg font-semibold px-5 py-3 rounded-xl transition-colors text-sm"
        >
          <Plus size={16} /> Post a Job
        </Link>
      </div>

      {categories.length > 0 ? (
        <div className="flex gap-2 flex-wrap mb-5">
          <Link
            href="/jobs"
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
              !activeCategory ? 'bg-brand text-bg' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            All
          </Link>
          {categories.map((category) => (
            <Link
              key={category}
              href={`/jobs?category=${encodeURIComponent(category)}${activeType ? `&type=${encodeURIComponent(activeType)}` : ''}`}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                activeCategory === category ? 'bg-brand text-bg' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {category}
            </Link>
          ))}
        </div>
      ) : null}

      {jobs.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-2xl border border-gray-100">
          <div className="text-6xl mb-4">💼</div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">No jobs posted yet</h2>
          <p className="text-gray-500 mb-6">Be the first to post a job opportunity in Dahanu!</p>
          <Link
            href="/jobs/submit"
            className="inline-flex items-center gap-2 bg-brand hover:bg-brand-strong text-bg font-semibold px-5 py-3 rounded-xl transition-colors"
          >
            <Plus size={16} /> Post a Job
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {jobs.map((job) => {
            const statusBadge = STATUS_BADGE[job.status] ?? STATUS_BADGE.open
            return (
              <Link
                key={job.id}
                href={`/jobs/${job.id}`}
                className="block bg-white border border-gray-100 rounded-2xl p-5 hover:border-border hover:shadow-sm transition-all"
              >
                <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-surface-soft flex items-center justify-center flex-shrink-0">
                    <Briefcase size={22} className="text-brand" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5 mb-1">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${statusBadge.cls}`}>
                        {statusBadge.label}
                      </span>
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${TYPE_COLORS[job.type] || 'bg-gray-100 text-gray-600'}`}>
                        {job.type}
                      </span>
                      <span className="text-xs text-gray-500">{job.category}</span>
                    </div>

                    <h2 className="font-bold text-gray-900 text-lg leading-snug">{job.title}</h2>
                    <p className="text-sm text-gray-600 mt-0.5">{job.company}</p>

                    <div className="flex flex-wrap gap-3 mt-2 text-xs text-gray-400">
                      {job.location ? (
                        <span className="flex items-center gap-1">
                          <MapPin size={11} />
                          {job.location}
                        </span>
                      ) : null}
                      {job.salary ? <span className="font-medium text-brand">₹ {job.salary}</span> : null}
                      {job.positions && job.positions > 1 ? (
                        <span className="flex items-center gap-1">
                          <Users size={11} />
                          {job.positions} positions
                        </span>
                      ) : null}
                      <span className="flex items-center gap-1">
                        <Clock size={11} />
                        Posted {formatPostedDate(job.created_at)}
                      </span>
                    </div>

                    {job.description ? <p className="text-sm text-gray-500 mt-2 line-clamp-2">{job.description}</p> : null}
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      )}

      {jobs.length > 0 ? (
        <div className="mt-12 bg-gradient-to-br from-surface-soft to-border/30 border border-border rounded-2xl p-8 text-center">
          <h2 className="text-xl font-bold text-gray-900 mb-2">Hiring in Dahanu?</h2>
          <p className="text-gray-500 text-sm mb-5">Post your job and reach thousands of local candidates.</p>
          <Link
            href="/jobs/submit"
            className="inline-flex items-center gap-2 bg-brand hover:bg-brand-strong text-bg font-semibold px-6 py-3 rounded-xl transition-colors"
          >
            <Plus size={16} /> Post a Job
          </Link>
        </div>
      ) : null}
    </div>
  )
}

export default function JobsPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; type?: string; submitted?: string }>
}) {
  return (
    <Suspense fallback={<JobsPageFallback />}>
      <JobsPageContent searchParams={searchParams} />
    </Suspense>
  )
}
