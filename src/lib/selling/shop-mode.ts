import { classifyRazorpayKeyId } from './keys'

/** off: no online selling · test: only the owner may see and buy · live: everyone. */
export type ShopMode = 'off' | 'test' | 'live'

/** How admins see a business: suspension outranks everything else. */
export type SellingStatus = 'not_connected' | 'test' | 'live' | 'suspended'

export interface ShopModeInput {
  approved: boolean
  paymentsEnabled: boolean
  suspendedAt: string | null
  verifiedAt: string | null
  keyId: string | null
}

export const SHOP_NOT_OPEN_MESSAGE = "This shop isn't taking online payments yet."

export const LISTING_NOT_LIVE_MESSAGE = 'Your listing needs to be live before you can sell online.'

export function sellingPausedMessage(reason: string | null): string {
  const why = reason?.trim() || 'no reason given'
  return `Selling is paused by OurDahanu: ${why}. Contact us to resume.`
}

export function deriveShopMode(input: ShopModeInput): ShopMode {
  if (!input.approved || !input.paymentsEnabled || input.suspendedAt || !input.verifiedAt) {
    return 'off'
  }
  const kind = classifyRazorpayKeyId(input.keyId)
  if (kind === 'live') return 'live'
  if (kind === 'test') return 'test'
  return 'off'
}

export function deriveSellingStatus(input: ShopModeInput): SellingStatus {
  if (input.suspendedAt) return 'suspended'
  const mode = deriveShopMode(input)
  return mode === 'off' ? 'not_connected' : mode
}

export function canBuyFromShop(
  mode: ShopMode,
  viewer: { isOwner: boolean; isAdmin: boolean },
): boolean {
  if (mode === 'live') return true
  if (mode === 'test') return viewer.isOwner || viewer.isAdmin
  return false
}

/**
 * True when saving `nextKeyId` makes the shop live for the first time, or
 * moves it from test (or unverified) keys to live keys. Replacing one live
 * key with another is not news.
 */
export function becameLive(
  previous: { keyId: string | null; verifiedAt: string | null } | null,
  nextKeyId: string,
): boolean {
  if (classifyRazorpayKeyId(nextKeyId) !== 'live') return false
  const wasLive = Boolean(previous?.verifiedAt) && classifyRazorpayKeyId(previous?.keyId) === 'live'
  return !wasLive
}
