import { Bike } from 'lucide-react'

import { requireAdminOrMod } from '@/app/actions/admin'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin-client'
import EmptyState from '@/components/ui/EmptyState'

import { RiderApprovalList, type AdminRider } from './RiderApprovalList'

export const metadata = { title: 'Riders — Admin' }

export default async function AdminRidersPage() {
  const supabase = await createClient()
  await requireAdminOrMod(supabase)

  const admin = createAdminClient()
  const { data } = admin
    ? await admin
        .from('riders')
        .select('id, full_name, phone, vehicle_type, status, is_online, payout_upi, created_at')
        .order('created_at', { ascending: false })
        .limit(300)
    : { data: [] }

  const riders = (data ?? []) as AdminRider[]

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-10 sm:px-6">
      <header className="flex items-center gap-3">
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand/10 text-brand"><Bike size={24} /></span>
        <div>
          <h1 className="text-2xl font-bold text-[var(--od-ink)]">Riders</h1>
          <p className="text-sm text-[var(--od-muted)]">Approve, suspend, or re-enable delivery riders.</p>
        </div>
      </header>

      {riders.length === 0 ? (
        <EmptyState icon={<Bike size={26} />} title="No rider applications yet" />
      ) : (
        <RiderApprovalList initialRiders={riders} />
      )}
    </div>
  )
}
