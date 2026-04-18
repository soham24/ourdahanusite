import 'server-only'

import { escapeHtml } from '../email-layout'
import type { RenderedNotification } from '../types'

const TG_API = 'https://api.telegram.org'

/**
 * DMs the given chat_id using the bot configured via TELEGRAM_BOT_TOKEN
 * (or TELEGRAM_USER_BOT_TOKEN as an override — in MVP we reuse the admin bot).
 * Uses `rendered.telegram.text` if provided, otherwise falls back to title/body/link.
 */
export async function deliverTelegram(params: {
  chatId: string
  rendered: RenderedNotification
}): Promise<void> {
  const token =
    process.env.TELEGRAM_USER_BOT_TOKEN?.trim() ||
    process.env.TELEGRAM_BOT_TOKEN?.trim()
  if (!token) return

  const text = params.rendered.telegram?.text ?? buildFallbackText(params.rendered)
  if (!text) return

  const res = await fetch(`${TG_API}/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: params.chatId,
      text,
      parse_mode: 'HTML',
      disable_web_page_preview: true,
    }),
  })

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    console.error('[notifications:telegram] send failed', res.status, body.slice(0, 200))
  }
}

function buildFallbackText(rendered: RenderedNotification): string {
  const link = rendered.link
    ? rendered.link.startsWith('http')
      ? rendered.link
      : `https://ourdahanu.in${rendered.link}`
    : null
  return [
    `<b>${escapeHtml(rendered.title)}</b>`,
    '',
    escapeHtml(rendered.body),
    link ? `\n<a href="${link}">Open</a>` : null,
  ]
    .filter(Boolean)
    .join('\n')
}
