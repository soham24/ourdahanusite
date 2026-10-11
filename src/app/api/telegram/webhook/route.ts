/**
 * Telegram bot webhook — receives updates from Telegram's servers.
 *
 * Handles:
 *  - `/start <token>` — completes the account linking flow. The token was
 *    issued by `createTelegramLinkToken()` when the user clicked "Connect
 *    Telegram" in /account/notifications. We verify it, save the chat_id to
 *    notification_preferences, mark the token consumed, and reply with a
 *    welcome message.
 *  - `/stop` — disconnects the currently-linked chat.
 *  - anything else — a short help message.
 *
 * Security:
 *  The webhook URL embeds a secret path param: register it via
 *    `https://<your domain>/api/telegram/webhook?secret=<TELEGRAM_WEBHOOK_SECRET>`
 *  Telegram's `setWebhook` is called once manually with that URL. The secret
 *  is required: without TELEGRAM_WEBHOOK_SECRET set, this route answers 500
 *  to everything. See the Telegram section of SETUP.md.
 */

import { NextResponse } from 'next/server'
import { isConfigured, secretMatches } from '@/lib/http/shared-secret'

import { createAdminClient } from '@/lib/supabase/admin-client'
import { buildAbsoluteUrl, siteConfig } from '@/lib/site'

type TelegramUpdate = {
  update_id: number
  message?: {
    message_id: number
    from?: { id: number; is_bot: boolean; first_name?: string; username?: string }
    chat: { id: number; type: string; username?: string; first_name?: string }
    date: number
    text?: string
  }
}

// This deployment's own settings page, so a bot wired to a preview deployment
// sends people to the preview rather than to production.
const SETTINGS_URL = buildAbsoluteUrl('/account/notifications')
const SETTINGS_LINK = `<a href="${SETTINGS_URL}">your notification settings</a>`

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN?.trim() || process.env.TELEGRAM_USER_BOT_TOKEN?.trim()

async function replyToChat(chatId: number, text: string, parseMode: 'HTML' | 'Markdown' = 'HTML') {
  if (!BOT_TOKEN) return
  try {
    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: parseMode,
        disable_web_page_preview: true,
      }),
    })
  } catch (err) {
    console.error('[telegram/webhook:reply]', err)
  }
}

/**
 * Rejects the request unless it carries the configured `?secret=`.
 *
 * Fails closed: an unset TELEGRAM_WEBHOOK_SECRET answers 500, it does not
 * wave the caller through. This check used to be wrapped in `if (secret)`,
 * so a deployment that simply never set the variable had an unauthenticated
 * webhook and no sign of it -- which matters more now the code is public and
 * anyone can fork it. The cron routes have always failed closed; this brings
 * the webhook into line with them.
 */
