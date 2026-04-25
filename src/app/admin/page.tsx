import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Calendar, MapPin, Megaphone, MessageCircle, Clock, CheckCircle } from 'lucide-react'

function timeAgo(dateStr: string) {
  const date = new Date(dateStr)
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const hours = Math.floor(diff / 3600000)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

export default async function AdminOverviewPage() {
  let pendingEvents = 0
  let pendingListings = 0
  let activeAlerts = 0
  let recentThreads: Record<string, unknown>[] = []

  try {
    const supabase = await createClient()

    const [eventsRes, listingsRes, alertsRes, threadsRes] = await Promise.all([
      supabase.from('events').select('*', { count: 'exact', head: true }).eq('approved', false),
      supabase.from('listings').select('*', { count: 'exact', head: true }).eq('approved', false),
      supabase.from('emergency_alerts').select('*', { count: 'exact', head: true }).eq('active', true),
      supabase.from('forum_threads').select('id, title, author_name, created_at, category').order('created_at', { ascending: false }).limit(5),
    ])

    pendingEvents = eventsRes.count || 0
    pendingListings = listingsRes.count || 0
    activeAlerts = alertsRes.count || 0
    recentThreads = threadsRes.data || []
  } catch {
    // DB not ready — use defaults
  }

  const stats = [
    {
      label: 'Pending Events',
      value: pendingEvents,
      icon: <Calendar size={20} />,
      color: 'bg-orange-50 border-orange-100',
      iconColor: 'text-orange-600 bg-orange-100',
      href: '/admin/events',
      urgency: pendingEvents > 0,
    },
    {
      label: 'Pending Listings',
      value: pendingListings,
      icon: <MapPin size={20} />,
      color: 'bg-blue-50 border-blue-100',
      iconColor: 'text-blue-600 bg-blue-100',
      href: '/admin/listings',
      urgency: pendingListings > 0,
    },
    {
      label: 'Active Alerts',
      value: activeAlerts,
      icon: <Megaphone size={20} />,
      color: 'bg-red-50 border-red-100',
      iconColor: 'text-red-600 bg-red-100',
      href: '/admin/emergency',
      urgency: activeAlerts > 0,
    },
  ]

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Admin Overview</h1>
        <p className="text-gray-500 text-sm mt-1">Manage community content and moderation for OurDahanu</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-10">
        {stats.map(stat => (
          <Link
            key={stat.label}
            href={stat.href}
            className={`border rounded-2xl p-6 hover:shadow-md transition-all ${stat.color} ${stat.urgency ? 'ring-2 ring-orange-200' : ''}`}
          >
            <div className="flex items-start justify-between mb-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${stat.iconColor}`}>
                {stat.icon}
              </div>
              {stat.urgency && stat.value > 0 && (
                <span className="text-xs font-bold bg-red-500 text-white px-2 py-0.5 rounded-full">
                  Action needed
                </span>
              )}
            </div>
            <div className="text-3xl font-bold text-gray-900 mb-1">{stat.value}</div>
            <div className="text-sm text-gray-600 font-medium">{stat.label}</div>
          </Link>
        ))}
      </div>

      {/* Recent forum threads */}
      <div className="bg-white rounded-2xl border border-gray-100 p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <MessageCircle size={18} className="text-brand" />
            Recent Forum Threads
          </h2>
          <Link href="/admin/forum" className="text-sm text-brand hover:text-brand-strong font-medium">
            Manage all &rarr;
          </Link>
        </div>

        {recentThreads.length === 0 ? (
          <p className="text-gray-400 text-sm text-center py-8">No recent forum activity.</p>
        ) : (
          <div className="space-y-3">
            {recentThreads.map(thread => (
              <div key={thread.id as string} className="flex items-start justify-between gap-4 py-3 border-b border-gray-50 last:border-0">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 text-sm truncate">{thread.title as string}</p>
                  <div className="flex items-center gap-2 mt-0.5 text-xs text-gray-400">
                    <span>by {thread.author_name as string}</span>
                    <span>·</span>
                    <span>{thread.category as string}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-gray-400 flex-shrink-0">
                  <Clock size={11} />
                  {timeAgo(thread.created_at as string)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Quick links */}
      <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Link href="/admin/emergency" className="bg-red-50 border border-red-100 rounded-2xl p-5 hover:shadow-md transition-all">
          <div className="flex items-center gap-3">
            <Megaphone size={20} className="text-red-600" />
            <div>
              <h3 className="font-bold text-gray-900 text-sm">Create Emergency Alert</h3>
              <p className="text-xs text-gray-500">Broadcast critical information to the community</p>
            </div>
          </div>
        </Link>
        <div className="bg-green-50 border border-green-100 rounded-2xl p-5">
          <div className="flex items-center gap-3">
            <CheckCircle size={20} className="text-green-600" />
            <div>
              <h3 className="font-bold text-gray-900 text-sm">
                {pendingEvents + pendingListings} items pending approval
              </h3>
              <p className="text-xs text-gray-500">Review events and listings before they go live</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
