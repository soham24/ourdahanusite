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

test('pins the newest Supabase client compatible with the Node 20 runtime', async () => {
  const packageJson = JSON.parse(
    await readFile(new URL('../../../package.json', import.meta.url), 'utf8'),
  ) as { dependencies: Record<string, string> }

  assert.equal(packageJson.dependencies['@supabase/supabase-js'], '2.109.0')
})

test('shares production auth cookies across OurDahanu subdomains only', async () => {
  assert.deepEqual(getAuthCookieOptions('https://ourdahanu.in'), {
    domain: '.ourdahanu.in',
  })
  assert.deepEqual(getAuthCookieOptions('https://find.ourdahanu.in'), {
    domain: '.ourdahanu.in',
  })
  assert.deepEqual(getAuthCookieOptions('http://localhost:3000'), {})
  assert.deepEqual(getAuthCookieOptions('https://ourdahanu.in.evil.example'), {})
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
  assert.equal(shouldInitializeBrowserAuth('find.ourdahanu.in'), false)
  assert.equal(shouldInitializeBrowserAuth('find.localhost'), false)
  assert.equal(shouldInitializeBrowserAuth('find.localhost:3000'), false)
  assert.equal(shouldInitializeBrowserAuth('ourdahanu.in'), true)
  assert.equal(shouldInitializeBrowserAuth('shop.ourdahanu.in'), true)

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
      siteUrl: string,
      cookieHeader: string,
    ) => unknown)(
      'find.ourdahanu.in',
      'https://ourdahanu.in',
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
