import 'server-only'

import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'

/**
 * Symmetric encryption for listing-owner secrets (Razorpay key_secret).
 *
 * Algorithm: AES-256-GCM
 * Packing:   base64( iv(12) || authTag(16) || ciphertext )
 *
 * Requires env LISTING_PAYMENT_ENCRYPTION_KEY — a base64-encoded 32-byte key.
 * Generate one with:  node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
 */

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 12
const AUTH_TAG_LENGTH = 16

function getKey(): Buffer {
  const raw = process.env.LISTING_PAYMENT_ENCRYPTION_KEY?.trim()
  if (!raw) {
    throw new Error('LISTING_PAYMENT_ENCRYPTION_KEY is not configured.')
  }
  const key = Buffer.from(raw, 'base64')
  if (key.length !== 32) {
    throw new Error('LISTING_PAYMENT_ENCRYPTION_KEY must decode to 32 bytes (AES-256).')
  }
  return key
}

export function encryptSecret(plaintext: string): string {
  if (!plaintext) throw new Error('Cannot encrypt empty value.')
  const key = getKey()
  const iv = randomBytes(IV_LENGTH)
  const cipher = createCipheriv(ALGORITHM, key, iv)
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()
  return Buffer.concat([iv, authTag, ciphertext]).toString('base64')
}

export function decryptSecret(packed: string): string {
  if (!packed) throw new Error('Cannot decrypt empty value.')
  const key = getKey()
  const buffer = Buffer.from(packed, 'base64')
  if (buffer.length < IV_LENGTH + AUTH_TAG_LENGTH + 1) {
    throw new Error('Encrypted payload is too short.')
  }
  const iv = buffer.subarray(0, IV_LENGTH)
  const authTag = buffer.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH)
  const ciphertext = buffer.subarray(IV_LENGTH + AUTH_TAG_LENGTH)
  const decipher = createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(authTag)
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8')
}

/** Useful for masked UI display: last 4 chars of the (public) key_id. */
export function keyIdLast4(keyId: string): string {
  return keyId.slice(-4)
}
