/**
 * Per-type template renderers.
 * This is the single source of truth for notification copy (title/body/email/telegram/whatsapp).
 */

import { buildDetailRow, escapeHtml, renderEmailLayout } from './email-layout'
import type {
  NotificationPayload,
  NotificationType,
  RenderedNotification,
} from './types'
import { siteConfig } from '@/lib/site'

// The production domain, not the current deployment's: a link inside an
// email outlives the preview that sent it.
const SITE_URL = `https://${siteConfig.domain}`
const JOBS_URL = `https://jobs.${siteConfig.domain}`

function formatDate(dateStr: string): string {
  const date = new Date(`${dateStr}T00:00:00+05:30`)
  return date.toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'Asia/Kolkata',
  })
}

function formatSlotTime(time: string): string {
  const [h, m] = time.split(':')
  const hour = Number(h)
  const ampm = hour >= 12 ? 'PM' : 'AM'
  const display = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour
  return `${display}:${m} ${ampm}`
}

function formatCurrency(amount: number): string {
  return `₹${Number(amount || 0).toLocaleString('en-IN')}`
}

function getListingUrl(listingId: string, subdomain?: string | null): string {
  return subdomain ? `https://${subdomain}.ourdahanu.in` : `${SITE_URL}/listings/${listingId}`
}

// ─────────────────────────────────────────────────────────────────────────────
// Renderers (one per type)
// ─────────────────────────────────────────────────────────────────────────────

function renderOrderPlaced(p: NotificationPayload<'order.placed'>): RenderedNotification {
  const amount = formatCurrency(p.amountTotal)
  const qty = p.quantity
  const testPrefix = p.isTest ? 'Test order · ' : ''
  const testSubject = p.isTest ? '[Test] ' : ''
  // Only ever shown to the owner/admin: the buyer's own confirmation never
  // reads this, since their payment did go through regardless.
  const issueLine = p.fulfillmentIssue ? ` Needs attention: ${p.fulfillmentIssue}` : ''

  if (p.recipient === 'buyer') {
    return {
      title: `${testPrefix}Order confirmed · ${p.listingName}`,
      body: `Thanks! We received your order for ${p.productName} × ${qty} (${amount}).`,
      link: `/account/orders/${p.orderId}`,
      icon: 'ShoppingBag',
      metadata: { orderId: p.orderId, listingId: p.listingId },
      email: {
        subject: `${testSubject}Order confirmed at ${p.listingName}`,
        html: renderEmailLayout({
          eyebrow: 'Order Confirmed',
          headline: `Your order at ${p.listingName} is confirmed`,
          introHtml: `Hi ${escapeHtml(p.buyerName)}, thanks for shopping on ${siteConfig.name}. Your payment has been received.`,
          detailRows: [
            buildDetailRow('Item', `<strong>${escapeHtml(p.productName)}</strong>`, false),
            buildDetailRow('Quantity', String(qty)),
            buildDetailRow('Amount', `<strong>${escapeHtml(amount)}</strong>`),
            buildDetailRow('Order ID', `<span style="font-family:monospace;">${escapeHtml(p.orderId.slice(0, 8))}</span>`),
          ].join(''),
          ctaUrl: `${SITE_URL}/account/orders/${p.orderId}`,
          ctaText: 'View Order',
          footerNote: 'The business will reach out to you shortly on the phone number you provided.',
        }),
      },
      telegram: {
        text: [
          '🛒 <b>Order confirmed</b>',
          '',
          `<b>Business:</b> ${escapeHtml(p.listingName)}`,
          `<b>Item:</b> ${escapeHtml(p.productName)} × ${qty}`,
          `<b>Amount:</b> ${escapeHtml(amount)}`,
          '',
          `<a href="${SITE_URL}/account/orders/${p.orderId}">View order</a>`,
        ].join('\n'),
      },
    }
  }

  if (p.recipient === 'owner') {
    return {
      title: `${testPrefix}New order · ${p.productName}`,
      body: `${p.buyerName} just ordered ${p.productName} × ${qty} (${amount}).${issueLine}`,
      link: `/my-business/orders`,
      icon: 'ShoppingBag',
      metadata: { orderId: p.orderId, listingId: p.listingId },
      email: {
        subject: `${testSubject}🛒 New order — ${p.productName} (${amount})`,
        html: renderEmailLayout({
          eyebrow: 'New Order',
          headline: `A customer just placed an order`,
          introHtml: `Congrats — ${escapeHtml(p.buyerName)} just purchased <strong>${escapeHtml(p.productName)}</strong> at ${escapeHtml(p.listingName)}. Payment is settled directly to your Razorpay account.`,
          detailRows: [
            buildDetailRow('Item', `<strong>${escapeHtml(p.productName)}</strong>`, false),
            buildDetailRow('Quantity', String(qty)),
            buildDetailRow('Amount received', `<strong>${escapeHtml(amount)}</strong>`),
            buildDetailRow('Buyer', escapeHtml(p.buyerName)),
            ...(p.fulfillmentIssue ? [buildDetailRow('Needs attention', escapeHtml(p.fulfillmentIssue))] : []),
          ].join(''),
          ctaUrl: `${SITE_URL}/my-business/orders`,
          ctaText: 'Manage Orders',
          footerNote: 'Mark the order fulfilled once you’ve delivered it.',
        }),
      },
      telegram: {
        text: [
          '🛒 <b>New order received</b>',
          '',
          `<b>Business:</b> ${escapeHtml(p.listingName)}`,
          `<b>Item:</b> ${escapeHtml(p.productName)} × ${qty}`,
          `<b>Amount:</b> ${escapeHtml(amount)}`,
          `<b>Buyer:</b> ${escapeHtml(p.buyerName)}`,
          ...(p.fulfillmentIssue ? [`<b>⚠️ Needs attention:</b> ${escapeHtml(p.fulfillmentIssue)}`] : []),
          '',
          `<a href="${SITE_URL}/my-business/orders">Manage orders</a>`,
        ].join('\n'),
      },
    }
  }

  // admin recipient
  return {
    title: `Order placed at ${p.listingName}`,
    body: `${p.buyerName} · ${p.productName} × ${qty} · ${amount}${issueLine}`,
    link: `/admin/orders`,
    icon: 'ShoppingBag',
    metadata: { orderId: p.orderId, listingId: p.listingId },
    telegram: {
      text: [
        '🛒 <b>Marketplace order</b>',
        '',
        `<b>Business:</b> ${escapeHtml(p.listingName)}`,
        `<b>Item:</b> ${escapeHtml(p.productName)} × ${qty}`,
        `<b>Amount:</b> ${escapeHtml(amount)}`,
        `<b>Buyer:</b> ${escapeHtml(p.buyerName)}`,
        ...(p.fulfillmentIssue ? [`<b>⚠️ Needs attention:</b> ${escapeHtml(p.fulfillmentIssue)}`] : []),
        '',
        `<a href="${SITE_URL}/admin/orders">Admin orders</a>`,
      ].join('\n'),
    },
  }
}

