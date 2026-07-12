import assert from 'node:assert/strict'
import test from 'node:test'
import type { User } from '@supabase/supabase-js'
import { createFindActions, type FindActionDependencies } from './find-core'
import { createInsertProfessional } from './find-adapters'

const user = { id: 'user-1', email: 'soham@example.com', user_metadata: { full_name: 'Soham' } } as unknown as User

function harness(overrides: Partial<FindActionDependencies> = {}) {
  const notifications: unknown[][] = []
  const events: string[] = []
  const deps: FindActionDependencies = {
    async getUser() { return user }, rateLimit() { return { ok: true } }, isValidProfession() { return true },
    async insertProfessional() { events.push('write'); return { error: null } },
    async findProfessional() { return { id: 'pro-1', name: 'Dr. Asha Patil' } },
    async upsertRating() { events.push('write'); return { error: null } },
    notify(...args) { events.push('notify'); notifications.push(args) },
    ...overrides,
  }
  return { actions: createFindActions(deps), notifications, events }
}

test('submitProfessional notifies with exact payload only after its successful write', async () => {
  const { actions, notifications, events } = harness()
  assert.deepEqual(await actions.submitProfessional({ name: ' Dr. Asha Patil ', phone: '1234567', whatsapp: true, professions: ['Doctor'] }), { ok: true })
  await Promise.resolve()
  assert.deepEqual(events, ['write', 'notify'])
  assert.deepEqual(notifications, [['admin.new_submission', { kind: 'professional', title: 'Dr. Asha Patil', submitterName: 'Soham', reviewPath: '/admin/find' }]])
})

test('submitRating notifies with exact payload only after its successful write', async () => {
  const { actions, notifications, events } = harness()
  assert.deepEqual(await actions.submitRating({ professionalId: 'pro-1', rating: 4, comment: ' Helpful ', usedService: true }), { ok: true })
  await Promise.resolve()
  assert.deepEqual(events, ['write', 'notify'])
  assert.deepEqual(notifications, [['admin.new_submission', { kind: 'professional_review', title: 'Dr. Asha Patil · 4/5', submitterName: 'Soham', reviewPath: '/admin/find' }]])
})

test('submission actions do not notify when their writes fail', async () => {
  for (const kind of ['professional', 'rating'] as const) {
    const { actions, notifications } = harness({
      async insertProfessional() { return { error: { message: 'write failed' } } },
      async upsertRating() { return { error: { message: 'write failed' } } },
    })
    const result = kind === 'professional'
      ? await actions.submitProfessional({ name: 'Asha', phone: '1234567', whatsapp: false, professions: ['Doctor'] })
      : await actions.submitRating({ professionalId: 'pro-1', rating: 5, comment: 'Good', usedService: true })
    await Promise.resolve()
    assert.deepEqual(result, { error: 'write failed' }); assert.deepEqual(notifications, [])
  }
})

test('notification throws and rejections remain best-effort after a successful write', async () => {
  for (const notify of [() => { throw new Error('sync') }, () => Promise.reject(new Error('async'))]) {
    const original = console.error; const errors: unknown[][] = []; console.error = (...args) => { errors.push(args) }
    try {
      const { actions } = harness({ notify })
      assert.deepEqual(await actions.submitProfessional({ name: 'Asha', phone: '1234567', whatsapp: false, professions: ['Doctor'] }), { ok: true })
      await new Promise((resolve) => setImmediate(resolve))
      assert.equal(errors.length, 1)
    } finally { console.error = original }
  }
})

test('production professional insert adapter does not chain a select', async () => {
  const calls: string[] = []
  const insertProfessional = createInsertProfessional(async () => ({
    from(table: 'find_professionals') {
      calls.push(`from:${table}`)
      return {
        insert(row: Record<string, unknown>) {
          calls.push(`insert:${String(row.name)}`)
          return Promise.resolve({ error: null })
        },
      }
    },
  }))

  assert.deepEqual(await insertProfessional({ name: 'Asha' }), { error: null })
  assert.deepEqual(calls, ['from:find_professionals', 'insert:Asha'])
})
