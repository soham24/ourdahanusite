/**
 * Public surface of the notification engine. Server-only.
 */

export {
  sendNotification,
  sendNotificationToMany,
  sendNotificationToAdmins,
} from './dispatcher'
export type {
  NotificationType,
  NotificationPayload,
  NotificationPreferences,
  RenderedNotification,
  DispatchOptions,
} from './types'
export { NOTIFICATION_TYPES } from './types'
