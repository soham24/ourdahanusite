import assert from 'node:assert/strict'
import test from 'node:test'

import {
  catalogItemAction,
  catalogPriceLine,
  catalogWhatsAppHref,
  firstAvailableOptionId,
  formatPaise,
  isBuyable,
  isSoldOut,
  orderItemName,
  orderLineLabel,
  toCatalogItem,
} from './catalog'
import {
  catalogItemToInput,
  countWithoutOnlinePrice,
  emptyCatalogItemInput,
  managerPriceLine,
  managerStockLine,
  moveId,
  noOnlinePriceHint,
  previewCatalogItem,
} from './manager'
import type { CatalogItem, CatalogOption } from './types'
import { coerceCatalogItemInput, validateCatalogItem, type CatalogItemInput } from './validate'

function option(overrides: Partial<CatalogOption> = {}): CatalogOption {
  return { id: 'o1', label: '500 g', price_paise: 18000, quantity_in_stock: null, sort_order: 0, ...overrides }
}

function item(overrides: Partial<CatalogItem> = {}): CatalogItem {
  return {
    id: 'i1',
    type: 'product',
    name: 'Honey',
    description: null,
    price_paise: 15000,
    price_note: null,
    quantity_in_stock: null,
    image_url: null,
    image_thumb_url: null,
    image_aspect: 'square',
    sort_order: 0,
    options: [],
    ...overrides,
  }
}

function input(overrides: Partial<CatalogItemInput> = {}): CatalogItemInput {
  return { ...emptyCatalogItemInput(), name: 'Honey', price: '150', ...overrides }
}

const visitor = { isOwner: false, isAdmin: false }
const owner = { isOwner: true, isAdmin: false }

test('formatPaise shows rupees the Indian way', () => {
  assert.equal(formatPaise(15000), '₹150')
  assert.equal(formatPaise(37425), '₹374.25')
  assert.equal(formatPaise(139900), '₹1,399')
  assert.equal(formatPaise(10000000), '₹1,00,000')
})

test('catalogPriceLine: fixed price, lowest option, note, or ask', () => {
  assert.equal(catalogPriceLine(item()), '₹150')
  assert.equal(
    catalogPriceLine(item({ price_paise: null, options: [option({ price_paise: 25000 }), option({ id: 'o2', price_paise: 18000 })] })),
    'From ₹180',
  )
  assert.equal(catalogPriceLine(item({ price_paise: null, price_note: 'per kilo' })), 'per kilo')
  assert.equal(catalogPriceLine(item({ price_paise: null })), 'Ask for price')
})

test('isBuyable needs options or a price of at least ₹1', () => {
  assert.equal(isBuyable(item()), true)
  assert.equal(isBuyable(item({ price_paise: 99 })), false)
  assert.equal(isBuyable(item({ price_paise: null })), false)
  assert.equal(isBuyable(item({ price_paise: null, options: [option()] })), true)
})

test('isSoldOut looks at options when there are any', () => {
  assert.equal(isSoldOut(item({ quantity_in_stock: 0 })), true)
  assert.equal(isSoldOut(item({ quantity_in_stock: 3 })), false)
  assert.equal(isSoldOut(item({ price_paise: null, quantity_in_stock: 0, options: [option({ quantity_in_stock: 2 })] })), false)
  assert.equal(
    isSoldOut(item({ price_paise: null, options: [option({ quantity_in_stock: 0 }), option({ id: 'o2', quantity_in_stock: 0 })] })),
    true,
  )
})

test('catalogItemAction: Buy and Book in a live shop', () => {
  assert.deepEqual(catalogItemAction(item(), 'live', visitor, true), { kind: 'buy', label: 'Buy', href: '/checkout/i1' })
  assert.deepEqual(catalogItemAction(item({ type: 'service' }), 'live', visitor, false), {
    kind: 'buy',
    label: 'Book',
    href: '/checkout/i1',
  })
})

test('catalogItemAction: a test shop sells only to its owner', () => {
  assert.equal(catalogItemAction(item(), 'test', owner, true).kind, 'buy')
  assert.deepEqual(catalogItemAction(item(), 'test', visitor, true), { kind: 'whatsapp', label: 'Order on WhatsApp' })
  assert.deepEqual(catalogItemAction(item({ type: 'service' }), 'off', owner, true), { kind: 'whatsapp', label: 'Book on WhatsApp' })
})

