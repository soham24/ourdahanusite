// Rewrites the host matchers in src/proxy.ts from site-config.ts.
//
// Next.js only accepts inline literals in proxy.ts's `export const config`
// (a variable fails the build with "Invalid segment configuration export
// detected"), so the domain and the reserved-subdomain list are copied into
// its regexes rather than imported. That made proxy.ts the one file a fork
// had to edit by hand, and getting it wrong breaks every business subdomain
// without an error. This keeps the copy in step instead:
//
//   npm run sync:proxy          rewrite proxy.ts to match the config
//   npm run sync:proxy -- --check   exit 1 if they differ (part of npm test)
//
// Run through tsx so it can import the TypeScript sources it copies from.
import { readFileSync, writeFileSync } from 'node:fs'

import { siteConfig } from '../src/lib/site-config.ts'
import { RESERVED_SUBDOMAINS } from '../src/lib/subdomain.ts'

const PROXY = new URL('../src/proxy.ts', import.meta.url)
const check = process.argv.includes('--check')

const source = readFileSync(PROXY, 'utf8')
const configStart = source.indexOf('export const config')
if (configStart === -1) throw new Error('src/proxy.ts has no `export const config`')

// In the source text a regex dot is written `\\.` (backslash, backslash, dot).
const escapeForSource = (value) => value.replace(/\./g, '\\\\.')

// The domain the matchers currently use: whatever follows `[^.]+\\.` up to `|`.
const config = source.slice(configStart)
const current = config.match(/\[\^\.\]\+\\\\\.([^|']+)\|/)
if (!current) throw new Error('Could not find the business-host matcher in src/proxy.ts')
const currentEscaped = current[1]
const currentDomain = currentEscaped.replace(/\\\\\./g, '.')

const wantedEscaped = escapeForSource(siteConfig.domain)
const reserved = [...RESERVED_SUBDOMAINS].join('|')

let next = source
if (currentDomain !== siteConfig.domain) {
  // Matcher regexes, then the same domain in comments (`// find.ourdahanu.in`).
  next = next.split(currentEscaped).join(wantedEscaped).split(currentDomain).join(siteConfig.domain)
}
next = next.replace(/\(\?!\(\?:([a-z0-9|-]+)\)\\\\\.\)/g, `(?!(?:${reserved})\\\\.)`)

if (next === source) {
  console.log(`proxy.ts matchers OK: ${siteConfig.domain}`)
  process.exit(0)
}
if (check) {
  console.error(
    `src/proxy.ts does not match src/lib/site-config.ts (it routes ${currentDomain}, the config says ${siteConfig.domain},` +
      ' or the reserved subdomains differ). Run `npm run sync:proxy` and commit the result.'
  )
  process.exit(1)
}
writeFileSync(PROXY, next)
console.log(`Rewrote src/proxy.ts matchers for ${siteConfig.domain}`)
