// Browser smoke test: `npm run test:e2e`.
//
// Runs against a site already serving on BASE_URL (default
// http://localhost:3000) backed by the local Supabase from `npm run setup`,
// whose sample data and email inbox it relies on. CI does exactly that in
// .github/workflows/e2e.yml.
//
// It catches what unit tests cannot: a page that crashes or fails to
// hydrate, business-subdomain routing, and the sign-in round trip. Both
// hydration and routing broke in ways no unit test noticed before.
import { chromium } from 'playwright'

const BASE = (process.env.BASE_URL || 'http://localhost:3000').replace(/\/$/, '')
const INBOX = process.env.INBOX_URL || 'http://127.0.0.1:54324'
const ADMIN = process.env.E2E_ADMIN_EMAIL || 'admin@example.com'
const PAGES = ['/', '/listings', '/guides', '/emergency', '/jobs', '/search', '/about']

const failures = []
const check = (ok, what) => {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}`)
  if (!ok) failures.push(what)
}

const browser = await chromium.launch(
  process.env.PLAYWRIGHT_CHROMIUM_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH } : {},
)
const page = await browser.newPage()

// React reports a hydration mismatch through console.error (in production as
// "Minified React error #418/#423/#425"); a thrown error is a pageerror.
let pageErrors = []
page.on('pageerror', (error) => pageErrors.push(error.message))
page.on('console', (message) => {
  if (message.type() === 'error' && /Hydration|hydrat|Minified React error #(418|423|425)/i.test(message.text())) {
    pageErrors.push(message.text())
  }
})

// Wait for `load`, then give hydration time to finish. Not 'networkidle':
// signed-in pages keep polling (the notification bell), so the network never
// goes quiet and the wait times out.
const SETTLE_MS = 2_000

async function visit(url, label) {
  pageErrors = []
  const response = await page.goto(url, { waitUntil: 'load' })
  await page.waitForTimeout(SETTLE_MS)
  check(response?.status() === 200, `${label}: HTTP ${response?.status()}`)
  check(pageErrors.length === 0, `${label}: no page or hydration errors${pageErrors.length ? ` (${pageErrors[0].slice(0, 160)})` : ''}`)
}

// ── Signed out ───────────────────────────────────────────────────────────
for (const path of PAGES) await visit(`${BASE}${path}`, `signed out ${path}`)
check(await page.locator('text=Sign In').first().isVisible(), 'signed out: navbar offers Sign In')

// A business subdomain serves that business's page (src/proxy.ts).
// Chromium resolves *.localhost to the loopback address by itself.
const subdomainBase = BASE.replace('://localhost', '://seaside-thali.localhost')
await visit(`${subdomainBase}/`, 'business subdomain')
check(await page.locator('text=Seaside Thali House').first().isVisible(), 'business subdomain shows that business')

// ── Sign in through the local inbox ──────────────────────────────────────
await fetch(`${INBOX}/api/v1/messages`, { method: 'DELETE' })
await page.goto(`${BASE}/login?next=/admin`)
await page.fill('#local-email', ADMIN)
await page.click('text=Send link')
await page.locator('text=Sent. Open').waitFor({ timeout: 15_000 })

let link
for (let attempt = 0; attempt < 30 && !link; attempt++) {
  const list = await (await fetch(`${INBOX}/api/v1/messages`)).json()
  const message = list.messages?.find((m) => m.To?.some((to) => to.Address === ADMIN))
  if (message) {
    const full = await (await fetch(`${INBOX}/api/v1/message/${message.ID}`)).json()
    link = (full.HTML || full.Text).match(/https?:\/\/[^"\s<>]+verify[^"\s<>]*/)?.[0]?.replace(/&amp;/g, '&')
  }
  if (!link) await new Promise((resolve) => setTimeout(resolve, 500))
}
check(Boolean(link), 'sign-in: magic link arrived in the local inbox')

if (link) {
  await page.goto(link, { waitUntil: 'load' })
  await page.locator("text=Today's control room").first().waitFor({ timeout: 15_000 }).catch(() => {})
  check(new URL(page.url()).pathname === '/admin', `sign-in: landed on /admin (got ${new URL(page.url()).pathname})`)
  check(await page.locator('text=Today\'s control room').first().isVisible(), 'sign-in: admin dashboard renders')

  // ── Signed in ──────────────────────────────────────────────────────────
  for (const path of [...PAGES, '/admin', '/profile']) await visit(`${BASE}${path}`, `signed in ${path}`)
  check(await page.locator('text=Sign out').first().isVisible(), 'signed in: navbar offers Sign out')
}

await browser.close()
if (failures.length) {
  console.error(`\n${failures.length} check(s) failed.`)
  process.exit(1)
}
console.log('\nAll checks passed.')
