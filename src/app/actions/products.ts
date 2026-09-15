'use server'

import { getUserRole } from '@/app/actions/admin'
import { revalidatePublicListingDetail } from '@/lib/cache-tags'
import { assertListingOwner } from '@/lib/catalog/owner-gate'
import { normalizeInlineText, normalizeMultilineText } from '@/lib/listing-content'
import { normalizeOptionalUrlOrNull } from '@/lib/url'
import { createAdminClient } from '@/lib/supabase/admin-client'
import { createClient } from '@/lib/supabase/server'

export type ProductType = 'product' | 'service'

export interface ListingProduct {
  id: string
  listing_id: string
  type: ProductType
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

const MAX_NAME_LENGTH = 80
const MAX_DESCRIPTION_LENGTH = 600
const MAX_PRICE_PAISE = 100_00_000 * 100 // 10 crore in paise, generous cap

function parsePaiseFromRupees(raw: FormDataEntryValue | null): number | null {
  const value = String(raw ?? '').trim().replace(/[^0-9.]/g, '')
  if (!value) return null
  const rupees = Number.parseFloat(value)
  if (!Number.isFinite(rupees) || rupees < 0) return null
  return Math.round(rupees * 100)
}

function parseQuantity(raw: FormDataEntryValue | null, type: ProductType): number | null {
  const value = String(raw ?? '').trim()
  if (!value) return type === 'service' ? null : null
  const parsed = Number.parseInt(value, 10)
  if (!Number.isFinite(parsed) || parsed < 0) return null
  return parsed
}

export async function listOwnerProducts(listingId: string): Promise<ListingProduct[]> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data: listing } = await supabase
    .from('listings')
    .select('id, owner_id')
    .eq('id', listingId)
    .maybeSingle()

  if (!listing) return []

  const { role } = await getUserRole(supabase)
  if (listing.owner_id !== user.id && role !== 'admin') return []

  const { data } = await supabase
    .from('listing_products')
    .select('*')
    .eq('listing_id', listingId)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })

  return (data ?? []) as ListingProduct[]
}

export async function createProduct(
  formData: FormData,
): Promise<{ error?: string; id?: string }> {
  const listingId = (formData.get('listing_id') as string)?.trim()
  if (!listingId) return { error: 'Listing is required.' }

  const ownership = await assertListingOwner(listingId)
  if (!ownership.ok) return { error: ownership.error }

  const rawType = (formData.get('type') as string)?.trim()
  const type: ProductType = rawType === 'service' ? 'service' : 'product'

  const name = normalizeInlineText(formData.get('name') as string, MAX_NAME_LENGTH)
  if (!name) return { error: 'Name is required.' }

  const description = normalizeMultilineText(
    formData.get('description') as string,
    MAX_DESCRIPTION_LENGTH,
  )

  const pricePaise = parsePaiseFromRupees(formData.get('price_rupees'))
  if (pricePaise === null) {
    return { error: 'Enter a valid price in rupees (0 or more).' }
  }
  if (pricePaise > MAX_PRICE_PAISE) {
    return { error: 'Price is unrealistically high.' }
  }

  const rawQty = String(formData.get('quantity_in_stock') ?? '').trim()
  const quantity = rawQty ? parseQuantity(rawQty, type) : null
  if (rawQty && quantity === null) {
    return { error: 'Enter a valid stock quantity (0 or more), or leave blank for unlimited.' }
  }

  const imageUrl = normalizeOptionalUrlOrNull(formData.get('image_url') as string)
  const imageThumbUrl = normalizeOptionalUrlOrNull(formData.get('image_thumb_url') as string)
  const isActive = formData.get('is_active') !== 'off'

  const adminClient = createAdminClient()
  if (!adminClient) return { error: 'Server configuration error.' }

  // Place new product at end of list
  const { data: existing } = await adminClient
    .from('listing_products')
    .select('sort_order')
    .eq('listing_id', listingId)
    .order('sort_order', { ascending: false })
    .limit(1)

  const nextSortOrder = existing && existing.length > 0 ? (existing[0].sort_order ?? 0) + 1 : 0

  const thumbUrl = imageThumbUrl || imageUrl
  const insertPayload: Record<string, unknown> = {
    listing_id: listingId,
    type,
    name,
    description,
    price_paise: pricePaise,
    quantity_in_stock: quantity,
    image_url: imageUrl,
    is_active: isActive,
    sort_order: nextSortOrder,
  }
  // image_thumb_url was added in a later migration — only include it when
  // we have a value so inserts don't fail if the column doesn't exist yet.
  if (thumbUrl) insertPayload.image_thumb_url = thumbUrl

  const { data, error } = await adminClient
    .from('listing_products')
    .insert(insertPayload)
    .select('id')
    .single()

  if (error) return { error: error.message }

  revalidatePublicListingDetail(listingId)
  return { id: data?.id }
}

