import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowLeft, Bike } from 'lucide-react'

import { getOwnerDeliveryOrders } from '@/app/actions/delivery'
import { createClient } from '@/lib/supabase/server'
import EmptyState from '@/components/ui/EmptyState'

import { DeliveryOrdersBoard } from './DeliveryOrdersBoard'

export default async function DeliveryOrdersPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const orders = await getOwnerDeliveryOrders()

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-10 sm:px-6">
      <Link href="/my-business/delivery" className="inline-flex items-center gap-1.5 text-sm text-[var(--od-muted)] hover:text-brand transition-colors">
        <ArrowLeft size={14} /> Delivery setup
      </Link>

      <header className="rounded-[30px] border border-[var(--od-border)] bg-gradient-to-br from-[#fff7ef] via-white to-[#f4ede4] px-6 py-7 shadow-sm sm:px-8">
        <div className="flex items-start gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand/10 text-brand"><Bike size={24} /></span>
          <div>
            <h1 className="text-2xl font-bold text-[var(--od-ink)]">Delivery orders</h1>
            <p className="mt-2 text-sm leading-6 text-[var(--od-ink-2)]">
              Accept new orders, mark them preparing, then ready for pickup. A rider is dispatched once an order is ready.
            </p>
          </div>
        </div>
      </header>

      {orders.length === 0 ? (
        <EmptyState icon="🧾" title="No delivery orders yet" description="New orders from customers will appear here." />
      ) : (
        <DeliveryOrdersBoard initialOrders={orders} />
      )}
    </div>
  )
}
