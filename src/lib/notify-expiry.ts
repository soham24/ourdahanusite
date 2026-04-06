/**
 * Sends listing expiry reminder emails to business owners.
 * Used by the daily cron job at /api/cron/listing-expiry.
 */

export type ReminderDays = 30 | 15 | 5 | 3 | 1 | 0  // 0 = already expired

function reminderSubject(daysLeft: ReminderDays, listingName: string): string {
  const safe = listingName.slice(0, 40)
  if (daysLeft === 0) return `⚠️ Your listing "${safe}" has expired on OurDahanu`
  if (daysLeft === 1) return `🚨 Last chance! "${safe}" expires today — renew now`
  if (daysLeft <= 5)  return `⏰ "${safe}" expires in ${daysLeft} days — renew before it goes offline`
  return `📅 Reminder: "${safe}" expires in ${daysLeft} days on OurDahanu`
}

function urgencyBadge(daysLeft: ReminderDays): { color: string; text: string } {
  if (daysLeft === 0)      return { color: '#DC2626', text: 'EXPIRED' }
  if (daysLeft === 1)      return { color: '#DC2626', text: 'EXPIRES TODAY' }
  if (daysLeft <= 5)       return { color: '#D97706', text: `EXPIRES IN ${daysLeft} DAYS` }
  if (daysLeft <= 15)      return { color: '#D97706', text: `${daysLeft} DAYS LEFT` }
  return                          { color: '#2563EB', text: `${daysLeft} DAYS REMAINING` }
}

function buildEmailHtml(
  listingName: string,
  renewUrl: string,
  daysLeft: ReminderDays,
): string {
  const { color, text: badgeText } = urgencyBadge(daysLeft)
  const safeName = listingName.replace(/</g, '&lt;').replace(/>/g, '&gt;')

  let headline: string
  let bodyHtml: string
  let ctaText: string

  if (daysLeft === 0) {
    headline = 'Your listing has expired'
    bodyHtml = `Your business listing <strong>${safeName}</strong> has expired and is <strong>no longer visible</strong> to customers on OurDahanu. Renew now to get back online instantly.`
    ctaText  = 'Renew Your Listing Now'
  } else if (daysLeft === 1) {
    headline = 'Last chance — expires today!'
    bodyHtml = `Your business listing <strong>${safeName}</strong> expires <strong>today</strong>. After expiry it will be removed from the directory and customers won't be able to find you.`
    ctaText  = 'Renew Before Midnight'
  } else if (daysLeft <= 5) {
    headline = `Only ${daysLeft} days left to renew`
    bodyHtml = `Your business listing <strong>${safeName}</strong> on OurDahanu expires in just <strong>${daysLeft} days</strong>. Don't let your customers lose you — renew now to stay visible without any interruption.`
    ctaText  = 'Renew My Listing'
  } else {
    headline = `Your listing expires in ${daysLeft} days`
    bodyHtml = `Your business listing <strong>${safeName}</strong> on OurDahanu will expire in <strong>${daysLeft} days</strong>. Renew early to keep your visibility going and avoid any last-minute rush.`
    ctaText  = 'Renew Early'
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
</head>
<body style="margin:0;padding:0;background:#FBF0DC;font-family:sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#FBF0DC;padding:32px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0"
             style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#3D1A08,#C4663A);padding:24px 32px;">
            <h1 style="margin:0;color:#FBF0DC;font-size:20px;font-weight:700;">
              OurDahanu — Listing Renewal
            </h1>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:32px;">
            <!-- Urgency badge -->
            <div style="display:inline-block;background:${color};color:#fff;font-size:11px;
                        font-weight:700;padding:4px 12px;border-radius:999px;margin-bottom:20px;
                        text-transform:uppercase;letter-spacing:0.06em;">
              ${badgeText}
            </div>

            <h2 style="margin:0 0 12px;color:#1a1a1a;font-size:22px;font-weight:700;">
              ${headline}
            </h2>
            <p style="margin:0 0 24px;color:#555;font-size:15px;line-height:1.65;">
              ${bodyHtml}
            </p>

            <!-- Listing box -->
            <table width="100%" cellpadding="0" cellspacing="0"
                   style="background:#f9fafb;border-radius:10px;padding:16px 20px;margin-bottom:28px;">
              <tr><td style="padding:4px 0;">
                <span style="color:#888;font-size:11px;font-weight:600;text-transform:uppercase;
                             letter-spacing:0.04em;">Your Listing</span><br/>
                <span style="color:#1a1a1a;font-size:17px;font-weight:700;">${safeName}</span>
              </td></tr>
            </table>

            <!-- CTA -->
            <a href="${renewUrl}"
               style="display:inline-block;background:#C4663A;color:#fff;text-decoration:none;
                      padding:14px 32px;border-radius:10px;font-weight:700;font-size:15px;">
              ${ctaText} →
            </a>

            <p style="margin:20px 0 0;color:#999;font-size:13px;line-height:1.5;">
              If you have any questions, just reply to this email.<br/>
              You can also visit
              <a href="https://ourdahanu.in/my-business"
                 style="color:#C4663A;text-decoration:none;">My Business</a>
              on OurDahanu to manage your listing.
            </p>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#f9fafb;padding:16px 32px;text-align:center;">
            <p style="margin:0;color:#aaa;font-size:12px;">
              OurDahanu — Dahanu's Community Portal ·
              <a href="https://ourdahanu.in" style="color:#aaa;">ourdahanu.in</a>
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}

/**
 * Sends an expiry reminder or "expired" notification to a listing owner.
 * @param ownerId   - Supabase auth user ID of the listing owner
 * @param listingName - Business name
 * @param listingId   - Listing UUID (used to build the renewal URL)
 * @param daysLeft    - Days until expiry (0 = already expired)
 */
export async function notifyListingExpiry(
  ownerId: string,
  listingName: string,
  listingId: string,
  daysLeft: ReminderDays,
): Promise<void> {
  try {
    if (!process.env.RESEND_API_KEY) return

    const { createAdminClient } = await import('@/lib/supabase/admin-client')
    const adminClient = createAdminClient()
    if (!adminClient) return

    const { data: { user } } = await adminClient.auth.admin.getUserById(ownerId)
    if (!user?.email) return

    const renewUrl = `https://ourdahanu.in/my-business/renew/${listingId}`

    const { Resend } = await import('resend')
    const resend = new Resend(process.env.RESEND_API_KEY)

    await resend.emails.send({
      from:    'OurDahanu <hello@ourdahanu.in>',
      to:      user.email,
      subject: reminderSubject(daysLeft, listingName),
      html:    buildEmailHtml(listingName, renewUrl, daysLeft),
    })
  } catch (err) {
    console.error('[notifyListingExpiry]', err)
  }
}
