import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import {
  ArrowRight,
  BadgePercent,
  Calendar,
  CheckCircle,
  Mail,
  MapPin,
  Megaphone,
  Plus,
  Search,
  Shield,
  Users,
} from 'lucide-react'

import { getUserRole } from '@/app/actions/admin'

type Tone = 'amber' | 'blue' | 'green' | 'purple' | 'red' | 'slate'

const TONE_STYLES: Record<Tone, { icon: string; value: string; badge: string }> = {
  amber: {
    icon: 'bg-amber-50 text-amber-700 border-amber-100',
    value: 'text-amber-700',
    badge: 'bg-amber-50 text-amber-700 border-amber-100',
  },
  blue: {
    icon: 'bg-blue-50 text-blue-700 border-blue-100',
    value: 'text-blue-700',
    badge: 'bg-blue-50 text-blue-700 border-blue-100',
  },
  green: {
    icon: 'bg-green-50 text-green-700 border-green-100',
    value: 'text-green-700',
    badge: 'bg-green-50 text-green-700 border-green-100',
  },
  purple: {
    icon: 'bg-purple-50 text-purple-700 border-purple-100',
    value: 'text-purple-700',
    badge: 'bg-purple-50 text-purple-700 border-purple-100',
  },
  red: {
    icon: 'bg-red-50 text-red-700 border-red-100',
    value: 'text-red-700',
    badge: 'bg-red-50 text-red-700 border-red-100',
  },
  slate: {
    icon: 'bg-gray-50 text-gray-700 border-gray-100',
    value: 'text-gray-900',
    badge: 'bg-gray-50 text-gray-700 border-gray-100',
  },
}

function plural(count: number, singular: string) {
  return `${count} ${singular}${count === 1 ? '' : 's'}`
}

