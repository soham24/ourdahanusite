/**
 * Fire-and-forget admin notifications (email + Telegram).
 * Sends to ADMIN_EMAIL env var + all profiles with role='admin'
 * Also pings TELEGRAM_CHAT_ID via TELEGRAM_BOT_TOKEN.
 */

import { getCanonicalListingUrl } from '@/lib/listing-url'

type SubmissionType = 'listing' | 'classified' | 'event' | 'news' | 'forum' | 'job'

const TYPE_META: Record<SubmissionType, { label: string; emoji: string; reviewPath: string }> = {
  listing:   { label: 'Listing',    emoji: '🏪', reviewPath: '/admin/listings' },
  classified:{ label: 'Classified', emoji: '🏷️', reviewPath: '/admin/classifieds' },
  event:     { label: 'Event',      emoji: '📅', reviewPath: '/admin/events' },
  news:      { label: 'News',       emoji: '📰', reviewPath: '/admin/news' },
  forum:     { label: 'Forum Post', emoji: '💬', reviewPath: '/admin/forum' },
  job:       { label: 'Job',        emoji: '💼', reviewPath: '/admin/jobs' },
}

async function notifyTelegram(type: SubmissionType, title: string, submitter?: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN
  const chatId = process.env.TELEGRAM_CHAT_ID
  if (!token || !chatId) return

  const meta = TYPE_META[type]
  const reviewUrl = `https://ourdahanu.in${meta.reviewPath}`

  const text = [
    `${meta.emoji} *New ${meta.label} Submitted*`,
    ``,
    `📌 *Title:* ${title}`,
    submitter ? `👤 *By:* ${submitter}` : null,
    ``,
    `🔗 [Review & Approve](${reviewUrl})`,
  ].filter(Boolean).join('\n')

  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: 'Markdown',
      disable_web_page_preview: true,
    }),
  })
}

function escapeTelegramHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

export async function notifyNewReview(params: {
  listingId: string
  listingName: string
  subdomain?: string | null
  rating: number
  reviewer?: string | null
  comment?: string | null
}) {
  const token = process.env.TELEGRAM_BOT_TOKEN
  const chatId = process.env.TELEGRAM_CHAT_ID
  if (!token || !chatId) return

  const listingUrl = getCanonicalListingUrl(params.listingId, params.subdomain)
  const safeListingName = escapeTelegramHtml(params.listingName)
  const safeReviewer = escapeTelegramHtml((params.reviewer || 'Anonymous').trim() || 'Anonymous')
  const safeComment = params.comment
    ? escapeTelegramHtml(params.comment.trim())
    : null
  const stars = '⭐'.repeat(Math.max(1, Math.min(5, Math.round(params.rating))))

  const text = [
    '💬 <b>New Review Added</b>',
    '',
    `🏪 <b>Listing:</b> ${safeListingName}`,
    `👤 <b>By:</b> ${safeReviewer}`,
    `⭐ <b>Rating:</b> ${params.rating}/5 ${stars}`,
    safeComment ? `📝 <b>Review:</b> ${safeComment}` : null,
    '',
    `🔗 <a href="${listingUrl}">Open Listing</a>`,
  ].filter(Boolean).join('\n')

  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
      disable_web_page_preview: true,
    }),
  })
}

export async function notifyAdmin(
  type: SubmissionType,
  title: string,
  submitter?: string,
) {
  try {
    const meta = TYPE_META[type]
    const siteUrl = 'https://ourdahanu.in'
    const reviewUrl = `${siteUrl}${meta.reviewPath}`

    // Telegram — fire and forget
    void notifyTelegram(type, title, submitter).catch(err =>
      console.error('[notifyAdmin:telegram]', err)
    )

    // Email via Resend
    if (!process.env.RESEND_API_KEY) return

    // Collect admin emails
    const emails: string[] = []

    const adminEmail = process.env.ADMIN_EMAIL
    if (adminEmail) emails.push(adminEmail)

    // Also pull emails from profiles with role='admin'
    try {
      const { createAdminClient } = await import('@/lib/supabase/admin-client')
      const adminClient = createAdminClient()
      if (adminClient) {
        const { data: admins } = await adminClient
          .from('profiles')
          .select('id')
          .eq('role', 'admin')
        if (admins) {
          for (const a of admins) {
            const { data: { user } } = await adminClient.auth.admin.getUserById(a.id)
            if (user?.email && !emails.includes(user.email)) emails.push(user.email)
          }
        }
      }
    } catch {
      // admin client might not be configured — fall back to ADMIN_EMAIL only
    }

    if (emails.length === 0) return

    const { Resend } = await import('resend')
    const resend = new Resend(process.env.RESEND_API_KEY)

    await resend.emails.send({
      from: 'OurDahanu <hello@ourdahanu.in>',
      to: emails,
      subject: `${meta.emoji} New ${meta.label} submitted: ${title}`,
      html: `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/></head>
<body style="margin:0;padding:0;background:#FBF0DC;font-family:sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#FBF0DC;padding:32px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
        <tr>
          <td style="background:linear-gradient(135deg,#3D1A08,#C4663A);padding:24px 32px;">
            <h1 style="margin:0;color:#FBF0DC;font-size:20px;font-weight:700;">OurDahanu — Admin Alert</h1>
          </td>
        </tr>
        <tr>
          <td style="padding:32px;">
            <p style="margin:0 0 6px;font-size:28px;">${meta.emoji}</p>
            <h2 style="margin:0 0 8px;color:#1a1a1a;font-size:20px;">New ${meta.label} Submission</h2>
            <p style="margin:0 0 24px;color:#555;font-size:15px;">A new submission needs your review.</p>

            <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;border-radius:10px;padding:20px;margin-bottom:24px;">
              <tr><td style="padding:6px 0;">
                <span style="color:#888;font-size:12px;font-weight:600;text-transform:uppercase;">Title</span><br/>
                <span style="color:#1a1a1a;font-size:16px;font-weight:700;">${title.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</span>
              </td></tr>
              ${submitter ? `<tr><td style="padding:6px 0;border-top:1px solid #eee;">
                <span style="color:#888;font-size:12px;font-weight:600;text-transform:uppercase;">Submitted by</span><br/>
                <span style="color:#1a1a1a;font-size:15px;">${submitter.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</span>
              </td></tr>` : ''}
            </table>

            <a href="${reviewUrl}"
               style="display:inline-block;background:#C4663A;color:#fff;text-decoration:none;padding:14px 28px;border-radius:8px;font-weight:700;font-size:15px;">
              Review &amp; Approve →
            </a>
          </td>
        </tr>
        <tr>
          <td style="background:#f9fafb;padding:16px 32px;text-align:center;">
            <p style="margin:0;color:#aaa;font-size:12px;">OurDahanu — Dahanu's Community Portal</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
    })
  } catch (err) {
    console.error('[notifyAdmin]', err)
  }
}
