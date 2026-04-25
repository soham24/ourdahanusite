import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Bell } from 'lucide-react'

import {
  getNotificationPreferences,
  getRecentNotifications,
} from '@/app/actions/notifications'
import { createClient } from '@/lib/supabase/server'

import NotificationsInbox from './NotificationsInbox'
import PreferencesForm from './PreferencesForm'
import TelegramConnect from './TelegramConnect'

export default async function NotificationsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login?redirect=' + encodeURIComponent('/account/notifications'))
  }

  const [prefs, initial] = await Promise.all([
    getNotificationPreferences(),
    getRecentNotifications(30),
  ])

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10 space-y-8">
      <header className="flex items-center gap-3">
        <div className="w-10 h-10 bg-surface-soft rounded-xl flex items-center justify-center">
          <Bell size={20} className="text-brand" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Notifications</h1>
          <p className="text-sm text-gray-500">
            Your inbox, delivery channels, and mute controls
          </p>
        </div>
      </header>

      <section>
        <NotificationsInbox initial={initial} />
      </section>

      <section className="bg-white border border-gray-100 rounded-2xl p-5 sm:p-6 space-y-5">
        <div>
          <h2 className="font-semibold text-gray-900">Delivery channels</h2>
          <p className="text-xs text-gray-500 mt-1">
            Choose where we reach you. In-app notifications always appear in the bell icon.
          </p>
        </div>
        <PreferencesForm initial={prefs} />
      </section>

      <section className="bg-white border border-gray-100 rounded-2xl p-5 sm:p-6">
        <h2 className="font-semibold text-gray-900 mb-1">Telegram</h2>
        <p className="text-xs text-gray-500 mb-4">
          Receive realtime pings in Telegram for new orders, appointments and reviews.
        </p>
        <TelegramConnect
          connected={Boolean(prefs?.telegram_chat_id)}
          verifiedAt={prefs?.telegram_verified_at ?? null}
        />
      </section>

      <p className="text-xs text-gray-400 text-center">
        Need help? <Link href="/contact" className="text-brand hover:underline">Contact support</Link>
      </p>
    </div>
  )
}
