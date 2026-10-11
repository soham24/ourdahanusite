// Fails if any entry in package.json's test:existing script matches no file.
//
// `node --test` treats its arguments as glob patterns and runs nothing for a
// pattern that matches nothing -- without failing. A path containing a Next
// route segment like [id] is such a pattern ([id] means "i or d"), which is
// how four tests silently stopped running when CI moved to Node 24. Paths
// with brackets are written with * instead; this keeps it from recurring.
import { globSync, readFileSync } from 'node:fs'

const { scripts } = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
const entries = scripts['test:existing']
  .split(/\s+/)
  .slice(2) // "tsx --test"
  .map((entry) => entry.replace(/^"|"$/g, ''))

const missing = entries.filter((pattern) => globSync(pattern).length === 0)
if (missing.length > 0) {
  console.error('These test:existing entries match no file, so their tests would silently not run:')
  for (const pattern of missing) console.error(`  ${pattern}`)
  console.error('A literal [ or ] in a path is read as a glob; write that segment as * and quote it.')
  process.exit(1)
}
console.log(`Test list OK: all ${entries.length} entries match a file`)
