'use client'

import { useState, useTransition } from 'react'
import {
  AtSign,
  Bell,
  CheckCircle2,
  Loader2,
  MessageCircle,
  Save,
  Send,
} from 'lucide-react'

import {
  setTypeMuted,
  updateNotificationPreferences,
  type NotificationPreferencesRow,
} from '@/app/actions/notifications'
import { NOTIFICATION_TYPES, type NotificationType } from '@/lib/notifications/types'

interface PreferencesFormProps {
  initial: NotificationPreferencesRow | null
}

const DEFAULT_STATE: Omit<NotificationPreferencesRow, 'user_id'> = {
  email_enabled: true,
  in_app_enabled: true,
  telegram_enabled: false,
  whatsapp_enabled: true,
  telegram_chat_id: null,
  telegram_verified_at: null,
  muted_types: [],
}

const TYPE_LABELS: Record<NotificationType, { label: string; hint: string }> = {
  'order.placed': { label: 'Order placed', hint: 'When a new order comes in or you place one' },
  'order.fulfilled': { label: 'Order fulfilled', hint: 'When an order is marked complete' },
  'order.cancelled': { label: 'Order cancelled', hint: 'When an order is cancelled' },
  'appointment.booked': { label: 'Appointment booked', hint: 'New booking confirmations' },
  'appointment.reminder': { label: 'Appointment reminders', hint: 'Day-of reminders before a visit' },
  'appointment.cancelled': { label: 'Appointment cancelled', hint: 'When a visit is cancelled' },
  'listing.approved': { label: 'Listing approved', hint: 'When your listing goes live' },
  'listing.rejected': { label: 'Listing rejected', hint: 'When a submission needs edits' },
  'listing.expiring': { label: 'Listing expiring', hint: 'Renewal reminders' },
  'review.new': { label: 'New reviews', hint: 'When someone reviews your listing' },
  'admin.new_submission': { label: 'New admin submissions', hint: 'Admins only — new pending items' },
}

