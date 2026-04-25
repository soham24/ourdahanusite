import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Briefcase, CheckCircle, XCircle, MapPin, Clock, Users } from 'lucide-react'
import { approveContent, rejectContent } from '@/app/actions/admin'
import AdminJobStatusButton from './AdminJobStatusButton'

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

const TYPE_COLORS: Record<string, string> = {
  'Full-time':   'bg-blue-100 text-blue-700',
  'Part-time':   'bg-purple-100 text-purple-700',
  'Contract':    'bg-orange-100 text-orange-700',
  'Daily Wage':  'bg-yellow-100 text-yellow-700',
  'Internship':  'bg-pink-100 text-pink-700',
  'Volunteer':   'bg-teal-100 text-teal-700',
  'Remote':      'bg-indigo-100 text-indigo-700',
}

const TABS = ['pending', 'live', 'all'] as const
type Tab = typeof TABS[number]

export default async function AdminJobsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>
}) {
  const { tab: rawTab } = await searchParams
  const activeTab: Tab = TABS.includes(rawTab as Tab) ? (rawTab as Tab) : 'pending'

  let pending: any[] = []
  let live: any[] = []
  let all: any[] = []
  let pendingCount = 0
  let liveCount = 0

  try {
    const supabase = await createClient()
    const [pendingRes, liveRes, allRes] = await Promise.all([
      supabase.from('jobs').select('*').eq('approved', false).neq('status', 'closed').order('created_at', { ascending: false }),
      supabase.from('jobs').select('*').eq('approved', true).order('created_at', { ascending: false }),
      supabase.from('jobs').select('*').order('created_at', { ascending: false }),
    ])
    pending = pendingRes.data ?? []
    live    = liveRes.data ?? []
    all     = allRes.data ?? []
    pendingCount = pending.length
    liveCount    = live.length
  } catch { /* db error */ }

  const displayJobs = activeTab === 'pending' ? pending : activeTab === 'live' ? live : all

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Briefcase size={22} className="text-blue-600" /> Manage Jobs
          </h1>
          <p className="text-gray-500 text-sm mt-0.5">
            {pendingCount} pending · {liveCount} live
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-gray-100 rounded-xl p-1 w-fit">
        {TABS.map(tab => (
          <Link
            key={tab}
            href={`/admin/jobs?tab=${tab}`}
            className={`px-4 py-2 rounded-lg text-sm font-semibold capitalize transition-colors ${
              activeTab === tab ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab} {tab === 'pending' && pendingCount > 0 && (
              <span className="ml-1 bg-amber-100 text-amber-700 text-xs px-1.5 py-0.5 rounded-full">{pendingCount}</span>
            )}
          </Link>
        ))}
      </div>

      {displayJobs.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
          <div className="text-5xl mb-3">✅</div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">
            {activeTab === 'pending' ? 'All caught up!' : 'No jobs here.'}
          </h2>
          <p className="text-gray-500 text-sm">
            {activeTab === 'pending' ? 'No job listings pending review.' : 'Nothing to show.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {displayJobs.map(job => (
            <div key={job.id} className="bg-white rounded-2xl border border-gray-100 p-5">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
                    {!job.approved && job.status !== 'closed' && (
                      <span className="text-xs font-semibold bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">⏳ Pending</span>
                    )}
                    {job.status === 'hiring' && (
                      <span className="text-xs font-semibold bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">Hiring in Progress</span>
                    )}
                    {job.status === 'closed' && (
                      <span className="text-xs font-semibold bg-red-100 text-red-600 px-2 py-0.5 rounded-full">Closed</span>
                    )}
                    {job.approved && job.status !== 'closed' && (
                      <span className="text-xs font-semibold bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Live</span>
                    )}
                    {job.payment_status === 'paid'
                      ? <span className="text-xs font-semibold bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                          Paid {job.amount_paid != null ? `₹${job.amount_paid}` : ''}
                        </span>
                      : job.payment_status === 'free_coupon'
                        ? <span className="text-xs font-semibold bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">
                            Free ({job.coupon_used})
                          </span>
                        : null
                    }
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${TYPE_COLORS[job.type] || 'bg-gray-100 text-gray-600'}`}>
                      {job.type}
                    </span>
                    <span className="text-xs text-gray-500">{job.category}</span>
                  </div>
                  <h3 className="font-bold text-gray-900">{job.title}</h3>
                  <p className="text-sm text-gray-500 mt-0.5">{job.company}</p>
                  <div className="flex flex-wrap gap-3 mt-2 text-xs text-gray-400">
                    {job.location && <span className="flex items-center gap-1"><MapPin size={11} />{job.location}</span>}
                    {job.salary   && <span className="font-medium text-brand">₹ {job.salary}</span>}
                    {job.positions > 1 && <span className="flex items-center gap-1"><Users size={11} />{job.positions} positions</span>}
                    <span className="flex items-center gap-1"><Clock size={11} />{formatDate(job.created_at)}</span>
                  </div>
                  {job.description && (
                    <p className="text-xs text-gray-400 mt-2 line-clamp-2">{job.description}</p>
                  )}
                </div>

                <div className="flex flex-col gap-2 flex-shrink-0">
                  {/* Approve / reject for pending */}
                  {!job.approved && job.status !== 'closed' && (
                    <div className="flex gap-2">
                      <form action={approveContent}>
                        <input type="hidden" name="table" value="jobs" />
                        <input type="hidden" name="id" value={job.id} />
                        <button type="submit"
                          className="inline-flex items-center gap-1 bg-brand hover:bg-brand-strong text-bg text-xs font-semibold px-3 py-2 rounded-lg transition-colors">
                          <CheckCircle size={13} /> Approve
                        </button>
                      </form>
                      <form action={rejectContent}>
                        <input type="hidden" name="table" value="jobs" />
                        <input type="hidden" name="id" value={job.id} />
                        <button type="submit"
                          className="inline-flex items-center gap-1 bg-red-50 hover:bg-red-100 text-red-700 text-xs font-semibold px-3 py-2 rounded-lg transition-colors border border-red-100">
                          <XCircle size={13} /> Reject
                        </button>
                      </form>
                    </div>
                  )}
                  {/* Status management for approved / closed jobs */}
                  {(job.approved || job.status === 'closed') && (
                    <AdminJobStatusButton jobId={job.id} currentStatus={job.status} />
                  )}
                  <Link href={`/jobs/${job.id}`}
                    className="text-xs text-gray-400 hover:text-gray-600 text-center">
                    View →
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
