'use client'

import Link from 'next/link'
import { useCallback, useEffect, useId, useRef, useState } from 'react'
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
  getRecentNotifications,
  getUnreadCount,
  markAllNotificationsRead,
  markNotificationRead,
  type NotificationRow,
} from '@/app/actions/notifications'
import { createPollScheduler } from '@/lib/notifications/poll-schedule'

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

function IconForType({ name, className }: { name: string | null; className?: string }) {
  const Icon = (name && ICON_MAP[name]) || Bell
  return <Icon size={16} className={className} />
}

function formatRelative(iso: string): string {
  const now = Date.now()
  const then = new Date(iso).getTime()
  const diff = Math.max(0, now - then)
  const s = Math.floor(diff / 1000)
  if (s < 60) return 'just now'
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  if (d < 7) return `${d}d ago`
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}

export default function NotificationBell({ userId }: { userId: string }) {
  const [open, setOpen] = useState(false)
  const [unread, setUnread] = useState(0)
  const [items, setItems] = useState<NotificationRow[]>([])
  const [loading, setLoading] = useState(false)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const buttonRef = useRef<HTMLButtonElement | null>(null)
  const panelId = useId()

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const [list, count] = await Promise.all([
        getRecentNotifications(15),
        getUnreadCount(),
      ])
      setItems(list)
      setUnread(count)
    } catch {
      // Offline: keep the last list rather than spin forever.
    } finally {
      setLoading(false)
    }
  }, [])

  // Poll (instead of Supabase Realtime, whose WAL polling was our top database
  // cost): every 60s while the tab is visible, immediately on becoming visible.
  // While the panel is open the list is refreshed along with the count.
  const openRef = useRef(open)
  useEffect(() => {
    openRef.current = open
  }, [open])

  useEffect(() => {
    if (!userId) return
    const scheduler = createPollScheduler({
      run: async () => {
        if (openRef.current) {
          const [list, count] = await Promise.all([
            getRecentNotifications(15),
            getUnreadCount(),
          ])
          setItems(list)
          setUnread(count)
        } else {
          setUnread(await getUnreadCount())
        }
      },
      isVisible: () => document.visibilityState === 'visible',
      setTimer: (fn, ms) => window.setTimeout(fn, ms),
      clearTimer: (handle) => window.clearTimeout(handle as number),
    })
    const onVisibility = () => scheduler.visibilityChanged()
    document.addEventListener('visibilitychange', onVisibility)
    scheduler.start()
    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      scheduler.stop()
    }
  }, [userId])

  // Close on outside click
  useEffect(() => {
    if (!open) return
    const onClick = (event: MouseEvent) => {
      if (!containerRef.current) return
      if (!containerRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      setOpen(false)
      buttonRef.current?.focus()
    }
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  const handleRowClick = async (row: NotificationRow) => {
    if (!row.read_at) {
      setItems((prev) =>
        prev.map((r) =>
          r.id === row.id ? { ...r, read_at: new Date().toISOString() } : r,
        ),
      )
      setUnread((c) => Math.max(0, c - 1))
      void markNotificationRead(row.id)
    }
    setOpen(false)
  }

  const handleMarkAllRead = async () => {
    const now = new Date().toISOString()
    setItems((prev) => prev.map((r) => ({ ...r, read_at: r.read_at ?? now })))
    setUnread(0)
    await markAllNotificationsRead()
  }

  const handleToggleOpen = () => {
    if (!open) void refresh()
    setOpen((v) => !v)
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={handleToggleOpen}
        aria-label={unread > 0 ? `Notifications, ${unread} unread` : 'Notifications'}
        aria-haspopup="dialog"
        aria-expanded={open}
        // Only while the panel is mounted, so the reference never dangles.
        aria-controls={open ? panelId : undefined}
        className="relative flex items-center justify-center w-9 h-9 rounded-lg text-ink-2 hover:text-brand hover:bg-surface-soft transition-colors"
      >
        <Bell size={18} />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] rounded-full bg-brand text-bg text-[10px] font-bold flex items-center justify-center px-1 leading-none">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          id={panelId}
          role="dialog"
          aria-label="Notifications"
          className="absolute right-0 mt-2 w-[340px] sm:w-[380px] bg-white rounded-2xl shadow-xl border border-border/60 overflow-hidden z-[60]">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <p className="text-sm font-bold text-ink">Notifications</p>
            {unread > 0 && (
              <button
                type="button"
                onClick={handleMarkAllRead}
                className="inline-flex items-center gap-1 text-xs text-brand hover:text-brand-strong font-semibold"
              >
                <CheckCheck size={12} />
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-[440px] overflow-y-auto">
            {loading && items.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-10">Loading…</p>
            ) : items.length === 0 ? (
              <div className="text-center py-10 px-6">
                <div className="w-12 h-12 bg-surface-soft rounded-2xl flex items-center justify-center mx-auto mb-3">
                  <Bell size={22} className="text-brand" />
                </div>
                <p className="text-sm font-semibold text-gray-700">All caught up</p>
                <p className="text-xs text-gray-400 mt-1">
                  You&apos;ll see orders, appointments and alerts here.
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-gray-50">
                {items.map((row) => {
                  const unreadRow = !row.read_at
                  const link = row.link || '/account/notifications'
                  return (
                    <li key={row.id}>
                      <Link
                        href={link}
                        onClick={() => void handleRowClick(row)}
                        className={`flex gap-3 px-4 py-3 transition-colors ${
                          unreadRow
                            ? 'bg-surface-soft/40 hover:bg-surface-soft/70'
                            : 'hover:bg-gray-50'
                        }`}
                      >
                        <div
                          className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                            unreadRow
                              ? 'bg-brand text-bg'
                              : 'bg-gray-100 text-gray-500'
                          }`}
                        >
                          <IconForType name={row.icon} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start gap-2">
                            <p
                              className={`text-sm flex-1 ${
                                unreadRow
                                  ? 'font-semibold text-gray-900'
                                  : 'text-gray-700'
                              }`}
                            >
                              {row.title}
                            </p>
                            {unreadRow && (
                              <span
                                aria-hidden
                                className="mt-1.5 w-2 h-2 bg-brand rounded-full flex-shrink-0"
                              />
                            )}
                          </div>
                          <p className="text-xs text-gray-500 line-clamp-2 mt-0.5">{row.body}</p>
                          <p className="text-[10px] text-gray-400 mt-1">
                            {formatRelative(row.created_at)}
                          </p>
                        </div>
                      </Link>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>

          <Link
            href="/account/notifications"
            onClick={() => setOpen(false)}
            className="block text-center text-xs font-semibold text-brand hover:bg-surface-soft/50 py-3 border-t border-gray-100"
          >
            See all notifications
          </Link>
        </div>
      )}
    </div>
  )
}