function renderOrderStatus(
  p: NotificationPayload<'order.fulfilled' | 'order.cancelled'>,
  type: 'fulfilled' | 'cancelled',
): RenderedNotification {
  const verb = type === 'fulfilled' ? 'delivered' : 'cancelled'
  const title =
    type === 'fulfilled'
      ? `Order delivered · ${p.listingName}`
      : `Order cancelled · ${p.listingName}`
  const body =
    type === 'fulfilled'
      ? `${p.listingName} marked your order for ${p.productName} as delivered.`
      : `${p.listingName} cancelled your order for ${p.productName}.`
  return {
    title,
    body,
    link: `/account/orders/${p.orderId}`,
    icon: type === 'fulfilled' ? 'CheckCircle' : 'XCircle',
    metadata: { orderId: p.orderId },
    email: {
      subject: title,
      html: renderEmailLayout({
        eyebrow: type === 'fulfilled' ? 'Order Delivered' : 'Order Cancelled',
        headline:
          type === 'fulfilled' ? 'Your order was delivered' : 'Your order was cancelled',
        introHtml: `<strong>${escapeHtml(p.listingName)}</strong> marked your order for <strong>${escapeHtml(p.productName)}</strong> as <strong>${verb}</strong>.`,
        ctaUrl: `${SITE_URL}/account/orders/${p.orderId}`,
        ctaText: 'View Order',
        footerNote:
          type === 'cancelled'
            ? 'If a refund is needed, please contact the business directly.'
            : `Thanks for shopping on ${siteConfig.name}.`,
      }),
    },
    telegram: {
      text:
        type === 'fulfilled'
          ? `✅ <b>Order delivered</b>\n${escapeHtml(p.listingName)} marked your order (${escapeHtml(p.productName)}) as delivered.`
          : `❌ <b>Order cancelled</b>\n${escapeHtml(p.listingName)} cancelled your order (${escapeHtml(p.productName)}).`,
    },
  }
}

