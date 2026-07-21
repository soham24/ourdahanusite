import assert from 'node:assert/strict'
import test from 'node:test'
import { createGameAudio } from './audio'

function createFakeContext(calls: string[]) {
  return {
    currentTime: 0,
    state: 'running',
    destination: {},
    createGain: () => ({
      gain: {
        value: 1,
        setValueAtTime() {},
        exponentialRampToValueAtTime() {},
      },
      connect() {},
    }),
    createOscillator: () => ({
      type: 'sine',
      frequency: {
        setValueAtTime() {},
        exponentialRampToValueAtTime() {},
      },
      connect() {},
      start() { calls.push('start') },
      stop() {},
    }),
    resume: async () => { calls.push('resume') },
    suspend: async () => { calls.push('suspend') },
    close: async () => { calls.push('close') },
  }
}

test('audio is lazy, respects mute, suspends, and closes', async () => {
  const calls: string[] = []
  const fake = createFakeContext(calls)
  const audio = createGameAudio(() => fake)

  assert.equal(calls.length, 0)
  await audio.unlock()
  audio.setEnabled(false)
  audio.play('catch')
  await audio.suspend()
  await audio.destroy()

  assert.equal(calls.includes('start'), false)
  assert.equal(calls.includes('suspend'), true)
  assert.equal(calls.includes('close'), true)
})

test('audio schedules a two-note rhythm only while an enabled game is playing', async () => {
  const calls: string[] = []
  const fake = createFakeContext(calls)
  const intervals = new Map<number, () => void>()
  const originalWindow = globalThis.window
  const fakeWindow = {
    setInterval(callback: () => void, delay: number) {
      calls.push(`interval:${delay}`)
      intervals.set(1, callback)
      return 1
    },
    clearInterval(id: number) {
      calls.push(`clear:${id}`)
      intervals.delete(id)
    },
  }

  Object.defineProperty(globalThis, 'window', { configurable: true, value: fakeWindow })
  try {
    const audio = createGameAudio(() => fake)
    await audio.unlock()
    audio.setPhase('flow')

    assert.deepEqual(calls, ['resume', 'interval:720'])
    intervals.get(1)?.()
    assert.equal(calls.filter((call) => call === 'start').length, 2)

    audio.setEnabled(false)
    assert.equal(calls.includes('clear:1'), true)
    assert.equal(intervals.size, 0)

    await audio.destroy()
  } finally {
    Object.defineProperty(globalThis, 'window', { configurable: true, value: originalWindow })
  }
})

test('unsupported audio capabilities are non-blocking', async () => {
  const audio = createGameAudio(() => { throw new Error('unsupported') })

  await assert.doesNotReject(audio.unlock())
  assert.doesNotThrow(() => audio.play('catch'))
  await assert.doesNotReject(audio.suspend())
  await assert.doesNotReject(audio.resume())
  await assert.doesNotReject(audio.destroy())
})

test('timer failures do not interrupt the game', async () => {
  const originalWindow = globalThis.window
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: { setInterval() { throw new Error('timers unavailable') } },
  })

  try {
    const audio = createGameAudio(() => createFakeContext([]))
    await audio.unlock()

    assert.doesNotThrow(() => audio.setPhase('warmup'))
    await assert.doesNotReject(audio.destroy())
  } finally {
    Object.defineProperty(globalThis, 'window', { configurable: true, value: originalWindow })
  }
})
