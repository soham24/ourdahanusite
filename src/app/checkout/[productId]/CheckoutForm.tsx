'use client'

export interface CheckoutFormProps {
  product: {
    id: string
    name: string
    pricePaise: number
    quantityInStock: number | null
    type: 'product' | 'service'
    imageUrl: string | null
  }
  listing: { id: string; name: string; whatsapp: string | null }
  businessUrl: string
  buyerName: string
  buyerPhone: string
  buyerEmail: string
}

export default function CheckoutForm({ product, listing }: CheckoutFormProps) {
  return (
    <div className="od-card p-4">
      <p className="text-sm font-semibold text-[var(--od-ink)]">{product.name}</p>
      <p className="mt-0.5 text-lg font-bold text-[var(--od-brand)]">
        ₹{(product.pricePaise / 100).toLocaleString('en-IN')}
      </p>
      <p className="mt-0.5 text-xs text-[var(--od-muted)]">from {listing.name}</p>
    </div>
  )
}
