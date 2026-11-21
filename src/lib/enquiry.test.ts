import { test } from 'node:test'
import assert from 'node:assert/strict'

import { normalizePhone, validateEnquiry } from './enquiry'

test('phone numbers are reduced to digits, keeping a leading +', () => {
  assert.equal(normalizePhone(' 98765 43210 '), '9876543210')
  assert.equal(normalizePhone('+91 (98765) 43-210'), '+919876543210')
})

test('a complete enquiry is accepted and tidied', () => {
  const result = validateEnquiry({ name: '  Ravi   Patil ', phone: '98765 43210', message: 'Do you deliver\r\nto Bordi?' })
  assert.deepEqual(result, { values: { name: 'Ravi Patil', phone: '9876543210', message: 'Do you deliver\nto Bordi?' } })
})

test('each missing or bad field gets its own message', () => {
  const ok = { name: 'Ravi', phone: '9876543210', message: 'Hi' }
  assert.match((validateEnquiry({ ...ok, name: '  ' }) as { error: string }).error, /name/)
  assert.match((validateEnquiry({ ...ok, phone: '12345' }) as { error: string }).error, /phone/)
  assert.match((validateEnquiry({ ...ok, phone: '1'.repeat(16) }) as { error: string }).error, /phone/)
  assert.match((validateEnquiry({ ...ok, message: '\n \n' }) as { error: string }).error, /message/)
})

test('long text is cut to the database limits', () => {
  const result = validateEnquiry({ name: 'x'.repeat(200), phone: '9876543210', message: 'y'.repeat(5000) })
  assert.ok('values' in result)
  if ('values' in result) {
    assert.equal(result.values.name.length, 80)
    assert.ok(result.values.message.length <= 1000)
  }
})