test('catalogItemAction: Sold out only ever replaces Buy', () => {
  assert.deepEqual(catalogItemAction(item({ quantity_in_stock: 0 }), 'live', visitor, true), { kind: 'sold_out', label: 'Sold out' })
  assert.deepEqual(
    catalogItemAction(item({ price_paise: null, options: [option({ quantity_in_stock: 0 })] }), 'live', visitor, true),
    { kind: 'sold_out', label: 'Sold out' },
  )
  assert.equal(catalogItemAction(item({ quantity_in_stock: 0 }), 'off', visitor, true).kind, 'whatsapp')
})

test('catalogItemAction: unbuyable items use WhatsApp, or nothing without a number', () => {
  assert.equal(catalogItemAction(item({ price_paise: null, price_note: 'per kilo' }), 'live', visitor, true).kind, 'whatsapp')
  assert.deepEqual(catalogItemAction(item({ price_paise: null }), 'live', visitor, false), { kind: 'none' })
})

test('catalogWhatsAppHref prefills the item and its link', () => {
  const href = catalogWhatsAppHref('+91 98765-43210', item(), '₹150', 'https://farm.ourdahanu.in/p/i1') ?? ''
  assert.ok(href.startsWith('https://wa.me/919876543210?text='))
  assert.equal(
    decodeURIComponent(href.split('?text=')[1] ?? ''),
    "Hi! I'm interested in your product — *Honey* (₹150).\n\nCan you share more details?\n\nhttps://farm.ourdahanu.in/p/i1",
  )
  assert.equal(catalogWhatsAppHref('', item(), '₹150', 'x'), null)
  assert.equal(catalogWhatsAppHref(null, item(), '₹150', 'x'), null)
})

test('firstAvailableOptionId skips sold-out options', () => {
  assert.equal(
    firstAvailableOptionId([option({ id: 'a', quantity_in_stock: 0 }), option({ id: 'b' }), option({ id: 'c', quantity_in_stock: 5 })]),
    'b',
  )
  assert.equal(firstAvailableOptionId([option({ id: 'a', quantity_in_stock: 0 })]), null)
  assert.equal(firstAvailableOptionId([]), null)
})

test('order labels include the option when there is one', () => {
  assert.equal(orderItemName('Honey', '500 g'), 'Honey — 500 g')
  assert.equal(orderItemName('Honey', null), 'Honey')
  assert.equal(orderLineLabel('Honey', '500 g', 2), 'Honey — 500 g ×2')
  assert.equal(orderLineLabel('Honey', null, 1), 'Honey ×1')
})

test('toCatalogItem sorts options and defaults an unknown photo shape to square', () => {
  const shaped = toCatalogItem({
    ...item(),
    image_aspect: 'wide',
    options: [option({ id: 'b', sort_order: 1 }), option({ id: 'a', sort_order: 0 })],
  })
  assert.equal(shaped.image_aspect, 'square')
  assert.deepEqual(shaped.options.map((o) => o.id), ['a', 'b'])
  assert.deepEqual(toCatalogItem({ ...item(), options: null }).options, [])
})

test('validateCatalogItem: one price', () => {
  const result = validateCatalogItem(input({ price: '374.25', stock: '12', description: '  Raw  honey  ' }))
  assert.equal(result.ok, true)
  if (!result.ok) return
  assert.equal(result.values.price_paise, 37425)
  assert.equal(result.values.quantity_in_stock, 12)
  assert.equal(result.values.price_note, null)
  assert.deepEqual(result.values.options, [])
  assert.equal(result.values.description, 'Raw honey')
  assert.equal(result.values.image_aspect, 'square')
  assert.equal(validateCatalogItem(input({ price: '1,399' })).ok, true)
})

test('validateCatalogItem: prices below ₹1, above ₹1 crore and bad numbers are refused', () => {
  const cases: [string, string][] = [
    ['0', 'The price must be at least ₹1.'],
    ['0.50', 'The price must be at least ₹1.'],
    ['', 'Enter a price.'],
    ['12.345', 'Enter a price in rupees, like 150 or 99.50.'],
    ['abc', 'Enter a price in rupees, like 150 or 99.50.'],
    ['10000001', 'The price can be at most ₹1,00,00,000.'],
  ]
  for (const [price, message] of cases) {
    const result = validateCatalogItem(input({ price }))
    assert.equal(result.ok, false, price)
    if (!result.ok) assert.equal(result.errors.price, message, price)
  }
})