export async function updateProduct(
  productId: string,
  formData: FormData,
): Promise<{ error?: string }> {
  if (!productId) return { error: 'Product id is required.' }

  const adminClient = createAdminClient()
  if (!adminClient) return { error: 'Server configuration error.' }

  const { data: product } = await adminClient
    .from('listing_products')
    .select('id, listing_id')
    .eq('id', productId)
    .maybeSingle()

  if (!product) return { error: 'Product not found.' }

  const ownership = await assertListingOwner(product.listing_id)
  if (!ownership.ok) return { error: ownership.error }

  const rawType = (formData.get('type') as string)?.trim()
  const type: ProductType = rawType === 'service' ? 'service' : 'product'

  const name = normalizeInlineText(formData.get('name') as string, MAX_NAME_LENGTH)
  if (!name) return { error: 'Name is required.' }

  const description = normalizeMultilineText(
    formData.get('description') as string,
    MAX_DESCRIPTION_LENGTH,
  )

  const pricePaise = parsePaiseFromRupees(formData.get('price_rupees'))
  if (pricePaise === null) return { error: 'Enter a valid price.' }
  if (pricePaise > MAX_PRICE_PAISE) return { error: 'Price is unrealistically high.' }

  const rawQty = String(formData.get('quantity_in_stock') ?? '').trim()
  const quantity = rawQty ? parseQuantity(rawQty, type) : null
  if (rawQty && quantity === null) {
    return { error: 'Enter a valid stock quantity (0 or more), or leave blank for unlimited.' }
  }

  const imageUrl = normalizeOptionalUrlOrNull(formData.get('image_url') as string)
  const imageThumbUrl = normalizeOptionalUrlOrNull(formData.get('image_thumb_url') as string)
  const isActive = formData.get('is_active') !== 'off'

  const thumbUrl = imageThumbUrl || imageUrl
  const updatePayload: Record<string, unknown> = {
    type,
    name,
    description,
    price_paise: pricePaise,
    quantity_in_stock: quantity,
    image_url: imageUrl,
    is_active: isActive,
  }
  if (thumbUrl !== undefined) updatePayload.image_thumb_url = thumbUrl

  const { error } = await adminClient
    .from('listing_products')
    .update(updatePayload)
    .eq('id', productId)

  if (error) return { error: error.message }

  revalidatePublicListingDetail(product.listing_id)
  return {}
}

export async function deleteProduct(
  productId: string,
): Promise<{ error?: string }> {
  if (!productId) return { error: 'Product id is required.' }

  const adminClient = createAdminClient()
  if (!adminClient) return { error: 'Server configuration error.' }

  const { data: product } = await adminClient
    .from('listing_products')
    .select('id, listing_id')
    .eq('id', productId)
    .maybeSingle()

  if (!product) return { error: 'Product not found.' }

  const ownership = await assertListingOwner(product.listing_id)
  if (!ownership.ok) return { error: ownership.error }

  const { error } = await adminClient
    .from('listing_products')
    .delete()
    .eq('id', productId)

  if (error) return { error: error.message }

  revalidatePublicListingDetail(product.listing_id)
  return {}
}

export async function toggleProductActive(
  productId: string,
  isActive: boolean,
): Promise<{ error?: string }> {
  const adminClient = createAdminClient()
  if (!adminClient) return { error: 'Server configuration error.' }

  const { data: product } = await adminClient
    .from('listing_products')
    .select('id, listing_id')
    .eq('id', productId)
    .maybeSingle()

  if (!product) return { error: 'Product not found.' }

  const ownership = await assertListingOwner(product.listing_id)
  if (!ownership.ok) return { error: ownership.error }

  const { error } = await adminClient
    .from('listing_products')
    .update({ is_active: isActive })
    .eq('id', productId)

  if (error) return { error: error.message }

  revalidatePublicListingDetail(product.listing_id)
  return {}
}

export async function reorderProducts(
  listingId: string,
  orderedIds: string[],
): Promise<{ error?: string }> {
  if (!listingId) return { error: 'Listing is required.' }

  const ownership = await assertListingOwner(listingId)
  if (!ownership.ok) return { error: ownership.error }

  if (!Array.isArray(orderedIds) || orderedIds.length === 0) {
    return { error: 'Nothing to reorder.' }
  }

  const adminClient = createAdminClient()
  if (!adminClient) return { error: 'Server configuration error.' }

  // Validate all ids belong to this listing
  const { data: existing } = await adminClient
    .from('listing_products')
    .select('id')
    .eq('listing_id', listingId)

  const validIds = new Set((existing ?? []).map((row) => row.id))
  const unknown = orderedIds.find((id) => !validIds.has(id))
  if (unknown) return { error: 'Unknown product in ordering.' }

  // Apply ordering
  const updates = orderedIds.map((id, index) =>
    adminClient
      .from('listing_products')
      .update({ sort_order: index })
      .eq('id', id),
  )

  const results = await Promise.all(updates)
  const firstError = results.find((r) => r.error)
  if (firstError?.error) return { error: firstError.error.message }

  revalidatePublicListingDetail(listingId)
  return {}
}
