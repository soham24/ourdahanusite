import { Wallet } from 'lucide-react'

import { requireAdminOrMod } from '@/app/actions/admin'
import { getSettlementSummary } from '@/app/actions/settlement'
import { createClient } from '@/lib/supabase/server'
import EmptyState from '@/components/ui/EmptyState'

import { SettlementList } from './SettlementList'

export const metadata = { title: 'Settlements — Admin' }

export default async function AdminSettlementsPage() {
  const supabase = await createClient()
  await requireAdminOrMod(supabase)

  const rows = await getSettlementSummary()

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-10 sm:px-6">
      <header className="flex items-center gap-3">
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand/10 text-brand"><Wallet size={24} /></span>
        <div>
          <h1 className="text-2xl font-bold text-[var(--od-ink)]">Rider settlements</h1>
          <p className="text-sm text-[var(--od-muted)]">Delivery fees owed to riders, and COD cash riders owe back.</p>
        </div>
      </header>

      {rows.length === 0 ? (
        <EmptyState icon={<Wallet size={26} />} title="All settled up" description="No pending rider payouts or COD reconciliations." />
      ) : (
        <SettlementList initialRows={rows} />
      )}
    </div>
  )
}
