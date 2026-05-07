import Link from 'next/link'
import { redirect } from 'next/navigation'

import { getUserRole } from '@/app/actions/admin'
import { createAdminClient } from '@/lib/supabase/admin-client'
import { createClient } from '@/lib/supabase/server'

interface IntentRow {
  id: string
  user_id: string
  flow: string
  razorpay_order_id: string
  razorpay_payment_id: string | null
  amount_paise: number
  status: string
  entity_id: string | null
  entity_table: string | null
  listing_id: string | null
  payload: Record<string, unknown>
  last_error: string | null
  retry_count: number
  created_at: string
  captured_at: string | null
  finalized_at: string | null
}

const STATUS_TONE: Record<string, string> = {
  created: 'bg-gray-100 text-gray-700',
  captured: 'bg-amber-100 text-amber-800',
  finalized: 'bg-green-100 text-green-800',
  failed: 'bg-red-100 text-red-700',
  cancelled: 'bg-gray-100 text-gray-500',
}

function fmtPaise(paise: number): string {
  return `₹${(paise / 100).toLocaleString('en-IN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`
}

function fmtDate(value: string | null): string {
  if (!value) return '—'
  const d = new Date(value)
  return d.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default async function AdminPaymentIntentsPage() {
  const supabase = await createClient()
  const { role } = await getUserRole(supabase)
  if (role !== 'admin') redirect('/')

  const adminClient = createAdminClient()
  if (!adminClient) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-700">
        Server configuration error — SUPABASE_SERVICE_ROLE_KEY is not set.
      </div>
    )
  }

  const { data: orphans } = await adminClient
    .from('payment_intents')
    .select('*')
    .in('status', ['captured', 'failed'])
    .order('created_at', { ascending: false })
    .limit(100)

  const { data: recent } = await adminClient
    .from('payment_intents')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50)

  const orphanRows = (orphans ?? []) as IntentRow[]
  const recentRows = (recent ?? []) as IntentRow[]

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Payment Intents</h1>
        <p className="mt-1 text-sm text-gray-500">
          Tracks every Razorpay payment from the moment we ask for an order id to the moment
          the local entity is finalized. &quot;Captured&quot; rows are paid-but-not-yet-finalized —
          these are the ones to investigate.
        </p>
      </div>

      <section>
        <h2 className="mb-3 text-lg font-bold text-gray-900">
          Orphans needing attention ({orphanRows.length})
        </h2>
        {orphanRows.length === 0 ? (
          <div className="rounded-2xl border border-green-200 bg-green-50 p-6 text-green-700">
            ✅ No paid-but-unfinalized intents right now.
          </div>
        ) : (
          <IntentTable rows={orphanRows} highlight />
        )}
      </section>

      <section>
        <h2 className="mb-3 text-lg font-bold text-gray-900">Recent intents</h2>
        <IntentTable rows={recentRows} />
      </section>
    </div>
  )
}

function IntentTable({ rows, highlight = false }: { rows: IntentRow[]; highlight?: boolean }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white">
      <table className="min-w-full divide-y divide-gray-200 text-sm">
        <thead className="bg-gray-50">
          <tr>
            <Th>Status</Th>
            <Th>Flow</Th>
            <Th>Amount</Th>
            <Th>Razorpay Order</Th>
            <Th>Payment ID</Th>
            <Th>Created</Th>
            <Th>Captured</Th>
            <Th>Finalized</Th>
            <Th>Entity</Th>
            <Th>Retries</Th>
            <Th>Last Error</Th>
            <Th>Actions</Th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {rows.map((row) => (
            <tr key={row.id} className={highlight ? 'bg-amber-50/30' : ''}>
              <td className="px-3 py-2">
                <span
                  className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${
                    STATUS_TONE[row.status] ?? 'bg-gray-100 text-gray-700'
                  }`}
                >
                  {row.status}
                </span>
              </td>
              <td className="px-3 py-2 font-medium text-gray-700">{row.flow}</td>
              <td className="px-3 py-2 font-mono text-xs text-gray-700">
                {fmtPaise(row.amount_paise)}
              </td>
              <td className="px-3 py-2 font-mono text-xs text-gray-500">
                {row.razorpay_order_id}
              </td>
              <td className="px-3 py-2 font-mono text-xs text-gray-500">
                {row.razorpay_payment_id ?? '—'}
              </td>
              <td className="px-3 py-2 text-xs text-gray-500">{fmtDate(row.created_at)}</td>
              <td className="px-3 py-2 text-xs text-gray-500">{fmtDate(row.captured_at)}</td>
              <td className="px-3 py-2 text-xs text-gray-500">{fmtDate(row.finalized_at)}</td>
              <td className="px-3 py-2 font-mono text-xs text-gray-500">
                {row.entity_table ? (
                  <span>
                    {row.entity_table}
                    <br />
                    <span className="text-gray-400">{row.entity_id?.slice(0, 8) ?? ''}</span>
                  </span>
                ) : (
                  '—'
                )}
              </td>
              <td className="px-3 py-2 text-xs text-gray-500">{row.retry_count}</td>
              <td className="px-3 py-2 max-w-xs truncate text-xs text-red-600" title={row.last_error ?? ''}>
                {row.last_error ?? '—'}
              </td>
              <td className="px-3 py-2 text-xs">
                <Link
                  href={`/payments/recover/${encodeURIComponent(row.razorpay_order_id)}`}
                  className="text-brand hover:underline"
                >
                  Inspect →
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
      {children}
    </th>
  )
}
