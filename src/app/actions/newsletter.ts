'use server'

import { createClient } from '@/lib/supabase/server'
import { requireAdmin } from './admin'
import { siteConfig } from '@/lib/site'

interface NewsletterState {
  success: boolean
  message: string
}

export async function subscribeNewsletter(
  _prevState: NewsletterState,
  formData: FormData
): Promise<NewsletterState> {
  const email = (formData.get('email') as string)?.trim().toLowerCase()

  if (!email) {
    return { success: false, message: 'Please enter your email address.' }
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(email)) {
    return { success: false, message: 'Please enter a valid email address.' }
  }

  try {
    const baseUrl =
      process.env.NEXT_PUBLIC_SITE_URL ||
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')

    const response = await fetch(`${baseUrl}/api/newsletter`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    })

    const data = await response.json()

    if (!response.ok || data.error) {
      return { success: false, message: data.error || 'Subscription failed. Please try again.' }
    }

    return { success: true, message: `You're subscribed! Welcome to the ${siteConfig.name} community.` }
  } catch {
    return { success: false, message: 'Something went wrong. Please try again.' }
  }
}

export type SendNewsletterState = {
  sent?: number
  failed?: number
  total?: number
  error?: string
} | null

export async function sendNewsletter(
  _prev: SendNewsletterState,
  formData: FormData
): Promise<SendNewsletterState> {
  const supabase = await createClient()
  await requireAdmin(supabase)

  const subject = (formData.get('subject') as string)?.trim()
  const bodyText = (formData.get('body') as string)?.trim()

  if (!subject || !bodyText) {
    return { error: 'Subject and body are required.' }
  }

  // Fetch all subscribers
  const { data: subscribers, error: fetchError } = await supabase
    .from('newsletter_subscriptions')
    .select('email')

  if (fetchError) {
    return { error: 'Could not fetch subscribers: ' + fetchError.message }
  }

  if (!subscribers || subscribers.length === 0) {
    return { error: 'No subscribers found.' }
  }

  if (!process.env.RESEND_API_KEY) {
    return { error: 'RESEND_API_KEY is not configured.' }
  }

  const { Resend } = await import('resend')
  const resend = new Resend(process.env.RESEND_API_KEY)

  // Wrap body text in a styled HTML email template
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${subject}</title>
</head>
<body style="margin:0;padding:0;background:#FBF0DC;font-family:sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:#FBF0DC;padding:32px 0;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" role="presentation" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
          <tr>
            <td style="background:linear-gradient(135deg,#3D1A08,#C4663A);padding:32px 40px;text-align:center;">
              <div style="display:inline-flex;align-items:center;justify-content:center;width:44px;height:44px;background:rgba(251,240,220,0.2);border-radius:50%;margin-bottom:10px;">
                <span style="color:#FBF0DC;font-weight:900;font-size:16px;">OD</span>
              </div>
              <h1 style="color:#FBF0DC;font-size:22px;font-weight:800;margin:0;">${subject}</h1>
              <p style="color:#E8C99A;font-size:13px;margin:6px 0 0;">OurDahanu Community Newsletter</p>
            </td>
          </tr>
          <tr>
            <td style="padding:36px 40px;">
              <div style="color:#3D1A08;font-size:15px;line-height:1.7;white-space:pre-wrap;">${bodyText.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 40px;text-align:center;">
              <a href="https://${siteConfig.domain}" style="display:inline-block;background:#C4663A;color:#FBF0DC;font-weight:700;font-size:14px;text-decoration:none;padding:12px 28px;border-radius:10px;">
                Visit OurDahanu →
              </a>
            </td>
          </tr>
          <tr>
            <td style="background:#FBF0DC;padding:18px 40px;text-align:center;border-top:1px solid #E8C99A;">
              <p style="color:#7A4A25;font-size:12px;margin:0;">
                Dahanu, Palghar, Maharashtra, India 401602<br/>
                You received this because you subscribed at ${siteConfig.domain}
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`

  let sent = 0
  let failed = 0
  const total = subscribers.length

  // Resend batch API: max 100 per call
  const batchSize = 100
  for (let i = 0; i < subscribers.length; i += batchSize) {
    const batch = subscribers.slice(i, i + batchSize)
    try {
      await resend.batch.send(
        batch.map((sub) => ({
          from: `${siteConfig.name} <hello@ourdahanu.com>`,
          to: sub.email,
          subject,
          html,
        }))
      )
      sent += batch.length
    } catch {
      failed += batch.length
    }
  }

  return { sent, failed, total }
}
