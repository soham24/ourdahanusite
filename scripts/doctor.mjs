// npm run doctor — checks that a copy of this site is set up correctly.
//
// Reads .env.local (via `node --env-file-if-exists`, see package.json) and
// checks each piece, saying in plain words what is wrong and how to fix it.
// Everything here only READS: no rows, settings, webhooks or emails are
// created or changed, and no secret is ever printed.
//
// Exit code 1 when something required is broken; warnings alone exit 0.

import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const results = []
const pass = (area, msg) => results.push({ level: 'ok', area, msg })
const warn = (area, msg, fix) => results.push({ level: 'warn', area, msg, fix })
// Something worth knowing that this script cannot check; never counted.
const note = (area, msg, fix) => results.push({ level: 'note', area, msg, fix })
const fail = (area, msg, fix) => results.push({ level: 'fail', area, msg, fix })

// Newer Supabase projects name the two keys differently; either works.
const ALIASES = {
  NEXT_PUBLIC_SUPABASE_ANON_KEY: 'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
  SUPABASE_SERVICE_ROLE_KEY: 'SUPABASE_SECRET_KEY',
}
const env = (name) => ((process.env[name] ?? '').trim() || (ALIASES[name] ? (process.env[ALIASES[name]] ?? '').trim() : ''))
// The example file's placeholders start with "your_"; treat them as unset.
const isSet = (name) => env(name) !== '' && !/^your_/i.test(env(name))

async function fetchJson(url, init = {}) {
  const res = await fetch(url, { ...init, signal: AbortSignal.timeout(10_000) })
  let body = null
  try { body = await res.json() } catch { /* not JSON */ }
  return { ok: res.ok, status: res.status, body }
}

// ── Node ──────────────────────────────────────────────────────────────────
{
  const wanted = readFileSync(new URL('../.nvmrc', import.meta.url), 'utf8').trim()
  const major = process.versions.node.split('.')[0]
  if (major === wanted) pass('Node', `Node ${process.versions.node}`)
  else warn('Node', `Node ${process.versions.node}; production runs Node ${wanted}`, `Install Node ${wanted} (nvm install ${wanted} && nvm use).`)
}

// ── Town config ───────────────────────────────────────────────────────────
const { siteConfig } = await import('../src/lib/site-config.ts')
{
  const siteUrl = env('NEXT_PUBLIC_SITE_URL')
  let host = ''
  try { host = new URL(siteUrl).hostname } catch { /* checked below */ }
  // A *.vercel.app address is a deployment URL, not a domain to compare.
  const isCustomDomain = host && host !== 'localhost' && !host.endsWith('.vercel.app')
  if (isCustomDomain && host !== siteConfig.domain && !host.endsWith(`.${siteConfig.domain}`)) {
    warn('Town', `NEXT_PUBLIC_SITE_URL is ${host} but src/lib/site-config.ts says the domain is ${siteConfig.domain}`, 'Set `domain` in src/lib/site-config.ts to your domain (SETUP.md step 7).')
  } else {
    pass('Town', `${siteConfig.name} — ${siteConfig.town} (${siteConfig.domain})`)
  }
}

