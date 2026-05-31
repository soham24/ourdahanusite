import 'server-only'

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
  const supabase = createPublicClient()
  const { data: productData } = await supabase
    .from('listing_products')
    .select('*')
    .eq('id', productId)
    .eq('is_active', true)
    .maybeSingle()
  const product = productData as StandaloneProduct | null
  if (!product) return null

  const { data: listingData } = await supabase
    .from('listings')
    .select('id, name, subdomain, whatsapp, phone, approved')
    .eq('id', product.listing_id)
    .eq('approved', true)
    .maybeSingle()
  const listing = listingData as StandaloneProductListing | null
  return { product, listing }
}
