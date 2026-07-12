import assert from 'node:assert/strict'
import test from 'node:test'

import { completeFindWrite } from './find-notifications'

test('notifies admins with the exact professional payload after a successful write', () => {
  const calls: unknown[][] = []
  const result = completeFindWrite(null, {
    kind: 'professional',
    title: 'Dr. Asha Patil',
    submitterName: 'Soham',
    reviewPath: '/admin/find',
  }, (...args) => { calls.push(args) })

  assert.deepEqual(result, { ok: true })
  assert.deepEqual(calls, [[
    'admin.new_submission',
    {
      kind: 'professional',
      title: 'Dr. Asha Patil',
      submitterName: 'Soham',
      reviewPath: '/admin/find',
    },
  ]])
})

test('notifies admins with the exact professional review payload after a successful write', () => {
  const calls: unknown[][] = []
  const result = completeFindWrite(null, {
    kind: 'professional_review',
    title: 'Dr. Asha Patil · 4/5',
    submitterName: 'Reviewer',
    reviewPath: '/admin/find',
  }, (...args) => { calls.push(args) })

  assert.deepEqual(result, { ok: true })
  assert.deepEqual(calls, [[
    'admin.new_submission',
    {
      kind: 'professional_review',
      title: 'Dr. Asha Patil · 4/5',
      submitterName: 'Reviewer',
      reviewPath: '/admin/find',
    },
  ]])
})

test('does not notify admins when the database write fails', () => {
  const calls: unknown[][] = []
  const result = completeFindWrite({ message: 'write failed' }, {
    kind: 'professional',
    title: 'Ignored',
    submitterName: null,
    reviewPath: '/admin/find',
  }, (...args) => { calls.push(args) })

  assert.deepEqual(result, { error: 'write failed' })
  assert.deepEqual(calls, [])
})
