import { normalizeServiceImageAspect, type ServiceImageAspect } from '../service-image'
import { MAX_OPTIONS, MAX_PRICE_PAISE, MIN_ONLINE_PRICE_PAISE } from './catalog'
import type { CatalogItemType } from './types'

export const NAME_MAX = 80
export const DESCRIPTION_MAX = 600
export const PRICE_NOTE_MAX = 32
export const OPTION_LABEL_MAX = 40
const STOCK_MAX = 1_000_000

export type PricingMode = 'fixed' | 'options' | 'none'

/** What the item form holds: raw text, exactly as typed. */
export interface CatalogOptionInput {
  id?: string
  label: string
  price: string
  stock: string
}

export interface CatalogItemInput {
  type: CatalogItemType
  name: string
  description: string
  imageUrl: string
  imageAspect: ServiceImageAspect
  pricingMode: PricingMode
  price: string
  stock: string
  priceNote: string
  options: CatalogOptionInput[]
}

/** Clean values ready to write to listing_products and listing_product_options. */
export interface CatalogItemValues {
  type: CatalogItemType
  name: string
  description: string | null
  image_url: string | null
  image_aspect: ServiceImageAspect
  price_paise: number | null
  quantity_in_stock: number | null
  price_note: string | null
  options: { id?: string; label: string; price_paise: number; quantity_in_stock: number | null }[]
}

export type OptionFieldErrors = Partial<Record<'label' | 'price' | 'stock', string>>

export interface CatalogItemErrors {
  name?: string
  price?: string
  stock?: string
  options?: string
  optionRows?: Record<number, OptionFieldErrors>
}

export type CatalogItemValidation =
  | { ok: true; values: CatalogItemValues }
  | { ok: false; errors: CatalogItemErrors }

const PRICE_PATTERN = /^\d+(\.\d{1,2})?$/

export function parsePrice(raw: string): { paise: number } | { error: string } {
  const value = raw.trim().replace(/,/g, '')
  if (!value) return { error: 'Enter a price.' }
  if (!PRICE_PATTERN.test(value)) return { error: 'Enter a price in rupees, like 150 or 99.50.' }
  const paise = Math.round(Number(value) * 100)
  if (paise < MIN_ONLINE_PRICE_PAISE) return { error: 'The price must be at least ₹1.' }
  if (paise > MAX_PRICE_PAISE) return { error: 'The price can be at most ₹1,00,00,000.' }
  return { paise }
}

export function parseStock(raw: string): { stock: number | null } | { error: string } {
  const value = raw.trim()
  if (!value) return { stock: null }
  if (!/^\d+$/.test(value) || Number(value) > STOCK_MAX) {
    return { error: 'Enter stock as a whole number, or leave it blank for no limit.' }
  }
  return { stock: Number(value) }
}

function inlineText(value: string, max: number): string {
  return value.replace(/\s+/g, ' ').trim().slice(0, max).trim()
}

function multilineText(value: string, max: number): string | null {
  const text = value
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => line.replace(/[ \t]+/g, ' ').trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, max)
    .trim()
  return text || null
}

export function validateCatalogItem(input: CatalogItemInput): CatalogItemValidation {
  const errors: CatalogItemErrors = {}

  const name = inlineText(input.name, NAME_MAX)
  if (!name) errors.name = 'Enter a name.'

  const imageUrl = input.imageUrl.trim()
  let price_paise: number | null = null
  let quantity_in_stock: number | null = null
  let price_note: string | null = null
  const options: CatalogItemValues['options'] = []

  if (input.pricingMode === 'fixed') {
    const price = parsePrice(input.price)
    if ('error' in price) errors.price = price.error
    else price_paise = price.paise
    const stock = parseStock(input.stock)
    if ('error' in stock) errors.stock = stock.error
    else quantity_in_stock = stock.stock
  } else if (input.pricingMode === 'options') {
    if (input.options.length === 0) errors.options = 'Add at least one option.'
    else if (input.options.length > MAX_OPTIONS) errors.options = `You can add up to ${MAX_OPTIONS} options.`

    const seenLabels = new Set<string>()
    const optionRows: Record<number, OptionFieldErrors> = {}
    input.options.forEach((row, index) => {
      const rowErrors: OptionFieldErrors = {}
      const label = inlineText(row.label, OPTION_LABEL_MAX)
      if (!label) rowErrors.label = 'Enter a label.'
      else if (seenLabels.has(label.toLowerCase())) rowErrors.label = 'Each option needs a different label.'
      else seenLabels.add(label.toLowerCase())

      const price = parsePrice(row.price)
      if ('error' in price) rowErrors.price = price.error
      const stock = parseStock(row.stock)
      if ('error' in stock) rowErrors.stock = stock.error

      if ('error' in price || 'error' in stock || rowErrors.label) {
        optionRows[index] = rowErrors
        return
      }
      options.push({
        ...(row.id ? { id: row.id } : {}),
        label,
        price_paise: price.paise,
        quantity_in_stock: stock.stock,
      })
    })
    if (Object.keys(optionRows).length > 0) errors.optionRows = optionRows
  } else {
    price_note = inlineText(input.priceNote, PRICE_NOTE_MAX) || null
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors }

  return {
    ok: true,
    values: {
      type: input.type === 'service' ? 'service' : 'product',
      name,
      description: multilineText(input.description, DESCRIPTION_MAX),
      image_url: /^https?:\/\//i.test(imageUrl) ? imageUrl : null,
      image_aspect: normalizeServiceImageAspect(input.imageAspect, 'square'),
      price_paise,
      quantity_in_stock,
      price_note,
      options,
    },
  }
}

function text(value: unknown): string {
  if (typeof value === 'string') return value
  if (typeof value === 'number') return String(value)
  return ''
}

/** Server actions receive untrusted data: shape it before validating. */
export function coerceCatalogItemInput(raw: unknown): CatalogItemInput {
  const source = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const mode = source.pricingMode
  // One extra row survives so validation can still report "up to 6".
  const rows = Array.isArray(source.options) ? source.options.slice(0, MAX_OPTIONS + 1) : []
  return {
    type: source.type === 'service' ? 'service' : 'product',
    name: text(source.name),
    description: text(source.description),
    imageUrl: text(source.imageUrl),
    imageAspect: normalizeServiceImageAspect(source.imageAspect, 'square'),
    pricingMode: mode === 'fixed' || mode === 'options' ? mode : 'none',
    price: text(source.price),
    stock: text(source.stock),
    priceNote: text(source.priceNote),
    options: rows.map((row) => {
      const option = (row && typeof row === 'object' ? row : {}) as Record<string, unknown>
      return {
        ...(typeof option.id === 'string' && option.id ? { id: option.id } : {}),
        label: text(option.label),
        price: text(option.price),
        stock: text(option.stock),
      }
    }),
  }
}
