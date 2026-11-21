// npm run backup -- copies every table in the public schema to JSON files
// on this machine, in backups/<date>/, plus a list of uploaded images.
//
// Reads .env.local (see package.json) and needs the service-role key, which
// sees every row: keep the output private. It never writes to the database.
// Supabase's free plan keeps no downloadable backups, so run this regularly
// (weekly is plenty here) and copy the folder somewhere safe.
//
// Not included: sign-in accounts (auth.users, managed by Supabase) and the
// image files themselves -- the manifest lists their paths so they can be
// fetched from the public bucket if ever needed.

import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY
if (!url || !key) {
  console.error('Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local first.')
  process.exit(1)
}

const PAGE = 1000
const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })

// The REST API describes every table it exposes; that is the list to copy,
// so a new table is backed up without editing this script.
const spec = await fetch(`${url}/rest/v1/`, { headers: { apikey: key, Authorization: `Bearer ${key}` } })
if (!spec.ok) {
  console.error(`Could not list tables: HTTP ${spec.status}`)
  process.exit(1)
}
const definitions = (await spec.json()).definitions ?? {}
const tables = Object.keys(definitions).sort()

const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-')
const dir = join('backups', stamp)
mkdirSync(dir, { recursive: true })

let failed = 0
for (const table of tables) {
  const rows = []
  let error = null
  for (let from = 0; ; from += PAGE) {
    const page = await supabase.from(table).select('*').range(from, from + PAGE - 1)
    if (page.error) {
      error = page.error
      break
    }
    rows.push(...page.data)
    if (page.data.length < PAGE) break
  }
  // Views and tables the API cannot page are reported, not fatal.
  if (error) {
    failed += 1
    console.log(`  !  ${table}: ${error.message}`)
    continue
  }
  writeFileSync(join(dir, `${table}.json`), JSON.stringify(rows, null, 1))
  console.log(`  ✓  ${table.padEnd(32)} ${rows.length} rows`)
}

const images = []
async function listFolder(prefix) {
  for (let offset = 0; ; offset += PAGE) {
    const { data, error } = await supabase.storage.from('uploads').list(prefix, { limit: PAGE, offset })
    if (error || !data) return
    for (const entry of data) {
      const path = prefix ? `${prefix}/${entry.name}` : entry.name
      if (entry.id) images.push(path)
      else await listFolder(path)
    }
    if (data.length < PAGE) return
  }
}
await listFolder('')
writeFileSync(join(dir, '_uploads-manifest.json'), JSON.stringify(images, null, 1))
console.log(`  ✓  ${'uploads bucket (paths only)'.padEnd(32)} ${images.length} files`)

console.log(`\nSaved to ${dir}${failed ? ` -- ${failed} table(s) could not be read, see above` : ''}`)
process.exit(failed ? 1 : 0)
