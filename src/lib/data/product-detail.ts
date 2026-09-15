import 'server-only'

import { cacheLife, cacheTag } from 'next/cache'

import { CACHE_TAGS } from '@/lib/cache-tags'
import { PUBLIC_CONTENT_CACHE } from '@/lib/cache-policy'
import { CATALOG_ITEM_SELECT, toCatalogItem, type CatalogRow } from '@/lib/catalog/catalog'
import type { CatalogItem } from '@/lib/catalog/types'
import { logCacheRegeneration } from '@/lib/isr-debug'
import { deriveShopMode, type ShopMode } from '@/lib/selling/shop-mode'
import { createAdminClient } from '@/lib/supabase/admin-client'
import { createPublicClient } from '@/lib/supabase/public'

export interface StandaloneProduct extends CatalogItem {
  listing_id: string
}

export interface StandaloneProductListing {
  id: string
  name: string
  subdomain: string | null
  whatsapp: string | null
  phone: string | null
  approved: boolean
}

export async function fetchProductAndListing(productId: string): Promise<{
  product: StandaloneProduct
  listing: StandaloneProductListing | null
  shopMode: ShopMode
} | null> {
  'use cache'

  cacheLife(PUBLIC_CONTENT_CACHE)

  const supabase = createPublicClient()
  const { data: productData } = await supabase
    .from('listing_products')
    .select(`listing_id, ${CATALOG_ITEM_SELECT}`)
    .eq('id', productId)
    .eq('is_active', true)
    .maybeSingle()
  if (!productData) return null
  const product = toCatalogItem(productData as unknown as CatalogRow & { listing_id: string })

  // Tagged with the owning listing, which is only known once the product is
  // fetched — the same after-the-fetch tagging getCachedListingDetail uses.
  //
  // This matters beyond freshness: /checkout reads price and stock from here,
  // while the Razorpay order is created from the live DB row. Without a tag
  // nothing could invalidate this entry, so a seller's price edit would leave
  // the buyer charged the new amount while the receipt showed the old one, and
  // a restocked item would keep rendering "Sold out". Every product mutation
  // already calls revalidatePublicListingDetail(listing_id), so subscribing to
  // that tag is all this needed.
  cacheTag(CACHE_TAGS.listing(product.listing_id))
  logCacheRegeneration({
    scope: 'product:detail',
    tags: [CACHE_TAGS.listing(product.listing_id)],
    detail: { productId },
  })

  const { data: listingData } = await supabase
    .from('listings')
    .select('id, name, subdomain, whatsapp, phone, approved, payments_enabled, payments_suspended_at')
    .eq('id', product.listing_id)
    .eq('approved', true)
    .maybeSingle()
  const listingRow = (listingData ?? null) as
    | (StandaloneProductListing & { payments_enabled: boolean | null; payments_suspended_at: string | null })
    | null

  // Payment configs have no public read policy; the key id is read only to
  // tell test keys from live keys and never leaves this function.
  const adminClient = listingRow?.payments_enabled ? createAdminClient() : null
  const { data: configData } = adminClient
    ? await adminClient
        .from('listing_payment_configs')
        .select('verified_at, razorpay_key_id')
        .eq('listing_id', product.listing_id)
        .maybeSingle()
    : { data: null }
  const config = (configData ?? null) as { verified_at: string | null; razorpay_key_id: string } | null

  const shopMode = deriveShopMode({
    approved: listingRow?.approved === true,
    paymentsEnabled: listingRow?.payments_enabled === true,
    suspendedAt: listingRow?.payments_suspended_at ?? null,
    verifiedAt: config?.verified_at ?? null,
    keyId: config?.razorpay_key_id ?? null,
  })

  const listing: StandaloneProductListing | null = listingRow
    ? {
        id: listingRow.id,
        name: listingRow.name,
        subdomain: listingRow.subdomain,
        whatsapp: listingRow.whatsapp,
        phone: listingRow.phone,
        approved: listingRow.approved,
      }
    : null

  return { product, listing, shopMode }
}
