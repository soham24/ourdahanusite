import 'server-only'

type DebugPayload = {
  scope: string
  tags?: string[]
  detail?: Record<string, string | number | boolean | null | undefined>
}

function isEnabled() {
  return process.env.ISR_DEBUG === '1'
}

function write(event: string, payload: DebugPayload) {
  if (!isEnabled()) return

  console.info(
    '[isr-debug]',
    JSON.stringify({
      event,
      ...payload,
      at: new Date().toISOString(),
    }),
  )
}

export function logCacheRegeneration(payload: DebugPayload) {
  write('cache-regeneration', payload)
}

export function logCacheInvalidation(payload: DebugPayload) {
  write('cache-invalidation', payload)
}