function rejectUnauthorised(request: Request): NextResponse | null {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET
  if (!isConfigured(secret)) {
    console.error('[telegram/webhook] TELEGRAM_WEBHOOK_SECRET not configured')
    return NextResponse.json({ error: 'Webhook not configured' }, { status: 500 })
  }
  if (!secretMatches(new URL(request.url).searchParams.get('secret'), secret.trim())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return null
}

/** GET exists only so you can visually confirm the webhook URL is reachable. */
export async function GET(request: Request) {
  const unauthorised = rejectUnauthorised(request)
  if (unauthorised) return unauthorised
  return NextResponse.json({ ok: true, service: 'telegram-webhook' })
}

export async function POST(request: Request) {
  // Auth: the `?secret=` query param must match (fails closed if unset).
  const unauthorised = rejectUnauthorised(request)
  if (unauthorised) return unauthorised

  let update: TelegramUpdate
  try {
    update = (await request.json()) as TelegramUpdate
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const message = update.message
  const chatId = message?.chat?.id
  const text = message?.text?.trim() ?? ''

  // We only handle private-chat text commands. Return 200 so Telegram doesn't
  // retry — we intentionally ignore non-command traffic.
  if (!chatId || !text) {
    return NextResponse.json({ ok: true })
  }

  const adminClient = createAdminClient()
  if (!adminClient) {
    console.error('[telegram/webhook] admin client unavailable')
    return NextResponse.json({ ok: true })
  }

  // ── /start <token> ──────────────────────────────────────────────────────
  if (text.startsWith('/start')) {
    const [, rawToken] = text.split(/\s+/, 2)
    const token = rawToken?.trim()

    if (!token) {
      await replyToChat(
        chatId,
        `👋 <b>Welcome to ${siteConfig.name} Notifications</b>\n\nTo receive alerts here, open ${SETTINGS_LINK} on ${siteConfig.name} and click <b>Connect Telegram</b>. That will bring you back here with a one-tap link.`,
      )
      return NextResponse.json({ ok: true })
    }

    // Look up the token
    const { data: linkRow } = await adminClient
      .from('telegram_link_tokens')
      .select('token, user_id, expires_at, consumed_at')
      .eq('token', token)
      .maybeSingle()

    if (!linkRow) {
      await replyToChat(
        chatId,
        `⚠️ That link is invalid. Please open ${SETTINGS_LINK} and click <b>Connect Telegram</b> to generate a new one.`,
      )
      return NextResponse.json({ ok: true })
    }

    if (linkRow.consumed_at) {
      await replyToChat(
        chatId,
        `⚠️ That link has already been used. Generate a fresh one from ${SETTINGS_LINK} if you need to reconnect.`,
      )
      return NextResponse.json({ ok: true })
    }

    if (new Date(linkRow.expires_at as string).getTime() < Date.now()) {
      await replyToChat(
        chatId,
        `⚠️ That link has expired. Please open ${SETTINGS_LINK} and click <b>Connect Telegram</b> again.`,
      )
      return NextResponse.json({ ok: true })
    }

    // Save chat_id to the user's notification preferences
    const userId = linkRow.user_id as string
    const nowIso = new Date().toISOString()

    const { error: upsertErr } = await adminClient
      .from('notification_preferences')
      .upsert(
        {
          user_id: userId,
          telegram_chat_id: String(chatId),
          telegram_enabled: true,
          telegram_verified_at: nowIso,
        },
        { onConflict: 'user_id' },
      )

    if (upsertErr) {
      console.error('[telegram/webhook:upsert-prefs]', upsertErr)
      await replyToChat(
        chatId,
        `❌ Sorry, something went wrong on our end. Please try again in a few minutes, or email <a href="mailto:${siteConfig.contactEmail}">${siteConfig.contactEmail}</a> if it keeps happening.`,
      )
      return NextResponse.json({ ok: true })
    }

    // Mark the token consumed (one-time use)
    await adminClient
      .from('telegram_link_tokens')
      .update({ consumed_at: nowIso })
      .eq('token', token)

    await replyToChat(
      chatId,
      `✅ <b>All set!</b>\n\nYou're now connected to ${siteConfig.name}. You'll get instant alerts here for bookings, orders, listing approvals, expiry reminders, and more.\n\nYou can manage what lands in Telegram any time from ${SETTINGS_LINK}.\n\nSend <b>/stop</b> to disconnect.`,
    )
    return NextResponse.json({ ok: true })
  }

  // ── /stop ────────────────────────────────────────────────────────────────
  if (text.startsWith('/stop')) {
    // Find the user linked to this chat_id
    const { data: prefRow } = await adminClient
      .from('notification_preferences')
      .select('user_id')
      .eq('telegram_chat_id', String(chatId))
      .maybeSingle()

    if (!prefRow) {
      await replyToChat(chatId, `You're not currently connected. No action needed.`)
      return NextResponse.json({ ok: true })
    }

    await adminClient
      .from('notification_preferences')
      .update({
        telegram_enabled: false,
        telegram_chat_id: null,
        telegram_verified_at: null,
      })
      .eq('user_id', prefRow.user_id as string)

    await replyToChat(
      chatId,
      `👋 Disconnected. You won't get Telegram alerts from ${siteConfig.name} anymore.\n\nYou can reconnect any time from ${SETTINGS_LINK}.`,
    )
    return NextResponse.json({ ok: true })
  }

  // ── anything else ────────────────────────────────────────────────────────
  await replyToChat(
    chatId,
    `👋 Hi! I'm the ${siteConfig.name} notifications bot.\n\n<b>Commands</b>\n• <b>/start</b> — show connection instructions\n• <b>/stop</b> — disconnect this chat\n\nManage your notification settings at <a href="${SETTINGS_URL}">${SETTINGS_URL.replace(/^https?:\/\//, '')}</a>.`,
  )
  return NextResponse.json({ ok: true })
}
