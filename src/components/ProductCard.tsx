import { Package, Wrench } from 'lucide-react'

export type PublicProduct = {
  id: string
  type: 'product' | 'service'
  name: string
  description: string | null
  price_paise: number
  quantity_in_stock: number | null
  image_url: string | null
}

function formatPrice(paise: number): string {
  return `₹${(paise / 100).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`
}

export default function ProductCard({
  product,
  buySlot,
}: {
  product: PublicProduct
  buySlot?: React.ReactNode
}) {
  const isOutOfStock = product.quantity_in_stock === 0
  const lowStock =
    product.quantity_in_stock !== null && product.quantity_in_stock > 0 && product.quantity_in_stock <= 5

  return (
    <article className="flex flex-col overflow-hidden rounded-3xl border border-[#eee2d7] bg-white shadow-sm transition-all hover:border-warli-sand hover:shadow-md">
      <div className="relative aspect-square w-full overflow-hidden bg-[#fdf7f0]">
        {product.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={product.image_url}
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
              : 'bg-[#fff1e4]/95 text-warli-terra'
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
          <h3 className="text-base font-bold text-[#2d160b]">{product.name}</h3>
          {product.description && (
            <p className="mt-1 line-clamp-3 text-sm text-[#7c6253]">{product.description}</p>
          )}
        </div>

        <div className="mt-auto flex items-center justify-between gap-2">
          <p className="text-xl font-bold text-[#2d160b]">{formatPrice(product.price_paise)}</p>
          {buySlot}
        </div>
      </div>
    </article>
  )
}
