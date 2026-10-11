'use server'

import { revalidateProductDetail, revalidatePublicListingDetail } from '@/lib/cache-tags'
import { OWNER_CATALOG_ITEM_SELECT, toCatalogItem, type OwnerCatalogRow } from '@/lib/catalog/catalog'
import { assertListingOwner } from '@/lib/catalog/owner-gate'
import type { OwnerCatalogItem } from '@/lib/catalog/types'
import {
  coerceCatalogItemInput,
  validateCatalogItem,
  type CatalogItemErrors,
  type CatalogItemValues,
} from '@/lib/catalog/validate'
import { getUserRole } from '@/app/actions/admin'
import { createAdminClient } from '@/lib/supabase/admin-client'
import { createClient } from '@/lib/supabase/server'

export type CatalogItemResult = {
  item?: OwnerCatalogItem
  error?: string
  fieldErrors?: CatalogItemErrors
}

type AdminClient = NonNullable<ReturnType<typeof createAdminClient>>

const SAVE_FAILED = 'Could not save the item. Please try again.'

async function loadItem(adminClient: AdminClient, itemId: string): Promise<OwnerCatalogItem | null> {
  const { data } = await adminClient
    .from('listing_products')
    .select(OWNER_CATALOG_ITEM_SELECT)
    .eq('id', itemId)
    .maybeSingle()
  return data ? toCatalogItem(data as OwnerCatalogRow) : null
}

async function loadItemListingId(adminClient: AdminClient, itemId: string): Promise<string | null> {
  const { data } = await adminClient.from('listing_products').select('listing_id').eq('id', itemId).maybeSingle()
  return (data as { listing_id: string } | null)?.listing_id ?? null
}

/** Updates kept options, adds new ones and removes the rest — only for this item. */
async function saveOptions(
  adminClient: AdminClient,
  itemId: string,
  options: CatalogItemValues['options'],
): Promise<string | null> {
  const { data: existingData, error: loadError } = await adminClient
    .from('listing_product_options')
    .select('id')
    .eq('product_id', itemId)
  if (loadError) return loadError.message

  const existingIds = new Set(((existingData ?? []) as { id: string }[]).map((row) => row.id))
  const keptIds = new Set<string>()
  const now = new Date().toISOString()

  for (const [index, option] of options.entries()) {
    const row = {
      label: option.label,
      price_paise: option.price_paise,
      quantity_in_stock: option.quantity_in_stock,
      sort_order: index,
      updated_at: now,
    }
    if (option.id && existingIds.has(option.id)) {
      keptIds.add(option.id)
      const { error } = await adminClient
        .from('listing_product_options')
        .update(row)
        .eq('id', option.id)
        .eq('product_id', itemId)
      if (error) return error.message
    } else {
      const { error } = await adminClient.from('listing_product_options').insert({ ...row, product_id: itemId })
      if (error) return error.message
    }
  }

  const removedIds = [...existingIds].filter((id) => !keptIds.has(id))
  if (removedIds.length > 0) {
    const { error } = await adminClient
      .from('listing_product_options')
      .delete()
      .eq('product_id', itemId)
      .in('id', removedIds)
    if (error) return error.message
  }
  return null
}

function itemColumns(values: CatalogItemValues) {
  return {
    type: values.type,
    name: values.name,
    description: values.description,
    image_url: values.image_url,
    image_aspect: values.image_aspect,
    price_paise: values.price_paise,
    quantity_in_stock: values.quantity_in_stock,
    price_note: values.price_note,
    image_thumb_url: values.image_url,
  }
}

export async function listOwnerCatalogItems(listingId: string): Promise<OwnerCatalogItem[]> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data: listing } = await supabase.from('listings').select('id, owner_id').eq('id', listingId).maybeSingle()
  if (!listing) return []

  const { role } = await getUserRole(supabase)
  if (listing.owner_id !== user.id && role !== 'admin') return []

  // Admins manage items on any listing, including unapproved ones or items
  // hidden by RLS from non-owners; read through the admin client so they see
  // the same rows an owner would. Owners keep reading through their own
  // RLS-scoped client. Fall back to the session client if the admin client
  // is unavailable (matches assertListingOwner's pattern).
  const client = role === 'admin' ? createAdminClient() ?? supabase : supabase

  const { data } = await client
    .from('listing_products')
    .select(OWNER_CATALOG_ITEM_SELECT)
    .eq('listing_id', listingId)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })

  return ((data ?? []) as unknown as OwnerCatalogRow[]).map((row) => toCatalogItem(row))
}

