'use server'

import { randomBytes } from 'crypto'

import { revalidatePath } from 'next/cache'

import { createAdminClient } from '@/lib/supabase/admin-client'
import { createClient } from '@/lib/supabase/server'
import {
  DEFAULT_PREFERENCES,
  NOTIFICATION_TYPES,
  type NotificationType,
} from '@/lib/notifications/types'

const TELEGRAM_LINK_TTL_MIN = 15
const NOTIFICATION_TYPE_SET = new Set<string>(NOTIFICATION_TYPES)

export interface NotificationRow {
  id: string
  user_id: string
  type: string
  title: string
  body: string
  link: string | null
  icon: string | null
  metadata: Record<string, unknown> | null
  read_at: string | null
  created_at: string
}

export interface NotificationPreferencesRow {
  user_id: string
  email_enabled: boolean
  in_app_enabled: boolean
  telegram_enabled: boolean
  whatsapp_enabled: boolean
  telegram_chat_id: string | null
  telegram_verified_at: string | null
  muted_types: string[]
}

// ─────────────────────────────────────────────────────────────────────────────
// Reads
// ─────────────────────────────────────────────────────────────────────────────

export async function getRecentNotifications(
  limit = 20,
): Promise<NotificationRow[]> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(Math.max(1, Math.min(50, limit)))

  return (data ?? []) as NotificationRow[]
}

export async function getUnreadCount(): Promise<number> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return 0

  const { count } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .is('read_at', null)

  return count ?? 0
}

export async function getNotificationPreferences(): Promise<NotificationPreferencesRow | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data } = await supabase
    .from('notification_preferences')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle()

  if (data) return data as NotificationPreferencesRow
  return { user_id: user.id, ...DEFAULT_PREFERENCES }
}

// ─────────────────────────────────────────────────────────────────────────────
// Mutations
// ─────────────────────────────────────────────────────────────────────────────

export async function markNotificationRead(
  notificationId: string,
): Promise<{ error?: string }> {
  if (!notificationId) return { error: 'Missing notification.' }
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not signed in.' }

  const { error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('id', notificationId)
    .eq('user_id', user.id)
    .is('read_at', null)

  if (error) return { error: error.message }
  revalidatePath('/account/notifications')
  return {}
}

export async function markAllNotificationsRead(): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not signed in.' }

  const { error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('user_id', user.id)
    .is('read_at', null)

  if (error) return { error: error.message }
  revalidatePath('/account/notifications')
  return {}
}

export interface UpdatePreferencesInput {
  email_enabled?: boolean
  in_app_enabled?: boolean
  telegram_enabled?: boolean
  whatsapp_enabled?: boolean
  muted_types?: string[]
}

export async function updateNotificationPreferences(
  input: UpdatePreferencesInput,
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not signed in.' }

  const cleanMuted = Array.isArray(input.muted_types)
    ? input.muted_types
        .map((t) => String(t).trim())
        .filter((t) => NOTIFICATION_TYPE_SET.has(t))
    : undefined

  const row: Record<string, unknown> = { user_id: user.id }
  if (typeof input.email_enabled === 'boolean') row.email_enabled = input.email_enabled
  if (typeof input.in_app_enabled === 'boolean') row.in_app_enabled = input.in_app_enabled
  if (typeof input.telegram_enabled === 'boolean')
    row.telegram_enabled = input.telegram_enabled
  if (typeof input.whatsapp_enabled === 'boolean')
    row.whatsapp_enabled = input.whatsapp_enabled
  if (cleanMuted) row.muted_types = cleanMuted

  const { error } = await supabase
    .from('notification_preferences')
    .upsert(row, { onConflict: 'user_id' })

  if (error) return { error: error.message }
  revalidatePath('/account/notifications')
  return {}
}

/**
 * Mute (or unmute) a specific notification type for the current user.
 * Managed separately from the bulk setter for a cleaner UI.
 */
export async function setTypeMuted(
  type: NotificationType,
  muted: boolean,
): Promise<{ error?: string }> {
  if (!NOTIFICATION_TYPE_SET.has(type)) return { error: 'Unknown notification type.' }
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not signed in.' }

  const { data: current } = await supabase
    .from('notification_preferences')
    .select('muted_types')
    .eq('user_id', user.id)
    .maybeSingle()

  const existing = Array.isArray(current?.muted_types)
    ? (current!.muted_types as string[])
    : []
  const next = muted
    ? [...new Set([...existing, type])]
    : existing.filter((t) => t !== type)

  const { error } = await supabase
    .from('notification_preferences')
    .upsert({ user_id: user.id, muted_types: next }, { onConflict: 'user_id' })

  if (error) return { error: error.message }
  revalidatePath('/account/notifications')
  return {}
}

// ─────────────────────────────────────────────────────────────────────────────
// Telegram link flow
// ─────────────────────────────────────────────────────────────────────────────

export interface TelegramLinkResult {
  error?: string
  token?: string
  botUsername?: string
  deeplink?: string
  expiresAt?: string
}

/**
 * Issues a short-lived token the user can send to the Telegram bot via
 * `t.me/<bot>?start=<token>`. The webhook route consumes it and saves the
 * resulting chat_id to notification_preferences.
 */
export async function createTelegramLinkToken(): Promise<TelegramLinkResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not signed in.' }

  const botUsername = process.env.TELEGRAM_BOT_USERNAME?.trim()
  if (!botUsername) {
    return { error: 'Telegram bot is not configured yet. Please contact support.' }
  }

  const adminClient = createAdminClient()
  if (!adminClient) return { error: 'Server configuration error.' }

  const token = randomBytes(18).toString('hex') // 36 chars
  const expiresAt = new Date(Date.now() + TELEGRAM_LINK_TTL_MIN * 60_000).toISOString()

  const { error } = await adminClient
    .from('telegram_link_tokens')
    .insert({ token, user_id: user.id, expires_at: expiresAt })

  if (error) return { error: error.message }

  const deeplink = `https://t.me/${botUsername}?start=${token}`
  return { token, botUsername, deeplink, expiresAt }
}

/**
 * Disconnect the currently-linked Telegram chat for the signed-in user.
 */
export async function disconnectTelegram(): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not signed in.' }

  const { error } = await supabase
    .from('notification_preferences')
    .upsert(
      {
        user_id: user.id,
        telegram_enabled: false,
        telegram_chat_id: null,
        telegram_verified_at: null,
      },
      { onConflict: 'user_id' },
    )

  if (error) return { error: error.message }
  revalidatePath('/account/notifications')
  return {}
}
