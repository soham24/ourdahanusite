import { test } from 'node:test'
import assert from 'node:assert/strict'

import { createPollScheduler, nextDelay } from './poll-schedule'

function harness(results: Array<boolean | 'throw'> = []) {
  let visible = true
  let calls = 0
  let nextId = 1
  const timers = new Map<number, { fn: () => void; ms: number }>()
  const gates: Array<() => void> = []
  let hold = false
  const s = createPollScheduler({
    run: async () => {
      calls++
      if (hold) await new Promise<void>((r) => gates.push(r))
      const r = results.shift() ?? true
      if (r === 'throw') throw new Error('x')
      return r
    },
    isVisible: () => visible,
    setTimer: (fn, ms) => {
      const id = nextId++
      timers.set(id, { fn, ms })
      return id
    },
    clearTimer: (h) => void timers.delete(h as number),
    baseMs: 60_000,
    maxMs: 300_000,
  })
  const flush = () => new Promise((r) => setImmediate(r))
  const fire = async () => {
    const [id, t] = [...timers.entries()][0]
    timers.delete(id)
    t.fn()
    await flush()
  }
  return {
    s, timers, gates, flush, fire,
    calls: () => calls,
    setVisible: (v: boolean) => { visible = v },
    hold: (h: boolean) => { hold = h },
  }
}

test('nextDelay doubles to the cap and resets on success', () => {
  assert.equal(nextDelay(60_000, false, 60_000, 300_000), 120_000)
  assert.equal(nextDelay(240_000, false, 60_000, 300_000), 300_000)
  assert.equal(nextDelay(300_000, false, 60_000, 300_000), 300_000)
  assert.equal(nextDelay(300_000, true, 60_000, 300_000), 60_000)
})

test('start polls immediately then every 60s', async () => {
  const h = harness()
  h.s.start()
  await h.flush()
  assert.equal(h.calls(), 1)
  assert.equal([...h.timers.values()][0].ms, 60_000)
  await h.fire()
  assert.equal(h.calls(), 2)
  assert.equal(h.timers.size, 1)
})

test('does not poll or schedule while hidden; resumes immediately when visible', async () => {
  const h = harness()
  h.setVisible(false)
  h.s.start()
  await h.flush()
  assert.equal(h.calls(), 0)
  assert.equal(h.timers.size, 0)
  h.setVisible(true)
  h.s.visibilityChanged()
  await h.flush()
  assert.equal(h.calls(), 1)
  assert.equal(h.timers.size, 1)
  h.setVisible(false)
  h.s.visibilityChanged()
  assert.equal(h.timers.size, 0)
})

test('backs off after failures (throw or false) and resets on success', async () => {
  const h = harness(['throw', false, true])
  h.s.start()
  await h.flush()
  assert.equal([...h.timers.values()][0].ms, 120_000)
  await h.fire()
  assert.equal([...h.timers.values()][0].ms, 240_000)
  await h.fire()
  assert.equal([...h.timers.values()][0].ms, 60_000)
})

test('never overlaps requests', async () => {
  const h = harness()
  h.hold(true)
  h.s.start()
  await h.flush()
  h.s.poll()
  h.s.visibilityChanged()
  await h.flush()
  assert.equal(h.calls(), 1)
  h.gates.shift()!()
  await h.flush()
  assert.equal(h.timers.size, 1)
})

test('poll() runs now and restarts the countdown', async () => {
  const h = harness()
  h.s.start()
  await h.flush()
  h.s.poll()
  await h.flush()
  assert.equal(h.calls(), 2)
  assert.equal(h.timers.size, 1)
})

test('stop clears the timer and ignores an in-flight result', async () => {
  const h = harness()
  h.s.start()
  await h.flush()
  h.s.stop()
  assert.equal(h.timers.size, 0)
  h.s.poll()
  await h.flush()
  assert.equal(h.calls(), 1)

  const g = harness()
  g.hold(true)
  g.s.start()
  await g.flush()
  g.s.stop()
  g.gates.shift()!()
  await g.flush()
  assert.equal(g.timers.size, 0)
})