test('validateCatalogItem: stock must be a whole number or blank', () => {
  const bad = validateCatalogItem(input({ stock: '2.5' }))
  assert.equal(bad.ok, false)
  if (!bad.ok) assert.equal(bad.errors.stock, 'Enter stock as a whole number, or leave it blank for no limit.')
  const blank = validateCatalogItem(input({ stock: '   ' }))
  assert.equal(blank.ok && blank.values.quantity_in_stock, null)
})

test('validateCatalogItem: a name is required and capped; photo links must be web links', () => {
  const missing = validateCatalogItem(input({ name: '   ' }))
  assert.equal(missing.ok, false)
  if (!missing.ok) assert.equal(missing.errors.name, 'Enter a name.')
  const long = validateCatalogItem(input({ name: 'x'.repeat(100) }))
  assert.equal(long.ok && long.values.name.length, 80)
  const script = validateCatalogItem(input({ imageUrl: 'javascript:alert(1)' }))
  assert.equal(script.ok && script.values.image_url, null)
})

test('validateCatalogItem: options replace the item price and stock', () => {
  const result = validateCatalogItem(
    input({
      pricingMode: 'options',
      price: '150',
      stock: '4',
      options: [
        { id: 'o1', label: '500 g', price: '180', stock: '' },
        { label: '1 kg', price: '340', stock: '3' },
      ],
    }),
  )
  assert.equal(result.ok, true)
  if (!result.ok) return
  assert.equal(result.values.price_paise, null)
  assert.equal(result.values.quantity_in_stock, null)
  assert.deepEqual(result.values.options, [
    { id: 'o1', label: '500 g', price_paise: 18000, quantity_in_stock: null },
    { label: '1 kg', price_paise: 34000, quantity_in_stock: 3 },
  ])
})

test('validateCatalogItem: option rules', () => {
  const none = validateCatalogItem(input({ pricingMode: 'options', options: [] }))
  assert.equal(!none.ok && none.errors.options, 'Add at least one option.')

  const seven = validateCatalogItem(
    input({
      pricingMode: 'options',
      options: Array.from({ length: 7 }, (_, i) => ({ label: `Pack ${i}`, price: '100', stock: '' })),
    }),
  )
  assert.equal(!seven.ok && seven.errors.options, 'You can add up to 6 options.')

  const rows = validateCatalogItem(
    input({
      pricingMode: 'options',
      options: [
        { label: '500 g', price: '180', stock: '' },
        { label: '500 G', price: '0.5', stock: '-1' },
        { label: ' ', price: '100', stock: '' },
      ],
    }),
  )
  assert.equal(rows.ok, false)
  if (rows.ok) return
  assert.deepEqual(rows.errors.optionRows, {
    1: {
      label: 'Each option needs a different label.',
      price: 'The price must be at least ₹1.',
      stock: 'Enter stock as a whole number, or leave it blank for no limit.',
    },
    2: { label: 'Enter a label.' },
  })
})

test('validateCatalogItem: no fixed price keeps only the note', () => {
  const result = validateCatalogItem(
    input({ pricingMode: 'none', price: '150', priceNote: '  Price   on request, call us after 6 pm  ' }),
  )
  assert.equal(result.ok, true)
  if (!result.ok) return
  assert.equal(result.values.price_paise, null)
  assert.equal(result.values.price_note, 'Price on request, call us after')
  const blank = validateCatalogItem(input({ pricingMode: 'none', priceNote: ' ' }))
  assert.equal(blank.ok && blank.values.price_note, null)
})

test('coerceCatalogItemInput turns untrusted data into safe input', () => {
  const coerced = coerceCatalogItemInput({ type: 'service', name: 42, pricingMode: 'weird', options: 'nope', imageAspect: 'portrait' })
  assert.equal(coerced.type, 'service')
  assert.equal(coerced.name, '42')
  assert.equal(coerced.pricingMode, 'none')
  assert.deepEqual(coerced.options, [])
  assert.equal(coerced.imageAspect, 'portrait')
  assert.equal(coerceCatalogItemInput(null).type, 'product')
  const many = coerceCatalogItemInput({ pricingMode: 'options', options: Array.from({ length: 20 }, () => ({ label: 'x' })) })
  assert.equal(many.options.length, 7)
})

