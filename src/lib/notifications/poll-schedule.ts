/**
 * Scheduling for the notification bell's polling. Pure: timers and the
 * visibility check are injected so it can be tested without a browser.
 *
 * Rules: poll every `baseMs` only while the tab is visible; never run two
 * polls at once; after a failure double the delay up to `maxMs`, reset on
 * success; `poll()` (bell opened, tab visible again) runs immediately.
 */

export const POLL_BASE_MS = 60_000
export const POLL_MAX_MS = 5 * 60_000

export type PollSchedulerOptions = {
  /** Does one fetch. Throw/reject (or resolve false) to signal failure. */
  run: () => Promise<boolean | void>
  isVisible: () => boolean
  setTimer: (fn: () => void, ms: number) => unknown
  clearTimer: (handle: unknown) => void
  baseMs?: number
  maxMs?: number
}

export type PollScheduler = {
  /** Begin scheduling (runs immediately if visible). Idempotent. */
  start: () => void
  /** Stop scheduling; an in-flight run's result is ignored. */
  stop: () => void
  /** Run now if visible and nothing is in flight (bell opened). */
  poll: () => void
  /** Call when document visibility changes. */
  visibilityChanged: () => void
  /** Current delay, for tests. */
  currentDelay: () => number
}

export function nextDelay(current: number, ok: boolean, baseMs: number, maxMs: number): number {
  return ok ? baseMs : Math.min(current * 2, maxMs)
}

export function createPollScheduler(opts: PollSchedulerOptions): PollScheduler {
  const baseMs = opts.baseMs ?? POLL_BASE_MS
  const maxMs = opts.maxMs ?? POLL_MAX_MS
  let running = false
  let inFlight = false
  let timer: unknown = null
  let delay = baseMs

  const clear = () => {
    if (timer !== null) {
      opts.clearTimer(timer)
      timer = null
    }
  }

  const schedule = () => {
    clear()
    if (!running || !opts.isVisible()) return
    timer = opts.setTimer(() => {
      timer = null
      void execute()
    }, delay)
  }

  const execute = async () => {
    if (!running || inFlight || !opts.isVisible()) return
    clear()
    inFlight = true
    let ok = true
    try {
      ok = (await opts.run()) !== false
    } catch {
      ok = false
    }
    inFlight = false
    if (!running) return
    delay = nextDelay(delay, ok, baseMs, maxMs)
    schedule()
  }

  return {
    start() {
      if (running) return
      running = true
      delay = baseMs
      void execute()
    },
    stop() {
      running = false
      clear()
    },
    poll() {
      void execute()
    },
    visibilityChanged() {
      if (!running) return
      if (opts.isVisible()) void execute()
      else clear()
    },
    currentDelay: () => delay,
  }
}
