'use client'

import { useEffect, useState, useTransition } from 'react'
import { Loader2, X } from 'lucide-react'

import { createCatalogItem, updateCatalogItem } from '@/app/actions/catalog'
import CatalogItemCard from '@/components/catalog/CatalogItemCard'
import CompactImageUpload from '@/components/CompactImageUpload'
import { catalogItemAction, catalogPriceLine, catalogWhatsAppHref } from '@/lib/catalog/catalog'
import { catalogItemToInput, emptyCatalogItemInput, previewCatalogItem } from '@/lib/catalog/manager'
import type { OwnerCatalogItem } from '@/lib/catalog/types'
import {
  DESCRIPTION_MAX,
  NAME_MAX,
  PRICE_NOTE_MAX,
  validateCatalogItem,
  type CatalogItemInput,
  type PricingMode,
} from '@/lib/catalog/validate'
import type { ShopMode } from '@/lib/selling/shop-mode'

import OptionsEditor from './OptionsEditor'

const labelCls = 'mb-1.5 block text-[11px] font-bold uppercase tracking-[0.04em] text-[var(--od-muted)]'
const inputCls = 'od-input w-full px-3.5 py-2.5 text-sm'
const errorCls = 'mt-1 text-xs font-semibold text-[var(--od-danger)]'

const PRICING_CHOICES: { value: PricingMode; title: string; hint: string }[] = [
  { value: 'fixed', title: 'One price', hint: 'Customers can buy it online.' },
  { value: 'options', title: 'Options', hint: 'Sizes or packs, each with its own price.' },
  { value: 'none', title: 'No fixed price', hint: 'Customers ask you on WhatsApp.' },
]

function previewNote(shopMode: ShopMode): string {
  return shopMode === 'live'
    ? 'Your shop is live, so customers can buy items that have a price.'
    : 'Customers see WhatsApp buttons until you sell online with live Razorpay keys.'
}

function Field({
  label,
  htmlFor,
  hint,
  error,
  children,
}: {
  label: string
  htmlFor?: string
  hint?: string
  error?: string
  children: React.ReactNode
}) {
  return (
    <div>
      {htmlFor ? (
        <label htmlFor={htmlFor} className={labelCls}>{label}</label>
      ) : (
        <p className={labelCls}>{label}</p>
      )}
      {children}
      {error ? (
        <p role="alert" className={errorCls}>{error}</p>
      ) : hint ? (
        <p className="od-muted mt-1 text-xs">{hint}</p>
      ) : null}
    </div>
  )
}