export async function createCatalogItem(listingId: string, input: unknown): Promise<CatalogItemResult> {
  if (!listingId) return { error: 'Listing is required.' }

  const ownership = await assertListingOwner(listingId)
  if (!ownership.ok) return { error: ownership.error }

  const validation = validateCatalogItem(coerceCatalogItemInput(input))
  if (!validation.ok) return { error: 'Please fix the highlighted fields.', fieldErrors: validation.errors }

  const adminClient = createAdminClient()
  if (!adminClient) return { error: 'Server configuration error.' }

  const { data: last } = await adminClient
    .from('listing_products')
    .select('sort_order')
    .eq('listing_id', listingId)
    .order('sort_order', { ascending: false })
    .limit(1)
  const nextSortOrder = last && last.length > 0 ? (last[0].sort_order ?? 0) + 1 : 0

  const { data: created, error } = await adminClient
    .from('listing_products')
    .insert({ ...itemColumns(validation.values), listing_id: listingId, is_active: true, sort_order: nextSortOrder })
    .select('id')
    .single()
  if (error || !created) {
    console.error('[catalog] create item failed:', error)
    return { error: SAVE_FAILED }
  }

  const optionsError = await saveOptions(adminClient, created.id, validation.values.options)
  revalidatePublicListingDetail(listingId)
  const item = (await loadItem(adminClient, created.id)) ?? undefined

  if (optionsError) {
    console.error('[catalog] save options failed:', optionsError)
    return { item, error: 'The item was saved, but its options were not. Edit it to try again.' }
  }
  return item ? { item } : { error: 'Saved. Refresh the page to see it.' }
}

export async function updateCatalogItem(itemId: string, input: unknown): Promise<CatalogItemResult> {
  const adminClient = createAdminClient()
  if (!adminClient) return { error: 'Server configuration error.' }

  const listingId = await loadItemListingId(adminClient, itemId)
  if (!listingId) return { error: 'This item no longer exists.' }

  const ownership = await assertListingOwner(listingId)
  if (!ownership.ok) return { error: ownership.error }

  const validation = validateCatalogItem(coerceCatalogItemInput(input))
  if (!validation.ok) return { error: 'Please fix the highlighted fields.', fieldErrors: validation.errors }

  const { error } = await adminClient
    .from('listing_products')
    .update({ ...itemColumns(validation.values), updated_at: new Date().toISOString() })
    .eq('id', itemId)
  if (error) {
    console.error('[catalog] update item failed:', error)
    return { error: SAVE_FAILED }
  }

  const optionsError = await saveOptions(adminClient, itemId, validation.values.options)
  revalidatePublicListingDetail(listingId)
  revalidateProductDetail(itemId)
  const item = (await loadItem(adminClient, itemId)) ?? undefined

  if (optionsError) {
    console.error('[catalog] save options failed:', optionsError)
    return { item, error: 'The item was saved, but its options were not. Try again.' }
  }
  return item ? { item } : { error: 'Saved. Refresh the page to see it.' }
}

export async function setCatalogItemVisible(itemId: string, visible: boolean): Promise<CatalogItemResult> {
  const adminClient = createAdminClient()
  if (!adminClient) return { error: 'Server configuration error.' }

  const listingId = await loadItemListingId(adminClient, itemId)
  if (!listingId) return { error: 'This item no longer exists.' }

  const ownership = await assertListingOwner(listingId)
  if (!ownership.ok) return { error: ownership.error }

  const { error } = await adminClient
    .from('listing_products')
    .update({ is_active: visible === true, updated_at: new Date().toISOString() })
    .eq('id', itemId)
  if (error) {
    console.error('[catalog] visibility failed:', error)
    return { error: 'Could not change visibility. Please try again.' }
  }

  revalidatePublicListingDetail(listingId)
  revalidateProductDetail(itemId)
  const item = await loadItem(adminClient, itemId)
  return item ? { item } : { error: 'This item no longer exists.' }
}

export async function moveCatalogItems(listingId: string, orderedIds: string[]): Promise<{ error?: string }> {
  if (!listingId) return { error: 'Listing is required.' }

  const ownership = await assertListingOwner(listingId)
  if (!ownership.ok) return { error: ownership.error }

  if (!Array.isArray(orderedIds) || orderedIds.length === 0) return { error: 'Nothing to reorder.' }

  const adminClient = createAdminClient()
  if (!adminClient) return { error: 'Server configuration error.' }

  const { data: existing } = await adminClient.from('listing_products').select('id').eq('listing_id', listingId)
  const validIds = new Set(((existing ?? []) as { id: string }[]).map((row) => row.id))
  if (orderedIds.some((id) => !validIds.has(id))) {
    return { error: 'The list changed. Refresh the page and try again.' }
  }

  const results = await Promise.all(
    orderedIds.map((id, index) => adminClient.from('listing_products').update({ sort_order: index }).eq('id', id)),
  )
  const failed = results.find((result) => result.error)
  if (failed?.error) {
    console.error('[catalog] reorder failed:', failed.error)
    return { error: 'Could not move the item. Please try again.' }
  }

  revalidatePublicListingDetail(listingId)
  return {}
}

export async function deleteCatalogItem(itemId: string): Promise<{ error?: string }> {
  const adminClient = createAdminClient()
  if (!adminClient) return { error: 'Server configuration error.' }

  const listingId = await loadItemListingId(adminClient, itemId)
  if (!listingId) return {}

  const ownership = await assertListingOwner(listingId)
  if (!ownership.ok) return { error: ownership.error }

  // Past orders keep their item name and option label; their links are set to null.
  const { error } = await adminClient.from('listing_products').delete().eq('id', itemId)
  if (error) {
    console.error('[catalog] delete failed:', error)
    return { error: 'Could not delete the item. Please try again.' }
  }

  revalidatePublicListingDetail(listingId)
  revalidateProductDetail(itemId)
  return {}
}
