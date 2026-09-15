import { canBuyFromShop, type ShopMode } from '../selling/shop-mode'
import { normalizeServiceImageAspect } from '../service-image'
import type { CatalogItem, CatalogOption, OwnerCatalogItem } from './types'

/** Razorpay's minimum order, and the lowest price an item can be sold for online. */
export const MIN_ONLINE_PRICE_PAISE = 100
/** ₹1 crore. price_paise is a 32-bit integer column. */
export const MAX_PRICE_PAISE = 1_000_000_000
export const MAX_OPTIONS = 6

const OPTION_COLUMNS = 'id, label, price_paise, quantity_in_stock, sort_order'

/** Public item columns with options embedded (RLS hides options of hidden items). */
export const CATALOG_ITEM_SELECT = `id, type, name, description, price_paise, price_note, quantity_in_stock, image_url, image_thumb_url, image_aspect, sort_order, options:listing_product_options(${OPTION_COLUMNS})`

/** Every item column, for the owner's manager, with options embedded. */
export const OWNER_CATALOG_ITEM_SELECT = `*, options:listing_product_options(${OPTION_COLUMNS})`

/** A database row before shaping: the photo shape is free text and options may be missing. */
export type CatalogRow = Omit<CatalogItem, 'image_aspect' | 'options'> & {
  image_aspect: string | null
  options?: CatalogOption[] | null
}

export type OwnerCatalogRow = CatalogRow &
  Pick<OwnerCatalogItem, 'listing_id' | 'is_active' | 'legacy_service_index' | 'created_at' | 'updated_at'>

export function formatPaise(paise: number): string {
  return `₹${(paise / 100).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`
}

export function sortCatalogOptions(options: readonly CatalogOption[] | null | undefined): CatalogOption[] {
  return [...(options ?? [])].sort((a, b) => a.sort_order - b.sort_order || a.label.localeCompare(b.label))
}

export function toCatalogItem<T extends CatalogRow>(
  row: T,
): Omit<T, 'image_aspect' | 'options'> & Pick<CatalogItem, 'image_aspect' | 'options'> {
  return {
    ...row,
    image_aspect: normalizeServiceImageAspect(row.image_aspect, 'square'),
    options: sortCatalogOptions(row.options),
  } as Omit<T, 'image_aspect' | 'options'> & Pick<CatalogItem, 'image_aspect' | 'options'>
}

/** Options, or a fixed price of at least ₹1. */
export function isBuyable(item: { price_paise: number | null; options: readonly unknown[] }): boolean {
  return item.options.length > 0 || (item.price_paise ?? 0) >= MIN_ONLINE_PRICE_PAISE
}

export function isAvailable(stock: number | null): boolean {
  return stock === null || stock > 0
}

export function isSoldOut(item: Pick<CatalogItem, 'quantity_in_stock' | 'options'>): boolean {
  return item.options.length > 0
    ? item.options.every((option) => option.quantity_in_stock === 0)
    : item.quantity_in_stock === 0
}

export function lowestOptionPrice(options: readonly CatalogOption[]): number | null {
  return options.length === 0 ? null : Math.min(...options.map((option) => option.price_paise))
}

export function catalogPriceLine(item: Pick<CatalogItem, 'price_paise' | 'price_note' | 'options'>): string {
  const lowest = lowestOptionPrice(item.options)
  if (lowest !== null) return `From ${formatPaise(lowest)}`
  if (item.price_paise !== null) return formatPaise(item.price_paise)
  return item.price_note ?? 'Ask for price'
}

export type CatalogAction =
  | { kind: 'buy'; label: 'Buy' | 'Book'; href: string }
  | { kind: 'sold_out'; label: 'Sold out' }
  | { kind: 'whatsapp'; label: 'Order on WhatsApp' | 'Book on WhatsApp' }
  | { kind: 'none' }

export function catalogItemAction(
  item: Pick<CatalogItem, 'id' | 'type' | 'price_paise' | 'quantity_in_stock' | 'options'>,
  shopMode: ShopMode,
  viewer: { isOwner: boolean; isAdmin: boolean },
  hasContactNumber: boolean,
): CatalogAction {
  const isService = item.type === 'service'
  if (canBuyFromShop(shopMode, viewer) && isBuyable(item)) {
    if (isSoldOut(item)) return { kind: 'sold_out', label: 'Sold out' }
    return { kind: 'buy', label: isService ? 'Book' : 'Buy', href: `/checkout/${item.id}` }
  }
  if (!hasContactNumber) return { kind: 'none' }
  return { kind: 'whatsapp', label: isService ? 'Book on WhatsApp' : 'Order on WhatsApp' }
}

export function catalogWhatsAppHref(
  number: string | null,
  item: Pick<CatalogItem, 'type' | 'name'>,
  priceLine: string,
  itemUrl: string,
): string | null {
  const digits = (number ?? '').replace(/\D/g, '')
  if (!digits) return null
  const message = `Hi! I'm interested in your ${item.type} — *${item.name}* (${priceLine}).\n\nCan you share more details?\n\n${itemUrl}`
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`
}

export function firstAvailableOptionId(options: readonly CatalogOption[]): string | null {
  return options.find((option) => isAvailable(option.quantity_in_stock))?.id ?? null
}

export function orderItemName(name: string, optionLabel: string | null | undefined): string {
  return optionLabel ? `${name} — ${optionLabel}` : name
}

export function orderLineLabel(name: string, optionLabel: string | null | undefined, quantity: number): string {
  return `${orderItemName(name, optionLabel)} ×${quantity}`
}