export default function ItemSheet({
  listingId,
  shopMode,
  whatsappNumber,
  item,
  onClose,
  onSaved,
}: {
  listingId: string
  shopMode: ShopMode
  whatsappNumber: string | null
  item: OwnerCatalogItem | null
  onClose: () => void
  onSaved: (item: OwnerCatalogItem, error: string | null) => void
}) {
  const [input, setInput] = useState<CatalogItemInput>(() => (item ? catalogItemToInput(item) : emptyCatalogItemInput()))
  const [tab, setTab] = useState<'details' | 'preview'>('details')
  const [touched, setTouched] = useState<Partial<Record<keyof CatalogItemInput, boolean>>>({})
  const [submitted, setSubmitted] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [isSaving, startSaving] = useTransition()

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isSaving) onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isSaving, onClose])

  const validation = validateCatalogItem(input)
  const errors = validation.ok ? {} : validation.errors
  const show = (key: keyof CatalogItemInput) => submitted || touched[key] === true

  const update = <K extends keyof CatalogItemInput>(key: K, value: CatalogItemInput[K]) => {
    setInput((previous) => ({ ...previous, [key]: value }))
    setTouched((previous) => ({ ...previous, [key]: true }))
  }

  const choosePricing = (mode: PricingMode) => {
    setInput((previous) => ({
      ...previous,
      pricingMode: mode,
      // Start the options list with one row, carrying over a price already typed.
      options:
        mode === 'options' && previous.options.length === 0
          ? [{ label: '', price: previous.price, stock: '' }]
          : previous.options,
    }))
  }

  const handleSave = () => {
    setSubmitted(true)
    setSaveError(null)
    if (!validation.ok) {
      setTab('details')
      return
    }
    startSaving(async () => {
      const result = item ? await updateCatalogItem(item.id, input) : await createCatalogItem(listingId, input)
      if (result.item) {
        onSaved(result.item, result.error ?? null)
        return
      }
      setSaveError(result.error ?? 'Could not save the item. Please try again.')
    })
  }

  const preview = previewCatalogItem(input, item?.id ?? 'preview')
  const previewAction = catalogItemAction(preview, shopMode, { isOwner: false, isAdmin: false }, Boolean(whatsappNumber))
  const previewWhatsApp =
    previewAction.kind === 'whatsapp' ? catalogWhatsAppHref(whatsappNumber, preview, catalogPriceLine(preview), '') : null

  return (
    <div
      className="fixed inset-0 z-[60] flex h-[100dvh] justify-end bg-black/40"
      onClick={(event) => {
        if (event.target === event.currentTarget && !isSaving) onClose()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="item-sheet-title"
        className="flex h-full max-h-[100dvh] w-full flex-col bg-[var(--od-surface-soft)] md:max-w-lg md:shadow-2xl"
      >
        <header className="flex items-center justify-between gap-3 border-b border-[var(--od-border)] bg-white px-4 py-3">
          <h2 id="item-sheet-title" className="text-base font-extrabold text-[var(--od-ink)]">
            {item ? 'Edit item' : 'Add item'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            aria-label="Close"
            className="inline-flex h-10 w-10 items-center justify-center rounded-full text-[var(--od-muted)] hover:bg-[var(--od-surface-soft)]"
          >
            <X size={18} aria-hidden />
          </button>
        </header>

        <div role="tablist" className="grid grid-cols-2 gap-1 border-b border-[var(--od-border)] bg-white px-4 py-2">
          {(['details', 'preview'] as const).map((value) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={tab === value}
              onClick={() => setTab(value)}
              className={`min-h-10 rounded-lg text-sm font-bold ${
                tab === value ? 'bg-[var(--od-surface-soft)] text-[var(--od-brand-strong)]' : 'text-[var(--od-muted)]'
              }`}
            >
              {value === 'details' ? 'Details' : 'How customers see it'}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4">
          {tab === 'details' ? (
            <div className="space-y-5">
              <Field label="Type">
                <div className="grid grid-cols-2 gap-2">
                  {(['product', 'service'] as const).map((type) => (
                    <button
                      key={type}
                      type="button"
                      aria-pressed={input.type === type}
                      onClick={() => update('type', type)}
                      className={`min-h-11 rounded-xl border text-sm font-bold ${
                        input.type === type
                          ? 'border-[var(--od-brand)] bg-[rgba(192,88,46,0.06)] text-[var(--od-brand-strong)]'
                          : 'border-[var(--od-border)] bg-white text-[var(--od-ink-2)]'
                      }`}
                    >
                      {type === 'product' ? 'Product' : 'Service'}
                    </button>
                  ))}
                </div>
              </Field>

              <Field label="Name" htmlFor="item-name" error={show('name') ? errors.name : undefined}>
                <input
                  id="item-name"
                  value={input.name}
                  maxLength={NAME_MAX}
                  onChange={(event) => update('name', event.target.value)}
                  placeholder={input.type === 'service' ? 'e.g. Home cleaning, 2 hours' : 'e.g. Alphonso mangoes, 1 dozen'}
                  className={inputCls}
                />
              </Field>

              <Field label="Description (optional)" htmlFor="item-description" hint={`${input.description.length}/${DESCRIPTION_MAX}`}>
                <textarea
                  id="item-description"
                  value={input.description}
                  maxLength={DESCRIPTION_MAX}
                  rows={6}
                  onChange={(event) => update('description', event.target.value)}
                  className={`${inputCls} min-h-32 resize-y`}
                />
              </Field>

              <Field label="Photo (optional)">
                <CompactImageUpload
                  value={input.imageUrl}
                  aspect={input.imageAspect}
                  onUpload={(url) => update('imageUrl', url)}
                  onClear={() => update('imageUrl', '')}
                  onAspectChange={(aspect) => update('imageAspect', aspect)}
                />
              </Field>

              <Field label="Pricing">
                <div className="space-y-2">
                  {PRICING_CHOICES.map((choice) => (
                    <label
                      key={choice.value}
                      className={`flex min-h-12 cursor-pointer items-start gap-3 rounded-xl border px-3.5 py-3 ${
                        input.pricingMode === choice.value
                          ? 'border-[var(--od-brand)] bg-[rgba(192,88,46,0.06)]'
                          : 'border-[var(--od-border)] bg-white'
                      }`}
                    >
                      <input
                        type="radio"
                        name="pricing"
                        checked={input.pricingMode === choice.value}
                        onChange={() => choosePricing(choice.value)}
                        className="mt-0.5 h-4 w-4 accent-[var(--od-brand)]"
                      />
                      <span>
                        <span className="block text-sm font-bold text-[var(--od-ink)]">{choice.title}</span>
                        <span className="od-muted block text-xs">{choice.hint}</span>
                      </span>
                    </label>
                  ))}
                </div>
              </Field>

              {input.pricingMode === 'fixed' && (
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Price (₹)" htmlFor="item-price" error={show('price') ? errors.price : undefined}>
                    <input
                      id="item-price"
                      inputMode="decimal"
                      value={input.price}
                      onChange={(event) => update('price', event.target.value)}
                      placeholder="150"
                      className={inputCls}
                    />
                  </Field>
                  <Field
                    label="Stock (optional)"
                    htmlFor="item-stock"
                    hint="Blank means no limit"
                    error={show('stock') ? errors.stock : undefined}
                  >
                    <input
                      id="item-stock"
                      inputMode="numeric"
                      value={input.stock}
                      onChange={(event) => update('stock', event.target.value)}
                      placeholder="No limit"
                      className={inputCls}
                    />
                  </Field>
                </div>
              )}

              {input.pricingMode === 'options' && (
                <OptionsEditor
                  options={input.options}
                  onChange={(next) => update('options', next)}
                  error={show('options') ? errors.options : undefined}
                  rowErrors={show('options') ? errors.optionRows : undefined}
                />
              )}

              {input.pricingMode === 'none' && (
                <Field label="Price note (optional)" htmlFor="item-price-note" hint="e.g. per kilo, or Price on request">
                  <input
                    id="item-price-note"
                    value={input.priceNote}
                    maxLength={PRICE_NOTE_MAX}
                    onChange={(event) => update('priceNote', event.target.value)}
                    className={inputCls}
                  />
                </Field>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {/* inert: the preview's buttons and links must not work */}
              <div inert className="mx-auto max-w-sm">
                <CatalogItemCard
                  item={preview}
                  action={previewAction}
                  whatsappHref={previewWhatsApp}
                  shareUrl={null}
                  collapsible={false}
                />
              </div>
              <p className="od-muted text-center text-xs">{previewNote(shopMode)}</p>
            </div>
          )}
        </div>

        <footer
          className="space-y-2 border-t border-[var(--od-border)] bg-white px-4 py-3"
          style={{ paddingBottom: `calc(0.75rem + env(safe-area-inset-bottom, 0px))` }}
        >
          {saveError && <p role="alert" className={errorCls}>{saveError}</p>}
          <div className="flex gap-3">
            <button type="button" onClick={onClose} disabled={isSaving} className="od-button-secondary min-h-12 px-4 text-sm">
              Cancel
            </button>
            <button type="button" onClick={handleSave} disabled={isSaving} className="od-button-primary min-h-12 flex-1 text-sm disabled:opacity-60">
              {isSaving && <Loader2 size={15} className="animate-spin" aria-hidden />}
              {item ? 'Save changes' : 'Add item'}
            </button>
          </div>
        </footer>
      </div>
    </div>
  )
}
