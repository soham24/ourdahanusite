'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import {
  ShoppingBag,
  CheckCircle,
  XCircle,
  Clock,
  Loader2,
  Package,
  CreditCard,
  Wallet,
} from 'lucide-react'
import { getMyListingOrders, updateOrderStatus } from '@/app/actions/orders'
import type { Order } from '@/app/actions/orders'
import { updateMarketplaceOrderStatus } from '@/app/actions/marketplace-orders'

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

function FlowBadge({ flow }: { flow: Order['payment_flow'] }) {
  if (flow === 'owner_razorpay') {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-surface-soft text-brand-strong">
        <CreditCard size={10} />
        Direct payment
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-purple-50 text-purple-700">
      <Wallet size={10} />
      UPI via OurDahanu
    </span>
  )
}

function PayoutBadge({ status }: { status: string }) {
  if (status === 'not_applicable') {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-700">
        <CheckCircle size={10} />
        Paid to you
      </span>
    )
  }
  if (status === 'paid')
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-700">
        <CheckCircle size={10} />
        Paid out
      </span>
    )
  if (status === 'failed')
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-red-100 text-red-600">
        <XCircle size={10} />
        Payout failed
      </span>
    )
  return (
    <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700">
      <Clock size={10} />
      Pending payout
    </span>
  )
}

function StatusBadge({ status }: { status: string }) {
  if (status === 'fulfilled')
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-700">
        <CheckCircle size={10} />
        Fulfilled
      </span>
    )
  if (status === 'cancelled')
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
        <XCircle size={10} />
        Cancelled
      </span>
    )
  return (
    <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-100 text-blue-600">
      <Clock size={10} />
      Confirmed
    </span>
  )
}

function OrderRow({
  order,
  onStatusChange,
}: {
  order: Order
  onStatusChange: (order: Order, status: 'fulfilled' | 'cancelled') => void
}) {
  const [isPending, startTransition] = useTransition()
  const isActive = order.status === 'confirmed'
  const isMarketplace = order.payment_flow === 'owner_razorpay'

  const handleAction = (status: 'fulfilled' | 'cancelled') => {
    startTransition(() => {
      onStatusChange(order, status)
    })
  }

  return (
    <div className="border border-gray-100 rounded-2xl p-4 space-y-3 hover:border-border transition-colors">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="font-semibold text-gray-900 text-sm">{order.service_name}</span>
            <StatusBadge status={order.status} />
            <PayoutBadge status={order.payout_status} />
            <FlowBadge flow={order.payment_flow} />
          </div>
          <p className="text-xs text-gray-400">{formatDate(order.created_at)}</p>
        </div>
        <div className="text-right flex-shrink-0">
          <p className="font-bold text-brand">
            ₹{Number(order.amount_total).toLocaleString('en-IN')}
          </p>
          <p className="text-xs text-gray-400">
            ×{order.quantity} @ ₹{Number(order.service_price).toLocaleString('en-IN')}
          </p>
          <p className="text-xs text-green-600 mt-0.5">
            {isMarketplace ? 'Received directly' : 'You get'} ₹
            {Number(order.seller_payout_amount).toLocaleString('en-IN')}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-xs text-gray-600">
        <div>
          <span className="text-gray-400">Buyer: </span>
          {order.buyer_name}
        </div>
        <div>
          <span className="text-gray-400">Phone: </span>
          <a href={`tel:${order.buyer_phone}`} className="text-brand hover:underline">
            {order.buyer_phone}
          </a>
        </div>
        {order.delivery_address && (
          <div className="sm:col-span-2">
            <span className="text-gray-400">Address: </span>
            {order.delivery_address}
          </div>
        )}
        {order.notes && (
          <div className="sm:col-span-2">
            <span className="text-gray-400">Notes: </span>
            {order.notes}
          </div>
        )}
        {!isMarketplace && order.payout_error && (
          <div className="sm:col-span-2 text-red-500">
            <span className="font-medium">Payout error: </span>
            {order.payout_error}
          </div>
        )}
        {isMarketplace && order.owner_razorpay_payment_id && (
          <div className="sm:col-span-2 text-gray-400">
            <span>Razorpay Payment: </span>
            <span className="font-mono text-gray-600">{order.owner_razorpay_payment_id}</span>
          </div>
        )}
      </div>

      {isActive && (
        <div className="flex gap-2 pt-1">
          <button
            onClick={() => handleAction('fulfilled')}
            disabled={isPending}
            className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-green-600 hover:bg-green-700 text-white transition-colors disabled:opacity-50"
          >
            {isPending ? <Loader2 size={11} className="animate-spin" /> : <CheckCircle size={11} />}
            Mark Fulfilled
          </button>
          <button
            onClick={() => handleAction('cancelled')}
            disabled={isPending}
            className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border border-gray-200 text-gray-500 hover:border-red-200 hover:text-red-500 transition-colors disabled:opacity-50"
          >
            <XCircle size={11} />
            Cancel
          </button>
        </div>
      )}
    </div>
  )
}

