import Link from 'next/link'
import { redirect } from 'next/navigation'
import { CheckCircle, Clock, Package, ShoppingBag, XCircle } from 'lucide-react'

import { getMyMarketplaceOrders } from '@/app/actions/marketplace-orders'
import { orderItemName } from '@/lib/catalog/catalog'
import { createClient } from '@/lib/supabase/server'
import { buildAbsoluteUrl } from '@/lib/site'

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function StatusBadge({ status }: { status: string }) {
  if (status === 'fulfilled') {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-700">
        <CheckCircle size={10} />
        Fulfilled
      </span>
    )
  }
  if (status === 'cancelled') {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
        <XCircle size={10} />
        Cancelled
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-100 text-blue-600">
      <Clock size={10} />
      Confirmed
    </span>
  )
}

export default async function MyAccountOrdersPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login?next=' + encodeURIComponent('/account/orders'))
  }

  const orders = await getMyMarketplaceOrders()

  const totalSpend = orders
    .filter((order) => order.status !== 'cancelled' && !order.is_test)
    .reduce((sum, order) => sum + Number(order.amount_total || 0), 0)

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 bg-surface-soft rounded-xl flex items-center justify-center">
          <ShoppingBag size={20} className="text-brand" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Orders</h1>
          <p className="text-sm text-gray-500">Items and services you&apos;ve purchased on OurDahanu</p>
        </div>
      </div>

      {orders.length === 0 ? (
        <div className="text-center py-20 bg-white border border-gray-100 rounded-2xl">
          <div className="w-16 h-16 bg-surface-soft rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Package size={28} className="text-brand" />
          </div>
          <h3 className="font-semibold text-gray-900 mb-2">No orders yet</h3>
          <p className="text-sm text-gray-400 max-w-xs mx-auto mb-6">
            Explore local businesses on Dahanu and shop directly from their catalog.
          </p>
          <Link
            href={buildAbsoluteUrl('/listings')}
            className="inline-flex items-center gap-2 px-4 py-2 bg-brand text-bg rounded-xl font-semibold text-sm hover:bg-brand-strong transition-colors"
          >
            Browse Listings
          </Link>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 mb-6">
            <div className="bg-white border border-gray-100 rounded-xl p-3 text-center">
              <div className="text-xl font-bold text-gray-900">{orders.filter((order) => !order.is_test).length}</div>
              <div className="text-xs text-gray-400">Orders placed</div>
            </div>
            <div className="bg-white border border-gray-100 rounded-xl p-3 text-center">
              <div className="text-xl font-bold text-brand">
                ₹{totalSpend.toLocaleString('en-IN')}
              </div>
              <div className="text-xs text-gray-400">Total spent</div>
            </div>
          </div>

          <div className="space-y-3">
            {orders.map((order) => {
              const listingName = order.listing?.name || 'Business'
              const subdomain = order.listing?.subdomain
              return (
                <Link
                  key={order.id}
                  href={`/account/orders/${order.id}`}
                  className="block bg-white border border-gray-100 rounded-2xl p-4 hover:border-border transition-colors"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="font-semibold text-gray-900 text-sm">
                          {orderItemName(order.service_name, order.option_label)}
                        </span>
                        {order.fulfillment_issue ? <span className="text-xs font-semibold text-amber-800">Payment received · Needs attention</span> : <StatusBadge status={order.status} />}
                        {order.is_test && (
                          <span className="inline-flex items-center rounded-full bg-[rgba(200,136,30,0.14)] px-2 py-0.5 text-xs font-bold text-[var(--od-brand-strong)]">
                            Test
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500">
                        from{' '}
                        <span className="font-medium text-ink-2">{listingName}</span>
                        {subdomain ? (
                          <span className="text-gray-400"> · {subdomain}.ourdahanu.in</span>
                        ) : null}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {formatDate(order.created_at)} · Order #{order.id.slice(0, 8)}
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="font-bold text-brand">
                        ₹{Number(order.amount_total).toLocaleString('en-IN')}
                      </p>
                      <p className="text-xs text-gray-400">
                        ×{order.quantity} @ ₹
                        {Number(order.service_price).toLocaleString('en-IN')}
                      </p>
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
