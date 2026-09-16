import { formatPaise, isBuyable, lowestOptionPrice } from './catalog'
import type { CatalogItem } from './types'
import { parsePrice, parseStock, type CatalogItemInput } from './validate'

export function managerPriceLine(item: Pick<CatalogItem, 'price_paise' | 'options'>): string {
  const lowest = lowestOptionPrice(item.options)
  if (lowest !== null) {
    const count = item.options.length
    return `From ${formatPaise(lowest)} · ${count} ${count === 1 ? 'option' : 'options'}`
  }
  if (item.price_paise !== null) return formatPaise(item.price_paise)
  return 'No fixed price · WhatsApp only'
}

export function managerStockLine(item: Pick<CatalogItem, 'quantity_in_stock' | 'options'>): string | null {
  if (item.options.length > 0) {
    if (item.options.every((option) => option.quantity_in_stock === 0)) return 'Sold out'
    if (item.options.some((option) => option.quantity_in_stock === null)) return null
    const total = item.options.reduce((sum, option) => sum + (option.quantity_in_stock ?? 0), 0)
    return `${total} left`
  }
  if (item.quantity_in_stock === null) return null
  return item.quantity_in_stock === 0 ? 'Sold out' : `${item.quantity_in_stock} left`
}

export function moveId(ids: readonly string[], id: string, direction: 'up' | 'down'): string[] {
  const index = ids.indexOf(id)
  const target = direction === 'up' ? index - 1 : index + 1
  const next = [...ids]
  if (index < 0 || target < 0 || target >= ids.length) return next
  ;[next[index], next[target]] = [next[target], next[index]]
  return next
}

export function countWithoutOnlinePrice(
  items: readonly { is_active: boolean; price_paise: number | null; options: readonly unknown[] }[],
): number {
  return items.filter((item) => item.is_active && !isBuyable(item)).length
}

export function noOnlinePriceHint(count: number): string {
  return count === 1
    ? '1 item has no fixed price. Customers can only ask about it on WhatsApp. Add a price to sell it online.'
    : `${count} items have no fixed price. Customers can only ask about them on WhatsApp. Add a price to sell them online.`
}

export function emptyCatalogItemInput(): CatalogItemInput {
  return {
    type: 'product',
    name: '',
    description: '',
    imageUrl: '',
    imageAspect: 'square',
    pricingMode: 'fixed',
    price: '',
    stock: '',
    priceNote: '',
    options: [],
  }
}

const rupees = (paise: number) => String(paise / 100)
const stockText = (stock: number | null) => (stock === null ? '' : String(stock))

export function catalogItemToInput(item: CatalogItem): CatalogItemInput {
  return {
    type: item.type,
    name: item.name,
    description: item.description ?? '',
    imageUrl: item.image_url ?? '',
    imageAspect: item.image_aspect,
    pricingMode: item.options.length > 0 ? 'options' : item.price_paise !== null ? 'fixed' : 'none',
    price: item.price_paise !== null ? rupees(item.price_paise) : '',
    stock: stockText(item.quantity_in_stock),
    priceNote: item.price_note ?? '',
    options: item.options.map((option) => ({
      id: option.id,
      label: option.label,
      price: rupees(option.price_paise),
      stock: stockText(option.quantity_in_stock),
    })),
  }
}

/** The customer card for unsaved form values; rows that are not valid yet are left out. */
export function previewCatalogItem(input: CatalogItemInput, id = 'preview'): CatalogItem {
  const price = input.pricingMode === 'fixed' ? parsePrice(input.price) : null
  const stock = input.pricingMode === 'fixed' ? parseStock(input.stock) : null
  const options =
    input.pricingMode === 'options'
      ? input.options.flatMap((row, index) => {
          const optionPrice = parsePrice(row.price)
          const optionStock = parseStock(row.stock)
          const label = row.label.trim()
          if (!label || 'error' in optionPrice) return []
          return [
            {
              id: row.id ?? `${id}-option-${index}`,
              label,
              price_paise: optionPrice.paise,
              quantity_in_stock: 'error' in optionStock ? null : optionStock.stock,
              sort_order: index,
            },
          ]
        })
      : []

  return {
    id,
    type: input.type,
    name: input.name.trim() || 'Item name',
    description: input.description.trim() || null,
    price_paise: price && !('error' in price) ? price.paise : null,
    price_note: input.pricingMode === 'none' ? input.priceNote.trim() || null : null,
    quantity_in_stock: stock && !('error' in stock) ? stock.stock : null,
    image_url: input.imageUrl || null,
    image_thumb_url: input.imageUrl || null,
    image_aspect: input.imageAspect,
    sort_order: 0,
    options,
  }
}
