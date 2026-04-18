import 'server-only'

import { sendWhatsAppTemplate } from '@/lib/whatsapp'

import type { RenderedNotification } from '../types'

/**
 * Dispatches a WhatsApp template message for owner-scoped events.
 * Only fires when the rendered notification has a `whatsappTemplate` payload
 * AND a phone number is available.
 *
 * Note: WhatsApp can only deliver pre-approved templates — free-form text is
 * blocked by Meta outside a 24h customer-initiated window.
 */
export async function deliverWhatsApp(params: {
  phone: string
  rendered: RenderedNotification
}): Promise<void> {
  const template = params.rendered.whatsappTemplate
  if (!template) return

  await sendWhatsAppTemplate(params.phone, template.name, template.params)
}
