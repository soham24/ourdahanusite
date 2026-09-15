'use client'

import { useState, useTransition } from 'react'
import { ArrowDown, ArrowUp, Package, Pencil, Plus, Trash2, Wrench } from 'lucide-react'

import { deleteCatalogItem, moveCatalogItems, setCatalogItemVisible } from '@/app/actions/catalog'
import {
  countWithoutOnlinePrice,
  managerPriceLine,
  managerStockLine,
  moveId,
  noOnlinePriceHint,
} from '@/lib/catalog/manager'
import type { OwnerCatalogItem } from '@/lib/catalog/types'
import type { ShopMode } from '@/lib/selling/shop-mode'
import { getServiceImageAspectOption } from '@/lib/service-image'

import ItemSheet from './ItemSheet'

type SheetState = { kind: 'closed' } | { kind: 'new' } | { kind: 'edit'; itemId: string }

const iconButton =
  'inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--od-border)] bg-white text-[var(--od-ink-2)] transition-colors hover:border-[var(--od-brand)] hover:text-[var(--od-brand)] disabled:opacity-40 disabled:hover:border-[var(--od-border)] disabled:hover:text-[var(--od-ink-2)]'

export function ProductsManager({
  listingId,
  shopMode,
  whatsappNumber,
  initialItems,
}: {
  listingId: string
  shopMode: ShopMode
  whatsappNumber: string | null
  initialItems: OwnerCatalogItem[]
}) {
  const [items, setItems] = useState(initialItems)
  const [sheet, setSheet] = useState<SheetState>({ kind: 'closed' })
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({})
  const [, startTransition] = useTransition()

  const setRowError = (itemId: string, message: string | null) =>
    setRowErrors((previous) => {
      const next = { ...previous }
      if (message) next[itemId] = message
      else delete next[itemId]
      return next
    })

  const upsertItem = (item: OwnerCatalogItem) =>
    setItems((previous) =>
      previous.some((existing) => existing.id === item.id)
        ? previous.map((existing) => (existing.id === item.id ? item : existing))
        : [...previous, item],
    )

  const handleMove = (itemId: string, direction: 'up' | 'down') => {
    const previous = items
    const nextIds = moveId(items.map((item) => item.id), itemId, direction)
    const byId = new Map(items.map((item) => [item.id, item]))
    setItems(nextIds.flatMap((id) => byId.get(id) ?? []))
    setRowError(itemId, null)
    startTransition(async () => {
      const result = await moveCatalogItems(listingId, nextIds)
      if (result.error) {
        setItems(previous)
        setRowError(itemId, result.error)
      }
    })
  }

  const handleVisible = (item: OwnerCatalogItem) => {
    const visible = !item.is_active
    upsertItem({ ...item, is_active: visible })
    setRowError(item.id, null)
    startTransition(async () => {
      const result = await setCatalogItemVisible(item.id, visible)
      if (result.item) upsertItem(result.item)
      if (result.error) {
        upsertItem(item)
        setRowError(item.id, result.error)
      }
    })
  }

  const handleDelete = (item: OwnerCatalogItem) => {
    if (!window.confirm(`Delete "${item.name}"? This can't be undone.`)) return
    const previous = items
    setItems(items.filter((existing) => existing.id !== item.id))
    startTransition(async () => {
      const result = await deleteCatalogItem(item.id)
      if (result.error) {
        setItems(previous)
        setRowError(item.id, result.error)
      }
    })
  }

  const handleSaved = (item: OwnerCatalogItem, error: string | null) => {
    upsertItem(item)
    setRowError(item.id, error)
    setSheet({ kind: 'closed' })
  }

  const withoutPrice = countWithoutOnlinePrice(items)
  const editing = sheet.kind === 'edit' ? items.find((item) => item.id === sheet.itemId) ?? null : null

  return (
    <div className="space-y-4">
      {items.length > 0 && (
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-bold text-[var(--od-ink)]">
            {items.length} {items.length === 1 ? 'item' : 'items'}
          </p>
          <button type="button" onClick={() => setSheet({ kind: 'new' })} className="od-button-primary min-h-11 px-4 text-sm">
            <Plus size={16} aria-hidden />
            Add item
          </button>
        </div>
      )}

      {withoutPrice > 0 && (
        <p
          role="note"
          className="rounded-xl border border-[rgba(200,136,30,0.35)] bg-[rgba(200,136,30,0.07)] px-3.5 py-2.5 text-[13px] leading-relaxed text-[var(--od-ink-2)]"
        >
          {noOnlinePriceHint(withoutPrice)}
        </p>
      )}

      {items.length === 0 ? (
        <section className="od-card flex flex-col items-center p-8 text-center">
          <Package size={32} className="text-[var(--od-muted)]" aria-hidden />
          <p className="mt-3 text-base font-bold text-[var(--od-ink)]">No items yet</p>
          <p className="od-muted mt-1 text-sm">Add what you sell or offer. Customers see it on your business page.</p>
          <button type="button" onClick={() => setSheet({ kind: 'new' })} className="od-button-primary mt-5 min-h-12 px-5 text-sm">
            <Plus size={16} aria-hidden />
            Add your first item
          </button>
        </section>
      ) : (
        <ul className="space-y-3">
          {items.map((item, index) => {
            const aspect = getServiceImageAspectOption(item.image_aspect, 'square')
            const imageUrl = item.image_url || item.image_thumb_url
            const stock = managerStockLine(item)
            return (
              <li key={item.id} className="od-card p-3.5">
                <div className={`flex gap-3 ${item.is_active ? '' : 'opacity-60'}`}>
                  <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-[var(--od-surface-soft)] text-[var(--od-muted)]">
                    {imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={imageUrl}
                        alt=""
                        style={{ width: aspect.thumbnailWidth, height: aspect.thumbnailHeight }}
                        className="rounded-lg object-cover"
                      />
                    ) : item.type === 'service' ? (
                      <Wrench size={22} aria-hidden />
                    ) : (
                      <Package size={22} aria-hidden />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <p className="min-w-0 truncate font-bold text-[var(--od-ink)]">{item.name}</p>
                      <span className="rounded-full bg-[var(--od-surface-soft)] px-2 py-0.5 text-[11px] font-bold text-[var(--od-brand-strong)]">
                        {item.type === 'service' ? 'Service' : 'Product'}
                      </span>
                      {!item.is_active && (
                        <span className="rounded-full border border-[var(--od-border)] px-2 py-0.5 text-[11px] font-bold text-[var(--od-muted)]">
                          Hidden
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-sm font-semibold text-[var(--od-ink-2)]">{managerPriceLine(item)}</p>
                    {stock && <p className="od-muted text-xs">{stock}</p>}
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-[var(--od-border)] pt-3">
                  <label className="mr-auto inline-flex min-h-10 cursor-pointer items-center gap-2 text-sm font-semibold text-[var(--od-ink-2)]">
                    <input
                      type="checkbox"
                      role="switch"
                      checked={item.is_active}
                      onChange={() => handleVisible(item)}
                      className="h-5 w-5 accent-[var(--od-brand)]"
                    />
                    Visible
                  </label>
                  <button
                    type="button"
                    onClick={() => handleMove(item.id, 'up')}
                    disabled={index === 0}
                    aria-label={`Move ${item.name} up`}
                    className={iconButton}
                  >
                    <ArrowUp size={16} aria-hidden />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleMove(item.id, 'down')}
                    disabled={index === items.length - 1}
                    aria-label={`Move ${item.name} down`}
                    className={iconButton}
                  >
                    <ArrowDown size={16} aria-hidden />
                  </button>
                  <button
                    type="button"
                    onClick={() => setSheet({ kind: 'edit', itemId: item.id })}
                    className="od-button-secondary min-h-10 px-3 text-sm"
                  >
                    <Pencil size={14} aria-hidden />
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(item)}
                    aria-label={`Delete ${item.name}`}
                    className={`${iconButton} hover:!text-red-600`}
                  >
                    <Trash2 size={16} aria-hidden />
                  </button>
                </div>

                {rowErrors[item.id] && (
                  <p role="alert" className="mt-2 text-xs font-semibold text-[var(--color-danger-strong,#a33)]">
                    {rowErrors[item.id]}
                  </p>
                )}
              </li>
            )
          })}
        </ul>
      )}

      {sheet.kind !== 'closed' && (
        <ItemSheet
          key={sheet.kind === 'edit' ? sheet.itemId : 'new'}
          listingId={listingId}
          shopMode={shopMode}
          whatsappNumber={whatsappNumber}
          item={editing}
          onClose={() => setSheet({ kind: 'closed' })}
          onSaved={handleSaved}
        />
      )}
    </div>
  )
}