function renderAppointmentBooked(
  p: NotificationPayload<'appointment.booked'>,
): RenderedNotification {
  const date = formatDate(p.bookingDate)
  const time = `${formatSlotTime(p.slotStart)} – ${formatSlotTime(p.slotEnd)}`
  const fee = p.bookingFee > 0 ? formatCurrency(p.bookingFee) : 'Free'
  const listingUrl = getListingUrl(p.listingId, p.subdomain)

  if (p.recipient === 'owner') {
    return {
      title: `New appointment · ${p.customerName}`,
      body: `${p.customerName} booked ${date} at ${time}.`,
      link: `/my-business/appointments`,
      icon: 'Calendar',
      metadata: { listingId: p.listingId },
      email: {
        subject: `New appointment at ${p.listingName}`,
        html: renderEmailLayout({
          eyebrow: 'New Appointment',
          headline: 'A customer just booked a slot',
          introHtml: `Someone booked an appointment at <strong>${escapeHtml(p.listingName)}</strong>.`,
          detailRows: [
            buildDetailRow('Customer', `<strong>${escapeHtml(p.customerName)}</strong>`, false),
            buildDetailRow('Phone', escapeHtml(p.customerPhone)),
            buildDetailRow('Date', `<strong>${escapeHtml(date)}</strong>`),
            buildDetailRow('Time', `<strong>${escapeHtml(time)}</strong>`),
            buildDetailRow('Booking Fee', escapeHtml(fee)),
          ].join(''),
          ctaUrl: `${SITE_URL}/my-business/appointments`,
          ctaText: 'View Appointments',
        }),
      },
      telegram: {
        text: [
          '📅 <b>New appointment booked</b>',
          '',
          `<b>Business:</b> ${escapeHtml(p.listingName)}`,
          `<b>Customer:</b> ${escapeHtml(p.customerName)}`,
          `<b>Phone:</b> ${escapeHtml(p.customerPhone)}`,
          `<b>Date:</b> ${escapeHtml(date)}`,
          `<b>Time:</b> ${escapeHtml(time)}`,
          `<b>Fee:</b> ${escapeHtml(fee)}`,
          '',
          `<a href="${listingUrl}">View listing</a>`,
        ].join('\n'),
      },
    }
  }

  if (p.recipient === 'buyer') {
    return {
      title: `Appointment confirmed · ${p.listingName}`,
      body: `Booked for ${date} at ${time}.`,
      link: `/dashboard/appointments`,
      icon: 'Calendar',
      metadata: { listingId: p.listingId },
      email: {
        subject: `Appointment confirmed at ${p.listingName}`,
        html: renderEmailLayout({
          eyebrow: 'Appointment Confirmed',
          headline: 'Your appointment is booked',
          introHtml: `Your appointment at <strong>${escapeHtml(p.listingName)}</strong> is confirmed.`,
          detailRows: [
            buildDetailRow('Business', `<strong>${escapeHtml(p.listingName)}</strong>`, false),
            buildDetailRow('Date', `<strong>${escapeHtml(date)}</strong>`),
            buildDetailRow('Time', `<strong>${escapeHtml(time)}</strong>`),
            buildDetailRow('Booking Fee', escapeHtml(fee)),
          ].join(''),
          ctaUrl: `${SITE_URL}/dashboard/appointments`,
          ctaText: 'My Appointments',
        }),
      },
    }
  }

  // admin recipient
  return {
    title: `Appointment at ${p.listingName}`,
    body: `${p.customerName} booked ${date} ${time}.`,
    link: `/admin/appointments`,
    icon: 'Calendar',
    metadata: { listingId: p.listingId },
  }
}

