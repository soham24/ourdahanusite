'use client'

import { useEffect, useState } from 'react'
import { ShoppingBag, CheckCircle, XCircle, Clock, Loader2 } from 'lucide-react'
import { getAllOrders } from '@/app/actions/orders'
import type { Order } from '@/app/actions/orders'

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

function TestBadge() {
  return (
    <span className="inline-flex items-center rounded-full bg-[rgba(200,136,30,0.14)] px-2 py-0.5 text-xs font-bold text-[var(--od-brand-strong)]">
      Test
    </span>
  )
}

function OrderStatusBadge({ status }: { status: string }) {
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

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getAllOrders().then((data) => {
      setOrders(data)
      setLoading(false)
    })
  }, [])

  const totalRevenue = orders
    .filter((o) => o.payment_status === 'paid')
    .reduce((s, o) => s + Number(o.amount_total || 0), 0)

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <ShoppingBag size={22} className="text-brand" />
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Orders</h1>
          <p className="text-sm text-gray-500">All marketplace orders</p>
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
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="bg-white border border-gray-100 rounded-xl p-4 text-center">
              <div className="text-2xl font-bold text-gray-900">{orders.length}</div>
              <div className="text-xs text-gray-400">Total Orders</div>
            </div>
            <div className="bg-white border border-gray-100 rounded-xl p-4 text-center">
              <div className="text-2xl font-bold text-brand">
                ₹{totalRevenue.toLocaleString('en-IN')}
              </div>
              <div className="text-xs text-gray-400">Total GMV</div>
            </div>
          </div>

          {/* Orders */}
          {orders.length === 0 ? (
            <p className="text-center text-sm text-gray-400 py-12">No orders yet.</p>
          ) : (
            <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Date</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Listing / Item</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Buyer</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Status</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {orders.map((order) => (
                      <tr key={order.id} className="hover:bg-gray-50/50">
                        <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap">
                          {formatDate(order.created_at)}
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-medium text-gray-900 text-xs">
                            {(order.listing as { name: string } | null)?.name ?? '—'}
                          </p>
                          <p className="text-xs text-gray-400">
                            {order.service_name} ×{order.quantity}
                          </p>
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-xs text-gray-700">{order.buyer_name}</p>
                          <p className="text-xs text-gray-400">{order.buyer_phone}</p>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {order.fulfillment_issue ? <span className="text-xs font-semibold text-amber-800">Needs attention</span> : <OrderStatusBadge status={order.status} />}
                            {order.is_test && <TestBadge />}
                          </div>
                          {order.fulfillment_issue && <p className="mt-1 max-w-xs text-xs text-amber-800">{order.fulfillment_issue}</p>}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <p className="font-semibold text-gray-900 text-xs">
                            ₹{Number(order.amount_total).toLocaleString('en-IN')}
                          </p>
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
