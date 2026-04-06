'use client'

import { useEffect, useState, useTransition } from 'react'
import { ShoppingBag, CheckCircle, XCircle, Clock, Loader2, RefreshCw } from 'lucide-react'
import { getAllOrders, retryPayout } from '@/app/actions/orders'
import type { Order } from '@/app/actions/orders'

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

function PayoutBadge({ status }: { status: string }) {
  if (status === 'paid')
    return <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-700"><CheckCircle size={10} />Paid out</span>
  if (status === 'failed')
    return <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-red-100 text-red-600"><XCircle size={10} />Payout failed</span>
  return <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700"><Clock size={10} />Pending payout</span>
}

function OrderStatusBadge({ status }: { status: string }) {
  if (status === 'fulfilled')
    return <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-700"><CheckCircle size={10} />Fulfilled</span>
  if (status === 'cancelled')
    return <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-500"><XCircle size={10} />Cancelled</span>
  return <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-100 text-blue-600"><Clock size={10} />Confirmed</span>
}

function RetryButton({ orderId, onRetry }: { orderId: string; onRetry: (id: string) => void }) {
  const [isPending, startTransition] = useTransition()

  return (
    <button
      onClick={() => startTransition(() => onRetry(orderId))}
      disabled={isPending}
      className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-lg bg-orange-100 text-orange-700 hover:bg-orange-200 transition-colors disabled:opacity-50"
    >
      {isPending ? <Loader2 size={10} className="animate-spin" /> : <RefreshCw size={10} />}
      Retry Payout
    </button>
  )
}

type FilterTab = 'all' | 'pending' | 'paid' | 'failed'

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<FilterTab>('all')
  const [retryErrors, setRetryErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    getAllOrders().then(data => {
      setOrders(data)
      setLoading(false)
    })
  }, [])

  const handleRetry = async (orderId: string) => {
    const result = await retryPayout(orderId)
    if (result.error) {
      setRetryErrors(prev => ({ ...prev, [orderId]: result.error! }))
    } else {
      setOrders(prev => prev.map(o => o.id === orderId ? { ...o, payout_status: 'paid' } : o))
      setRetryErrors(prev => { const n = { ...prev }; delete n[orderId]; return n })
    }
  }

  const filtered = filter === 'all' ? orders : orders.filter(o => o.payout_status === filter)

  const counts = {
    all:     orders.length,
    pending: orders.filter(o => o.payout_status === 'pending').length,
    paid:    orders.filter(o => o.payout_status === 'paid').length,
    failed:  orders.filter(o => o.payout_status === 'failed').length,
  }

  const totalRevenue    = orders.filter(o => o.payment_status === 'paid').reduce((s, o) => s + o.amount_total, 0)
  const totalCommission = orders.filter(o => o.payment_status === 'paid').reduce((s, o) => s + o.commission_amount, 0)

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <ShoppingBag size={22} className="text-warli-terra" />
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Orders</h1>
          <p className="text-sm text-gray-500">All marketplace orders with payout status</p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-gray-400">
          <Loader2 size={24} className="animate-spin mr-2" />
          Loading orders…
        </div>
      ) : (
        <>
          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
            <div className="bg-white border border-gray-100 rounded-xl p-4 text-center">
              <div className="text-2xl font-bold text-gray-900">{counts.all}</div>
              <div className="text-xs text-gray-400">Total Orders</div>
            </div>
            <div className="bg-white border border-gray-100 rounded-xl p-4 text-center">
              <div className="text-2xl font-bold text-warli-terra">₹{totalRevenue.toLocaleString('en-IN')}</div>
              <div className="text-xs text-gray-400">Total GMV</div>
            </div>
            <div className="bg-white border border-gray-100 rounded-xl p-4 text-center">
              <div className="text-2xl font-bold text-green-600">₹{totalCommission.toLocaleString('en-IN')}</div>
              <div className="text-xs text-gray-400">Platform Commission</div>
            </div>
            <div className="bg-white border border-gray-100 rounded-xl p-4 text-center">
              <div className="text-2xl font-bold text-red-500">{counts.failed}</div>
              <div className="text-xs text-gray-400">Failed Payouts</div>
            </div>
          </div>

          {/* Payout filter tabs */}
          <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-5 w-fit">
            {(['all', 'pending', 'paid', 'failed'] as FilterTab[]).map(tab => (
              <button
                key={tab}
                onClick={() => setFilter(tab)}
                className={`text-xs font-semibold px-3 py-1.5 rounded-lg capitalize transition-colors ${
                  filter === tab
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab} {counts[tab] > 0 && tab !== 'all' ? `(${counts[tab]})` : tab === 'all' ? `(${counts.all})` : ''}
              </button>
            ))}
          </div>

          {/* Orders */}
          {filtered.length === 0 ? (
            <p className="text-center text-sm text-gray-400 py-12">No orders in this category.</p>
          ) : (
            <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Date</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Listing / Item</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Buyer</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500">Amount</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500">Commission</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Order</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Payout</th>
                      <th className="px-4 py-3"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {filtered.map(order => (
                      <tr key={order.id} className="hover:bg-gray-50/50">
                        <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap">{formatDate(order.created_at)}</td>
                        <td className="px-4 py-3">
                          <p className="font-medium text-gray-900 text-xs">{(order.listing as { name: string } | null)?.name ?? '—'}</p>
                          <p className="text-xs text-gray-400">{order.service_name} ×{order.quantity}</p>
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-xs text-gray-700">{order.buyer_name}</p>
                          <p className="text-xs text-gray-400">{order.buyer_phone}</p>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <p className="font-semibold text-gray-900 text-xs">₹{order.amount_total.toLocaleString('en-IN')}</p>
                          <p className="text-xs text-gray-400">Seller gets ₹{order.seller_payout_amount.toLocaleString('en-IN')}</p>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <p className="text-xs font-semibold text-green-600">₹{order.commission_amount.toLocaleString('en-IN')}</p>
                          <p className="text-xs text-gray-400">{(order.commission_rate * 100).toFixed(0)}%</p>
                        </td>
                        <td className="px-4 py-3">
                          <OrderStatusBadge status={order.status} />
                        </td>
                        <td className="px-4 py-3">
                          <div className="space-y-1">
                            <PayoutBadge status={order.payout_status} />
                            {retryErrors[order.id] && (
                              <p className="text-xs text-red-500">{retryErrors[order.id]}</p>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          {order.payout_status === 'failed' && (
                            <RetryButton orderId={order.id} onRetry={handleRetry} />
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