function renderAppointmentReminder(
  p: NotificationPayload<'appointment.reminder'>,
): RenderedNotification {
  const date = formatDate(p.bookingDate)
  const time = `${formatSlotTime(p.slotStart)} – ${formatSlotTime(p.slotEnd)}`
  const isOwner = p.recipient === 'owner'
  return {
    title: isOwner
      ? `Upcoming appointment · ${p.listingName}`
      : `Your appointment starts soon · ${p.listingName}`,
    body: `${date}, ${time}`,
    link: isOwner ? `/my-business/appointments` : `/dashboard/appointments`,
    icon: 'Clock',
    email: {
      subject: isOwner
        ? `Reminder: upcoming appointment at ${p.listingName}`
        : `Reminder: your appointment at ${p.listingName} starts soon`,
      html: renderEmailLayout({
        eyebrow: 'Appointment Reminder',
        headline: isOwner ? 'Upcoming appointment in the next 2 hours' : 'Your appointment starts soon',
        introHtml: isOwner
          ? `A booked appointment at <strong>${escapeHtml(p.listingName)}</strong> is starting soon.`
          : `Your appointment with <strong>${escapeHtml(p.listingName)}</strong> is coming up within the next 2 hours.`,
        detailRows: [
          buildDetailRow('Business', `<strong>${escapeHtml(p.listingName)}</strong>`, false),
          buildDetailRow('Date', `<strong>${escapeHtml(date)}</strong>`),
          buildDetailRow('Time', `<strong>${escapeHtml(time)}</strong>`),
        ].join(''),
        ctaUrl: isOwner
          ? `${SITE_URL}/my-business/appointments`
          : `${SITE_URL}/dashboard/appointments`,
        ctaText: isOwner ? 'Open Dashboard' : 'My Appointments',
      }),
    },
  }
}

function renderAppointmentCancelled(
  p: NotificationPayload<'appointment.cancelled'>,
): RenderedNotification {
  const date = formatDate(p.bookingDate)
  const isOwner = p.recipient === 'owner'
  return {
    title: `Appointment cancelled · ${p.listingName}`,
    body: `${date} ${formatSlotTime(p.slotStart)}`,
    link: isOwner ? `/my-business/appointments` : `/dashboard/appointments`,
    icon: 'XCircle',
  }
}

function renderListingApproved(
  p: NotificationPayload<'listing.approved'>,
): RenderedNotification {
  const listingUrl = getListingUrl(p.listingId, p.subdomain)
  return {
    title: `🎉 Your listing is live · ${p.listingName}`,
    body: `"${p.listingName}" is now live on ${siteConfig.name}.`,
    link: `/my-business`,
    icon: 'CheckCircle',
    metadata: { listingId: p.listingId },
    email: {
      subject: `🎉 Your listing "${p.listingName}" is now live on ${siteConfig.name}`,
      html: renderEmailLayout({
        eyebrow: 'Listing Approved',
        headline: 'Your listing is live!',
        introHtml: `Great news — your listing <strong>${escapeHtml(p.listingName)}</strong> was just approved and is now visible on ${siteConfig.name}. Customers in ${siteConfig.town} can find you here:`,
        detailRows: buildDetailRow(
          'Your page',
          `<a href="${listingUrl}" style="color:#C4663A;text-decoration:none;">${escapeHtml(listingUrl)}</a>`,
          false,
        ),
        ctaUrl: `${SITE_URL}/my-business`,
        ctaText: 'Open My Business',
      }),
    },
    telegram: {
      text: `✅ <b>Listing approved</b>\n${escapeHtml(p.listingName)} is now live: <a href="${listingUrl}">open</a>`,
    },
    whatsappTemplate: {
      name: 'listing_approved_notice',
      params: [p.listingName, listingUrl],
    },
  }
}

function renderListingRejected(
  p: NotificationPayload<'listing.rejected'>,
): RenderedNotification {
  return {
    title: `Listing not approved · ${p.listingName}`,
    body: p.reason
      ? `Reason: ${p.reason}`
      : 'Please review submission guidelines and re-submit.',
    link: `/my-business`,
    icon: 'XCircle',
    metadata: { listingId: p.listingId },
    email: {
      subject: `Update on your listing "${p.listingName}"`,
      html: renderEmailLayout({
        eyebrow: 'Listing Update',
        headline: 'Your listing needs changes before going live',
        introHtml: p.reason
          ? `We couldn't approve <strong>${escapeHtml(p.listingName)}</strong>. Reason: ${escapeHtml(p.reason)}.`
          : `We couldn't approve <strong>${escapeHtml(p.listingName)}</strong>. Please review our listing guidelines and re-submit.`,
        ctaUrl: `${SITE_URL}/my-business`,
        ctaText: 'Open My Business',
      }),
    },
  }
}

