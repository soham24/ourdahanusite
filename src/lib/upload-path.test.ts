import { test } from 'node:test'
import assert from 'node:assert/strict'

import { storageObjectPath } from './upload-path'

const UID = '11111111-2222-3333-4444-555555555555'

test('puts the uploader id in the second path segment, where the policy looks', () => {
  // A storage policy reads this as (storage.foldername(name))[2].
  const parts = storageObjectPath(UID, 'shopfront.jpg').split('/')
  assert.equal(parts[0], 'public')
  assert.equal(parts[1], UID)
  assert.equal(parts.length, 3)
})

test('a filename cannot escape the uploader folder', () => {
  for (const hostile of ['../../evil.jpg', 'a/b/c.jpg', '..\\..\\evil.jpg', '/etc/passwd']) {
    const path = storageObjectPath(UID, hostile)
    assert.equal(path.split('/').length, 3, `escaped with ${hostile}`)
    assert.ok(path.startsWith(`public/${UID}/`), `escaped with ${hostile}`)
    assert.ok(!path.includes('..'), `kept traversal from ${hostile}`)
  }
})

test('keeps the name recognisable', () => {
  assert.match(storageObjectPath(UID, 'Shop Front Photo.JPEG'), /-shop-front-photo\.jpg$/)
})

test('falls back to a name rather than an empty one', () => {
  assert.match(storageObjectPath(UID, '!!!.png'), /-image\.jpg$/)
  assert.match(storageObjectPath(UID, ''), /-image\.jpg$/)
})

test('caps a very long filename', () => {
  const path = storageObjectPath(UID, `${'a'.repeat(300)}.jpg`)
  const name = path.split('/')[2]
  assert.ok(name.length < 80, `name too long: ${name.length}`)
})

test('two uploads in the same millisecond do not collide', () => {
  // The bucket has no UPDATE policy, so upsert cannot overwrite: a collision
  // failed the second upload in front of the user.
  const paths = new Set(Array.from({ length: 200 }, () => storageObjectPath(UID, 'same.jpg')))
  assert.equal(paths.size, 200)
})

test('the thumbnail sits beside its full image', () => {
  assert.match(storageObjectPath(UID, 'x.jpg', '-thumb'), /-thumb\.jpg$/)
})

test('refuses to build a path without an uploader', () => {
  assert.throws(() => storageObjectPath('', 'x.jpg'), /uploader id/)
})

test('always ends in .jpg, since every upload is re-encoded', () => {
  for (const n of ['a.png', 'b.webp', 'c.gif', 'd']) {
    assert.ok(storageObjectPath(UID, n).endsWith('.jpg'))
  }
})
