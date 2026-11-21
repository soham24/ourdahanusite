import assert from 'node:assert/strict'
import test from 'node:test'
import { getAuthIdentity, getAuthUserId, identityFromClaims, type ClaimsClient } from './auth-claims'

const NOW = 1_800_000_000

function claims(overrides: Record<string, unknown> = {}) {
  return {
    sub: '11111111-1111-1111-1111-111111111111',
    role: 'authenticated',
    aud: 'authenticated',
    exp: NOW + 3600,
    iat: NOW,
    email: 'someone@example.com',
    phone: '',
    is_anonymous: false,
    user_metadata: { full_name: 'Some One' },
    ...overrides,
  }
}

test('maps a signed-in user JWT to an identity', () => {
  assert.deepEqual(identityFromClaims(claims(), NOW), {
    id: '11111111-1111-1111-1111-111111111111',
    email: 'someone@example.com',
    phone: null,
    isAnonymous: false,
    userMetadata: { full_name: 'Some One' },
  })
})

test('rejects tokens that are not a signed-in user', () => {
  // The anon / service-role API keys are JWTs with no sub and another role.
  assert.equal(identityFromClaims({ role: 'anon', exp: NOW + 60 }, NOW), null)
  assert.equal(identityFromClaims(claims({ role: 'service_role' }), NOW), null)
  assert.equal(identityFromClaims(claims({ sub: '' }), NOW), null)
  assert.equal(identityFromClaims(claims({ sub: 42 }), NOW), null)
  assert.equal(identityFromClaims(null, NOW), null)
  assert.equal(identityFromClaims('a.b.c', NOW), null)
})

test('rejects expired or exp-less tokens', () => {
  assert.equal(identityFromClaims(claims({ exp: NOW }), NOW), null)
  assert.equal(identityFromClaims(claims({ exp: NOW - 1 }), NOW), null)
  assert.equal(identityFromClaims(claims({ exp: undefined }), NOW), null)
  assert.equal(identityFromClaims(claims({ exp: String(NOW + 60) }), NOW), null)
})

test('tolerates missing or odd optional claims', () => {
  const identity = identityFromClaims(
    claims({ email: undefined, phone: '+919800000000', is_anonymous: 'true', user_metadata: ['x'] }),
    NOW,
  )
  assert.deepEqual(identity, {
    id: '11111111-1111-1111-1111-111111111111',
    email: null,
    phone: '+919800000000',
    isAnonymous: false,
    userMetadata: {},
  })
  assert.equal(identityFromClaims(claims({ is_anonymous: true }), NOW)?.isAnonymous, true)
})

function fakeClient(result: unknown): ClaimsClient {
  return {
    auth: {
      async getClaims() {
        if (result instanceof Error) throw result
        return result as Awaited<ReturnType<ClaimsClient['auth']['getClaims']>>
      },
    },
  }
}

test('getAuthIdentity returns the identity for verified claims', async () => {
  const live = claims({ exp: Math.floor(Date.now() / 1000) + 3600 })
  const client = fakeClient({ data: { claims: live, header: {}, signature: new Uint8Array() }, error: null })
  assert.equal((await getAuthIdentity(client))?.id, live.sub)
  assert.equal(await getAuthUserId(client), live.sub)
})

test('getAuthIdentity is null when signed out, unverified, or the call throws', async () => {
  // Signed out: getClaims returns { data: null, error: null }.
  assert.equal(await getAuthIdentity(fakeClient({ data: null, error: null })), null)
  // Bad signature / expired / revoked (legacy fallback): an AuthError.
  assert.equal(await getAuthIdentity(fakeClient({ data: null, error: new Error('Invalid JWT signature') })), null)
  // Non-auth errors are rethrown by auth-js; treat them as signed out.
  assert.equal(await getAuthIdentity(fakeClient(new TypeError('fetch failed'))), null)
  assert.equal(await getAuthUserId(fakeClient({ data: null, error: null })), null)
})