function renderListingExpiring(
  p: NotificationPayload<'listing.expiring'>,
): RenderedNotification {
  const urgent = p.daysLeft <= 3
  const phrase =
    p.daysLeft === 0
      ? 'has expired'
      : p.daysLeft === 1
        ? 'expires tomorrow'
        : `expires in ${p.daysLeft} days`
  return {
    title: `Listing ${phrase} · ${p.listingName}`,
    body: urgent
      ? `Renew now to stay visible to customers.`
      : `Renew early to avoid any interruption.`,
    link: `/my-business/renew/${p.listingId}`,
    icon: urgent ? 'AlertCircle' : 'Clock',
    metadata: { listingId: p.listingId, daysLeft: p.daysLeft },
  }
}

function jobNoun(kind: 'hiring' | 'seeking'): string {
  return kind === 'hiring' ? 'job post' : 'profile'
}

function renderJobApproved(p: NotificationPayload<'job.approved'>): RenderedNotification {
  const postUrl = `${JOBS_URL}/j/${p.postId}`
  const noun = jobNoun(p.kind)
  return {
    title: `✅ Your ${noun} is live · ${p.title}`,
    body: `"${p.title}" is now live on ${siteConfig.name} Jobs for 30 days.`,
    link: `/jobs/j/${p.postId}`,
    icon: 'CheckCircle',
    metadata: { postId: p.postId },
    email: {
      subject: `Your ${noun} "${p.title}" is live on ${siteConfig.name} Jobs`,
      html: renderEmailLayout({
        eyebrow: `${siteConfig.name} Jobs`,
        headline: `Your ${noun} is live`,
        introHtml: `<strong>${escapeHtml(p.title)}</strong> was approved and is now visible on ${siteConfig.name} Jobs for 30 days.`,
        detailRows: buildDetailRow(
          'Your post',
          `<a href="${postUrl}" style="color:#C4663A;text-decoration:none;">${escapeHtml(postUrl)}</a>`,
          false,
        ),
        ctaUrl: `${JOBS_URL}/my-posts`,
        ctaText: 'Open my posts',
      }),
    },
    telegram: {
      text: `✅ <b>Jobs post approved</b>\n${escapeHtml(p.title)} is live: <a href="${postUrl}">open</a>`,
    },
  }
}

function renderJobRejected(p: NotificationPayload<'job.rejected'>): RenderedNotification {
  const noun = jobNoun(p.kind)
  return {
    title: `Your ${noun} was not approved · ${p.title}`,
    body: `Reason: ${p.reason}. Edit it from My posts to resubmit.`,
    link: '/jobs/my-posts',
    icon: 'XCircle',
    metadata: { postId: p.postId },
    email: {
      subject: `Your ${noun} "${p.title}" was not approved`,
      html: renderEmailLayout({
        eyebrow: `${siteConfig.name} Jobs`,
        headline: `Your ${noun} was not approved`,
        introHtml: `We could not approve <strong>${escapeHtml(p.title)}</strong> yet. You can edit it and resubmit.`,
        detailRows: buildDetailRow('Reason', escapeHtml(p.reason), false),
        ctaUrl: `${JOBS_URL}/my-posts`,
        ctaText: 'Edit and resubmit',
      }),
    },
    telegram: {
      text: `❌ <b>Jobs post not approved</b>\n${escapeHtml(p.title)}\nReason: ${escapeHtml(p.reason)}`,
    },
  }
}

