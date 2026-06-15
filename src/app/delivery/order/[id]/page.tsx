import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

import { getDeliveryTracking } from '@/app/actions/delivery'
import { createClient } from '@/lib/supabase/server'

import { DeliveryTracker } from './DeliveryTracker'

export const metadata = { title: 'Track delivery — OurDahanu' }

export default async function TrackDeliveryPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(`/login?next=/delivery/order/${id}`)

  const { tracking, error } = await getDeliveryTracking(id)
  if (error || !tracking) notFound()

  return (
    <div className="od-page min-h-screen">
      <div className="mx-auto max-w-md px-4 py-8 sm:px-6">
        <Link href="/account/orders" className="inline-flex items-center gap-1.5 text-sm text-[var(--od-muted)] hover:text-brand transition-colors">
          <ArrowLeft size={14} /> My orders
        </Link>
        <DeliveryTracker orderId={id} initial={tracking} />
      </div>
    </div>
  )
}
