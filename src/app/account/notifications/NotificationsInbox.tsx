'use client'

import Link from 'next/link'
import { useState, useTransition } from 'react'
import {
  AlertCircle,
  Bell,
  Calendar,
  CheckCheck,
  CheckCircle,
  Clock,
  ShoppingBag,
  Star,
  XCircle,
  type LucideIcon,
} from 'lucide-react'

import {
  markAllNotificationsRead,
  markNotificationRead,
  type NotificationRow,
} from '@/app/actions/notifications'

const ICON_MAP: Record<string, LucideIcon> = {
  Bell,
  ShoppingBag,
  Calendar,
  Clock,
  CheckCircle,
  XCircle,
  Star,
  AlertCircle,
}

function IconFor({ name }: { name: string | null }) {
  const Icon = (name && ICON_MAP[name]) || Bell
  return <Icon size={16} />
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
}

export default function NotificationsInbox({
  initial,
}: {
  initial: NotificationRow[]
}) {
  const [items, setItems] = useState(initial)
  const [isPending, startTransition] = useTransition()

  const unreadCount = items.filter((i) => !i.read_at).length

  const handleClick = (row: NotificationRow) => {
    if (row.read_at) return
    setItems((prev) =>
      prev.map((r) =>
        r.id === row.id ? { ...r, read_at: new Date().toISOString() } : r,
      ),
    )
    void markNotificationRead(row.id)
  }

  const handleMarkAll = () => {
    const now = new Date().toISOString()
    setItems((prev) => prev.map((r) => ({ ...r, read_at: r.read_at ?? now })))
    startTransition(() => {
      void markAllNotificationsRead()
    })
  }

  return (
    <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
        <div>
          <p className="font-semibold text-gray-900 text-sm">Inbox</p>
          <p className="text-xs text-gray-400">
            {unreadCount === 0
              ? 'All caught up'
              : `${unreadCount} unread notification${unreadCount === 1 ? '' : 's'}`}
          </p>
        </div>
        {unreadCount > 0 && (
          <button
            type="button"
            onClick={handleMarkAll}
            disabled={isPending}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand hover:text-brand-strong disabled:opacity-50"
          >
            <CheckCheck size={14} />
            Mark all read
          </button>
        )}
      </div>

      {items.length === 0 ? (
        <div className="text-center py-14">
          <div className="w-14 h-14 bg-surface-soft rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Bell size={24} className="text-brand" />
          </div>
          <p className="font-semibold text-gray-700">No notifications yet</p>
          <p className="text-xs text-gray-400 mt-1 max-w-xs mx-auto">
            Order updates, appointment reminders and community alerts will show up here.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-gray-50">
          {items.map((row) => {
            const unread = !row.read_at
            const link = row.link || '/account/notifications'
            return (
              <li key={row.id}>
                <Link
                  href={link}
                  onClick={() => handleClick(row)}
                  className={`flex gap-3 px-5 py-4 transition-colors ${
                    unread
                      ? 'bg-surface-soft/40 hover:bg-surface-soft/70'
                      : 'hover:bg-gray-50'
                  }`}
                >
                  <div
                    className={`flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center ${
                      unread
                        ? 'bg-brand text-bg'
                        : 'bg-gray-100 text-gray-500'
                    }`}
                  >
                    <IconFor name={row.icon} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start gap-2">
                      <p
                        className={`text-sm flex-1 ${
                          unread ? 'font-semibold text-gray-900' : 'text-gray-700'
                        }`}
                      >
                        {row.title}
                      </p>
                      {unread && (
                        <span
                          aria-hidden
                          className="mt-1.5 w-2 h-2 bg-brand rounded-full flex-shrink-0"
                        />
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5 line-clamp-3">{row.body}</p>
                    <p className="text-[10px] text-gray-400 mt-1">
                      {formatDateTime(row.created_at)}
                      <span className="mx-1.5">·</span>
                      <span className="uppercase tracking-wide">{row.type}</span>
                    </p>
                  </div>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