// ── Local content (forks only) ────────────────────────────────────────────
// Changing site-config.ts renames the site, but the content SETUP.md step 8
// lists is still OurDahanu's: its emergency numbers, team, guides and contact
// details. On a fork, point at whatever still carries them. ourdahanu.in
// itself skips this.
if (siteConfig.domain !== 'ourdahanu.in') {
  const read = (path) => { try { return readFileSync(new URL(`../${path}`, import.meta.url), 'utf8') } catch { return '' } }
  const step8 = 'Replace it with your own (SETUP.md step 8).'

  const local = read('src/content/local.ts')
  if (/Dahanu|Palghar/.test(local)) {
    fail('Content', "The emergency page still lists Dahanu's police, hospital and fire numbers", `Wrong numbers in an emergency are the worst bug this site can have. Edit \`emergency\` in src/content/local.ts. ${step8}`)
  }
  if (siteConfig.contactEmail === 'railkarsoham@gmail.com') {
    warn('Content', 'contactEmail in site-config.ts is still the OurDahanu maintainer\'s address', 'Set it to your own; it is shown on the contact, privacy and terms pages.')
  }
  const checks = [
    ['src/app/page-components/HeritageSection.tsx', /Railkar|Dahanu/, 'The homepage names the OurDahanu team'],
    ['src/app/about/page.tsx', /Railkar|Dahanu/, 'The about page tells OurDahanu\'s story'],
  ]
  if (/8149314106|'ourdahanu'/.test(local)) {
    warn('Content', 'The contact page has OurDahanu\'s WhatsApp number and Instagram', 'Edit `contact` in src/content/local.ts.')
  }
  for (const [path, pattern, msg] of checks) {
    if (pattern.test(read(path))) warn('Content', msg, `Edit ${path}. ${step8}`)
  }
  let guides = []
  try {
    guides = readdirSync(new URL('../content/guides', import.meta.url))
      .filter((name) => name.endsWith('.md') && name !== 'README.md' && /Dahanu/.test(read(`content/guides/${name}`)))
  } catch { /* no guides directory */ }
  if (guides.length) warn('Content', `${guides.length} guide(s) in content/guides/ are about Dahanu`, 'Rewrite or delete them (SETUP.md step 8).')
}

// ── Required settings ─────────────────────────────────────────────────────
const required = ['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY', 'NEXT_PUBLIC_SITE_URL']
const missing = required.filter((name) => !isSet(name))
if (missing.length) {
  // Which advice depends on how far along they are. Someone following the
  // README's first section has no .env.local at all and wants `npm run
  // setup`, which writes one for them; pointing them at a Supabase dashboard
  // sends them off to make an account they were told they would not need.
  // Someone who already has the file is past that and is filling it in.
  // Resolved from the repo root like every other read in this script, so
  // running it from a subdirectory cannot flip the advice.
  const starting = missing.length === required.length
    && !existsSync(new URL('../.env.local', import.meta.url))
  fail(
    'Settings',
    `Missing in .env.local: ${missing.join(', ')}`,
    starting
      ? 'Run `npm run setup` to start a local database and write .env.local for you (needs Docker). No Docker? Use a hosted Supabase project instead: SETUP.md steps 1-4.'
      : 'Copy them from Supabase → Project Settings → API (SETUP.md step 4).',
  )
} else pass('Settings', 'All four required values are set')

