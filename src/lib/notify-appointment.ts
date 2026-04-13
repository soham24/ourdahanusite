/**
 * Fire-and-forget notifications for appointment bookings.
 *
 * 1. Email to business owner (via Resend)
 * 2. Telegram message to admin chat
 */

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function formatSlotTime(time: string): string {
  const [h, m] = time.split(':')
  const hour = Number(h)
  const ampm = hour >= 12 ? 'PM' : 'AM'
  const display = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour
  return `${display}:${m} ${ampm}`
}

function formatDate(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00+05:30`)
  return d.toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Kolkata',
  })
}

// ── Telegram ─────────────────────────────────────────────────

async function notifyTelegramAppointment(params: {
  listingName: string
  listingId: string
  customerName: string
  customerPhone: string
  bookingDate: string
  slotStart: string
  slotEnd: string
  bookingFee: number
  paymentStatus: string
}) {
  const token = process.env.TELEGRAM_BOT_TOKEN
  const chatId = process.env.TELEGRAM_CHAT_ID
  if (!token || !chatId) return

  const dateDisplay = formatDate(params.bookingDate)
  const timeDisplay = `${formatSlotTime(params.slotStart)} – ${formatSlotTime(params.slotEnd)}`
  const feeDisplay = params.bookingFee > 0 ? `₹${params.bookingFee}` : 'Free'
  const listingUrl = `https://ourdahanu.in/listings/${params.listingId}`

  const text = [
    '📅 <b>New Appointment Booked</b>',
    '',
    `🏪 <b>Business:</b> ${escapeHtml(params.listingName)}`,
    `👤 <b>Customer:</b> ${escapeHtml(params.customerName)}`,
    `📞 <b>Phone:</b> ${escapeHtml(params.customerPhone)}`,
    `🗓 <b>Date:</b> ${dateDisplay}`,
    `🕐 <b>Time:</b> ${timeDisplay}`,
    `💰 <b>Fee:</b> ${feeDisplay} (${params.paymentStatus})`,
    '',
    `🔗 <a href="${listingUrl}">View Listing</a> · <a href="https://ourdahanu.in/admin/appointments">Admin Panel</a>`,
  ].join('\n')

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

// ── Email to Business Owner ──────────────────────────────────

async function notifyOwnerEmail(params: {
  ownerEmail: string
  listingName: string
  listingId: string
  customerName: string
  customerPhone: string
  customerEmail: string | null
  bookingDate: string
  slotStart: string
  slotEnd: string
  bookingFee: number
  notes: string | null
}) {
  if (!process.env.RESEND_API_KEY) return

  const { Resend } = await import('resend')
  const resend = new Resend(process.env.RESEND_API_KEY)

  const dateDisplay = formatDate(params.bookingDate)
  const timeDisplay = `${formatSlotTime(params.slotStart)} – ${formatSlotTime(params.slotEnd)}`
  const feeDisplay = params.bookingFee > 0 ? `₹${params.bookingFee}` : 'Free'
  const dashboardUrl = 'https://ourdahanu.in/my-business/appointments'

  const safeName = escapeHtml(params.listingName)
  const safeCustomer = escapeHtml(params.customerName)
  const safePhone = escapeHtml(params.customerPhone)
  const safeEmail = params.customerEmail ? escapeHtml(params.customerEmail) : null
  const safeNotes = params.notes ? escapeHtml(params.notes) : null

  await resend.emails.send({
    from: 'OurDahanu <hello@ourdahanu.in>',
    to: [params.ownerEmail],
    subject: `📅 New appointment booked — ${params.listingName}`,
    html: `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/></head>
<body style="margin:0;padding:0;background:#FBF0DC;font-family:sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#FBF0DC;padding:32px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
        <tr>
          <td style="background:linear-gradient(135deg,#3D1A08,#C4663A);padding:24px 32px;">
            <h1 style="margin:0;color:#FBF0DC;font-size:20px;font-weight:700;">OurDahanu — New Appointment</h1>
          </td>
        </tr>
        <tr>
          <td style="padding:32px;">
            <p style="margin:0 0 6px;font-size:28px;">📅</p>
            <h2 style="margin:0 0 8px;color:#1a1a1a;font-size:20px;">Appointment Booked!</h2>
            <p style="margin:0 0 24px;color:#555;font-size:15px;">Someone just booked an appointment at <strong>${safeName}</strong>.</p>

            <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;border-radius:10px;padding:20px;margin-bottom:24px;">
              <tr><td style="padding:6px 0;">
                <span style="color:#888;font-size:12px;font-weight:600;text-transform:uppercase;">Customer</span><br/>
                <span style="color:#1a1a1a;font-size:16px;font-weight:700;">${safeCustomer}</span>
              </td></tr>
              <tr><td style="padding:6px 0;border-top:1px solid #eee;">
                <span style="color:#888;font-size:12px;font-weight:600;text-transform:uppercase;">Phone</span><br/>
                <span style="color:#1a1a1a;font-size:15px;">${safePhone}</span>
              </td></tr>
              ${safeEmail ? `<tr><td style="padding:6px 0;border-top:1px solid #eee;">
                <span style="color:#888;font-size:12px;font-weight:600;text-transform:uppercase;">Email</span><br/>
                <span style="color:#1a1a1a;font-size:15px;">${safeEmail}</span>
              </td></tr>` : ''}
              <tr><td style="padding:6px 0;border-top:1px solid #eee;">
                <span style="color:#888;font-size:12px;font-weight:600;text-transform:uppercase;">Date &amp; Time</span><br/>
                <span style="color:#1a1a1a;font-size:15px;font-weight:700;">${dateDisplay}</span><br/>
                <span style="color:#C4663A;font-size:15px;font-weight:700;">${timeDisplay}</span>
              </td></tr>
              <tr><td style="padding:6px 0;border-top:1px solid #eee;">
                <span style="color:#888;font-size:12px;font-weight:600;text-transform:uppercase;">Booking Fee</span><br/>
                <span style="color:#1a1a1a;font-size:15px;">${feeDisplay}</span>
              </td></tr>
              ${safeNotes ? `<tr><td style="padding:6px 0;border-top:1px solid #eee;">
                <span style="color:#888;font-size:12px;font-weight:600;text-transform:uppercase;">Notes</span><br/>
                <span style="color:#555;font-size:14px;">${safeNotes}</span>
              </td></tr>` : ''}
            </table>

            <a href="${dashboardUrl}"
               style="display:inline-block;background:#C4663A;color:#fff;text-decoration:none;padding:14px 28px;border-radius:8px;font-weight:700;font-size:15px;">
              View Appointments &rarr;
            </a>
          </td>
        </tr>
        <tr>
          <td style="background:#f9fafb;padding:16px 32px;text-align:center;">
            <p style="margin:0;color:#aaa;font-size:12px;">OurDahanu &mdash; Dahanu's Community Portal</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
  })
}

// ── Main Export ───────────────────────────────────────────────

export async function notifyAppointmentBooked(params: {
  listingId: string
  listingName: string
  ownerUserId: string
  customerName: string
  customerPhone: string
  customerEmail: string | null
  bookingDate: string
  slotStart: string
  slotEnd: string
  bookingFee: number
  paymentStatus: string
  notes: string | null
}) {
  try {
    // Telegram to admin — fire and forget
    void notifyTelegramAppointment({
      listingName: params.listingName,
      listingId: params.listingId,
      customerName: params.customerName,
      customerPhone: params.customerPhone,
      bookingDate: params.bookingDate,
      slotStart: params.slotStart,
      slotEnd: params.slotEnd,
      bookingFee: params.bookingFee,
      paymentStatus: params.paymentStatus,
    }).catch(err => console.error('[notifyAppointment:telegram]', err))

    // Email to business owner — need to fetch owner email
    try {
      const { createAdminClient } = await import('@/lib/supabase/admin-client')
      const adminClient = createAdminClient()
      if (adminClient) {
        const { data: { user: ownerUser } } = await adminClient.auth.admin.getUserById(params.ownerUserId)
        if (ownerUser?.email) {
          void notifyOwnerEmail({
            ownerEmail: ownerUser.email,
            listingName: params.listingName,
            listingId: params.listingId,
            customerName: params.customerName,
            customerPhone: params.customerPhone,
            customerEmail: params.customerEmail,
            bookingDate: params.bookingDate,
            slotStart: params.slotStart,
            slotEnd: params.slotEnd,
            bookingFee: params.bookingFee,
            notes: params.notes,
          }).catch(err => console.error('[notifyAppointment:email]', err))
        }
      }
    } catch (err) {
      console.error('[notifyAppointment:owner-lookup]', err)
    }
  } catch (err) {
    console.error('[notifyAppointmentBooked]', err)
  }
}