export default function PreferencesForm({ initial }: PreferencesFormProps) {
  const starting = initial ?? DEFAULT_STATE
  const [emailEnabled, setEmailEnabled] = useState(starting.email_enabled)
  const [inAppEnabled, setInAppEnabled] = useState(starting.in_app_enabled)
  const [telegramEnabled, setTelegramEnabled] = useState(starting.telegram_enabled)
  const [whatsappEnabled, setWhatsappEnabled] = useState(starting.whatsapp_enabled)
  const [mutedTypes, setMutedTypes] = useState<string[]>(starting.muted_types ?? [])

  const [channelError, setChannelError] = useState<string | null>(null)
  const [channelSuccess, setChannelSuccess] = useState<string | null>(null)
  const [savingChannels, startSaveChannels] = useTransition()
  const [mutingType, setMutingType] = useState<NotificationType | null>(null)
  const [, startMuteTransition] = useTransition()

  const telegramLinked = Boolean(starting.telegram_chat_id)

  const handleSaveChannels = () => {
    setChannelError(null)
    setChannelSuccess(null)
    startSaveChannels(async () => {
      const result = await updateNotificationPreferences({
        email_enabled: emailEnabled,
        in_app_enabled: inAppEnabled,
        telegram_enabled: telegramLinked ? telegramEnabled : false,
        whatsapp_enabled: whatsappEnabled,
      })
      if (result.error) {
        setChannelError(result.error)
        return
      }
      setChannelSuccess('Delivery channels updated.')
    })
  }

  const toggleMute = (type: NotificationType, shouldMute: boolean) => {
    setMutingType(type)
    // optimistic
    setMutedTypes((prev) =>
      shouldMute ? [...new Set([...prev, type])] : prev.filter((t) => t !== type),
    )
    startMuteTransition(async () => {
      const result = await setTypeMuted(type, shouldMute)
      if (result.error) {
        // revert
        setMutedTypes((prev) =>
          shouldMute ? prev.filter((t) => t !== type) : [...new Set([...prev, type])],
        )
        setChannelError(result.error)
      }
      setMutingType(null)
    })
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2">
        <ChannelToggle
          icon={<Bell size={16} />}
          title="In-app"
          subtitle="Bell icon, always visible while signed in"
          checked={inAppEnabled}
          onChange={setInAppEnabled}
          disabled={savingChannels}
        />
        <ChannelToggle
          icon={<AtSign size={16} />}
          title="Email"
          subtitle="Summaries and important alerts"
          checked={emailEnabled}
          onChange={setEmailEnabled}
          disabled={savingChannels}
        />
        <ChannelToggle
          icon={<Send size={16} />}
          title="Telegram"
          subtitle={
            telegramLinked
              ? 'Realtime pings to your linked Telegram chat'
              : 'Connect Telegram below to enable'
          }
          checked={telegramEnabled && telegramLinked}
          onChange={setTelegramEnabled}
          disabled={savingChannels || !telegramLinked}
        />
        <ChannelToggle
          icon={<MessageCircle size={16} />}
          title="WhatsApp"
          subtitle="Approval, expiry and other owner alerts"
          checked={whatsappEnabled}
          onChange={setWhatsappEnabled}
          disabled={savingChannels}
        />
      </div>

      {channelError && (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {channelError}
        </p>
      )}
      {channelSuccess && (
        <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 inline-flex items-center gap-2">
          <CheckCircle2 size={14} />
          {channelSuccess}
        </p>
      )}

      <div className="flex items-center justify-end">
        <button
          type="button"
          onClick={handleSaveChannels}
          disabled={savingChannels}
          className="inline-flex items-center gap-2 bg-warli-terra hover:bg-warli-deep text-warli-cream px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-60"
        >
          {savingChannels ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
          Save channels
        </button>
      </div>

      <div className="border-t border-gray-100 pt-5">
        <h3 className="font-semibold text-sm text-gray-900">Mute specific types</h3>
        <p className="text-xs text-gray-500 mt-1">
          Turn off a notification type across every channel. You can always re-enable it here.
        </p>
        <ul className="mt-4 divide-y divide-gray-100 border border-gray-100 rounded-xl overflow-hidden">
          {NOTIFICATION_TYPES.map((type) => {
            const muted = mutedTypes.includes(type)
            const busy = mutingType === type
            const meta = TYPE_LABELS[type]
            return (
              <li
                key={type}
                className="flex items-start justify-between gap-4 px-4 py-3 bg-white"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900">{meta.label}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{meta.hint}</p>
                </div>
                <label className="inline-flex items-center gap-2 text-xs text-gray-600 shrink-0">
                  <input
                    type="checkbox"
                    checked={!muted}
                    disabled={busy}
                    onChange={(e) => toggleMute(type, !e.target.checked)}
                    className="rounded border-gray-300 text-warli-terra focus:ring-warli-terra"
                  />
                  {muted ? 'Muted' : 'On'}
                </label>
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )
}

function ChannelToggle({
  icon,
  title,
  subtitle,
  checked,
  onChange,
  disabled,
}: {
  icon: React.ReactNode
  title: string
  subtitle: string
  checked: boolean
  onChange: (v: boolean) => void
  disabled?: boolean
}) {
  return (
    <label
      className={`flex items-start gap-3 px-4 py-3 rounded-xl border transition-colors cursor-pointer ${
        disabled
          ? 'border-gray-100 bg-gray-50 cursor-not-allowed'
          : checked
            ? 'border-warli-terra/40 bg-warli-light/50'
            : 'border-gray-100 bg-white hover:border-warli-sand'
      }`}
    >
      <div
        className={`mt-0.5 w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
          checked ? 'bg-warli-terra text-warli-cream' : 'bg-gray-100 text-gray-500'
        }`}
      >
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-semibold text-gray-900">{title}</p>
          <input
            type="checkbox"
            checked={checked}
            disabled={disabled}
            onChange={(e) => onChange(e.target.checked)}
            className="rounded border-gray-300 text-warli-terra focus:ring-warli-terra"
          />
        </div>
        <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>
      </div>
    </label>
  )
}
