import assert from 'node:assert/strict'
import test from 'node:test'

import { renderNotification } from './templates'

test('selling.paused by an admin quotes the reason and links to payments', () => {
  const rendered = renderNotification('selling.paused', {
    listingId: 'l1',
    listingName: 'Organic Farm',
    reason: 'Fake <items>',
    byAdmin: true,
  })
  assert.equal(rendered.title, 'Selling paused · Organic Farm')
  assert.equal(rendered.body, 'Selling is paused by OurDahanu: Fake <items>. Contact us to resume.')
  assert.equal(rendered.link, '/my-business/payments')
  assert.match(rendered.email?.html ?? '', /Fake &lt;items&gt;/)
  assert.equal((rendered.email?.html ?? '').includes('<items>'), false)
})

test('selling.paused does not double the full stop after the reason', () => {
  const rendered = renderNotification('selling.paused', {
    listingId: 'l1',
    listingName: 'Organic Farm',
    reason: 'Repeated complaints.',
    byAdmin: true,
  })
  assert.equal(rendered.body, 'Selling is paused by OurDahanu: Repeated complaints. Contact us to resume.')
})

test('selling.paused after Razorpay rejects keys asks the owner to reconnect', () => {
  const rendered = renderNotification('selling.paused', {
    listingId: 'l1',
    listingName: 'Organic Farm',
    reason: 'Razorpay stopped accepting your keys',
    byAdmin: false,
  })
  assert.equal(rendered.body, 'Razorpay stopped accepting your keys. Reconnect Razorpay to keep selling.')
  assert.equal(rendered.link, '/my-business/payments')
})

test('selling.resumed links to My Business', () => {
  const rendered = renderNotification('selling.resumed', { listingId: 'l1', listingName: 'Organic Farm' })
  assert.equal(rendered.title, 'Selling resumed · Organic Farm')
  assert.equal(rendered.link, '/my-business')
})

test('test orders say so in the buyer and owner titles', () => {
  const base = {
    orderId: 'o1',
    listingId: 'l1',
    listingName: 'Organic Farm',
    productName: 'Chikoo',
    quantity: 2,
    amountTotal: 300,
    buyerName: 'Asha',
    isTest: true,
  }
  assert.equal(
    renderNotification('order.placed', { ...base, recipient: 'buyer' }).title,
    'Test order · Order confirmed · Organic Farm',
  )
  assert.equal(
    renderNotification('order.placed', { ...base, recipient: 'owner' }).title,
    'Test order · New order · Chikoo',
  )
  assert.match(renderNotification('order.placed', { ...base, recipient: 'owner' }).email?.subject ?? '', /^\[Test\] /)
})

test('real orders keep their titles', () => {
  const base = {
    orderId: 'o1',
    listingId: 'l1',
    listingName: 'Organic Farm',
    productName: 'Chikoo',
    quantity: 2,
    amountTotal: 300,
    buyerName: 'Asha',
  }
  assert.equal(renderNotification('order.placed', { ...base, recipient: 'buyer' }).title, 'Order confirmed · Organic Farm')
  assert.equal(renderNotification('order.placed', { ...base, recipient: 'owner' }).title, 'New order · Chikoo')
})

test('order.placed without a fulfillment issue keeps today\'s title and body exactly', () => {
  const base = {
    orderId: 'o1',
    listingId: 'l1',
    listingName: 'Organic Farm',
    productName: 'Chikoo',
    quantity: 2,
    amountTotal: 300,
    buyerName: 'Asha',
  }
  const owner = renderNotification('order.placed', { ...base, recipient: 'owner' })
  assert.equal(owner.title, 'New order · Chikoo')
  assert.equal(owner.body, 'Asha just ordered Chikoo × 2 (₹300).')
  assert.equal(owner.email?.html.includes('Needs attention'), false)

  const admin = renderNotification('order.placed', { ...base, recipient: 'admin' })
  assert.equal(admin.title, 'Order placed at Organic Farm')
  assert.equal(admin.body, 'Asha · Chikoo × 2 · ₹300')

  const buyer = renderNotification('order.placed', { ...base, recipient: 'buyer' })
  assert.equal(buyer.title, 'Order confirmed · Organic Farm')
  assert.equal(buyer.body, 'Thanks! We received your order for Chikoo × 2 (₹300).')
})

test('order.placed with a fulfillment issue tells the owner and admin, but not the buyer', () => {
  const base = {
    orderId: 'o1',
    listingId: 'l1',
    listingName: 'Organic Farm',
    productName: 'Chikoo',
    quantity: 2,
    amountTotal: 300,
    buyerName: 'Asha',
    fulfillmentIssue: 'Insufficient stock after payment. Contact the buyer to arrange fulfillment or a refund.',
  }

  const owner = renderNotification('order.placed', { ...base, recipient: 'owner' })
  assert.equal(owner.title, 'New order · Chikoo')
  assert.match(owner.body, /Needs attention: Insufficient stock after payment/)
  assert.match(owner.email?.html ?? '', /Needs attention/)
  assert.match(owner.email?.html ?? '', /Insufficient stock after payment/)
  assert.match(owner.telegram?.text ?? '', /Needs attention/)

  const admin = renderNotification('order.placed', { ...base, recipient: 'admin' })
  assert.match(admin.body, /Needs attention: Insufficient stock after payment/)
  assert.match(admin.telegram?.text ?? '', /Needs attention/)

  // The buyer's own confirmation stays positive — their payment did go through.
  const buyer = renderNotification('order.placed', { ...base, recipient: 'buyer' })
  assert.equal(buyer.title, 'Order confirmed · Organic Farm')
  assert.equal(buyer.body, 'Thanks! We received your order for Chikoo × 2 (₹300).')
  assert.equal(buyer.body.includes('Needs attention'), false)
})

test('admin shop_live alert names the business', () => {
  const rendered = renderNotification('admin.new_submission', {
    kind: 'shop_live',
    title: 'Organic Farm',
    reviewPath: '/admin/payments',
  })
  assert.equal(rendered.title, 'Organic Farm is now selling online')
  assert.equal(rendered.link, '/admin/payments')
})
