'use client'

import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react'

import { MAX_OPTIONS } from '@/lib/catalog/catalog'
import { OPTION_LABEL_MAX, type CatalogOptionInput, type OptionFieldErrors } from '@/lib/catalog/validate'

const errorCls = 'mt-1 text-xs font-semibold text-[var(--od-danger)]'
const smallIcon =
  'inline-flex h-10 w-10 items-center justify-center rounded-lg text-[var(--od-muted)] transition-colors hover:bg-[var(--od-surface-soft)] hover:text-[var(--od-brand)] disabled:opacity-40'

export default function OptionsEditor({
  options,
  onChange,
  error,
  rowErrors,
}: {
  options: CatalogOptionInput[]
  onChange: (next: CatalogOptionInput[]) => void
  error?: string
  rowErrors?: Record<number, OptionFieldErrors>
}) {
  const updateRow = (index: number, patch: Partial<CatalogOptionInput>) =>
    onChange(options.map((row, i) => (i === index ? { ...row, ...patch } : row)))

  const moveRow = (index: number, direction: -1 | 1) => {
    const target = index + direction
    if (target < 0 || target >= options.length) return
    const next = [...options]
    ;[next[index], next[target]] = [next[target], next[index]]
    onChange(next)
  }

  return (
    <div>
      <p className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.04em] text-[var(--od-muted)]">Options</p>
      <ul className="space-y-3">
        {options.map((row, index) => {
          const rowError = rowErrors?.[index]
          return (
            <li key={row.id ?? `new-${index}`} className="rounded-xl border border-[var(--od-border)] bg-white p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold text-[var(--od-muted)]">Option {index + 1}</span>
                <div className="flex">
                  <button type="button" onClick={() => moveRow(index, -1)} disabled={index === 0} aria-label={`Move option ${index + 1} up`} className={smallIcon}>
                    <ArrowUp size={15} aria-hidden />
                  </button>
                  <button type="button" onClick={() => moveRow(index, 1)} disabled={index === options.length - 1} aria-label={`Move option ${index + 1} down`} className={smallIcon}>
                    <ArrowDown size={15} aria-hidden />
                  </button>
                  <button type="button" onClick={() => onChange(options.filter((_, i) => i !== index))} aria-label={`Remove option ${index + 1}`} className={smallIcon}>
                    <Trash2 size={15} aria-hidden />
                  </button>
                </div>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-[1fr_7rem_7rem]">
                <div className="col-span-2 sm:col-span-1">
                  <label htmlFor={`option-label-${index}`} className="sr-only">Option {index + 1} label</label>
                  <input
                    id={`option-label-${index}`}
                    value={row.label}
                    maxLength={OPTION_LABEL_MAX}
                    onChange={(event) => updateRow(index, { label: event.target.value })}
                    placeholder="e.g. 500 g"
                    className="od-input w-full px-3.5 py-2.5 text-sm"
                  />
                  {rowError?.label && <p role="alert" className={errorCls}>{rowError.label}</p>}
                </div>
                <div>
                  <label htmlFor={`option-price-${index}`} className="sr-only">Option {index + 1} price in rupees</label>
                  <input
                    id={`option-price-${index}`}
                    inputMode="decimal"
                    value={row.price}
                    onChange={(event) => updateRow(index, { price: event.target.value })}
                    placeholder="Price ₹"
                    className="od-input w-full px-3.5 py-2.5 text-sm"
                  />
                  {rowError?.price && <p role="alert" className={errorCls}>{rowError.price}</p>}
                </div>
                <div>
                  <label htmlFor={`option-stock-${index}`} className="sr-only">Option {index + 1} stock</label>
                  <input
                    id={`option-stock-${index}`}
                    inputMode="numeric"
                    value={row.stock}
                    onChange={(event) => updateRow(index, { stock: event.target.value })}
                    placeholder="Stock"
                    className="od-input w-full px-3.5 py-2.5 text-sm"
                  />
                  {rowError?.stock && <p role="alert" className={errorCls}>{rowError.stock}</p>}
                </div>
              </div>
            </li>
          )
        })}
      </ul>
      {error && <p role="alert" className={errorCls}>{error}</p>}
      {options.length < MAX_OPTIONS ? (
        <button
          type="button"
          onClick={() => onChange([...options, { label: '', price: '', stock: '' }])}
          className="od-button-secondary mt-3 min-h-11 w-full text-sm"
        >
          <Plus size={15} aria-hidden />
          Add option
        </button>
      ) : (
        <p className="od-muted mt-2 text-xs">You can add up to {MAX_OPTIONS} options.</p>
      )}
      <p className="od-muted mt-2 text-xs">Leave stock blank for no limit.</p>
    </div>
  )
}
