import assert from 'node:assert/strict'
import test from 'node:test'
import { createGameAudio, type AudioCue } from './audio'

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

function createTimerWindow(calls: string[]) {
  const callbacks = new Map<number, () => void>()
  let nextHandle = 1
  return {
    callbacks,
    window: {
      setInterval(callback: () => void, delay: number) {
        const handle = nextHandle++
        calls.push(`interval:${delay}`)
        callbacks.set(handle, callback)
        return handle
      },
      clearInterval(handle: number) {
        calls.push(`clear:${handle}`)
        callbacks.delete(handle)
      },
    },
  }
}

test('audio is lazy, respects mute, suspends, and closes', async () => {
  const calls: string[] = []
  const fake = createFakeContext(calls)
  const audio = createGameAudio(() => fake)

  assert.equal(calls.length, 0)
  await audio.unlock()
  audio.setEnabled(false)
  audio.setRhythmActive(false)
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
    audio.setRhythmActive(true)

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
  assert.doesNotThrow(() => audio.setRhythmActive(false))
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
    assert.doesNotThrow(() => audio.setRhythmActive(true))
    await assert.doesNotReject(audio.destroy())
  } finally {
    Object.defineProperty(globalThis, 'window', { configurable: true, value: originalWindow })
  }
})

test('a retained rhythm callback stays silent after mute', async () => {
  const calls: string[] = []
  const { callbacks, window } = createTimerWindow(calls)
  const originalWindow = globalThis.window
  Object.defineProperty(globalThis, 'window', { configurable: true, value: window })

  try {
    const audio = createGameAudio(() => createFakeContext(calls))
    await audio.unlock()
    audio.setPhase('flow')
    audio.setRhythmActive(true)
    const retainedCallback = callbacks.get(1)
    assert.ok(retainedCallback)

    retainedCallback()
    const startsBeforeMute = calls.filter((call) => call === 'start').length
    audio.setEnabled(false)
    retainedCallback()

    assert.equal(calls.filter((call) => call === 'start').length, startsBeforeMute)
    await audio.destroy()
  } finally {
    Object.defineProperty(globalThis, 'window', { configurable: true, value: originalWindow })
  }
})

test('a retained rhythm callback stays silent after suspension', async () => {
  const calls: string[] = []
  const { callbacks, window } = createTimerWindow(calls)
  const originalWindow = globalThis.window
  Object.defineProperty(globalThis, 'window', { configurable: true, value: window })

  try {
    const audio = createGameAudio(() => createFakeContext(calls))
    await audio.unlock()
    audio.setPhase('flow')
    audio.setRhythmActive(true)
    const retainedCallback = callbacks.get(1)
    assert.ok(retainedCallback)

    retainedCallback()
    const startsBeforeSuspend = calls.filter((call) => call === 'start').length
    await audio.suspend()
    retainedCallback()

    assert.equal(calls.filter((call) => call === 'start').length, startsBeforeSuspend)
    await audio.destroy()
  } finally {
    Object.defineProperty(globalThis, 'window', { configurable: true, value: originalWindow })
  }
})

test('suspend and phase changes replace rhythm scheduling without duplicates', async () => {
  const calls: string[] = []
  const { callbacks, window } = createTimerWindow(calls)
  const originalWindow = globalThis.window
  Object.defineProperty(globalThis, 'window', { configurable: true, value: window })

  try {
    const audio = createGameAudio(() => createFakeContext(calls))
    await audio.unlock()
    audio.setPhase('flow')
    audio.setRhythmActive(true)
    assert.equal(callbacks.size, 1)

    await audio.suspend()
    assert.equal(callbacks.size, 0)
    assert.equal(calls.includes('clear:1'), true)

    await audio.resume()
    assert.equal(callbacks.size, 1)
    assert.equal(calls.filter((call) => call === 'interval:720').length, 2)

    audio.setPhase('rush')
    assert.equal(callbacks.size, 1)
    assert.equal(calls.includes('clear:2'), true)
    assert.equal(calls.includes('interval:560'), true)

    await audio.destroy()
  } finally {
    Object.defineProperty(globalThis, 'window', { configurable: true, value: originalWindow })
  }
})

test('cleanup uses the scheduler that created the rhythm handle', async () => {
  const calls: string[] = []
  const first = createTimerWindow(calls)
  const originalWindow = globalThis.window
  Object.defineProperty(globalThis, 'window', { configurable: true, value: first.window })

  try {
    const audio = createGameAudio(() => createFakeContext(calls))
    await audio.unlock()
    audio.setPhase('warmup')
    audio.setRhythmActive(true)

    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: {
        setInterval() { return 99 },
        clearInterval(handle: number) { calls.push(`replacement-clear:${handle}`) },
      },
    })
    audio.setEnabled(false)

    assert.equal(calls.includes('clear:1'), true)
    assert.equal(calls.some((call) => call.startsWith('replacement-clear:')), false)
    await audio.destroy()
  } finally {
    Object.defineProperty(globalThis, 'window', { configurable: true, value: originalWindow })
  }
})

test('every cue produces a tone when audio is enabled and unlocked', async () => {
  const calls: string[] = []
  const audio = createGameAudio(() => createFakeContext(calls))
  const cues: AudioCue[] = ['countdown', 'catch', 'combo', 'miss', 'damage', 'pause', 'resume', 'gameOver', 'select']

  await audio.unlock()
  for (const cue of cues) audio.play(cue)

  assert.equal(calls.filter((call) => call === 'start').length, cues.length)
  await audio.destroy()
})

test('countdown cues are audible while rhythm stays inactive until play', async () => {
  const calls: string[] = []
  const { callbacks, window } = createTimerWindow(calls)
  const originalWindow = globalThis.window
  Object.defineProperty(globalThis, 'window', { configurable: true, value: window })

  try {
    const audio = createGameAudio(() => createFakeContext(calls))
    await audio.unlock()
    audio.setRhythmActive(false)
    audio.setPhase('warmup')
    audio.play('countdown')
    audio.play('countdown')
    audio.play('countdown')

    assert.equal(calls.filter((call) => call === 'start').length, 3)
    assert.equal(callbacks.size, 0)

    audio.setRhythmActive(true)
    assert.equal(callbacks.size, 1)
    assert.equal(calls.filter((call) => call === 'interval:900').length, 1)
    await audio.destroy()
  } finally {
    Object.defineProperty(globalThis, 'window', { configurable: true, value: originalWindow })
  }
})
