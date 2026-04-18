import 'server-only'

import { renderEmailLayout, escapeHtml } from '../email-layout'
import type { RenderedNotification } from '../types'

/**
 * Sends the rendered notification as an email via Resend.
 * Uses `rendered.email` if provided, otherwise falls back to a minimal
 * title/body/link layout.
 */
export async function deliverEmail(params: {
  to: string
  rendered: RenderedNotification
}): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) return

  const { Resend } = await import('resend')
  const resend = new Resend(apiKey)

  const subject =
    params.rendered.email?.subject ?? params.rendered.title.slice(0, 120)
  const html =
    params.rendered.email?.html ?? buildFallbackHtml(params.rendered)

  await resend.emails.send({
    from: 'OurDahanu <hello@ourdahanu.in>',
    to: params.to,
    subject,
    html,
  })
}

function buildFallbackHtml(rendered: RenderedNotification): string {
  const ctaUrl = rendered.link
    ? rendered.link.startsWith('http')
      ? rendered.link
      : `https://ourdahanu.in${rendered.link}`
    : undefined

  return renderEmailLayout({
    eyebrow: 'Notification',
    headline: rendered.title,
    introHtml: escapeHtml(rendered.body),
    ctaUrl,
    ctaText: ctaUrl ? 'Open OurDahanu' : undefined,
  })
}
