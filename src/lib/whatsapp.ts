/**
 * Meta WhatsApp Cloud API client
 *
 * Required env vars (add to Vercel + .env.local):
 *   WHATSAPP_ACCESS_TOKEN     — Permanent token from Meta System User
 *   WHATSAPP_PHONE_NUMBER_ID  — Phone Number ID from Meta App dashboard
 *
 * Setup guide:
 *   1. Go to developers.facebook.com → My Apps → Create App → Business
 *   2. Add "WhatsApp" product to the app
 *   3. WhatsApp → Getting Started → copy Phone Number ID + temporary token
 *   4. For permanent token: Business Settings → System Users → Generate token (whatsapp_business_messaging)
 *   5. Create message templates at: business.facebook.com/wa/manage/message-templates/
 *
 * Templates to create in Meta (Category: UTILITY, Language: English):
 * ─────────────────────────────────────────────────────────────────────
 *
 * [1] Name: listing_approved_notice
 * Body: "🎉 Great news! Your listing *{{1}}* is now live on OurDahanu!\n\nCustomers in Dahanu can now find you at:\n{{2}}\n\nShare this link with your customers!"
 *
 * [2] Name: listing_expiry_reminder
 * Body: "⏰ Reminder: Your listing *{{1}}* on OurDahanu expires in *{{2}} days*.\n\nRenew now to stay visible to local customers:\n{{3}}"
 *
 * [3] Name: listing_expired_notice
 * Body: "⚠️ Your listing *{{1}}* on OurDahanu has expired and is no longer visible to customers.\n\nRenew now to get back online:\n{{2}}"
 */

const WA_API_BASE = 'https://graph.facebook.com/v19.0'

/**
 * Normalize any Indian phone number to E.164 digits (no +), e.g. "91XXXXXXXXXX"
 */
export function formatWhatsAppPhone(phone: string): string | null {
  const digits = phone.replace(/\D/g, '')
  if (digits.length === 10) return `91${digits}`
  if (digits.length === 11 && digits.startsWith('0')) return `91${digits.slice(1)}`
  if (digits.length === 12 && digits.startsWith('91')) return digits
  if (digits.length === 13 && digits.startsWith('091')) return digits.slice(1)
  return null
}

/**
 * Send a pre-approved template message.
 * bodyParams maps to {{1}}, {{2}}, ... placeholders in the template body.
 */
export async function sendWhatsAppTemplate(
  to: string,
  templateName: string,
  bodyParams: string[],
): Promise<boolean> {
  const token         = process.env.WHATSAPP_ACCESS_TOKEN
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID
  if (!token || !phoneNumberId) return false

  const formattedTo = formatWhatsAppPhone(to)
  if (!formattedTo) {
    console.warn('[whatsapp] Could not format phone:', to)
    return false
  }

  const payload = {
    messaging_product: 'whatsapp',
    to: formattedTo,
    type: 'template',
    template: {
      name: templateName,
      language: { code: 'en' },
      components: bodyParams.length > 0
        ? [{
            type: 'body',
            parameters: bodyParams.map(text => ({ type: 'text', text })),
          }]
        : [],
    },
  }

  try {
    const res = await fetch(`${WA_API_BASE}/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })

    if (!res.ok) {
      const err = await res.text()
      console.error('[whatsapp:template]', templateName, err)
      return false
    }

    return true
  } catch (err) {
    console.error('[whatsapp:template]', err)
    return false
  }
}

/**
 * Notify a listing owner that their listing was approved and is now live.
 * Template: listing_approved_notice  (params: listingName, listingUrl)
 */
export async function waNotifyListingApproved(
  phone: string,
  listingName: string,
  listingUrl: string,
): Promise<boolean> {
  return sendWhatsAppTemplate(phone, 'listing_approved_notice', [listingName, listingUrl])
}

/**
 * Notify a listing owner about upcoming expiry or that their listing expired.
 * Templates:
 *   daysLeft > 0 → listing_expiry_reminder  (params: listingName, daysLeft, renewUrl)
 *   daysLeft = 0 → listing_expired_notice   (params: listingName, renewUrl)
 */
export async function waNotifyListingExpiry(
  phone: string,
  listingName: string,
  renewUrl: string,
  daysLeft: number,
): Promise<boolean> {
  if (daysLeft === 0) {
    return sendWhatsAppTemplate(phone, 'listing_expired_notice', [listingName, renewUrl])
  }
  return sendWhatsAppTemplate(phone, 'listing_expiry_reminder', [
    listingName,
    String(daysLeft),
    renewUrl,
  ])
}
