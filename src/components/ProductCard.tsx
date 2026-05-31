'use client'

import { useState } from 'react'
import { Package, Wrench, Link2, Check } from 'lucide-react'

export type PublicProduct = {
  id: string
  type: 'product' | 'service'
  name: string
  description: string | null
  price_paise: number
  quantity_in_stock: number | null
  image_url: string | null
  image_thumb_url?: string | null
}

function formatPrice(paise: number): string {
  return `₹${(paise / 100).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`
}

function ShareButton({ url }: { url: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback for older browsers
      const ta = document.createElement('textarea')
      ta.value = url
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      title="Copy direct link to this item"
      className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1.5 text-[11px] font-semibold transition-all ${
        copied
          ? 'border-green-200 bg-green-50 text-green-700'
          : 'border-[var(--od-border)] bg-white text-[var(--od-muted)] hover:border-[var(--od-brand)]/40 hover:text-[var(--od-brand)]'
      }`}
    >
      {copied ? <Check size={11} /> : <Link2 size={11} />}
      {copied ? 'Copied!' : 'Share'}
    </button>
  )
}

export default function ProductCard({
  product,
  buySlot,
  shareUrl,
}: {
  product: PublicProduct
  buySlot?: React.ReactNode
  shareUrl?: string
}) {
  const isOutOfStock = product.quantity_in_stock === 0
  const lowStock =
    product.quantity_in_stock !== null && product.quantity_in_stock > 0 && product.quantity_in_stock <= 5

  return (
    <article
      id={`product-${product.id}`}
      className="od-card od-card-hover flex flex-col overflow-hidden scroll-mt-28"
    >
      <div className="relative aspect-square w-full overflow-hidden bg-[#fdf7f0]">
        {product.image_thumb_url || product.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={(product.image_thumb_url || product.image_url) as string}
            alt={product.name}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-[#c4a990]">
            {product.type === 'service' ? <Wrench size={48} /> : <Package size={48} />}
          </div>
        )}
        <span
          className={`absolute left-3 top-3 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide backdrop-blur ${
            product.type === 'service'
              ? 'bg-blue-100/90 text-blue-700'
              : 'bg-[#fff1e4]/95 text-brand'
          }`}
        >
          {product.type === 'service' ? <Wrench size={10} /> : <Package size={10} />}
          {product.type}
        </span>
        {isOutOfStock && (
          <span className="absolute right-3 top-3 inline-flex items-center rounded-full bg-red-500/90 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-white backdrop-blur">
            Sold out
          </span>
        )}
        {!isOutOfStock && lowStock && (
          <span className="absolute right-3 top-3 inline-flex items-center rounded-full bg-amber-500/90 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-white backdrop-blur">
            Only {product.quantity_in_stock} left
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-3 p-4">
        <div>
          <h3 className="text-base font-extrabold text-[var(--od-ink)]">{product.name}</h3>
          {product.description && (
            <p className="mt-1 line-clamp-3 text-sm text-[var(--od-muted)]">{product.description}</p>
          )}
        </div>

        <div className="mt-auto flex flex-wrap items-center justify-between gap-2">
          <p className="text-xl font-extrabold text-[var(--od-ink)]">{formatPrice(product.price_paise)}</p>
          <div className="flex items-center gap-2">
            {shareUrl && <ShareButton url={shareUrl} />}
            {buySlot}
          </div>
        </div>
      </div>
    </article>
  )
}