// ── Supabase ──────────────────────────────────────────────────────────────
const supabaseUrl = env('NEXT_PUBLIC_SUPABASE_URL').replace(/\/$/, '')
// The stack from `npm run setup` — same test as src/lib/local-supabase.ts,
// which this plain-Node script cannot import.
const isLocalSupabase = /^http:\/\/(?:127\.0\.0\.1|localhost)(?::\d+)?$/.test(supabaseUrl)
const canReachSupabase = isSet('NEXT_PUBLIC_SUPABASE_URL') && isSet('SUPABASE_SERVICE_ROLE_KEY') && isSet('NEXT_PUBLIC_SUPABASE_ANON_KEY')
if (canReachSupabase) {
  const admin = createClient(supabaseUrl, env('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false } })
  const anon = createClient(supabaseUrl, env('NEXT_PUBLIC_SUPABASE_ANON_KEY'), { auth: { persistSession: false } })

  const listings = await admin.from('listings').select('id', { count: 'exact', head: true })
  if (listings.error && /does not exist|schema cache/i.test(listings.error.message)) {
    fail('Database', 'Connected, but the tables are missing', 'Apply supabase/migrations/ in filename order (SETUP.md step 2).')
  } else if (listings.error) {
    fail('Database', `Could not connect: ${listings.error.message}`, 'Check NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.')
  } else {
    pass('Database', `Connected — ${listings.count ?? 0} listings`)

    // One observable effect per migration, newest last. When you add a
    // migration whose effect can be seen through the API, add a probe here.
    const probes = [
      ['20261011000000_baseline', async () => !(await admin.from('pricing_config').select('id').limit(1)).error],
      ['20261011010000_profile_names', async () => !(await anon.rpc('get_profile_names', { p_ids: [] })).error],
      ['20261011020000_drop_public_profiles_view', async () => Boolean((await admin.from('public_profiles').select('id').limit(1)).error)],
      ['20261011040000_lock_down_direct_writes', async () => Boolean((await anon.from('coupons').select('code').limit(1)).error)],
      ['20261011050000_drop_unused_tables', async () => Boolean((await admin.from('riders').select('id').limit(1)).error)],
      ['20261011060000_order_status_transitions', async () => !(await admin.rpc('set_marketplace_order_status', { p_order_id: '00000000-0000-0000-0000-000000000000', p_status: 'cancelled' })).error],
      ['20261011070000_default_pricing_row', async () => ((await admin.from('pricing_config').select('id').eq('id', 1)).data ?? []).length === 1],
    ]
    const notApplied = []
    for (const [name, probe] of probes) {
      try { if (!(await probe())) notApplied.push(name) } catch { notApplied.push(name) }
    }
    if (notApplied.length) fail('Migrations', `Not applied: ${notApplied.join(', ')}`, 'Run each missing file from supabase/migrations/ in order, or `npx supabase db push`.')
    else pass('Migrations', `All ${probes.length} checked migrations are applied`)

    const bucket = await admin.storage.getBucket('uploads')
    if (bucket.error) fail('Storage', 'The "uploads" bucket is missing', 'It is created by the baseline migration; re-run it.')
    else pass('Storage', `"uploads" bucket exists (${bucket.data.public ? 'public' : 'PRIVATE — images will not load'})`)

    const admins = await admin.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'admin')
    // ADMIN_EMAIL makes its account admin at request time (src/app/actions/admin.ts)
    // without changing its profile row, so a signed-in ADMIN_EMAIL counts too.
    const envAdmin = isSet('ADMIN_EMAIL')
      ? await admin.from('profiles').select('id', { count: 'exact', head: true }).eq('email', env('ADMIN_EMAIL'))
      : { count: 0 }
    if ((admins.count ?? 0) > 0) pass('Admin', `${admins.count} admin account(s)`)
    else if ((envAdmin.count ?? 0) > 0) pass('Admin', `${env('ADMIN_EMAIL')} (ADMIN_EMAIL) has signed in and is admin`)
    else if (isSet('ADMIN_EMAIL')) warn('Admin', 'No admin yet', 'Sign in once with the Google account in ADMIN_EMAIL; it is made admin.')
    else warn('Admin', 'No admin and ADMIN_EMAIL is not set', 'Set ADMIN_EMAIL to your Google address, then sign in.')
  }

  const auth = await fetchJson(`${supabaseUrl}/auth/v1/settings`, { headers: { apikey: env('NEXT_PUBLIC_SUPABASE_ANON_KEY') } }).catch(() => null)
  if (!auth?.ok) {
    // Already reported under Database when Supabase is unreachable; saying
    // "Google is off" here would send people to the wrong fix.
    warn('Sign-in', 'Could not read Supabase auth settings', 'Fix the Database problem above first.')
  } else if (isLocalSupabase) {
    pass('Sign-in', 'Local database: sign in by email on /login; links land in http://127.0.0.1:54324')
  } else if (auth.body?.external?.google) {
    pass('Sign-in', 'Google sign-in is enabled in Supabase')
  } else {
    fail('Sign-in', 'Google sign-in is not enabled in Supabase', 'Supabase → Authentication → Providers → Google (SETUP.md step 3).')
  }
  // supabase/config.toml already lists localhost's callback for the local stack.
  if (!isLocalSupabase) note('Sign-in', 'Redirect URLs cannot be checked from here', `In Supabase → Authentication → URL Configuration, the Redirect URLs must include ${env('NEXT_PUBLIC_SITE_URL') || 'your site'}/auth/callback.`)
}

// ── Cron ──────────────────────────────────────────────────────────────────
if (isSet('CRON_SECRET')) pass('Cron', 'CRON_SECRET is set')
else warn('Cron', 'CRON_SECRET is not set in .env.local', 'Not needed for local development, but it must be set in Vercel or listing expiry and reminders never run.')

// ── Payments (optional) ───────────────────────────────────────────────────
if (isSet('RAZORPAY_KEY_ID') && isSet('RAZORPAY_KEY_SECRET')) {
  const auth = Buffer.from(`${env('RAZORPAY_KEY_ID')}:${env('RAZORPAY_KEY_SECRET')}`).toString('base64')
  const res = await fetchJson('https://api.razorpay.com/v1/orders?count=1', { headers: { Authorization: `Basic ${auth}` } }).catch(() => null)
  const mode = env('RAZORPAY_KEY_ID').startsWith('rzp_live_') ? 'live' : 'test'
  if (res?.ok) pass('Payments', `Razorpay keys work (${mode} mode)`)
  else fail('Payments', `Razorpay rejected the keys (HTTP ${res?.status ?? 'no response'})`, 'Copy them again from Razorpay → Settings → API Keys.')
  if (!isSet('RAZORPAY_WEBHOOK_SECRET')) warn('Payments', 'RAZORPAY_WEBHOOK_SECRET is not set', 'Add the webhook in Razorpay → Settings → Webhooks (see .env.local.example) so a paid order is never lost.')
} else if (isSet('RAZORPAY_KEY_ID') || isSet('RAZORPAY_KEY_SECRET')) {
  fail('Payments', 'Only one of RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET is set', 'Set both, or neither.')
} else {
  pass('Payments', 'Not configured — free listings and bookings only')
}
if (isSet('LISTING_PAYMENT_ENCRYPTION_KEY') && Buffer.from(env('LISTING_PAYMENT_ENCRYPTION_KEY'), 'base64').length !== 32) {
  fail('Payments', 'LISTING_PAYMENT_ENCRYPTION_KEY is not a 32-byte base64 key', 'Generate one: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'base64\'))"')
}

// ── Email (optional) ──────────────────────────────────────────────────────
if (isSet('RESEND_API_KEY')) {
  const res = await fetchJson('https://api.resend.com/domains', { headers: { Authorization: `Bearer ${env('RESEND_API_KEY')}` } }).catch(() => null)
  if (res?.status === 401 && res.body?.name === 'restricted_api_key') {
    // A sending-only key works for the site but may not list domains.
    warn('Email', 'Resend key is sending-only, so its domain cannot be checked from here', `Make sure ${siteConfig.domain} shows "verified" in Resend → Domains.`)
  } else if (!res?.ok) {
    fail('Email', `Resend rejected the API key (HTTP ${res?.status ?? 'no response'})`, 'Create a key at Resend → API Keys.')
  } else {
    const domains = Array.isArray(res.body?.data) ? res.body.data : []
    const ours = domains.find((d) => d.name === siteConfig.domain)
    if (ours?.status === 'verified') pass('Email', `Resend works; ${siteConfig.domain} is verified (mail goes from hello@${siteConfig.domain})`)
    else if (ours) fail('Email', `${siteConfig.domain} is in Resend but "${ours.status}", so no email is sent`, 'Add the DNS records Resend shows, then wait for "verified".')
    else fail('Email', `${siteConfig.domain} is not added in Resend, so no email is sent`, 'Resend → Domains → Add domain (docs/EMAIL-AND-NOTIFICATIONS.md).')
  }
} else {
  pass('Email', 'Not configured — notifications stay in-app')
}

// ── Telegram (optional) ───────────────────────────────────────────────────
const botToken = env('TELEGRAM_BOT_TOKEN') || env('TELEGRAM_USER_BOT_TOKEN')
if (botToken) {
  const me = await fetchJson(`https://api.telegram.org/bot${botToken}/getMe`).catch(() => null)
  if (!me?.body?.ok) {
    fail('Telegram', 'Telegram rejected the bot token', 'Copy it again from @BotFather.')
  } else {
    const username = me.body.result.username
    if (env('TELEGRAM_BOT_USERNAME').replace(/^@/, '') !== username) {
      fail('Telegram', `TELEGRAM_BOT_USERNAME should be "${username}"`, '"Connect Telegram" links point at that username.')
    } else {
      pass('Telegram', `Bot @${username} works`)
    }
    if (!isSet('TELEGRAM_WEBHOOK_SECRET')) fail('Telegram', 'TELEGRAM_WEBHOOK_SECRET is not set — the webhook refuses every request', 'Set it, then register the webhook (SETUP.md, Telegram).')
    const hook = await fetchJson(`https://api.telegram.org/bot${botToken}/getWebhookInfo`).catch(() => null)
    const hookUrl = hook?.body?.result?.url ?? ''
    let hookHost = ''
    try { hookHost = new URL(hookUrl).hostname } catch { /* empty */ }
    if (!hookUrl) fail('Telegram', 'No webhook is registered, so linking never completes', 'Register it with setWebhook (SETUP.md, Telegram).')
    else if (hookHost !== siteConfig.domain && hookHost !== `www.${siteConfig.domain}`) warn('Telegram', `The webhook points at ${hookHost}, not ${siteConfig.domain}`, 'Re-run setWebhook with your domain if that is not intended.')
    else pass('Telegram', `Webhook registered on ${hookHost}${hook.body.result.last_error_message ? ` (last error: ${hook.body.result.last_error_message})` : ''}`)
  }
} else {
  pass('Telegram', 'Not configured')
}

// ── WhatsApp (optional) ───────────────────────────────────────────────────
if (isSet('WHATSAPP_ACCESS_TOKEN') && isSet('WHATSAPP_PHONE_NUMBER_ID')) {
  const res = await fetchJson(`https://graph.facebook.com/v19.0/${encodeURIComponent(env('WHATSAPP_PHONE_NUMBER_ID'))}?fields=display_phone_number`, {
    headers: { Authorization: `Bearer ${env('WHATSAPP_ACCESS_TOKEN')}` },
  }).catch(() => null)
  if (res?.ok) pass('WhatsApp', `Sending from ${res.body?.display_phone_number ?? 'the configured number'}; make sure the listing_approved_notice template is approved`)
  else fail('WhatsApp', `Meta rejected the token or phone number id (HTTP ${res?.status ?? 'no response'})`, 'Use a permanent System User token (docs/EMAIL-AND-NOTIFICATIONS.md).')
} else if (isSet('WHATSAPP_ACCESS_TOKEN') || isSet('WHATSAPP_PHONE_NUMBER_ID')) {
  fail('WhatsApp', 'Only one of WHATSAPP_ACCESS_TOKEN / WHATSAPP_PHONE_NUMBER_ID is set', 'Set both, or neither.')
} else {
  pass('WhatsApp', 'Not configured')
}

// ── Report ────────────────────────────────────────────────────────────────
const icon = { ok: '✓', note: 'i', warn: '!', fail: '✗' }
let lastArea = ''
for (const r of results) {
  const area = r.area === lastArea ? '' : r.area
  lastArea = r.area
  console.log(`${icon[r.level]} ${area.padEnd(11)} ${r.msg}`)
  if (r.fix) console.log(`  ${''.padEnd(11)} → ${r.fix}`)
}
const failures = results.filter((r) => r.level === 'fail').length
const warnings = results.filter((r) => r.level === 'warn').length
console.log(`\n${failures ? `${failures} problem(s) to fix` : 'Nothing broken'}${warnings ? `, ${warnings} thing(s) to check` : ''}.`)
process.exitCode = failures ? 1 : 0