function renderJobExpiring(p: NotificationPayload<'job.expiring'>): RenderedNotification {
  const noun = jobNoun(p.kind)
  const when = p.daysLeft === 1 ? '1 day' : `${p.daysLeft} days`
  return {
    title: `⏳ Your ${noun} expires in ${when} · ${p.title}`,
    body: `Renew "${p.title}" to keep it on ${siteConfig.name} Jobs for another 30 days.`,
    link: '/jobs/my-posts',
    icon: 'Clock',
    metadata: { postId: p.postId, daysLeft: p.daysLeft },
    email: {
      subject: `Your ${noun} "${p.title}" expires in ${when}`,
      html: renderEmailLayout({
        eyebrow: `${siteConfig.name} Jobs`,
        headline: p.kind === 'hiring' ? 'Still hiring?' : 'Still looking for work?',
        introHtml: `<strong>${escapeHtml(p.title)}</strong> comes off ${siteConfig.name} Jobs in ${when}. Renew it in one tap to keep it live for another 30 days.`,
        ctaUrl: `${JOBS_URL}/my-posts`,
        ctaText: 'Renew my post',
      }),
    },
    telegram: {
      text: `⏳ <b>Jobs post expiring</b>\n${escapeHtml(p.title)} expires in ${when}. <a href="${JOBS_URL}/my-posts">Renew</a>`,
    },
  }
}

/** The sentence adds its own full stop, so drop any trailing punctuation. */
function stripTrailingPunctuation(text: string): string {
  return text.trim().replace(/[.!?\s]+$/, '')
}

function renderSellingPaused(p: NotificationPayload<'selling.paused'>): RenderedNotification {
  const reason = stripTrailingPunctuation(p.reason)
  const body = p.byAdmin
    ? `Selling is paused by ${siteConfig.name}: ${reason}. Contact us to resume.`
    : `${reason}. Reconnect Razorpay to keep selling.`
  return {
    title: `Selling paused · ${p.listingName}`,
    body,
    link: '/my-business/payments',
    icon: 'AlertCircle',
    metadata: { listingId: p.listingId },
    email: {
      subject: `Online payments paused for ${p.listingName}`,
      html: renderEmailLayout({
        eyebrow: 'Selling paused',
        headline: "Customers can't pay online right now",
        introHtml: escapeHtml(body),
        ctaUrl: `${SITE_URL}/my-business/payments`,
        ctaText: p.byAdmin ? 'Open payments' : 'Reconnect Razorpay',
      }),
    },
    telegram: {
      text: `⏸️ <b>Selling paused</b>\n${escapeHtml(p.listingName)}: ${escapeHtml(body)}`,
    },
  }
}

function renderSellingResumed(p: NotificationPayload<'selling.resumed'>): RenderedNotification {
  const body =
    `${siteConfig.name} has lifted the pause. If your Razorpay keys are still connected, customers can buy from your shop again.`
  return {
    title: `Selling resumed · ${p.listingName}`,
    body,
    link: '/my-business',
    icon: 'CheckCircle',
    metadata: { listingId: p.listingId },
    email: {
      subject: `Online payments resumed for ${p.listingName}`,
      html: renderEmailLayout({
        eyebrow: 'Selling resumed',
        headline: 'Your shop can take payments again',
        introHtml: escapeHtml(body),
        ctaUrl: `${SITE_URL}/my-business`,
        ctaText: 'Open My Business',
      }),
    },
    telegram: {
      text: `▶️ <b>Selling resumed</b>\n${escapeHtml(p.listingName)}: ${escapeHtml(body)}`,
    },
  }
}

function renderReviewNew(p: NotificationPayload<'review.new'>): RenderedNotification {
  const name = (p.reviewerName || 'Someone').trim() || 'Someone'
  const stars = '⭐'.repeat(Math.max(1, Math.min(5, Math.round(p.rating))))
  const listingUrl = getListingUrl(p.listingId, p.subdomain)
  const snippet = p.comment ? p.comment.slice(0, 120) : null

  if (p.recipient === 'owner') {
    return {
      title: `New review · ${p.rating}/5`,
      body: `${name} left a review on ${p.listingName}${snippet ? `: "${snippet}"` : ''}`,
      link: `/my-business`,
      icon: 'Star',
      metadata: { listingId: p.listingId, rating: p.rating },
      telegram: {
        text: [
          '💬 <b>New review</b>',
          '',
          `<b>Listing:</b> ${escapeHtml(p.listingName)}`,
          `<b>By:</b> ${escapeHtml(name)}`,
          `<b>Rating:</b> ${p.rating}/5 ${stars}`,
          snippet ? `<b>Review:</b> ${escapeHtml(snippet)}` : null,
          '',
          `<a href="${listingUrl}">Open listing</a>`,
        ]
          .filter(Boolean)
          .join('\n'),
      },
    }
  }

  return {
    title: `Review on ${p.listingName}`,
    body: `${name} · ${p.rating}/5${snippet ? ` · "${snippet}"` : ''}`,
    link: `/admin/reviews`,
    icon: 'Star',
    metadata: { listingId: p.listingId, rating: p.rating },
  }
}

