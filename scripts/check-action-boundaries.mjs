import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

// Inspect the compiler's registered endpoints, not source spelling: an internal
// secret loader must never become remotely callable after a refactor.
const manifest = JSON.parse(await readFile('.next/server/server-reference-manifest.json', 'utf8'))
for (const runtime of ['node', 'edge']) {
  for (const entry of Object.values(manifest[runtime] ?? {})) {
    const exports = [entry.exportedName, ...Object.values(entry.workers ?? {}).map(worker => worker.exportedName)]
    assert.ok(!exports.includes('loadOwnerRazorpayKeys'), 'Decrypted payment credentials are exposed through a Server Action')
  }
}
console.log('Server Action credential boundary passed')
