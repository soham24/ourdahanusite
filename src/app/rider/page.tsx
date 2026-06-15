import { redirect } from 'next/navigation'
import { Bike, Clock } from 'lucide-react'

import { getMyRider, getRiderEarnings } from '@/app/actions/rider'
import { createClient } from '@/lib/supabase/server'

import { RiderOnboarding } from './RiderOnboarding'
import { RiderDashboard } from './RiderDashboard'

export const metadata = { title: 'Rider — OurDahanu' }

export default async function RiderPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?next=/rider')

  const rider = await getMyRider()

  return (
    <div className="od-page min-h-screen">
      <div className="mx-auto max-w-xl px-4 py-10 sm:px-6">
        <header className="mb-6 flex items-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand/10 text-brand"><Bike size={24} /></span>
          <div>
            <h1 className="text-2xl font-bold text-[var(--od-ink)]">Rider</h1>
            <p className="text-sm text-[var(--od-muted)]">Deliver for local Dahanu businesses.</p>
          </div>
        </header>

        {!rider ? (
          <RiderOnboarding />
        ) : rider.status === 'pending' ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-center">
            <Clock size={28} className="mx-auto text-amber-600" />
            <h2 className="mt-3 text-lg font-bold text-amber-900">Application under review</h2>
            <p className="mt-1 text-sm text-amber-800">
              Thanks, {rider.full_name.split(' ')[0]}! Our team will verify your details and approve your rider account shortly.
            </p>
          </div>
        ) : rider.status === 'suspended' ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center">
            <h2 className="text-lg font-bold text-red-800">Account suspended</h2>
            <p className="mt-1 text-sm text-red-700">Please contact OurDahanu support.</p>
          </div>
        ) : (
          <RiderDashboard rider={rider} earnings={await getRiderEarnings()} />
        )}
      </div>
    </div>
  )
}
