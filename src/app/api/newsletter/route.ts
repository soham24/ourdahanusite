import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { rateLimit, getClientIp, tooManyRequests } from '@/lib/rate-limit'
import { siteConfig } from '@/lib/site'

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

export async function POST(request: NextRequest) {
  try {
    // This endpoint sends a Resend welcome email per request, so it's an
    // email-bombing / quota-burn vector. Cap to 5 subscribes per IP per hour.
    const ip = getClientIp(request)
    const limit = rateLimit(`newsletter:${ip}`, 5, 60 * 60 * 1000)
    if (!limit.ok) return tooManyRequests(limit.resetAt)

    const body = await request.json()
    const email = (body.email as string)?.trim().toLowerCase()

    if (!email || !isValidEmail(email)) {
      return NextResponse.json({ error: 'Please provide a valid email address.' }, { status: 400 })
    }

    const supabase = await createClient()

    const { error: upsertError } = await supabase
      .from('newsletter_subscriptions')
      .upsert({ email, subscribed_at: new Date().toISOString() }, { onConflict: 'email' })

    if (upsertError) {
      console.error('Newsletter upsert error:', upsertError)
      return NextResponse.json({ error: 'Could not subscribe. Please try again.' }, { status: 500 })
    }

    // Send welcome email via Resend if API key is configured
    if (process.env.RESEND_API_KEY) {
      try {
        const { Resend } = await import('resend')
        const resend = new Resend(process.env.RESEND_API_KEY)

        await resend.emails.send({
          from: `${siteConfig.name} <hello@ourdahanu.in>`,
          to: email,
          subject: `Welcome to ${siteConfig.name} Newsletter! 🌴`,
          html: `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Welcome to ${siteConfig.name} Newsletter</title>
</head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:#f9fafb;padding:32px 0;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" role="presentation" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#16a34a,#059669);padding:36px 40px;text-align:center;">
              <div style="display:inline-flex;align-items:center;justify-content:center;width:48px;height:48px;background:rgba(255,255,255,0.2);border-radius:50%;margin-bottom:12px;">
                <span style="color:#ffffff;font-weight:900;font-size:18px;">OD</span>
              </div>
              <h1 style="color:#ffffff;font-size:26px;font-weight:800;margin:0;">Welcome to ${siteConfig.name}!</h1>
              <p style="color:#bbf7d0;font-size:14px;margin:8px 0 0;">Your community newsletter from the heart of ${siteConfig.town}</p>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:36px 40px;">
              <p style="color:#374151;font-size:16px;line-height:1.6;margin:0 0 20px;">
                Hello neighbour! 👋
              </p>
              <p style="color:#374151;font-size:15px;line-height:1.6;margin:0 0 20px;">
                Thank you for subscribing to the <strong style="color:#16a34a;">${siteConfig.name} newsletter</strong>. You're now part of ${siteConfig.town}'s growing online community.
              </p>
              <div style="background:#f0fdf4;border-left:4px solid #16a34a;border-radius:8px;padding:20px 24px;margin:24px 0;">
                <p style="color:#15803d;font-size:14px;font-weight:700;margin:0 0 12px;">What to expect from us:</p>
                <ul style="color:#374151;font-size:14px;line-height:1.8;margin:0;padding-left:20px;">
                  <li>Local news &amp; announcements</li>
                  <li>Upcoming events in ${siteConfig.town}</li>
                  <li>New business spotlights</li>
                  <li>Community updates &amp; alerts</li>
                  <li>Seasonal highlights (Chikoo season, Holi, more!)</li>
                </ul>
              </div>
              <p style="color:#374151;font-size:15px;line-height:1.6;margin:0 0 28px;">
                We respect your inbox — we only send meaningful updates, never spam.
              </p>
              <div style="text-align:center;">
                <a href="https://${siteConfig.domain}" style="display:inline-block;background:#16a34a;color:#ffffff;font-weight:700;font-size:15px;text-decoration:none;padding:14px 32px;border-radius:12px;">
                  Visit ${siteConfig.name}
                </a>
              </div>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background:#f9fafb;padding:20px 40px;text-align:center;border-top:1px solid #f3f4f6;">
              <p style="color:#9ca3af;font-size:12px;margin:0;">
                You're receiving this because you subscribed at ${siteConfig.domain}.<br/>
                ${siteConfig.town}, Palghar, Maharashtra, India 401602
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
          `.trim(),
        })
      } catch (emailError) {
        // Don't fail the subscription if email sending fails
        console.error('Welcome email failed:', emailError)
      }
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Newsletter route error:', err)
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 })
  }
}
