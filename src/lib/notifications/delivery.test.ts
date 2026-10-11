import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { transformSync } from 'esbuild'

// Compiled to CommonJS so every import becomes a require() the test answers.
// esbuild rather than ts.transpileModule: TypeScript 7 no longer ships that
// JavaScript API.
function loadModule(path: string, dependencies: Record<string, unknown>, globals: Record<string, unknown> = {}) {
  const source = readFileSync(new URL(path, import.meta.url), 'utf8')
  const compiled = transformSync(source, { loader: 'ts', format: 'cjs', target: 'es2022' }).code
  const cjs = { exports: {} as Record<string, (...args: unknown[]) => Promise<unknown>> }
  const require = (name: string) => {
    if (!(name in dependencies)) throw new Error(`Unexpected dependency: ${name}`)
    return dependencies[name]
  }
  new Function('require', 'exports', 'module', ...Object.keys(globals), compiled)(require, cjs.exports, cjs, ...Object.values(globals))
  return cjs.exports
}

test('default dispatch waits for Telegram delivery before resolving', async () => {
  let finish!: () => void
  let started!: () => void
  const began = new Promise<void>((resolve) => { started = resolve })
  const delivery = new Promise<void>((resolve) => { finish = resolve })
  const prefs = { in_app_enabled: false, email_enabled: false, whatsapp_enabled: false, telegram_enabled: true, telegram_chat_id: '123', muted_types: [] }
  const query = { select: () => query, eq: () => query, maybeSingle: async () => ({ data: prefs }) }
  const dispatcher = loadModule('./dispatcher.ts', {
    'server-only': {},
    '@/lib/supabase/admin-client': { createAdminClient: () => ({ from: () => query }) },
    './channels/email': {}, './channels/in-app': {}, './channels/whatsapp': {},
    './channels/telegram': { deliverTelegram: () => { started(); return delivery } },
    './templates': { renderNotification: () => ({ title: 'Review', body: 'New review' }) },
    './types': { DEFAULT_PREFERENCES: {} },
  })
  let resolved = false
  const pending = dispatcher.sendNotification('user', 'review.new', {}).then(() => { resolved = true })
  await began
  await new Promise((resolve) => setImmediate(resolve))
  assert.equal(resolved, false, 'dispatch must keep the request alive while Telegram is pending')
  finish()
  await pending
  assert.equal(resolved, true)
})

test('Telegram delivery uses the same primary bot as the linking webhook', async () => {
  const requests: string[] = []
  const channel = loadModule('./channels/telegram.ts', {
    'server-only': {}, '../email-layout': { escapeHtml: (s: string) => s },
    '@/lib/site': { siteConfig: { domain: 'ourdahanu.in' } },
  }, {
    process: { env: { TELEGRAM_BOT_TOKEN: 'primary', TELEGRAM_USER_BOT_TOKEN: 'other' } },
    fetch: async (url: string) => { requests.push(url); return { ok: true } },
  })
  await channel.deliverTelegram({ chatId: '123', rendered: { title: 'Review', body: 'New review' } })
  assert.deepEqual(requests, ['https://api.telegram.org/botprimary/sendMessage'])
})
