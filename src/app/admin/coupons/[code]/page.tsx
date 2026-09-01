import Link from 'next/link'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getUserRole } from '@/app/actions/admin'
import { fetchRedemptionsForCode } from '@/lib/data/coupon-redemptions'

export default async function CouponDrilldownPage({
  params,
}: {
  params: Promise<{ code: string }>
}) {
  const supabase = await createClient()
  const { role, user } = await getUserRole(supabase)
  if (!user) redirect('/login')
  if (role !== 'admin' && role !== 'moderator') redirect('/')

  const { code } = await params
  const rows = await fetchRedemptionsForCode(code)

  return (
    <div className="max-w-4xl">
      <Link href="/admin/coupons" className="text-sm text-gray-500 hover:text-gray-900">
        ← All coupons
      </Link>
      <h1 className="mt-2 text-2xl font-bold text-gray-900 font-mono">{code}</h1>
      <p className="text-sm text-gray-500 mt-1">{rows.length} redemptions</p>

      {rows.length === 0 ? (
        <p className="mt-6 text-sm text-gray-400">No redemptions for this code.</p>
      ) : (
        <div className="mt-6 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b">
                <th className="py-2">Business</th>
                <th className="py-2">Kind</th>
                <th className="py-2">When</th>
                <th className="py-2 text-right">Paid</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.id} className="border-b last:border-0">
                  <td className="py-2">
                    {r.listing_id ? (
                      <Link href={`/listings/${r.listing_id}`} className="text-[#C0582E] hover:underline">
                        {r.listing_name ?? 'View listing'}
                      </Link>
                    ) : (
                      <span className="text-gray-400">deleted listing</span>
                    )}
                  </td>
                  <td className="py-2">{r.kind}</td>
                  <td className="py-2">{new Date(r.redeemed_at).toLocaleDateString('en-IN')}</td>
                  <td className="py-2 text-right">
                    {r.payment_status === 'free_coupon' ? 'free' : `₹${r.amount_paid}`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
