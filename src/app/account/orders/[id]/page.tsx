import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import {
  ArrowLeft,
  CheckCircle,
  Clock,
  ExternalLink,
  MapPin,
  MessageCircle,
  Package,
  Phone,
  Receipt,
  XCircle,
} from 'lucide-react'

import { getMyMarketplaceOrder } from '@/app/actions/marketplace-orders'
import { orderItemName } from '@/lib/catalog/catalog'
import { createClient } from '@/lib/supabase/server'
import { siteConfig } from '@/lib/site'

interface PageProps {
  params: Promise<{ id: string }>
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
}

function StatusRow({ status }: { status: string }) {
  if (status === 'fulfilled') {
    return (
      <div className="flex items-center gap-2 text-green-700 bg-green-50 border border-green-100 rounded-xl px-4 py-3">
        <CheckCircle size={18} />
        <div>
          <p className="font-semibold text-sm">Fulfilled</p>
          <p className="text-xs text-green-600/80">
            The business has marked this order as delivered.
          </p>
        </div>
      </div>
    )
  }
  if (status === 'cancelled') {
    return (
      <div className="flex items-center gap-2 text-gray-500 bg-gray-50 border border-gray-100 rounded-xl px-4 py-3">
        <XCircle size={18} />
        <div>
          <p className="font-semibold text-sm">Cancelled</p>
          <p className="text-xs text-gray-400">
            This order was cancelled. Contact the business for details.
          </p>
        </div>
      </div>
    )
  }
  return (
    <div className="flex items-center gap-2 text-blue-700 bg-blue-50 border border-blue-100 rounded-xl px-4 py-3">
      <Clock size={18} />
      <div>
        <p className="font-semibold text-sm">Confirmed</p>
        <p className="text-xs text-blue-600/80">
          Payment received. The business will contact you shortly.
        </p>
      </div>
    </div>
  )
}

