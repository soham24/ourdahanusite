import Link from 'next/link'
import { ShoppingCart } from 'lucide-react'

export interface BuyProductInfo {
  id: string
  name: string
  pricePaise: number
  quantityInStock: number | null
  listingName: string
  type: 'product' | 'service'
}

const buttonCls =
  'inline-flex items-center justify-center gap-1.5 rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-bg transition-colors hover:bg-brand-strong'

/**
 * Entry point into checkout.
 *
 * This deliberately renders nothing but a link. It used to host the whole
 * checkout modal, but a `position: fixed` overlay rendered inside a product
 * card is captured by the card's `.od-card-hover` transform, which becomes
 * the overlay's containing block — the modal was clipped to the card while
 * hovered and snapped to fullscreen when not, producing a visible flicker.
 * Checkout now lives at its own route, so no overlay exists here to capture.
 */
export default function BuyButton({
  product,
  isSignedIn,
  disabled = false,
}: {
  product: BuyProductInfo
  isSignedIn: boolean
  disabled?: boolean
}) {
  const isSoldOut = product.quantityInStock === 0

  if (disabled || isSoldOut) {
    return (
      <button
        type="button"
        disabled
        className="inline-flex cursor-not-allowed items-center justify-center gap-1.5 rounded-xl border border-gray-200 bg-gray-100 px-4 py-2 text-sm font-semibold text-gray-400"
      >
        {isSoldOut ? 'Sold out' : 'Unavailable'}
      </button>
    )
  }

  const checkoutPath = `/checkout/${product.id}`

  if (!isSignedIn) {
    return (
      <Link href={`/login?next=${encodeURIComponent(checkoutPath)}`} className={buttonCls}>
        <ShoppingCart size={14} aria-hidden />
        Sign in to buy
      </Link>
    )
  }

  return (
    <Link href={checkoutPath} className={buttonCls}>
      <ShoppingCart size={14} aria-hidden />
      {product.type === 'service' ? 'Book now' : 'Buy now'}
    </Link>
  )
}