function renderReviewReplyPosted(
  p: NotificationPayload<'review.reply_posted'>,
): RenderedNotification {
  const owner = (p.ownerName || 'The business owner').trim() || 'The business owner'
  const listingUrl = getListingUrl(p.listingId, p.subdomain)
  const stars = '⭐'.repeat(Math.max(1, Math.min(5, Math.round(p.rating))))
  const replySnippet = p.replyText.slice(0, 140)
  const reviewerLabel = (p.reviewerName || 'a customer').trim() || 'a customer'
  const reviewSnippet = p.reviewComment ? p.reviewComment.slice(0, 100) : null

  if (p.recipient === 'reviewer') {
    return {
      title: `${p.listingName} replied to your review`,
      body: `${owner}: "${replySnippet}"`,
      link: `/listings/${p.subdomain || p.listingId}#review-${p.reviewId}`,
      icon: 'MessageCircle',
      metadata: { listingId: p.listingId, reviewId: p.reviewId },
      email: {
        subject: `${p.listingName} replied to your review`,
        html: renderEmailLayout({
          eyebrow: 'Review Reply',
          headline: `${escapeHtml(p.listingName)} replied to your review`,
          introHtml: `Hi, <strong>${escapeHtml(owner)}</strong> replied to the review you left on <strong>${escapeHtml(p.listingName)}</strong>.`,
          detailRows: [
            buildDetailRow(
              'Your rating',
              `${p.rating}/5 ${escapeHtml(stars)}`,
              false,
            ),
            reviewSnippet
              ? buildDetailRow('Your review', escapeHtml(reviewSnippet))
              : '',
            buildDetailRow(
              "Owner's reply",
              `<span style="white-space:pre-wrap;">${escapeHtml(p.replyText)}</span>`,
            ),
          ]
            .filter(Boolean)
            .join(''),
          ctaUrl: listingUrl,
          ctaText: `View on ${siteConfig.name}`,
          footerNote: 'You can continue the conversation by leaving another review later.',
        }),
      },
      telegram: {
        text: [
          '💬 <b>Reply to your review</b>',
          '',
          `<b>Listing:</b> ${escapeHtml(p.listingName)}`,
          `<b>Owner:</b> ${escapeHtml(owner)}`,
          `<b>Reply:</b> ${escapeHtml(replySnippet)}`,
          '',
          `<a href="${listingUrl}">Open listing</a>`,
        ].join('\n'),
      },
    }
  }

  // admin
  return {
    title: `Review reply on ${p.listingName}`,
    body: `${owner} replied to ${reviewerLabel}'s ${p.rating}/5 review: "${replySnippet}"`,
    link: `/admin/reviews`,
    icon: 'MessageCircle',
    metadata: { listingId: p.listingId, reviewId: p.reviewId },
    email: {
      subject: `[Admin] Review reply on ${p.listingName}`,
      html: renderEmailLayout({
        eyebrow: 'Admin · Review Reply',
        headline: `An owner replied to a review`,
        introHtml: `<strong>${escapeHtml(owner)}</strong> replied to a ${p.rating}/5 review on <strong>${escapeHtml(p.listingName)}</strong>.`,
        detailRows: [
          buildDetailRow('Reviewer', escapeHtml(reviewerLabel), false),
          buildDetailRow('Rating', `${p.rating}/5 ${escapeHtml(stars)}`),
          reviewSnippet ? buildDetailRow('Review', escapeHtml(reviewSnippet)) : '',
          buildDetailRow(
            'Reply',
            `<span style="white-space:pre-wrap;">${escapeHtml(p.replyText)}</span>`,
          ),
        ]
          .filter(Boolean)
          .join(''),
        ctaUrl: listingUrl,
        ctaText: 'Open listing',
      }),
    },
  }
}

