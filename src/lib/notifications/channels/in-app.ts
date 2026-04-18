import 'server-only'

import { createAdminClient } from '@/lib/supabase/admin-client'

import type { NotificationType, RenderedNotification } from '../types'

/**
 * Inserts a notification row into the `notifications` table so it shows up
 * in the bell dropdown / inbox. Supabase Realtime will broadcast this row
 * to the bell for the given user.
 */
export async function deliverInApp(params: {
  userId: string
  type: NotificationType
  rendered: RenderedNotification
}): Promise<void> {
  const adminClient = createAdminClient()
  if (!adminClient) {
    console.warn('[notifications:in-app] admin client unavailable — skipping')
    return
  }

  const { error } = await adminClient.from('notifications').insert({
    user_id: params.userId,
    type: params.type,
    title: params.rendered.title.slice(0, 160),
    body: params.rendered.body.slice(0, 600),
    link: params.rendered.link || null,
    icon: params.rendered.icon || null,
    metadata: params.rendered.metadata ?? null,
  })

  if (error) {
    console.error('[notifications:in-app] insert failed:', error)
  }
}
