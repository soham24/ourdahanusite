import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import {
  loadInitialAuthUser,
  shouldInitializeBrowserAuth,
} from '../auth-context-runtime'
import * as authContextRuntime from '../auth-context-runtime'
import {
  getAuthCookieOptions,
  getLegacyHostOnlyAuthCookieRemovals,
} from './auth-cookie'
import { ROOT_DOMAIN } from '@/lib/site-config'

test('pins the lockless Supabase client and its Node 20-compatible engine metadata', async () => {
  const packageJson = JSON.parse(
    await readFile(new URL('../../../package.json', import.meta.url), 'utf8'),
  ) as { dependencies: Record<string, string> }
  const packageLock = JSON.parse(
    await readFile(new URL('../../../package-lock.json', import.meta.url), 'utf8'),
  ) as {
    packages: Record<string, { version?: string; engines?: { node?: string } }>
  }

  assert.equal(packageJson.dependencies['@supabase/supabase-js'], '2.109.0')
  assert.equal(
    packageLock.packages['node_modules/@supabase/supabase-js']?.version,
    '2.109.0',
  )
  assert.equal(
    packageLock.packages['node_modules/@supabase/supabase-js']?.engines?.node,
    '>=20.0.0',
  )
  assert.equal(
    packageLock.packages['node_modules/@supabase/auth-js']?.version,
    '2.109.0',
  )
  assert.equal(
    packageLock.packages['node_modules/@supabase/auth-js']?.engines?.node,
    '>=20.0.0',
  )
})

test('shares production auth cookies across OurDahanu subdomains only', async () => {
  assert.deepEqual(getAuthCookieOptions(`https://${ROOT_DOMAIN}`), {
    domain: `.${ROOT_DOMAIN}`,
  })
  assert.deepEqual(getAuthCookieOptions(`${ROOT_DOMAIN}`), {
    domain: `.${ROOT_DOMAIN}`,
  })
  assert.deepEqual(getAuthCookieOptions(`find.${ROOT_DOMAIN}`), {
    domain: `.${ROOT_DOMAIN}`,
  })
  assert.deepEqual(getAuthCookieOptions(`https://find.${ROOT_DOMAIN}`), {
    domain: `.${ROOT_DOMAIN}`,
  })
  assert.deepEqual(getAuthCookieOptions('http://localhost:3000'), {})
  assert.deepEqual(getAuthCookieOptions(`https://${ROOT_DOMAIN}.evil.example`), {})
  assert.deepEqual(getAuthCookieOptions(undefined), {})
})

test('removes only legacy host-only auth-token cookies and leaves PKCE cookies intact', async () => {
  assert.deepEqual(
    getLegacyHostOnlyAuthCookieRemovals([
      'sb-project-auth-token=whole',
      'sb-project-auth-token.0=chunk-zero',
      'sb-project-auth-token.1=chunk-one',
      'sb-project-auth-token.1=duplicate',
      'sb-project-auth-token-code-verifier=keep-me',
      'sb-project-auth-token.extra=keep-me-too',
      'theme=dark',
    ].join('; ')),
    [
      'sb-project-auth-token=; Path=/; Max-Age=0; SameSite=Lax',
      'sb-project-auth-token.0=; Path=/; Max-Age=0; SameSite=Lax',
      'sb-project-auth-token.1=; Path=/; Max-Age=0; SameSite=Lax',
    ],
  )
})

test('skips browser auth on Find hosts and tolerates an initial getUser rejection', async () => {
  assert.equal(shouldInitializeBrowserAuth(`find.${ROOT_DOMAIN}`), false)
  assert.equal(shouldInitializeBrowserAuth('find.localhost'), false)
  assert.equal(shouldInitializeBrowserAuth('find.localhost:3000'), false)
  assert.equal(shouldInitializeBrowserAuth(`${ROOT_DOMAIN}`), true)
  assert.equal(shouldInitializeBrowserAuth(`shop.${ROOT_DOMAIN}`), true)

  const expectedUser = { id: 'user-1' }
  assert.equal(
    await loadInitialAuthUser(async () => ({ data: { user: expectedUser } })),
    expectedUser,
  )
  assert.equal(
    await loadInitialAuthUser(async () => {
      throw new Error('refresh rate limited')
    }),
    null,
  )
})

test('Find auth planning clears legacy host cookies without initializing a client', () => {
  const getBrowserAuthPlan = (
    authContextRuntime as Record<string, unknown>
  ).getBrowserAuthPlan
  assert.equal(typeof getBrowserAuthPlan, 'function')

  assert.deepEqual(
    (getBrowserAuthPlan as (
      hostname: string,
      cookieHeader: string,
    ) => unknown)(
      `find.${ROOT_DOMAIN}`,
      [
        'sb-project-auth-token.0=stale-host-token',
        'sb-project-auth-token-code-verifier=keep-pkce',
      ].join('; '),
    ),
    {
      shouldInitialize: false,
      legacyCookieRemovals: [
        'sb-project-auth-token.0=; Path=/; Max-Age=0; SameSite=Lax',
      ],
    },
  )
})
