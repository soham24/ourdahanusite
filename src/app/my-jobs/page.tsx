import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Briefcase, MapPin, Clock, Users, Plus } from 'lucide-react'
import JobStatusButton from '@/app/jobs/[id]/JobStatusButton'

export const unstable_instant = false

const TYPE_COLORS: Record<string, string> = {
  'Full-time':   'bg-blue-100 text-blue-700',
  'Part-time':   'bg-purple-100 text-purple-700',
  'Contract':    'bg-orange-100 text-orange-700',
  'Daily Wage':  'bg-yellow-100 text-yellow-700',
  'Internship':  'bg-pink-100 text-pink-700',
  'Volunteer':   'bg-teal-100 text-teal-700',
  'Remote':      'bg-indigo-100 text-indigo-700',
}

function statusBadge(status: string) {
  if (status === 'hiring')  return <span className="text-xs font-semibold bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">Hiring in Progress</span>
  if (status === 'closed')  return <span className="text-xs font-semibold bg-red-100 text-red-600 px-2 py-0.5 rounded-full">Closed</span>
  return <span className="text-xs font-semibold bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Open</span>
}

function approvalBadge(approved: boolean, status: string) {
  if (status === 'closed') return null
  if (!approved) return <span className="text-xs font-semibold bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">Pending Review</span>
  return <span className="text-xs font-semibold bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">Live</span>
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default async function MyJobsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?next=/my-jobs')

  let jobs: any[] = []
  try {
    const { data } = await supabase
      .from('jobs')
      .select('*')
      .eq('posted_by', user.id)
      .order('created_at', { ascending: false })
    jobs = data ?? []
  } catch { /* db not ready */ }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Job Postings</h1>
          <p className="text-gray-500 text-sm mt-1">{jobs.length} posting{jobs.length !== 1 ? 's' : ''}</p>
        </div>
        <Link href="/jobs/submit"
          className="inline-flex items-center gap-2 bg-warli-terra hover:bg-warli-deep text-warli-cream font-semibold px-4 py-2.5 rounded-xl transition-colors text-sm">
          <Plus size={15} /> Post New Job
        </Link>
      </div>

      {jobs.length === 0 ? (
        <div className="text-center py-20 bg-white border border-gray-100 rounded-2xl">
          <div className="text-5xl mb-4">💼</div>
          <h2 className="text-lg font-bold text-gray-900 mb-2">No jobs posted yet</h2>
          <p className="text-gray-500 text-sm mb-5">Post your first job and reach local candidates.</p>
          <Link href="/jobs/submit"
            className="inline-flex items-center gap-2 bg-warli-terra hover:bg-warli-deep text-warli-cream font-semibold px-5 py-3 rounded-xl transition-colors text-sm">
            <Plus size={15} /> Post a Job
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {jobs.map(job => (
            <div key={job.id} className={`bg-white border rounded-2xl p-5 ${job.status === 'closed' ? 'opacity-60 border-gray-100' : 'border-gray-200'}`}>
              <div className="flex items-start gap-3 mb-3">
                <div className="w-11 h-11 rounded-xl bg-warli-light flex items-center justify-center flex-shrink-0">
                  <Briefcase size={20} className="text-warli-terra" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap gap-1.5 mb-1">
                    {statusBadge(job.status)}
                    {approvalBadge(job.approved, job.status)}
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${TYPE_COLORS[job.type] || 'bg-gray-100 text-gray-600'}`}>
                      {job.type}
                    </span>
                  </div>
                  <Link href={`/jobs/${job.id}`} className="font-bold text-gray-900 hover:text-warli-terra transition-colors">
                    {job.title}
                  </Link>
                  <p className="text-sm text-gray-500 mt-0.5">{job.company}</p>
                </div>
              </div>

              <div className="flex flex-wrap gap-3 text-xs text-gray-400 mb-4">
                {job.location && <span className="flex items-center gap-1"><MapPin size={11} />{job.location}</span>}
                {job.positions > 1 && <span className="flex items-center gap-1"><Users size={11} />{job.positions} positions</span>}
                <span className="flex items-center gap-1"><Clock size={11} />Posted {formatDate(job.created_at)}</span>
                {job.amount_paid != null && (
                  <span className="text-green-600 font-medium">
                    {job.amount_paid === 0 ? 'Free (coupon)' : `Paid ₹${job.amount_paid}`}
                  </span>
                )}
              </div>

              <JobStatusButton jobId={job.id} currentStatus={job.status} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
