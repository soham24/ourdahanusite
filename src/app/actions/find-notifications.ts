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

  // Start delivery SYNCHRONOUSLY so the async work is in-flight before the
  // server action returns — matching the working pattern used by listings/jobs
  // (`void sendNotificationToAdmins(...)`). The previous
  // `Promise.resolve().then(() => notify(...))` deferred the start to a
  // microtask that ran only AFTER the action returned, so on Vercel the
  // serverless function froze before notify executed and NOTHING was delivered
  // (not even the in-app row). try/catch covers a synchronous throw; .catch
  // covers a rejected promise.
  try {
    void Promise.resolve(notify('admin.new_submission', payload)).catch((err) =>
      console.error(logContext, err),
    )
  } catch (err) {
    console.error(logContext, err)
  }

  return { ok: true }
}
