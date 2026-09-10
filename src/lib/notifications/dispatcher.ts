import 'server-only'

import { createAdminClient } from '@/lib/supabase/admin-client'

import { deliverEmail } from './channels/email'
import { deliverInApp } from './channels/in-app'
import { deliverTelegram } from './channels/telegram'
import { deliverWhatsApp } from './channels/whatsapp'
import { renderNotification } from './templates'
import {
  DEFAULT_PREFERENCES,
  type DispatchOptions,
  type NotificationPayload,
  type NotificationPreferences,
  type NotificationType,
} from './types'

/**
 * Core entry point — fan out one notification to every channel the user has enabled.
 *
 * Contract:
 *   - Always non-throwing (all delivery errors are logged, never propagated).
 *   - Awaits channel delivery by default so serverless requests cannot finish
 *     while Telegram/email/WhatsApp requests are still pending.
 *   - Respects `notification_preferences.muted_types[]` and per-channel toggles.
 *   - Writes an in-app row unless the user explicitly muted the type OR disabled in_app.
 *
 * @returns whether the in-app row was written (handy for tests / retry logic).
 */
export async function sendNotification<T extends NotificationType>(
  userId: string,
  type: T,
  payload: NotificationPayload<T>,
  options: DispatchOptions = {},
): Promise<boolean> {
  if (!userId) return false

  try {
    const prefs = await loadPreferences(userId)
    if (prefs.muted_types.includes(type)) {
      return false
    }

    const rendered = renderNotification(type, payload)
    const override = options.channelOverride ?? {}

    const useInApp = override.in_app ?? prefs.in_app_enabled
    const useEmail = override.email ?? prefs.email_enabled
    const useTelegram =
      (override.telegram ?? prefs.telegram_enabled) && Boolean(prefs.telegram_chat_id)
    const useWhatsApp = override.whatsapp ?? prefs.whatsapp_enabled

    // Keep delivery within the caller's lifetime, including inside after().
    const awaitDelivery = options.awaitDelivery ?? true
    const pending: Promise<unknown>[] = []
    const track = (p: Promise<unknown>) => {
      if (awaitDelivery) pending.push(p)
      else void p
    }

    // In-app is always awaited so the Realtime INSERT fires before we return.
    if (useInApp) {
      await deliverInApp({ userId, type, rendered })
    }

    // Email.
    if (useEmail) {
      track(
        resolveEmail(userId)
          .then((email) => {
            if (!email) return
            return deliverEmail({ to: email, rendered })
          })
          .catch((err) => console.error('[notifications:dispatch:email]', err)),
      )
    }

    // Telegram.
    if (useTelegram && prefs.telegram_chat_id) {
      track(
        deliverTelegram({ chatId: prefs.telegram_chat_id, rendered }).catch((err) =>
          console.error('[notifications:dispatch:telegram]', err),
        ),
      )
    }

    // WhatsApp — only if the rendered notification provided a template AND we have a phone.
    if (useWhatsApp && rendered.whatsappTemplate) {
      track(
        resolveWhatsAppPhone(userId)
          .then((phone) => {
            if (!phone) return
            return deliverWhatsApp({ phone, rendered })
          })
          .catch((err) => console.error('[notifications:dispatch:whatsapp]', err)),
      )
    }

    if (awaitDelivery && pending.length) {
      await Promise.allSettled(pending)
    }

    return useInApp
  } catch (err) {
    console.error('[notifications:dispatch]', type, err)
    return false
  }
}

/**
 * Send the same notification to multiple users (e.g. broadcast to all admins).
 * Per-user preferences are still honored.
 */
export async function sendNotificationToMany<T extends NotificationType>(
  userIds: string[],
  type: T,
  payload: NotificationPayload<T>,
  options: DispatchOptions = {},
): Promise<void> {
  const uniqueIds = [...new Set(userIds.filter(Boolean))]
  await Promise.allSettled(
    uniqueIds.map((id) => sendNotification(id, type, payload, options)),
  )
}

/**
 * Convenience: dispatch to every user with role `admin`.
 */
export async function sendNotificationToAdmins<T extends NotificationType>(
  type: T,
  payload: NotificationPayload<T>,
  options: DispatchOptions = {},
): Promise<void> {
  const admins = await loadAdminUserIds()
  if (admins.length === 0) return
  await sendNotificationToMany(admins, type, payload, options)
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

async function loadPreferences(userId: string): Promise<NotificationPreferences> {
  const adminClient = createAdminClient()
  if (!adminClient) {
    return { user_id: userId, ...DEFAULT_PREFERENCES }
  }

  const { data } = await adminClient
    .from('notification_preferences')
    .select(
      'user_id, email_enabled, in_app_enabled, telegram_enabled, whatsapp_enabled, telegram_chat_id, telegram_verified_at, muted_types',
    )
    .eq('user_id', userId)
    .maybeSingle()

  if (data) {
    return data as NotificationPreferences
  }

  return { user_id: userId, ...DEFAULT_PREFERENCES }
}

async function resolveEmail(userId: string): Promise<string | null> {
  const adminClient = createAdminClient()
  if (!adminClient) return null
  const { data } = await adminClient.auth.admin.getUserById(userId)
  return data.user?.email ?? null
}

async function resolveWhatsAppPhone(userId: string): Promise<string | null> {
  const adminClient = createAdminClient()
  if (!adminClient) return null
  const { data } = await adminClient
    .from('profiles')
    .select('phone')
    .eq('id', userId)
    .maybeSingle()
  const phone = typeof data?.phone === 'string' ? data.phone.trim() : ''
  return phone || null
}

async function loadAdminUserIds(): Promise<string[]> {
  const adminClient = createAdminClient()
  if (!adminClient) return []
  const { data } = await adminClient.from('profiles').select('id').eq('role', 'admin')
  return ((data ?? []) as Array<{ id: string }>).map((row) => row.id)
}
