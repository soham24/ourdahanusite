import Link from 'next/link'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getUserRole } from '@/app/actions/admin'
import { getCouponReport } from '@/app/actions/pricing'

export const metadata = { title: 'Coupon Report' }

export default async function AdminCouponsPage() {
  const supabase = await createClient()
  const { role, user } = await getUserRole(supabase)
  if (!user) redirect('/login')
  if (role !== 'admin' && role !== 'moderator') redirect('/')

  const { byCoupon, byPerson } = await getCouponReport()

  return (
    <div className="max-w-5xl space-y-10">
      <header>
        <h1 className="text-2xl font-bold text-gray-900">Coupon Report</h1>
        <p className="text-sm text-gray-500 mt-1">
          Counted only on successful payment and registration.
        </p>
      </header>

      <section>
        <h2 className="text-lg font-semibold text-gray-900 mb-3">By person</h2>
        {byPerson.length === 0 ? (
          <p className="text-sm text-gray-400">No redemptions yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b">
                  <th className="py-2">Person</th>
                  <th className="py-2">Codes</th>
                  <th className="py-2 text-right">Registrations</th>
                  <th className="py-2 text-right">Revenue</th>
                </tr>
              </thead>
              <tbody>
                {byPerson.map(p => (
                  <tr key={p.person} className="border-b last:border-0">
                    <td className="py-2 font-medium text-gray-900">{p.person}</td>
                    <td className="py-2 font-mono text-xs text-gray-500">{p.codes.join(', ')}</td>
                    <td className="py-2 text-right">{p.total}</td>
                    <td className="py-2 text-right">₹{p.revenue}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section>
        <h2 className="text-lg font-semibold text-gray-900 mb-3">By coupon</h2>
        {byCoupon.length === 0 ? (
          <p className="text-sm text-gray-400">No redemptions yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b">
                  <th className="py-2">Code</th>
                  <th className="py-2 text-right">New</th>
                  <th className="py-2 text-right">Renewals</th>
                  <th className="py-2 text-right">Total</th>
                  <th className="py-2 text-right">Revenue</th>
                </tr>
              </thead>
              <tbody>
                {byCoupon.map(c => (
                  <tr key={c.code} className="border-b last:border-0">
                    <td className="py-2 font-mono font-medium text-gray-900">
                      <Link href={`/admin/coupons/${c.code}`} className="hover:underline">{c.code}</Link>
                    </td>
                    <td className="py-2 text-right">{c.newCount}</td>
                    <td className="py-2 text-right">{c.renewalCount}</td>
                    <td className="py-2 text-right font-semibold">{c.total}</td>
                    <td className="py-2 text-right">₹{c.revenue}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
