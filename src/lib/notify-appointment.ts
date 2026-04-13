import { getCanonicalListingUrl } from '@/lib/listing-url'
import { createAdminClient } from '@/lib/supabase/admin-client'

const SITE_URL = 'https://ourdahanu.in'
const ADMIN_APPOINTMENTS_URL = `${SITE_URL}/admin/appointments`
const OWNER_APPOINTMENTS_URL = `${SITE_URL}/my-business/appointments`
const CUSTOMER_APPOINTMENTS_URL = `${SITE_URL}/dashboard/appointments`

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
  const date = new Date(`${dateStr}T00:00:00+05:30`)
  return date.toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Kolkata',
  })
}

function formatFee(value: number): string {
  return value > 0 ? `Rs ${value.toLocaleString('en-IN')}` : 'Free'
}

function buildEmailLayout(params: {
  eyebrow: string
  headline: string
  intro: string
  detailRows: string
  ctaUrl: string
  ctaText: string
  footerNote: string
}) {
  const safeEyebrow = escapeHtml(params.eyebrow)
  const safeHeadline = escapeHtml(params.headline)
  const safeIntro = params.intro
  const safeFooterNote = escapeHtml(params.footerNote)

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
</head>
<body style="margin:0;padding:0;background:#FBF0DC;font-family:sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#FBF0DC;padding:32px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
        <tr>
          <td style="background:linear-gradient(135deg,#3D1A08,#C4663A);padding:24px 32px;">
            <p style="margin:0;color:#F7E7D6;font-size:11px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;">${safeEyebrow}</p>
            <h1 style="margin:8px 0 0;color:#FBF0DC;font-size:22px;font-weight:700;">OurDahanu</h1>
          </td>
        </tr>
        <tr>
          <td style="padding:32px;">
            <h2 style="margin:0 0 12px;color:#1a1a1a;font-size:22px;font-weight:700;">${safeHeadline}</h2>
            <p style="margin:0 0 24px;color:#555;font-size:15px;line-height:1.65;">${safeIntro}</p>

            <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;border-radius:10px;padding:20px;margin-bottom:24px;">
              ${params.detailRows}
            </table>

            <a href="${params.ctaUrl}" style="display:inline-block;background:#C4663A;color:#fff;text-decoration:none;padding:14px 28px;border-radius:8px;font-weight:700;font-size:15px;">
              ${escapeHtml(params.ctaText)} &rarr;
            </a>

            <p style="margin:20px 0 0;color:#999;font-size:13px;line-height:1.55;">${safeFooterNote}</p>
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
</html>`
}

function buildDetailRow(label: string, value: string, bordered = true) {
  return `<tr><td style="padding:6px 0;${bordered ? 'border-top:1px solid #eee;' : ''}">
    <span style="color:#888;font-size:12px;font-weight:600;text-transform:uppercase;">${escapeHtml(label)}</span><br/>
    <span style="color:#1a1a1a;font-size:15px;">${value}</span>
  </td></tr>`
}

async function resolveAuthEmail(userId: string): Promise<string | null> {
  const adminClient = createAdminClient()
  if (!adminClient) return null

  const { data } = await adminClient.auth.admin.getUserById(userId)
  return data.user?.email ?? null
}

async function sendTelegramBookingAlert(params: {
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
  const timeDisplay = `${formatSlotTime(params.slotStart)} - ${formatSlotTime(params.slotEnd)}`
  const listingUrl = `${SITE_URL}/listings/${params.listingId}`

  const text = [
    '<b>New Appointment Booked</b>',
    '',
    `<b>Business:</b> ${escapeHtml(params.listingName)}`,
    `<b>Customer:</b> ${escapeHtml(params.customerName)}`,
    `<b>Phone:</b> ${escapeHtml(params.customerPhone)}`,
    `<b>Date:</b> ${dateDisplay}`,
    `<b>Time:</b> ${timeDisplay}`,
    `<b>Fee:</b> ${escapeHtml(formatFee(params.bookingFee))} (${escapeHtml(params.paymentStatus)})`,
    '',
    `<a href="${listingUrl}">View Listing</a> | <a href="${ADMIN_APPOINTMENTS_URL}">Admin Panel</a>`,
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

async function sendOwnerBookingEmail(params: {
  ownerEmail: string
  listingName: string
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
  const timeDisplay = `${formatSlotTime(params.slotStart)} - ${formatSlotTime(params.slotEnd)}`

  const rows = [
    buildDetailRow('Customer', `<strong>${escapeHtml(params.customerName)}</strong>`, false),
    buildDetailRow('Phone', escapeHtml(params.customerPhone)),
    params.customerEmail ? buildDetailRow('Email', escapeHtml(params.customerEmail)) : '',
    buildDetailRow('Date', `<strong>${escapeHtml(dateDisplay)}</strong>`),
    buildDetailRow('Time', `<strong>${escapeHtml(timeDisplay)}</strong>`),
    buildDetailRow('Booking Fee', escapeHtml(formatFee(params.bookingFee))),
    params.notes ? buildDetailRow('Notes', escapeHtml(params.notes)) : '',
  ].join('')

  await resend.emails.send({
    from: 'OurDahanu <hello@ourdahanu.in>',
    to: [params.ownerEmail],
    subject: `New appointment booked - ${params.listingName}`,
    html: buildEmailLayout({
      eyebrow: 'New Appointment',
      headline: 'A customer just booked a slot',
      intro: `Someone booked an appointment at <strong>${escapeHtml(params.listingName)}</strong>. The schedule details are below.`,
      detailRows: rows,
      ctaUrl: OWNER_APPOINTMENTS_URL,
      ctaText: 'View Appointments',
      footerNote: 'You can manage incoming appointments from the My Business dashboard.',
    }),
  })
}

async function sendOwnerReminderEmail(params: {
  ownerEmail: string
  listingName: string
  listingUrl: string
  customerName: string
  customerPhone: string
  customerEmail: string | null
  bookingDate: string
  slotStart: string
  slotEnd: string
  bookingFee: number
  notes: string | null
}) {
  if (!process.env.RESEND_API_KEY) return false

  const { Resend } = await import('resend')
  const resend = new Resend(process.env.RESEND_API_KEY)
  const dateDisplay = formatDate(params.bookingDate)
  const timeDisplay = `${formatSlotTime(params.slotStart)} - ${formatSlotTime(params.slotEnd)}`

  const rows = [
    buildDetailRow('Business', `<strong>${escapeHtml(params.listingName)}</strong>`, false),
    buildDetailRow('Customer', `<strong>${escapeHtml(params.customerName)}</strong>`),
    buildDetailRow('Phone', escapeHtml(params.customerPhone)),
    params.customerEmail ? buildDetailRow('Email', escapeHtml(params.customerEmail)) : '',
    buildDetailRow('Date', `<strong>${escapeHtml(dateDisplay)}</strong>`),
    buildDetailRow('Time', `<strong>${escapeHtml(timeDisplay)}</strong>`),
    buildDetailRow('Booking Fee', escapeHtml(formatFee(params.bookingFee))),
    params.notes ? buildDetailRow('Notes', escapeHtml(params.notes)) : '',
    buildDetailRow('Listing', `<a href="${params.listingUrl}" style="color:#C4663A;text-decoration:none;">Open listing page</a>`),
  ].join('')

  await resend.emails.send({
    from: 'OurDahanu <hello@ourdahanu.in>',
    to: [params.ownerEmail],
    subject: `Reminder: upcoming appointment at ${params.listingName}`,
    html: buildEmailLayout({
      eyebrow: 'Appointment Reminder',
      headline: 'Upcoming appointment in the next two hours',
      intro: `A booked appointment at <strong>${escapeHtml(params.listingName)}</strong> is starting soon. This is a reminder for your team to be ready.`,
      detailRows: rows,
      ctaUrl: OWNER_APPOINTMENTS_URL,
      ctaText: 'Open Owner Dashboard',
      footerNote: 'Use the owner dashboard to manage status, cancellations, and incoming appointments.',
    }),
  })

  return true
}

async function sendCustomerReminderEmail(params: {
  customerEmail: string
  customerName: string
  listingName: string
  listingUrl: string
  bookingDate: string
  slotStart: string
  slotEnd: string
  bookingFee: number
  notes: string | null
}) {
  if (!process.env.RESEND_API_KEY) return false

  const { Resend } = await import('resend')
  const resend = new Resend(process.env.RESEND_API_KEY)
  const dateDisplay = formatDate(params.bookingDate)
  const timeDisplay = `${formatSlotTime(params.slotStart)} - ${formatSlotTime(params.slotEnd)}`

  const rows = [
    buildDetailRow('Business', `<strong>${escapeHtml(params.listingName)}</strong>`, false),
    buildDetailRow('Date', `<strong>${escapeHtml(dateDisplay)}</strong>`),
    buildDetailRow('Time', `<strong>${escapeHtml(timeDisplay)}</strong>`),
    buildDetailRow('Booking Fee', escapeHtml(formatFee(params.bookingFee))),
    params.notes ? buildDetailRow('Notes', escapeHtml(params.notes)) : '',
    buildDetailRow('Listing', `<a href="${params.listingUrl}" style="color:#C4663A;text-decoration:none;">View business page</a>`),
  ].join('')

  await resend.emails.send({
    from: 'OurDahanu <hello@ourdahanu.in>',
    to: [params.customerEmail],
    subject: `Reminder: your appointment with ${params.listingName} starts soon`,
    html: buildEmailLayout({
      eyebrow: 'Appointment Reminder',
      headline: 'Your appointment starts soon',
      intro: `Hi <strong>${escapeHtml(params.customerName)}</strong>, this is a reminder that your appointment with <strong>${escapeHtml(params.listingName)}</strong> is coming up within the next two hours.`,
      detailRows: rows,
      ctaUrl: CUSTOMER_APPOINTMENTS_URL,
      ctaText: 'Open My Appointments',
      footerNote: 'You can review or manage your booking from the appointments page in your account.',
    }),
  })

  return true
}

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
    void sendTelegramBookingAlert({
      listingName: params.listingName,
      listingId: params.listingId,
      customerName: params.customerName,
      customerPhone: params.customerPhone,
      bookingDate: params.bookingDate,
      slotStart: params.slotStart,
      slotEnd: params.slotEnd,
      bookingFee: params.bookingFee,
      paymentStatus: params.paymentStatus,
    }).catch((err) => console.error('[notifyAppointment:telegram]', err))

    const ownerEmail = await resolveAuthEmail(params.ownerUserId)
    if (ownerEmail) {
      void sendOwnerBookingEmail({
        ownerEmail,
        listingName: params.listingName,
        customerName: params.customerName,
        customerPhone: params.customerPhone,
        customerEmail: params.customerEmail,
        bookingDate: params.bookingDate,
        slotStart: params.slotStart,
        slotEnd: params.slotEnd,
        bookingFee: params.bookingFee,
        notes: params.notes,
      }).catch((err) => console.error('[notifyAppointment:email]', err))
    }
  } catch (err) {
    console.error('[notifyAppointmentBooked]', err)
  }
}

export async function sendAppointmentReminderEmails(params: {
  listingId: string
  listingName: string
  listingSubdomain?: string | null
  ownerUserId: string | null
  customerUserId: string
  customerName: string
  customerPhone: string
  customerEmail: string | null
  bookingDate: string
  slotStart: string
  slotEnd: string
  bookingFee: number
  notes: string | null
  ownerReminderPending: boolean
  customerReminderPending: boolean
}): Promise<{ ownerSent: boolean; customerSent: boolean }> {
  try {
    if (!process.env.RESEND_API_KEY) {
      return { ownerSent: false, customerSent: false }
    }

    const listingUrl = getCanonicalListingUrl(params.listingId, params.listingSubdomain)
    const resolvedCustomerEmail = params.customerEmail ?? await resolveAuthEmail(params.customerUserId)
    const ownerEmail =
      params.ownerReminderPending && params.ownerUserId
        ? await resolveAuthEmail(params.ownerUserId)
        : null
    const customerEmail =
      params.customerReminderPending
        ? resolvedCustomerEmail
        : null

    const [ownerResult, customerResult] = await Promise.allSettled([
      params.ownerReminderPending && ownerEmail
        ? sendOwnerReminderEmail({
            ownerEmail,
            listingName: params.listingName,
            listingUrl,
            customerName: params.customerName,
            customerPhone: params.customerPhone,
            customerEmail: resolvedCustomerEmail,
            bookingDate: params.bookingDate,
            slotStart: params.slotStart,
            slotEnd: params.slotEnd,
            bookingFee: params.bookingFee,
            notes: params.notes,
          })
        : Promise.resolve(false),
      params.customerReminderPending && customerEmail
        ? sendCustomerReminderEmail({
            customerEmail,
            customerName: params.customerName,
            listingName: params.listingName,
            listingUrl,
            bookingDate: params.bookingDate,
            slotStart: params.slotStart,
            slotEnd: params.slotEnd,
            bookingFee: params.bookingFee,
            notes: params.notes,
          })
        : Promise.resolve(false),
    ])

    return {
      ownerSent: ownerResult.status === 'fulfilled' ? ownerResult.value : false,
      customerSent: customerResult.status === 'fulfilled' ? customerResult.value : false,
    }
  } catch (err) {
    console.error('[sendAppointmentReminderEmails]', err)
    return { ownerSent: false, customerSent: false }
  }
}
