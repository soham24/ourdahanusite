import type { ServiceImageAspect } from '../service-image'

export type CatalogItemType = 'product' | 'service'

export interface CatalogOption {
  id: string
  label: string
  price_paise: number
  /** Null means no stock limit. */
  quantity_in_stock: number | null
  sort_order: number
}

/** One item in a business's catalog, as customers see it. */
export interface CatalogItem {
  id: string
  type: CatalogItemType
  name: string
  description: string | null
  /** Null when the item has options or no fixed price. */
  price_paise: number | null
  price_note: string | null
  quantity_in_stock: number | null
  image_url: string | null
  image_thumb_url: string | null
  image_aspect: ServiceImageAspect
  sort_order: number
  /** When present, each option's price and stock apply instead of the item's. */
  options: CatalogOption[]
}

/** The owner's view of an item adds visibility and bookkeeping. */
export interface OwnerCatalogItem extends CatalogItem {
  listing_id: string
  is_active: boolean
  legacy_service_index: number | null
  created_at: string
  updated_at: string
}
