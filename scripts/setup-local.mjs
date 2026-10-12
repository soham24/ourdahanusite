// One-command local setup: `npm run setup`.
//
// Starts the local Supabase stack (Docker), which applies every migration and
// supabase/seed.sql, then writes its URL and keys into .env.local so that
// `npm run dev` works straight away. Also sets ADMIN_EMAIL, if it is empty, to
// an address that becomes admin when you sign in with it on /login (email
// sign-in is offered only against this local stack).
//
// It never overwrites settings that point at a hosted Supabase project: if
// .env.local already has one, it stops and says so. Pass --force to switch
// that file over to the local stack anyway.
import { execFileSync } from 'node:child_process'
import { copyFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs'

const SUPABASE = ['--yes', 'supabase@2.120.0']
const ENV_FILE = '.env.local'
const LOCAL_ADMIN = 'admin@example.com'
const force = process.argv.includes('--force')

const run = (args, opts = {}) => execFileSync('npx', [...SUPABASE, ...args], { encoding: 'utf8', ...opts })

try {
  execFileSync('docker', ['info'], { stdio: 'ignore' })
} catch {
  console.error('Docker is not running. Start Docker Desktop (or the Docker daemon) and try again.')
  console.error('No Docker? Use a free hosted Supabase project instead: SETUP.md, steps 1-4.')
  process.exit(1)
}

if (!existsSync(ENV_FILE)) {
  copyFileSync('.env.local.example', ENV_FILE)
  console.log(`Created ${ENV_FILE} from .env.local.example`)
}

let env = readFileSync(ENV_FILE, 'utf8')
const get = (key) => env.match(new RegExp(`^${key}=(.*)$`, 'm'))?.[1].trim() ?? ''
const set = (key, value) => {
  const line = `${key}=${value}`
  env = new RegExp(`^${key}=.*$`, 'm').test(env)
    ? env.replace(new RegExp(`^${key}=.*$`, 'm'), line)
    : `${env.trimEnd()}\n${line}\n`
}

const currentUrl = get('NEXT_PUBLIC_SUPABASE_URL')
if (/^https:\/\//.test(currentUrl) && !force) {
  console.error(`${ENV_FILE} already points at a hosted Supabase project (${currentUrl}).`)
  console.error('Leaving it alone. Run `npm run setup -- --force` to switch it to a local database.')
  process.exit(1)
}

console.log('Starting the local Supabase stack. The first run downloads its images and can take a few minutes...')
run(['start'], { stdio: 'inherit' })

const status = JSON.parse(run(['status', '--output', 'json'], { stdio: ['ignore', 'pipe', 'ignore'] }))
const required = { API_URL: status.API_URL, ANON_KEY: status.ANON_KEY, SERVICE_ROLE_KEY: status.SERVICE_ROLE_KEY }
for (const [name, value] of Object.entries(required)) {
  if (!value) throw new Error(`\`supabase status\` did not report ${name}`)
}

set('NEXT_PUBLIC_SUPABASE_URL', required.API_URL)
set('NEXT_PUBLIC_SUPABASE_ANON_KEY', required.ANON_KEY)
set('SUPABASE_SERVICE_ROLE_KEY', required.SERVICE_ROLE_KEY)
set('NEXT_PUBLIC_SITE_URL', 'http://localhost:3000')
if (!get('ADMIN_EMAIL')) set('ADMIN_EMAIL', LOCAL_ADMIN)
writeFileSync(ENV_FILE, env)

const admin = get('ADMIN_EMAIL')
console.log(`
Ready. ${ENV_FILE} now points at the local database (sample data included).

  1. npm run dev
  2. Open http://localhost:3000/login and sign in by email as ${admin}
  3. Click the link in the local inbox: ${status.INBUCKET_URL || status.MAILPIT_URL || 'http://127.0.0.1:54324'}

That account is the admin. Database dashboard: ${status.STUDIO_URL || 'http://127.0.0.1:54323'}
Stop the database with \`npm run db:stop\`; \`npm run db:reset\` puts it back to the sample data.`)
