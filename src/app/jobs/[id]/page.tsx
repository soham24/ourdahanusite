import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import { createPublicClient } from '@/lib/supabase/public'
import { buildAbsoluteUrl } from '@/lib/site'
import { MapPin, Clock, Users, Mail, Phone, MessageCircle, ArrowLeft, Briefcase } from 'lucide-react'
import JobStatusButton from './JobStatusButton'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params
  const supabase = createPublicClient()

  const { data: jobData } = await supabase
    .from('jobs')
    .select('title, company, description, location, type, category')
    .eq('id', id)
    .single()

  const job = jobData as {
    title: string
    company: string | null
    description: string | null
    location: string | null
    type: string | null
    category: string | null
  } | null

  if (!job) {
    return { title: 'Job Not Found | OurDahanu' }
  }

  const description = job.description
    ? job.description.slice(0, 160).replace(/\s+/g, ' ').trim() + (job.description.length > 160 ? '…' : '')
    : `${job.type} job at ${job.company || 'a local business'} in Dahanu.`

  const titleParts = [job.title]
  if (job.company) titleParts.push(job.company)
  const pageTitle = `${titleParts.join(' — ')} | Jobs | OurDahanu`

  const jobUrl = buildAbsoluteUrl(`/jobs/${id}`)

  return {
    title: pageTitle,
    description,
    alternates: { canonical: jobUrl },
    openGraph: {
      title: `${job.title}${job.company ? ` at ${job.company}` : ''}`,
      description,
      url: jobUrl,
      type: 'article',
      siteName: 'OurDahanu',
    },
    twitter: {
      card: 'summary',
      title: `${job.title}${job.company ? ` at ${job.company}` : ''}`,
      description,
    },
  }
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

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
}

function JobDetailFallback() {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
      <div className="h-5 w-28 rounded-lg bg-gray-200" />
      <div className="mt-6 h-[32rem] rounded-2xl bg-gray-200" />
    </div>
  )
}

async function JobDetailContent({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const [{ data: job }, { data: { user } }] = await Promise.all([
    supabase
      .from('jobs')
      .select('*')
      .eq('id', id)
      .single(),
    supabase.auth.getUser(),
  ])

  if (!job) notFound()

  const isPoster = user?.id === job.posted_by

  // Check admin
  let isAdmin = false
  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()
    isAdmin = profile?.role === 'admin' || profile?.role === 'moderator'
  }

  const canManage = isPoster || isAdmin

  if (!job.approved && job.status !== 'closed' && !canManage) notFound()

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
      <Link href="/jobs" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-6">
        <ArrowLeft size={14} /> Back to Jobs
      </Link>

      <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-gray-100">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-xl bg-warli-light flex items-center justify-center flex-shrink-0">
              <Briefcase size={26} className="text-warli-terra" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap gap-1.5 mb-2">
                {job.status === 'hiring' && (
                  <span className="text-xs font-semibold bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
                    Hiring in Progress
                  </span>
                )}
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${TYPE_COLORS[job.type] || 'bg-gray-100 text-gray-600'}`}>
                  {job.type}
                </span>
                <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">{job.category}</span>
              </div>
              <h1 className="text-2xl font-bold text-gray-900">{job.title}</h1>
              <p className="text-gray-600 mt-1 font-medium">{job.company}</p>
            </div>
          </div>

          {/* Meta row */}
          <div className="flex flex-wrap gap-4 mt-4 text-sm text-gray-500">
            {job.location && <span className="flex items-center gap-1.5"><MapPin size={14} />{job.location}</span>}
            {job.salary   && <span className="font-semibold text-warli-terra">₹ {job.salary}</span>}
            {job.positions > 1 && <span className="flex items-center gap-1.5"><Users size={14} />{job.positions} positions</span>}
            <span className="flex items-center gap-1.5"><Clock size={14} />Posted {formatDate(job.created_at)}</span>
          </div>
        </div>

        {/* Body */}
        <div className="p-6 space-y-6">
          <div>
            <h2 className="font-bold text-gray-800 mb-3">Job Description</h2>
            <p className="text-gray-700 text-sm leading-relaxed whitespace-pre-line">{job.description}</p>
          </div>

          {job.requirements && (
            <div>
              <h2 className="font-bold text-gray-800 mb-3">Requirements</h2>
              <p className="text-gray-700 text-sm leading-relaxed whitespace-pre-line">{job.requirements}</p>
            </div>
          )}

          {/* How to apply */}
          {(job.contact_email || job.contact_phone) && (
            <div className="bg-warli-light border border-warli-sand rounded-xl p-5">
              <h2 className="font-bold text-gray-800 mb-3">How to Apply</h2>
              <div className="space-y-2">
                {job.contact_email && (
                  <a href={`mailto:${job.contact_email}`}
                    className="flex items-center gap-2 text-sm text-warli-terra hover:underline font-medium">
                    <Mail size={15} />{job.contact_email}
                  </a>
                )}
                {job.contact_phone && (() => {
                  const raw = job.contact_phone as string
                  // Stored as 91XXXXXXXXXX — display as +91 XXXXX XXXXX
                  const display = raw.startsWith('91') && raw.length === 12
                    ? `+91 ${raw.slice(2, 7)} ${raw.slice(7)}`
                    : raw
                  const type = (job.contact_phone_type as string) || 'both'
                  const waLink = `https://wa.me/${raw.startsWith('91') ? raw : '91' + raw}`
                  const telLink = `tel:+${raw.startsWith('91') ? raw : '91' + raw}`

                  return (
                    <div className="flex flex-wrap gap-2">
                      {(type === 'call' || type === 'both') && (
                        <a href={telLink}
                          className="inline-flex items-center gap-1.5 bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-700 text-sm font-semibold px-4 py-2 rounded-xl transition-colors">
                          <Phone size={14} /> Call {display}
                        </a>
                      )}
                      {(type === 'whatsapp' || type === 'both') && (
                        <a href={waLink} target="_blank" rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 bg-green-50 hover:bg-green-100 border border-green-200 text-green-700 text-sm font-semibold px-4 py-2 rounded-xl transition-colors">
                          <MessageCircle size={14} /> WhatsApp {display}
                        </a>
                      )}
                    </div>
                  )
                })()}
              </div>
            </div>
          )}

          {/* Status management (poster or admin) */}
          {canManage && (
            <div className="border-t border-gray-100 pt-5">
              <h2 className="font-bold text-gray-800 mb-1">Manage This Job</h2>
              <p className="text-xs text-gray-400 mb-3">
                Current status: <span className="font-semibold capitalize">{job.status}</span>
              </p>
              <JobStatusButton jobId={job.id} currentStatus={job.status} />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function JobDetailPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<JobDetailFallback />}>
      <JobDetailContent params={params} />
    </Suspense>
  )
}