type FlowFilter = 'all' | 'owner_razorpay' | 'platform_upi_payout'
type StatusFilter = 'all' | 'confirmed' | 'fulfilled' | 'cancelled'

export default function MyOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [flowFilter, setFlowFilter] = useState<FlowFilter>('all')

  useEffect(() => {
    getMyListingOrders().then(({ orders }) => {
      setOrders(orders)
      setLoading(false)
    })
  }, [])

  const handleStatusChange = async (order: Order, status: 'fulfilled' | 'cancelled') => {
    const result =
      order.payment_flow === 'owner_razorpay'
        ? await updateMarketplaceOrderStatus(order.id, status)
        : await updateOrderStatus(order.id, status)
    if (!result.error) {
      setOrders((prev) => prev.map((o) => (o.id === order.id ? { ...o, status } : o)))
    }
  }

  const flowFiltered = useMemo(
    () => (flowFilter === 'all' ? orders : orders.filter((o) => o.payment_flow === flowFilter)),
    [orders, flowFilter],
  )

  const filtered =
    statusFilter === 'all' ? flowFiltered : flowFiltered.filter((o) => o.status === statusFilter)

  const counts = {
    all: flowFiltered.length,
    confirmed: flowFiltered.filter((o) => o.status === 'confirmed').length,
    fulfilled: flowFiltered.filter((o) => o.status === 'fulfilled').length,
    cancelled: flowFiltered.filter((o) => o.status === 'cancelled').length,
  }

  const flowCounts = {
    all: orders.length,
    owner_razorpay: orders.filter((o) => o.payment_flow === 'owner_razorpay').length,
    platform_upi_payout: orders.filter((o) => o.payment_flow === 'platform_upi_payout').length,
  }

  const totalEarnings = flowFiltered
    .filter((o) => o.status !== 'cancelled')
    .reduce((sum, o) => sum + Number(o.seller_payout_amount || 0), 0)

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 bg-surface-soft rounded-xl flex items-center justify-center">
          <ShoppingBag size={20} className="text-brand" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Orders</h1>
          <p className="text-sm text-gray-500">Orders placed by customers on your listings</p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-gray-400">
          <Loader2 size={24} className="animate-spin mr-2" />
          Loading orders…
        </div>
      ) : orders.length === 0 ? (
        <div className="text-center py-20 bg-white border border-gray-100 rounded-2xl">
          <div className="w-16 h-16 bg-surface-soft rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Package size={28} className="text-brand" />
          </div>
          <h3 className="font-semibold text-gray-900 mb-2">No orders yet</h3>
          <p className="text-sm text-gray-400 max-w-xs mx-auto">
            When customers place orders on your listings, they&apos;ll appear here.
          </p>
        </div>
      ) : (
        <>
          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            <div className="bg-white border border-gray-100 rounded-xl p-3 text-center">
              <div className="text-xl font-bold text-gray-900">{counts.all}</div>
              <div className="text-xs text-gray-400">Total Orders</div>
            </div>
            <div className="bg-white border border-gray-100 rounded-xl p-3 text-center">
              <div className="text-xl font-bold text-blue-600">{counts.confirmed}</div>
              <div className="text-xs text-gray-400">Pending</div>
            </div>
            <div className="bg-white border border-gray-100 rounded-xl p-3 text-center">
              <div className="text-xl font-bold text-green-600">{counts.fulfilled}</div>
              <div className="text-xs text-gray-400">Fulfilled</div>
            </div>
            <div className="bg-white border border-gray-100 rounded-xl p-3 text-center">
              <div className="text-xl font-bold text-brand">
                ₹{totalEarnings.toLocaleString('en-IN')}
              </div>
              <div className="text-xs text-gray-400">Earned</div>
            </div>
          </div>

          {/* Flow filter */}
          {flowCounts.owner_razorpay > 0 && flowCounts.platform_upi_payout > 0 && (
            <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-3 text-xs">
              {(
                [
                  { key: 'all' as const, label: 'All flows' },
                  { key: 'owner_razorpay' as const, label: 'Direct payment' },
                  { key: 'platform_upi_payout' as const, label: 'UPI payout' },
                ]
              ).map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setFlowFilter(tab.key)}
                  className={`flex-1 font-semibold py-1.5 rounded-lg transition-colors ${
                    flowFilter === tab.key
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {tab.label} ({flowCounts[tab.key]})
                </button>
              ))}
            </div>
          )}

          {/* Status filter tabs */}
          <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-5">
            {(['all', 'confirmed', 'fulfilled', 'cancelled'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setStatusFilter(tab)}
                className={`flex-1 text-xs font-semibold py-1.5 rounded-lg capitalize transition-colors ${
                  statusFilter === tab
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab} {tab !== 'all' && counts[tab] > 0 ? `(${counts[tab]})` : ''}
              </button>
            ))}
          </div>

          {/* Orders list */}
          {filtered.length === 0 ? (
            <p className="text-center text-sm text-gray-400 py-10">No orders in this view.</p>
          ) : (
            <div className="space-y-3">
              {filtered.map((order) => (
                <OrderRow key={order.id} order={order} onStatusChange={handleStatusChange} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
