'use client'

import { useEffect, useRef, useState } from 'react'
import { CheckCircle, Loader2, Minus, Plus, ShieldCheck, ShoppingCart, X } from 'lucide-react'

import { placeMarketplaceOrder } from '@/app/actions/marketplace-orders'

interface RazorpayOptions {
  key: string
  amount: number
  currency: string
  name: string
  description: string
  order_id: string
  handler: (r: {
    razorpay_payment_id: string
    razorpay_order_id: string
    razorpay_signature: string
  }) => void
  modal: { ondismiss: () => void }
  prefill: { name: string; contact: string; email?: string }
  theme: { color: string }
}

export interface BuyProductInfo {
  id: string
  name: string
  pricePaise: number
  quantityInStock: number | null
  listingName: string
  type: 'product' | 'service'
}

type Status = 'idle' | 'ordering' | 'paying' | 'submitting' | 'done' | 'error'

export default function BuyButton({
  product,
  isSignedIn,
  loginHref,
  userName = '',
  userPhone = '',
  userEmail = '',
  disabled = false,
}: {
  product: BuyProductInfo
  isSignedIn: boolean
  loginHref: string
  userName?: string
  userPhone?: string
  userEmail?: string
  disabled?: boolean
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [status, setStatus] = useState<Status>('idle')
  const [error, setError] = useState('')
  const [scriptReady, setScriptReady] = useState(false)
  const [quantity, setQuantity] = useState(1)
  const [buyerName, setBuyerName] = useState(userName)
  const [buyerPhone, setBuyerPhone] = useState(userPhone)
  const [deliveryAddress, setDeliveryAddress] = useState('')
  const [notes, setNotes] = useState('')
  const overlayRef = useRef<HTMLDivElement>(null)

  const isSoldOut = product.quantityInStock === 0
  const maxQuantity = product.quantityInStock ?? 99
  const totalPaise = product.pricePaise * quantity
  const isService = product.type === 'service'

  useEffect(() => {
    if (!isOpen) return
    if (document.getElementById('razorpay-script')) {
      setScriptReady(true)
      return
    }
    const s = document.createElement('script')
    s.id = 'razorpay-script'
    s.src = 'https://checkout.razorpay.com/v1/checkout.js'
    s.async = true
    s.onload = () => setScriptReady(true)
    document.body.appendChild(s)
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false)
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [isOpen])

  const close = () => {
    if (status === 'ordering' || status === 'paying' || status === 'submitting') return
    setIsOpen(false)
    setStatus('idle')
    setError('')
  }

  const handleOverlay = (e: React.MouseEvent) => {
    if (e.target === overlayRef.current) close()
  }

  const handleBuy = async () => {
    if (!buyerName.trim()) {
      setError('Please enter your name.')
      return
    }
    if (!/^\d{10}$/.test(buyerPhone.replace(/\D/g, '').slice(-10))) {
      setError('Please enter a valid 10-digit phone number.')
      return
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (!scriptReady || !(window as any).Razorpay) {
      setError('Payment gateway is still loading. Please try again.')
      return
    }
    setError('')

    try {
      setStatus('ordering')
      const orderRes = await fetch('/api/razorpay/create-marketplace-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId: product.id, quantity }),
      })
      const orderData = await orderRes.json()
      if (!orderRes.ok || orderData.error) {
        setError(orderData.error || 'Failed to start payment. Please try again.')
        setStatus('error')
        return
      }

      setStatus('paying')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const Razorpay = (window as any).Razorpay as new (o: RazorpayOptions) => { open: () => void }

      const rzp = new Razorpay({
        key: orderData.keyId,
        amount: orderData.amount,
        currency: orderData.currency || 'INR',
        name: orderData.listingName || product.listingName,
        description: `${product.name} ×${quantity}`,
        order_id: orderData.orderId,
        handler: async (response) => {
          setStatus('submitting')
          const fd = new FormData()
          fd.set('product_id', product.id)
          fd.set('quantity', String(quantity))
          fd.set('buyer_name', buyerName.trim())
          fd.set('buyer_phone', buyerPhone.trim())
          fd.set('delivery_address', deliveryAddress.trim())
          fd.set('notes', notes.trim())
          fd.set('razorpay_order_id', response.razorpay_order_id)
          fd.set('razorpay_payment_id', response.razorpay_payment_id)
          fd.set('razorpay_signature', response.razorpay_signature)

          const result = await placeMarketplaceOrder(fd)
          if (result.error) {
            setError(
              `${result.error}${response.razorpay_payment_id ? ` (Payment ID: ${response.razorpay_payment_id})` : ''}`,
            )
            setStatus('error')
          } else {
            setStatus('done')
          }
        },
        modal: {
          ondismiss: () => setStatus('idle'),
        },
        prefill: {
          name: buyerName,
          contact: buyerPhone,
          email: userEmail,
        },
        theme: { color: '#C4663A' },
      })
      rzp.open()
    } catch (e) {
      console.error('[BuyButton] payment error:', e)
      setError('Something went wrong. Please try again.')
      setStatus('error')
    }
  }

  const busy = status === 'ordering' || status === 'paying' || status === 'submitting'

  if (!isSignedIn) {
    return (
      <a
        href={loginHref}
        className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-warli-terra px-4 py-2 text-sm font-semibold text-warli-cream transition-colors hover:bg-warli-deep"
      >
        <ShoppingCart size={14} />
        Sign in to buy
      </a>
    )
  }

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

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setIsOpen(true)
          setStatus('idle')
          setError('')
          setQuantity(1)
        }}
        className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-warli-terra px-4 py-2 text-sm font-semibold text-warli-cream transition-colors hover:bg-warli-deep"
      >
        <ShoppingCart size={14} />
        {isService ? 'Book now' : 'Buy now'}
      </button>

      {isOpen && (
        <div
          ref={overlayRef}
          onClick={handleOverlay}
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4"
        >
          <div className="w-full overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:max-w-md sm:rounded-2xl">
            <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
              <div className="flex items-center gap-2">
                <ShoppingCart size={18} className="text-warli-terra" />
                <span className="text-sm font-semibold text-gray-900">
                  {isService ? 'Book service' : 'Buy product'}
                </span>
              </div>
              <button
                onClick={close}
                disabled={busy}
                className="text-gray-400 transition-colors hover:text-gray-600 disabled:opacity-40"
                aria-label="Close"
              >
                <X size={20} />
              </button>
            </div>

            {status === 'done' ? (
              <div className="flex flex-col items-center gap-4 px-5 py-10 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
                  <CheckCircle size={36} className="text-green-500" />
                </div>
                <h3 className="text-lg font-bold text-gray-900">
                  {isService ? 'Booking confirmed!' : 'Order placed!'}
                </h3>
                <p className="max-w-xs text-sm text-gray-500">
                  Your payment went directly to {product.listingName}. Check{' '}
                  <a href="/account/orders" className="font-semibold text-warli-terra underline">
                    your orders
                  </a>{' '}
                  anytime.
                </p>
                <button
                  onClick={close}
                  className="mt-1 text-sm text-gray-400 hover:text-gray-600"
                >
                  Close
                </button>
              </div>
            ) : (
              <div className="max-h-[80vh] space-y-4 overflow-y-auto px-5 py-5">
                <div className="rounded-xl border border-warli-sand bg-warli-light p-4">
                  <p className="text-sm font-semibold text-chikoo-bark">{product.name}</p>
                  <p className="mt-0.5 text-lg font-bold text-warli-terra">
                    ₹{(product.pricePaise / 100).toLocaleString('en-IN')}
                  </p>
                  <p className="mt-0.5 text-xs text-gray-400">from {product.listingName}</p>
                </div>

                {status === 'error' && error && (
                  <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {error}
                  </div>
                )}
                {status !== 'error' && error && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                    {error}
                  </div>
                )}

                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-gray-600">
                    Quantity
                  </label>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                      disabled={quantity <= 1 || busy}
                      className="flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 text-gray-600 transition-colors hover:border-warli-terra hover:text-warli-terra disabled:opacity-40"
                    >
                      <Minus size={14} />
                    </button>
                    <span className="w-6 text-center text-base font-bold text-gray-900">
                      {quantity}
                    </span>
                    <button
                      type="button"
                      onClick={() => setQuantity((q) => Math.min(maxQuantity, q + 1))}
                      disabled={quantity >= maxQuantity || busy}
                      className="flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 text-gray-600 transition-colors hover:border-warli-terra hover:text-warli-terra disabled:opacity-40"
                    >
                      <Plus size={14} />
                    </button>
                    <span className="ml-2 text-sm text-gray-500">
                      = ₹{(totalPaise / 100).toLocaleString('en-IN')}
                    </span>
                    {product.quantityInStock !== null && (
                      <span className="ml-auto text-xs text-gray-400">
                        {product.quantityInStock} available
                      </span>
                    )}
                  </div>
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-gray-600">
                    Your name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={buyerName}
                    onChange={(e) => setBuyerName(e.target.value)}
                    disabled={busy}
                    placeholder="Full name"
                    className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm focus:border-warli-terra focus:outline-none disabled:bg-gray-50"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-gray-600">
                    Phone number <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="tel"
                    value={buyerPhone}
                    onChange={(e) => setBuyerPhone(e.target.value)}
                    disabled={busy}
                    placeholder="10-digit mobile number"
                    className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm focus:border-warli-terra focus:outline-none disabled:bg-gray-50"
                  />
                </div>

                {!isService && (
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold text-gray-600">
                      Delivery address <span className="font-normal text-gray-400">(optional)</span>
                    </label>
                    <input
                      type="text"
                      value={deliveryAddress}
                      onChange={(e) => setDeliveryAddress(e.target.value)}
                      disabled={busy}
                      placeholder="Street, Village, Pincode"
                      className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm focus:border-warli-terra focus:outline-none disabled:bg-gray-50"
                    />
                  </div>
                )}

                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-gray-600">
                    Notes <span className="font-normal text-gray-400">(optional)</span>
                  </label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    disabled={busy}
                    rows={2}
                    placeholder="Preferred time, size, colour, etc."
                    className="w-full resize-none rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm focus:border-warli-terra focus:outline-none disabled:bg-gray-50"
                  />
                </div>

                <div className="flex items-center justify-between rounded-xl bg-gray-50 px-4 py-3">
                  <span className="text-sm font-semibold text-gray-700">Total</span>
                  <span className="text-lg font-bold text-chikoo-bark">
                    ₹{(totalPaise / 100).toLocaleString('en-IN')}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={handleBuy}
                  disabled={busy}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-warli-terra py-3 text-sm font-semibold text-warli-cream transition-colors hover:bg-warli-deep disabled:opacity-60"
                >
                  {busy ? (
                    <>
                      <Loader2 size={15} className="animate-spin" />
                      {status === 'ordering' && 'Preparing payment…'}
                      {status === 'paying' && 'Waiting for payment…'}
                      {status === 'submitting' && 'Finalising order…'}
                    </>
                  ) : (
                    <>
                      <ShoppingCart size={15} />
                      Pay ₹{(totalPaise / 100).toLocaleString('en-IN')}
                    </>
                  )}
                </button>

                <p className="flex items-center justify-center gap-1 text-center text-xs text-gray-400">
                  <ShieldCheck size={11} className="text-warli-terra" />
                  Payment goes directly to {product.listingName} via Razorpay
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