test('managerPriceLine and managerStockLine describe each row', () => {
  assert.equal(managerPriceLine(item()), '₹150')
  assert.equal(
    managerPriceLine(item({ price_paise: null, options: [option(), option({ id: 'o2', price_paise: 25000 }), option({ id: 'o3', price_paise: 30000 })] })),
    'From ₹180 · 3 options',
  )
  assert.equal(managerPriceLine(item({ price_paise: null, options: [option()] })), 'From ₹180 · 1 option')
  assert.equal(managerPriceLine(item({ price_paise: null, price_note: 'per kilo' })), 'No fixed price · WhatsApp only')

  assert.equal(managerStockLine(item()), null)
  assert.equal(managerStockLine(item({ quantity_in_stock: 0 })), 'Sold out')
  assert.equal(managerStockLine(item({ quantity_in_stock: 12 })), '12 left')
  assert.equal(managerStockLine(item({ options: [option({ quantity_in_stock: 2 }), option({ id: 'o2', quantity_in_stock: 3 })] })), '5 left')
  assert.equal(managerStockLine(item({ options: [option({ quantity_in_stock: 2 }), option({ id: 'o2' })] })), null)
  assert.equal(managerStockLine(item({ options: [option({ quantity_in_stock: 0 })] })), 'Sold out')
})

test('moveId swaps neighbours and ignores moves past the ends', () => {
  assert.deepEqual(moveId(['a', 'b', 'c'], 'b', 'up'), ['b', 'a', 'c'])
  assert.deepEqual(moveId(['a', 'b', 'c'], 'b', 'down'), ['a', 'c', 'b'])
  assert.deepEqual(moveId(['a', 'b', 'c'], 'a', 'up'), ['a', 'b', 'c'])
  assert.deepEqual(moveId(['a', 'b', 'c'], 'c', 'down'), ['a', 'b', 'c'])
  assert.deepEqual(moveId(['a', 'b'], 'zzz', 'up'), ['a', 'b'])
})

test('noOnlinePriceHint counts visible items customers cannot buy', () => {
  const items = [
    { ...item({ price_paise: null }), is_active: true },
    { ...item({ price_paise: null }), is_active: false },
    { ...item(), is_active: true },
  ]
  assert.equal(countWithoutOnlinePrice(items), 1)
  assert.equal(
    noOnlinePriceHint(1),
    '1 item has no fixed price. Customers can only ask about it on WhatsApp. Add a price to sell it online.',
  )
  assert.equal(
    noOnlinePriceHint(3),
    '3 items have no fixed price. Customers can only ask about them on WhatsApp. Add a price to sell them online.',
  )
})

test('catalogItemToInput round-trips through validation', () => {
  const original = item({
    price_paise: null,
    options: [option({ id: 'o1', price_paise: 37425, quantity_in_stock: 4 })],
    description: 'Raw honey',
    image_url: 'https://x.test/h.jpg',
    image_aspect: 'portrait',
  })
  const form = catalogItemToInput(original)
  assert.equal(form.pricingMode, 'options')
  assert.deepEqual(form.options, [{ id: 'o1', label: '500 g', price: '374.25', stock: '4' }])
  const result = validateCatalogItem(form)
  assert.equal(result.ok, true)
  if (!result.ok) return
  assert.deepEqual(result.values.options, [{ id: 'o1', label: '500 g', price_paise: 37425, quantity_in_stock: 4 }])
  assert.equal(result.values.image_aspect, 'portrait')
  assert.equal(catalogItemToInput(item({ price_paise: null, price_note: 'per kilo' })).pricingMode, 'none')
  assert.equal(catalogItemToInput(item()).pricingMode, 'fixed')
})

test('previewCatalogItem shows what customers will see before saving', () => {
  const preview = previewCatalogItem(
    input({
      pricingMode: 'options',
      options: [
        { label: '500 g', price: '180', stock: '0' },
        { label: '', price: '99', stock: '' },
      ],
    }),
  )
  assert.equal(preview.name, 'Honey')
  assert.equal(preview.options.length, 1)
  assert.equal(catalogPriceLine(preview), 'From ₹180')
  assert.equal(isSoldOut(preview), true)
  assert.equal(previewCatalogItem(input({ name: '' })).name, 'Item name')
})
