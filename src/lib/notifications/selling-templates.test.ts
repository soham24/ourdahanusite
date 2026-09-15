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

test('admin shop_live alert names the business', () => {
  const rendered = renderNotification('admin.new_submission', {
    kind: 'shop_live',
    title: 'Organic Farm',
    reviewPath: '/admin/payments',
  })
  assert.equal(rendered.title, 'Organic Farm is now selling online')
  assert.equal(rendered.link, '/admin/payments')
})