export default async function AdminOverviewPage() {
  let pendingEvents = 0
  let pendingListings = 0
  let activeAlerts = 0

  const supabase = await createClient()
  const { role } = await getUserRole(supabase)

  try {
    const [
      eventsRes,
      listingsRes,
      alertsRes,
    ] = await Promise.all([
      supabase.from('events').select('id', { count: 'exact', head: true }).eq('approved', false),
      supabase.from('listings').select('id', { count: 'exact', head: true }).eq('approved', false),
      supabase.from('emergency_alerts').select('id', { count: 'exact', head: true }).eq('active', true),
    ])

    pendingEvents = eventsRes.count ?? 0
    pendingListings = listingsRes.count ?? 0
    activeAlerts = alertsRes.count ?? 0
  } catch {
    // Keep the dashboard usable if local DB/env setup is incomplete.
  }

  const canAdmin = role === 'admin'
  const canModerateContent = role === 'admin' || role === 'moderator'

  const reviewQueues = [
    ...(canModerateContent
      ? [
          {
            label: 'Listings',
            description: 'Business profiles waiting to go live',
            count: pendingListings,
            href: '/admin/listings?filter=pending',
            icon: MapPin,
            tone: 'blue' as Tone,
          },
          {
            label: 'Events',
            description: 'Community events waiting for approval',
            count: pendingEvents,
            href: '/admin/events',
            icon: Calendar,
            tone: 'amber' as Tone,
          },
        ]
      : []),
  ]

  const reviewTotal = reviewQueues.reduce((total, item) => total + item.count, 0)
  const roleLabel = role.charAt(0).toUpperCase() + role.slice(1)

  const statusCards = [
    {
      label: 'Review queue',
      value: reviewTotal,
      detail: reviewTotal > 0 ? 'Items waiting for action' : 'No visible queue items',
      href: '/admin/listings?filter=pending',
      icon: CheckCircle,
      tone: reviewTotal > 0 ? ('amber' as Tone) : ('green' as Tone),
      badge: reviewTotal > 0 ? 'Needs review' : 'Clear',
    },
    ...(canAdmin
      ? [
          {
            label: 'Active alerts',
            value: activeAlerts,
            detail: activeAlerts > 0 ? 'Emergency banners currently live' : 'No live emergency banners',
            href: '/admin/emergency',
            icon: Megaphone,
            tone: activeAlerts > 0 ? ('red' as Tone) : ('slate' as Tone),
            badge: activeAlerts > 0 ? 'Live now' : 'Quiet',
          },
        ]
      : []),
  ]

  const quickActions = [
    ...(canModerateContent
      ? [
          {
            label: 'Review listings',
            detail: plural(pendingListings, 'pending listing'),
            href: '/admin/listings?filter=pending',
            icon: MapPin,
          },
          {
            label: 'Review events',
            detail: plural(pendingEvents, 'pending event'),
            href: '/admin/events',
            icon: Calendar,
          },
        ]
      : []),
    ...(canAdmin
      ? [
          {
            label: 'New listing',
            detail: 'Add a business manually',
            href: '/admin/listings/new',
            icon: Plus,
          },
          {
            label: 'Emergency alert',
            detail: activeAlerts > 0
              ? `${activeAlerts} ${activeAlerts === 1 ? 'alert' : 'alerts'} live`
              : 'Create a public alert',
            href: '/admin/emergency',
            icon: Megaphone,
          },
          {
            label: 'Newsletter',
            detail: 'Send an update to subscribers',
            href: '/admin/newsletter',
            icon: Mail,
          },
          {
            label: 'Pricing',
            detail: 'Plans, prices, and coupons',
            href: '/admin/pricing',
            icon: BadgePercent,
          },
          {
            label: 'Roles',
            detail: 'Manage staff access',
            href: '/admin/roles',
            icon: Users,
          },
          {
            label: 'Find Directory',
            detail: 'Approve professionals & ratings',
            href: '/admin/find',
            icon: Search,
          },
        ]
      : []),
  ]

  return (
    <div className="space-y-7">
      <section className="flex flex-col gap-4 border-b border-gray-200 pb-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-3xl">
          <p className="text-sm font-semibold text-[var(--od-brand)]">Admin dashboard</p>
          <h1 className="mt-1 text-3xl font-bold text-gray-950">Today&apos;s control room</h1>
          <p className="mt-2 text-sm leading-6 text-gray-600">
            Signed in as {roleLabel}. Review queues, urgent alerts, and frequent admin tasks are grouped for faster daily checks.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/admin/listings?filter=pending"
            className="inline-flex h-10 items-center gap-2 rounded-md bg-[var(--od-ink)] px-3 text-sm font-semibold text-white transition-colors hover:bg-[var(--od-brand-strong)]"
          >
            <CheckCircle size={15} />
            Review queue
          </Link>
          {canAdmin && (
            <Link
              href="/admin/emergency"
              className="inline-flex h-10 items-center gap-2 rounded-md border border-red-200 bg-white px-3 text-sm font-semibold text-red-700 transition-colors hover:bg-red-50"
            >
              <Megaphone size={15} />
              Alerts
            </Link>
          )}
        </div>
      </section>

      <section aria-label="Admin status" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {statusCards.map((card) => {
          const Icon = card.icon
          const tone = TONE_STYLES[card.tone]

          return (
            <Link
              key={card.label}
              href={card.href}
              className="group rounded-lg border border-gray-200 bg-white p-4 shadow-sm transition-all hover:border-[rgba(192,88,46,0.35)] hover:shadow-md"
            >
              <div className="flex items-start justify-between gap-3">
                <span className={`flex h-10 w-10 items-center justify-center rounded-md border ${tone.icon}`}>
                  <Icon size={18} />
                </span>
                <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${tone.badge}`}>
                  {card.badge}
                </span>
              </div>
              <p className={`mt-4 text-3xl font-bold ${tone.value}`}>{card.value}</p>
              <div className="mt-1 flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-sm font-bold text-gray-950">{card.label}</h2>
                  <p className="mt-0.5 text-xs leading-5 text-gray-500">{card.detail}</p>
                </div>
                <ArrowRight size={15} className="text-gray-300 transition-colors group-hover:text-[var(--od-brand)]" />
              </div>
            </Link>
          )
        })}
      </section>

      <section className="grid gap-5 lg:grid-cols-[1.08fr_0.92fr]">
        <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
          <div className="flex items-center justify-between gap-3 border-b border-gray-100 px-5 py-4">
            <div>
              <h2 className="text-base font-bold text-gray-950">Priority queues</h2>
              <p className="mt-0.5 text-xs text-gray-500">Sorted by what usually needs a decision first.</p>
            </div>
            <span className="rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1 text-xs font-semibold text-gray-700">
              {plural(reviewTotal, 'item')}
            </span>
          </div>

          <div className="divide-y divide-gray-100">
            {reviewQueues.map((queue) => {
              const Icon = queue.icon
              const tone = TONE_STYLES[queue.tone]

              return (
                <Link
                  key={queue.label}
                  href={queue.href}
                  className="group flex items-center justify-between gap-4 px-5 py-4 transition-colors hover:bg-gray-50"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-md border ${tone.icon}`}>
                      <Icon size={17} />
                    </span>
                    <div className="min-w-0">
                      <h3 className="truncate text-sm font-bold text-gray-950">{queue.label}</h3>
                      <p className="mt-0.5 truncate text-xs text-gray-500">{queue.description}</p>
                    </div>
                  </div>
                  <div className="flex flex-shrink-0 items-center gap-3">
                    <span className={`min-w-10 rounded-md px-2.5 py-1 text-center text-sm font-bold ${tone.badge}`}>
                      {queue.count}
                    </span>
                    <ArrowRight size={15} className="text-gray-300 transition-colors group-hover:text-[var(--od-brand)]" />
                  </div>
                </Link>
              )
            })}
          </div>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-100 px-5 py-4">
            <h2 className="text-base font-bold text-gray-950">Quick actions</h2>
            <p className="mt-0.5 text-xs text-gray-500">Short paths for common admin work.</p>
          </div>
          <div className="grid divide-y divide-gray-100">
            {quickActions.map((action) => {
              const Icon = action.icon

              return (
                <Link
                  key={`${action.href}-${action.label}`}
                  href={action.href}
                  className="group flex items-center justify-between gap-3 px-5 py-3.5 transition-colors hover:bg-gray-50"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-md border border-gray-200 bg-gray-50 text-gray-700">
                      <Icon size={16} />
                    </span>
                    <div className="min-w-0">
                      <h3 className="truncate text-sm font-bold text-gray-950">{action.label}</h3>
                      <p className="mt-0.5 truncate text-xs text-gray-500">{action.detail}</p>
                    </div>
                  </div>
                  <ArrowRight size={15} className="flex-shrink-0 text-gray-300 transition-colors group-hover:text-[var(--od-brand)]" />
                </Link>
              )
            })}
          </div>
        </div>
      </section>

      <section className="grid gap-5">
        <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <Shield size={17} className="text-[var(--od-brand)]" />
            <h2 className="text-base font-bold text-gray-950">Operating rhythm</h2>
          </div>
          <div className="mt-4 space-y-3 text-sm">
            <div className="flex gap-3">
              <CheckCircle size={16} className={reviewTotal > 0 ? 'mt-0.5 text-amber-600' : 'mt-0.5 text-green-600'} />
              <div>
                <p className="font-semibold text-gray-900">
                  {reviewTotal > 0 ? 'Review queue has work' : 'Review queue is clear'}
                </p>
                <p className="mt-0.5 text-xs leading-5 text-gray-500">
                  {reviewTotal > 0
                    ? 'Start with pending listings and events.'
                    : 'No visible approval queue items for your role.'}
                </p>
              </div>
            </div>
            {canAdmin && (
              <div className="flex gap-3">
                <Megaphone size={16} className={activeAlerts > 0 ? 'mt-0.5 text-red-600' : 'mt-0.5 text-gray-400'} />
                <div>
                  <p className="font-semibold text-gray-900">
                    {activeAlerts > 0
                      ? `${activeAlerts} ${activeAlerts === 1 ? 'alert is' : 'alerts are'} live`
                      : 'No emergency alerts live'}
                  </p>
                  <p className="mt-0.5 text-xs leading-5 text-gray-500">
                    Keep live alerts current so the public banner stays trustworthy.
                  </p>
                </div>
              </div>
            )}
            {canAdmin && (
              <div className="flex gap-3">
                <BadgePercent size={16} className="mt-0.5 text-gray-400" />
                <div>
                  <p className="font-semibold text-gray-900">Check pricing before campaigns</p>
                  <p className="mt-0.5 text-xs leading-5 text-gray-500">
                    Pricing, coupons, orders, and payment settings are grouped in the top navigation.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  )
}
