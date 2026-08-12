import 'server-only'

import { cacheLife, cacheTag } from 'next/cache'

import { CACHE_TAGS } from '@/lib/cache-tags'
import { PUBLIC_CONTENT_CACHE } from '@/lib/cache-policy'
import { logCacheRegeneration } from '@/lib/isr-debug'
import { createPublicClient } from '@/lib/supabase/public'

export interface StandaloneProduct {
  id: string
  listing_id: string
  type: 'product' | 'service'
  name: string
  description: string | null
  price_paise: number
  quantity_in_stock: number | null
  image_url: string | null
  image_thumb_url: string | null
  is_active: boolean
  sort_order: number
  created_at: string
  updated_at: string
}

export interface StandaloneProductListing {
  id: string
  name: string
  subdomain: string | null
  whatsapp: string | null
  phone: string | null
  approved: boolean
}

export async function fetchProductAndListing(productId: string) {
  'use cache'

  cacheLife(PUBLIC_CONTENT_CACHE)

  const supabase = createPublicClient()
  const { data: productData } = await supabase
    .from('listing_products')
    .select('id, listing_id, type, name, description, price_paise, quantity_in_stock, image_url, image_thumb_url, is_active, sort_order, created_at, updated_at')
    .eq('id', productId)
    .eq('is_active', true)
    .maybeSingle()
  const product = productData as StandaloneProduct | null
  if (!product) return null

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
    .select('id, name, subdomain, whatsapp, phone, approved')
    .eq('id', product.listing_id)
    .eq('approved', true)
    .maybeSingle()
  const listing = listingData as StandaloneProductListing | null
  return { product, listing }
}