function renderAdminSubmission(
  p: NotificationPayload<'admin.new_submission'>,
): RenderedNotification {
  const labels: Record<NotificationPayload<'admin.new_submission'>['kind'], string> = {
    listing: 'Listing',
    event: 'Event',
    professional: 'Professional',
    professional_review: 'Professional review',
    job: 'Job post',
    job_report: 'Job report',
    shop_live: 'Shop',
  }
  if (p.kind === 'shop_live') {
    return {
      title: `${p.title} is now selling online`,
      body: 'Live Razorpay keys connected. Take a quick look at their shop.',
      link: p.reviewPath,
      icon: 'ShoppingBag',
      email: {
        subject: `${p.title} is now selling online`,
        html: renderEmailLayout({
          eyebrow: 'Admin Alert',
          headline: `${p.title} is now selling online`,
          introHtml: `<strong>${escapeHtml(p.title)}</strong> connected live Razorpay keys. Customers can now pay on their page.`,
          ctaUrl: `${SITE_URL}${p.reviewPath}`,
          ctaText: 'Open payments',
        }),
      },
    }
  }
  const label = labels[p.kind]
  return {
    title: `New ${label} submission`,
    body: p.submitterName ? `${p.title} · by ${p.submitterName}` : p.title,
    link: p.reviewPath,
    icon: 'Bell',
    email: {
      subject: `New ${label} submitted: ${p.title}`,
      html: renderEmailLayout({
        eyebrow: 'Admin Alert',
        headline: `New ${label} submission`,
        introHtml: `A new ${escapeHtml(label.toLowerCase())} needs review.`,
        detailRows: [
          buildDetailRow('Title', `<strong>${escapeHtml(p.title)}</strong>`, false),
          p.submitterName
            ? buildDetailRow('Submitted by', escapeHtml(p.submitterName))
            : '',
        ].join(''),
        ctaUrl: `${SITE_URL}${p.reviewPath}`,
        ctaText: 'Review & Approve',
      }),
    },
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Dispatch to the right renderer
// ─────────────────────────────────────────────────────────────────────────────

export function renderNotification<T extends NotificationType>(
  type: T,
  payload: NotificationPayload<T>,
): RenderedNotification {
  switch (type) {
    case 'order.placed':
      return renderOrderPlaced(payload as NotificationPayload<'order.placed'>)
    case 'order.fulfilled':
      return renderOrderStatus(
        payload as NotificationPayload<'order.fulfilled'>,
        'fulfilled',
      )
    case 'order.cancelled':
      return renderOrderStatus(
        payload as NotificationPayload<'order.cancelled'>,
        'cancelled',
      )
    case 'appointment.booked':
      return renderAppointmentBooked(payload as NotificationPayload<'appointment.booked'>)
    case 'appointment.reminder':
      return renderAppointmentReminder(payload as NotificationPayload<'appointment.reminder'>)
    case 'appointment.cancelled':
      return renderAppointmentCancelled(payload as NotificationPayload<'appointment.cancelled'>)
    case 'listing.approved':
      return renderListingApproved(payload as NotificationPayload<'listing.approved'>)
    case 'listing.rejected':
      return renderListingRejected(payload as NotificationPayload<'listing.rejected'>)
    case 'listing.expiring':
      return renderListingExpiring(payload as NotificationPayload<'listing.expiring'>)
    case 'job.approved':
      return renderJobApproved(payload as NotificationPayload<'job.approved'>)
    case 'job.rejected':
      return renderJobRejected(payload as NotificationPayload<'job.rejected'>)
    case 'job.expiring':
      return renderJobExpiring(payload as NotificationPayload<'job.expiring'>)
    case 'selling.paused':
      return renderSellingPaused(payload as NotificationPayload<'selling.paused'>)
    case 'selling.resumed':
      return renderSellingResumed(payload as NotificationPayload<'selling.resumed'>)
    case 'review.new':
      return renderReviewNew(payload as NotificationPayload<'review.new'>)
    case 'review.reply_posted':
      return renderReviewReplyPosted(
        payload as NotificationPayload<'review.reply_posted'>,
      )
    case 'admin.new_submission':
      return renderAdminSubmission(payload as NotificationPayload<'admin.new_submission'>)
    default: {
      const exhaustive: never = type
      throw new Error(`Unknown notification type: ${String(exhaustive)}`)
    }
  }
}