export default async function MyOrderDetailPage({ params }: PageProps) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    redirect('/login')
  }

  const { id } = await params
  const order = await getMyMarketplaceOrder(id)
  if (!order) notFound()

  const listingName = order.listing?.name || 'Business'
  const subdomain = order.listing?.subdomain
  const phone = order.listing?.phone
  const whatsapp = order.listing?.whatsapp || phone
  const itemName = orderItemName(order.service_name, order.option_label)

  const whatsappMessage = encodeURIComponent(
    `Hi ${listingName},\n\nI'm following up on my order #${order.id.slice(0, 8)} for "${itemName}" × ${order.quantity}.\n\nThanks!`,
  )

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      <Link
        href="/account/orders"
        className="inline-flex items-center gap-1.5 text-sm text-ink-2 hover:text-brand"
      >
        <ArrowLeft size={14} />
        All orders
      </Link>

      {/* Status + summary */}
      <section className="bg-white border border-gray-100 rounded-2xl p-5 sm:p-6 space-y-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
              Order #{order.id.slice(0, 8)}
            </p>
            <h1 className="text-xl font-bold text-gray-900 mt-1">{itemName}</h1>
            <p className="text-xs text-gray-500 mt-1">
              Placed on {formatDateTime(order.created_at)}
            </p>
          </div>
          <Package size={28} className="text-brand" />
        </div>

        <StatusRow status={order.status} />

        {order.fulfillment_issue && (
          <div role="status" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            <strong>Needs attention</strong>
            <p className="mt-1">The business needs to arrange your item or a refund. Do not pay again if asked. Contact the business using the details below.</p>
          </div>
        )}

        {order.is_test && (
          <p className="rounded-xl border border-[rgba(200,136,30,0.35)] bg-[rgba(200,136,30,0.07)] px-4 py-3 text-sm leading-relaxed text-[var(--od-ink-2)]">
            <strong className="font-bold">Test order</strong> · a practice purchase made with Razorpay test keys. No real money moved.
          </p>
        )}

        <div className="bg-surface-soft/40 border border-border/60 rounded-xl p-4 space-y-1.5">
          <p className="text-xs text-gray-500">Purchased from</p>
          <p className="font-semibold text-ink-2">{listingName}</p>
          {subdomain ? (
            <a
              href={`https://${subdomain}.${siteConfig.domain}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-xs text-brand hover:underline"
            >
              Visit {subdomain}.{siteConfig.domain}
              <ExternalLink size={11} />
            </a>
          ) : null}
        </div>
      </section>

      {/* Payment summary */}
      <section className="bg-white border border-gray-100 rounded-2xl p-5 sm:p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Receipt size={18} className="text-brand" />
          <h2 className="font-semibold text-gray-900">Payment summary</h2>
        </div>
        <dl className="text-sm space-y-1.5">
          <div className="flex justify-between">
            <dt className="text-gray-500">Item</dt>
            <dd className="text-gray-900 font-medium">
              {itemName} × {order.quantity}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-gray-500">Unit price</dt>
            <dd className="text-gray-900">
              ₹{Number(order.service_price).toLocaleString('en-IN')}
            </dd>
          </div>
          <div className="flex justify-between border-t border-gray-100 pt-2 mt-2">
            <dt className="font-semibold text-gray-900">Total paid</dt>
            <dd className="font-bold text-brand text-base">
              ₹{Number(order.amount_total).toLocaleString('en-IN')}
            </dd>
          </div>
        </dl>
        <div className="flex items-center gap-2 rounded-lg bg-green-50 border border-green-100 px-3 py-2">
          <CheckCircle size={14} className="text-green-600 flex-shrink-0" />
          <p className="text-xs text-green-700">
            Paid via Razorpay · Payment ID{' '}
            <span className="font-mono font-semibold">
              {order.owner_razorpay_payment_id || '—'}
            </span>
          </p>
        </div>
      </section>

      {/* Delivery + contact */}
      <section className="bg-white border border-gray-100 rounded-2xl p-5 sm:p-6 space-y-4">
        <h2 className="font-semibold text-gray-900">Your details</h2>
        <dl className="text-sm space-y-2">
          <div>
            <dt className="text-xs text-gray-500 mb-0.5">Name</dt>
            <dd className="text-gray-900">{order.buyer_name}</dd>
          </div>
          <div>
            <dt className="text-xs text-gray-500 mb-0.5">Phone</dt>
            <dd className="text-gray-900 flex items-center gap-1.5">
              <Phone size={12} className="text-gray-400" />
              {order.buyer_phone}
            </dd>
          </div>
          {order.delivery_address ? (
            <div>
              <dt className="text-xs text-gray-500 mb-0.5">Delivery address</dt>
              <dd className="text-gray-900 flex items-start gap-1.5">
                <MapPin size={12} className="text-gray-400 flex-shrink-0 mt-1" />
                <span className="whitespace-pre-wrap">{order.delivery_address}</span>
              </dd>
            </div>
          ) : null}
          {order.notes ? (
            <div>
              <dt className="text-xs text-gray-500 mb-0.5">Notes</dt>
              <dd className="text-gray-700 text-xs whitespace-pre-wrap">{order.notes}</dd>
            </div>
          ) : null}
        </dl>
      </section>

      {/* Contact business */}
      {whatsapp || phone ? (
        <section className="bg-white border border-gray-100 rounded-2xl p-5 sm:p-6 space-y-3">
          <h2 className="font-semibold text-gray-900">Need help?</h2>
          <p className="text-xs text-gray-500">
            Reach out to {listingName} directly for any questions about your order.
          </p>
          <div className="flex flex-wrap gap-2">
            {whatsapp ? (
              <a
                href={`https://wa.me/${whatsapp.replace(/\D/g, '')}?text=${whatsappMessage}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-xl text-sm font-semibold transition-colors"
              >
                <MessageCircle size={14} />
                WhatsApp
              </a>
            ) : null}
            {phone ? (
              <a
                href={`tel:${phone}`}
                className="inline-flex items-center gap-1.5 px-4 py-2 border border-gray-200 text-ink-2 hover:border-border rounded-xl text-sm font-semibold transition-colors"
              >
                <Phone size={14} />
                Call
              </a>
            ) : null}
          </div>
        </section>
      ) : null}
    </div>
  )
}
