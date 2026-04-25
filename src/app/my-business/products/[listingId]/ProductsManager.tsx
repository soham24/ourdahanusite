'use client'

import { useState, useTransition } from 'react'
import {
  Edit2,
  EyeOff,
  GripVertical,
  Loader2,
  Package,
  Plus,
  Trash2,
  Wrench,
  X,
} from 'lucide-react'

import {
  createProduct,
  deleteProduct,
  reorderProducts,
  toggleProductActive,
  updateProduct,
  type ListingProduct,
  type ProductType,
} from '@/app/actions/products'
import ImageCropUpload from '@/components/ImageCropUpload'

type Mode =
  | { kind: 'idle' }
  | { kind: 'creating' }
  | { kind: 'editing'; productId: string }

function formatPrice(paise: number): string {
  return `₹${(paise / 100).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`
}

function stockLabel(product: ListingProduct): string {
  if (product.quantity_in_stock === null) return 'Unlimited'
  if (product.quantity_in_stock === 0) return 'Out of stock'
  return `${product.quantity_in_stock} in stock`
}

export function ProductsManager({
  listingId,
  initialProducts,
}: {
  listingId: string
  initialProducts: ListingProduct[]
}) {
  const [products, setProducts] = useState<ListingProduct[]>(initialProducts)
  const [mode, setMode] = useState<Mode>({ kind: 'idle' })
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [dragIndex, setDragIndex] = useState<number | null>(null)

  const editingProduct =
    mode.kind === 'editing' ? products.find((p) => p.id === mode.productId) ?? null : null

  const handleAfterMutation = (msg: string) => {
    setSuccessMessage(msg)
    setError(null)
    setMode({ kind: 'idle' })
  }

  const handleSubmit = (formData: FormData) => {
    setError(null)
    setSuccessMessage(null)

    if (mode.kind === 'creating') {
      formData.set('listing_id', listingId)
      startTransition(async () => {
        const res = await createProduct(formData)
        if (res.error) {
          setError(res.error)
          return
        }
        // Refresh products by refetching from server via full reload of list
        location.reload()
      })
      return
    }

    if (mode.kind === 'editing') {
      startTransition(async () => {
        const res = await updateProduct(mode.productId, formData)
        if (res.error) {
          setError(res.error)
          return
        }
        handleAfterMutation('Product updated.')
        location.reload()
      })
    }
  }

  const handleDelete = (product: ListingProduct) => {
    if (!confirm(`Delete "${product.name}"? This cannot be undone.`)) return
    setError(null)
    setSuccessMessage(null)
    startTransition(async () => {
      const res = await deleteProduct(product.id)
      if (res.error) {
        setError(res.error)
        return
      }
      setProducts((prev) => prev.filter((p) => p.id !== product.id))
      setSuccessMessage('Product deleted.')
    })
  }

  const handleToggleActive = (product: ListingProduct) => {
    const nextActive = !product.is_active
    setError(null)
    setSuccessMessage(null)
    startTransition(async () => {
      const res = await toggleProductActive(product.id, nextActive)
      if (res.error) {
        setError(res.error)
        return
      }
      setProducts((prev) =>
        prev.map((p) => (p.id === product.id ? { ...p, is_active: nextActive } : p)),
      )
    })
  }

  const handleDrop = (targetIndex: number) => {
    if (dragIndex === null || dragIndex === targetIndex) {
      setDragIndex(null)
      return
    }
    const reordered = [...products]
    const [moved] = reordered.splice(dragIndex, 1)
    reordered.splice(targetIndex, 0, moved)
    setProducts(reordered)
    setDragIndex(null)

    startTransition(async () => {
      const res = await reorderProducts(
        listingId,
        reordered.map((p) => p.id),
      )
      if (res.error) setError(res.error)
    })
  }

  return (
    <div className="space-y-5">
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {successMessage && (
        <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          {successMessage}
        </div>
      )}

      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-bold text-[#2d160b]">
          {products.length} {products.length === 1 ? 'item' : 'items'}
        </h2>
        {mode.kind === 'idle' && (
          <button
            type="button"
            onClick={() => setMode({ kind: 'creating' })}
            className="inline-flex items-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-bg transition-colors hover:bg-brand-strong"
          >
            <Plus size={14} />
            Add item
          </button>
        )}
      </div>

      {(mode.kind === 'creating' || mode.kind === 'editing') && (
        <ProductForm
          key={mode.kind === 'editing' ? mode.productId : 'new'}
          existing={editingProduct}
          isPending={isPending}
          onSubmit={handleSubmit}
          onCancel={() => {
            setMode({ kind: 'idle' })
            setError(null)
          }}
        />
      )}

      {products.length === 0 && mode.kind === 'idle' ? (
        <div className="rounded-[24px] border border-dashed border-[#ead8c8] bg-[#fcf7f2] px-6 py-12 text-center">
          <p className="text-base font-semibold text-[#2d160b]">No products or services yet.</p>
          <p className="mt-2 text-sm text-[#7c6253]">
            Add your first item so customers can buy it from your business page.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {products.map((product, index) => {
            const isDraggingThis = dragIndex === index
            return (
              <li
                key={product.id}
                draggable
                onDragStart={() => setDragIndex(index)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => handleDrop(index)}
                onDragEnd={() => setDragIndex(null)}
                className={`flex flex-col gap-3 rounded-[20px] border bg-white p-4 shadow-sm sm:flex-row sm:items-center ${
                  isDraggingThis
                    ? 'border-brand opacity-60'
                    : 'border-[#eee2d7] hover:border-border'
                } ${!product.is_active ? 'bg-gray-50' : ''}`}
              >
                <button
                  type="button"
                  aria-label="Drag to reorder"
                  className="hidden cursor-grab items-center justify-center self-center text-[#c7b6a8] transition-colors hover:text-brand active:cursor-grabbing sm:inline-flex"
                >
                  <GripVertical size={16} />
                </button>

                {product.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={product.image_url}
                    alt={product.name}
                    className="h-20 w-20 flex-shrink-0 rounded-2xl border border-[#f1e3d5] object-cover"
                  />
                ) : (
                  <div className="flex h-20 w-20 flex-shrink-0 items-center justify-center rounded-2xl border border-dashed border-[#e8d6c4] bg-[#fdf7f0] text-[#c4a990]">
                    {product.type === 'service' ? <Wrench size={22} /> : <Package size={22} />}
                  </div>
                )}

                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-base font-bold text-[#2d160b]">{product.name}</p>
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${
                        product.type === 'service'
                          ? 'bg-blue-50 text-blue-700'
                          : 'bg-[#fff1e4] text-brand'
                      }`}
                    >
                      {product.type === 'service' ? <Wrench size={10} /> : <Package size={10} />}
                      {product.type}
                    </span>
                    {!product.is_active && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-gray-200 px-2 py-0.5 text-[11px] font-semibold text-gray-600">
                        <EyeOff size={10} />
                        Hidden
                      </span>
                    )}
                  </div>

                  {product.description && (
                    <p className="mt-1 line-clamp-2 text-sm text-[#7c6253]">{product.description}</p>
                  )}

                  <div className="mt-2 flex flex-wrap items-center gap-3 text-sm">
                    <span className="font-bold text-[#2d160b]">{formatPrice(product.price_paise)}</span>
                    <span className="text-[#8b7264]">·</span>
                    <span className="text-[#7c6253]">{stockLabel(product)}</span>
                  </div>
                </div>

                <div className="flex flex-shrink-0 items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleToggleActive(product)}
                    disabled={isPending}
                    className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs font-semibold text-gray-600 transition-colors hover:border-border hover:text-brand disabled:opacity-50"
                  >
                    {product.is_active ? 'Hide' : 'Show'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setMode({ kind: 'editing', productId: product.id })}
                    disabled={isPending}
                    className="inline-flex items-center gap-1 rounded-lg bg-surface-soft px-2.5 py-1.5 text-xs font-semibold text-brand transition-colors hover:bg-brand hover:text-bg disabled:opacity-50"
                  >
                    <Edit2 size={12} />
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(product)}
                    disabled={isPending}
                    className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs font-semibold text-gray-500 transition-colors hover:border-red-200 hover:text-red-600 disabled:opacity-50"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      {products.length > 0 && (
        <p className="text-xs text-[#8b7264]">
          Tip: drag the grip icon to reorder how items appear on your business page.
        </p>
      )}
    </div>
  )
}

function ProductForm({
  existing,
  isPending,
  onSubmit,
  onCancel,
}: {
  existing: ListingProduct | null
  isPending: boolean
  onSubmit: (formData: FormData) => void
  onCancel: () => void
}) {
  const [type, setType] = useState<ProductType>(existing?.type ?? 'product')
  const [imageUrl, setImageUrl] = useState<string>(existing?.image_url ?? '')
  const defaultPriceRupees = existing ? String(existing.price_paise / 100) : ''
  const defaultStock =
    existing && existing.quantity_in_stock !== null ? String(existing.quantity_in_stock) : ''

  const handleFormSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    formData.set('type', type)
    formData.set('image_url', imageUrl)
    onSubmit(formData)
  }

  return (
    <form
      onSubmit={handleFormSubmit}
      className="rounded-[24px] border border-[#eee2d7] bg-white p-6 shadow-sm"
    >
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-base font-bold text-[#2d160b]">
          {existing ? 'Edit item' : 'Add new item'}
        </h3>
        <button
          type="button"
          onClick={onCancel}
          disabled={isPending}
          className="inline-flex items-center justify-center rounded-full p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 disabled:opacity-50"
          aria-label="Close"
        >
          <X size={16} />
        </button>
      </div>

      <div className="mt-4 flex gap-2">
        <button
          type="button"
          onClick={() => setType('product')}
          className={`flex-1 rounded-xl border px-3 py-2 text-sm font-semibold transition-colors ${
            type === 'product'
              ? 'border-brand bg-brand text-bg'
              : 'border-[#e8d6c4] bg-white text-[#6f584a] hover:border-border'
          }`}
        >
          <Package size={14} className="mr-2 inline-block -translate-y-px" />
          Product
        </button>
        <button
          type="button"
          onClick={() => setType('service')}
          className={`flex-1 rounded-xl border px-3 py-2 text-sm font-semibold transition-colors ${
            type === 'service'
              ? 'border-brand bg-brand text-bg'
              : 'border-[#e8d6c4] bg-white text-[#6f584a] hover:border-border'
          }`}
        >
          <Wrench size={14} className="mr-2 inline-block -translate-y-px" />
          Service
        </button>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <label className="block sm:col-span-2">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.18em] text-[#9b7c69]">
            Name
          </span>
          <input
            type="text"
            name="name"
            defaultValue={existing?.name ?? ''}
            maxLength={80}
            required
            disabled={isPending}
            placeholder={type === 'service' ? 'e.g. Home Cleaning (2 hours)' : 'e.g. 1kg Alphonso Mangoes'}
            className="w-full rounded-xl border border-[#dfcdbd] bg-white px-4 py-2.5 text-sm text-gray-800 focus:border-brand focus:outline-none disabled:bg-gray-50"
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.18em] text-[#9b7c69]">
            Price (₹)
          </span>
          <input
            type="number"
            name="price_rupees"
            defaultValue={defaultPriceRupees}
            min={0}
            step="0.01"
            required
            disabled={isPending}
            className="w-full rounded-xl border border-[#dfcdbd] bg-white px-4 py-2.5 text-sm text-gray-800 focus:border-brand focus:outline-none disabled:bg-gray-50"
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.18em] text-[#9b7c69]">
            Stock ({type === 'service' ? 'optional' : 'leave blank for unlimited'})
          </span>
          <input
            type="number"
            name="quantity_in_stock"
            defaultValue={defaultStock}
            min={0}
            step={1}
            disabled={isPending}
            placeholder="e.g. 25"
            className="w-full rounded-xl border border-[#dfcdbd] bg-white px-4 py-2.5 text-sm text-gray-800 focus:border-brand focus:outline-none disabled:bg-gray-50"
          />
        </label>

        <label className="block sm:col-span-2">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.18em] text-[#9b7c69]">
            Description
          </span>
          <textarea
            name="description"
            defaultValue={existing?.description ?? ''}
            maxLength={600}
            rows={3}
            disabled={isPending}
            placeholder="Short description shown next to the price."
            className="w-full rounded-xl border border-[#dfcdbd] bg-white px-4 py-2.5 text-sm text-gray-800 focus:border-brand focus:outline-none disabled:bg-gray-50"
          />
        </label>

        <div className="sm:col-span-2">
          <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-[#9b7c69]">
            Image
          </span>
          <div className="flex items-start gap-4">
            {imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={imageUrl}
                alt="Preview"
                className="h-24 w-24 flex-shrink-0 rounded-2xl border-2 border-border object-cover"
              />
            ) : (
              <div className="flex h-24 w-24 flex-shrink-0 items-center justify-center rounded-2xl border-2 border-dashed border-[#e8d6c4] bg-[#fdf7f0] text-[#c4a990]">
                <Package size={28} />
              </div>
            )}
            <div className="flex-1">
              <ImageCropUpload
                bucket="uploads"
                label={imageUrl ? 'Replace image' : 'Upload image'}
                size={400}
                aspect={1}
                onUpload={(url) => setImageUrl(url)}
              />
              {imageUrl && (
                <button
                  type="button"
                  onClick={() => setImageUrl('')}
                  className="mt-1 text-xs text-gray-400 hover:text-red-600"
                >
                  Remove image
                </button>
              )}
            </div>
          </div>
        </div>

        <label className="inline-flex items-center gap-2 rounded-xl border border-[#e9d7c8] bg-white px-3 py-2 text-sm font-medium text-gray-700 sm:col-span-2">
          <input
            type="checkbox"
            name="is_active"
            defaultChecked={existing?.is_active ?? true}
            disabled={isPending}
            className="rounded border-gray-300 text-brand focus:ring-brand"
          />
          Visible on business page (uncheck to hide temporarily)
        </label>
      </div>

      <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
        <button
          type="button"
          onClick={onCancel}
          disabled={isPending}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-600 transition-colors hover:border-gray-300 disabled:opacity-60"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isPending}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-bg transition-colors hover:bg-brand-strong disabled:opacity-60"
        >
          {isPending && <Loader2 size={14} className="animate-spin" />}
          {existing ? 'Save changes' : 'Create item'}
        </button>
      </div>
    </form>
  )
}
