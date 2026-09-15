/**
 * Notification types + payload shapes for the unified notification engine.
 *
 * Adding a new type:
 *   1. Add the string literal to `NotificationType`.
 *   2. Add its payload shape to `NotificationPayloadMap`.
 *   3. Add a renderer to `src/lib/notifications/templates.ts`.
 */

export const NOTIFICATION_TYPES = [
  // Marketplace orders (owner_razorpay flow)
  'order.placed',
  'order.fulfilled',
  'order.cancelled',
  // Appointments
  'appointment.booked',
  'appointment.reminder',
  'appointment.cancelled',
  // Listings
  'listing.approved',
  'listing.rejected',
  'listing.expiring',
  // Jobs board
  'job.approved',
  'job.rejected',
  'job.expiring',
  // Selling online
  'selling.paused',
  'selling.resumed',
  // Reviews
  'review.new',
  'review.reply_posted',
  // Admin
  'admin.new_submission',
] as const

export type NotificationType = (typeof NOTIFICATION_TYPES)[number]

// ─────────────────────────────────────────────────────────────────────────────
// Per-type payload shapes
// ─────────────────────────────────────────────────────────────────────────────

interface OrderPlacedPayload {
  orderId: string
  listingId: string
  listingName: string
  productName: string
  quantity: number
  amountTotal: number
  buyerName: string
  /** Which recipient is this rendered for? */
  recipient: 'buyer' | 'owner' | 'admin'
  /** Paid with Razorpay test keys: a practice purchase, no real money moved. */
  isTest?: boolean
}

interface OrderStatusPayload {
  orderId: string
  listingName: string
  productName: string
}

interface AppointmentBookedPayload {
  listingId: string
  listingName: string
  subdomain?: string | null
  customerName: string
  customerPhone: string
  bookingDate: string // YYYY-MM-DD
  slotStart: string // HH:MM
  slotEnd: string // HH:MM
  bookingFee: number
  recipient: 'buyer' | 'owner' | 'admin'
}

interface AppointmentReminderPayload {
  listingId: string
  listingName: string
  subdomain?: string | null
  bookingDate: string
  slotStart: string
  slotEnd: string
  recipient: 'buyer' | 'owner'
}

interface AppointmentCancelledPayload {
  listingName: string
  bookingDate: string
  slotStart: string
  recipient: 'buyer' | 'owner'
}

interface ListingApprovedPayload {
  listingId: string
  listingName: string
  subdomain?: string | null
}

interface ListingRejectedPayload {
  listingId: string
  listingName: string
  reason?: string | null
}

interface ListingExpiringPayload {
  listingId: string
  listingName: string
  daysLeft: number
}

interface JobApprovedPayload {
  postId: string
  title: string
  kind: 'hiring' | 'seeking'
}

interface JobRejectedPayload {
  postId: string
  title: string
  kind: 'hiring' | 'seeking'
  reason: string
}

interface JobExpiringPayload {
  postId: string
  title: string
  kind: 'hiring' | 'seeking'
  daysLeft: number
}

interface SellingPausedPayload {
  listingId: string
  listingName: string
  /** Shown to the owner: written by an admin, or a fixed system reason. */
  reason: string
  /** True when an admin paused selling; false when Razorpay rejected the keys. */
  byAdmin: boolean
}

interface SellingResumedPayload {
  listingId: string
  listingName: string
}

interface ReviewNewPayload {
  listingId: string
  listingName: string
  subdomain?: string | null
  reviewerName: string | null
  rating: number
  comment?: string | null
  recipient: 'owner' | 'admin'
}

interface ReviewReplyPostedPayload {
  reviewId: string
  listingId: string
  listingName: string
  subdomain?: string | null
  ownerName: string | null
  reviewerName: string | null
  rating: number
  reviewComment?: string | null
  replyText: string
  recipient: 'reviewer' | 'admin'
}

interface AdminSubmissionPayload {
  kind:
    | 'listing'
    | 'event'
    | 'professional'
    | 'professional_review'
    | 'job'
    | 'job_report'
    | 'shop_live'
  title: string
  submitterName?: string | null
  reviewPath: string
}

export interface NotificationPayloadMap {
  'order.placed': OrderPlacedPayload
  'order.fulfilled': OrderStatusPayload
  'order.cancelled': OrderStatusPayload
  'appointment.booked': AppointmentBookedPayload
  'appointment.reminder': AppointmentReminderPayload
  'appointment.cancelled': AppointmentCancelledPayload
  'listing.approved': ListingApprovedPayload
  'listing.rejected': ListingRejectedPayload
  'listing.expiring': ListingExpiringPayload
  'job.approved': JobApprovedPayload
  'job.rejected': JobRejectedPayload
  'job.expiring': JobExpiringPayload
  'selling.paused': SellingPausedPayload
  'selling.resumed': SellingResumedPayload
  'review.new': ReviewNewPayload
  'review.reply_posted': ReviewReplyPostedPayload
  'admin.new_submission': AdminSubmissionPayload
}

export type NotificationPayload<T extends NotificationType = NotificationType> =
  NotificationPayloadMap[T]

/**
 * Rendered notification in its final user-facing forms.
 * The dispatcher picks which channels to actually dispatch per user preference.
 */
export interface RenderedNotification {
  /** Short headline — shown in the bell dropdown + email subject fallback. */
  title: string
  /** Plain-text body for dropdown + in-app inbox. */
  body: string
  /** Where clicking the notification takes the user (relative path). */
  link: string
  /** Lucide icon name (used by the bell dropdown to pick an icon). */
  icon: string
  /** Optional structured metadata persisted alongside the notification row. */
  metadata?: Record<string, unknown>
  /** Optional richer email render. If missing, a fallback HTML is built from title/body/link. */
  email?: { subject: string; html: string }
  /** Optional Telegram render (HTML parse_mode). If missing, a fallback is built from title/body/link. */
  telegram?: { text: string }
  /** Optional WhatsApp template dispatch. Only fires for owners with WA number on file. */
  whatsappTemplate?: { name: string; params: string[] }
}

/**
 * Options passed to the dispatcher for a single notification.
 */
export interface DispatchOptions {
  /** Skip channels even if user has them enabled (useful for retries / test mode). */
  channelOverride?: Partial<Record<'email' | 'telegram' | 'in_app' | 'whatsapp', boolean>>
  /**
   * Defaults to true: await every channel, including inside after(), so the
   * serverless function stays alive until delivery completes. Only disable if
   * the caller independently guarantees the runtime will remain alive.
   */
  awaitDelivery?: boolean
}

/**
 * User preferences row (matches `notification_preferences` table).
 */
export interface NotificationPreferences {
  user_id: string
  email_enabled: boolean
  in_app_enabled: boolean
  telegram_enabled: boolean
  whatsapp_enabled: boolean
  telegram_chat_id: string | null
  telegram_verified_at: string | null
  muted_types: string[]
}

export const DEFAULT_PREFERENCES: Omit<NotificationPreferences, 'user_id'> = {
  email_enabled: true,
  in_app_enabled: true,
  telegram_enabled: false,
  whatsapp_enabled: true,
  telegram_chat_id: null,
  telegram_verified_at: null,
  muted_types: [],
}
