import type { NotificationPayload } from '@/lib/notifications'

type WriteError = { message: string } | null
type AdminNotifier = (
  type: 'admin.new_submission',
  payload: NotificationPayload<'admin.new_submission'>,
) => unknown

export function completeFindWrite(
  error: WriteError,
  payload: NotificationPayload<'admin.new_submission'>,
  notify: AdminNotifier,
  logContext = '[find:notify]',
): { error: string } | { ok: true } {
  if (error) return { error: error.message }

  Promise.resolve(notify('admin.new_submission', payload)).catch((err) =>
    console.error(logContext, err),
  )

  return { ok: true }
}
