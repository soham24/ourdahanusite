import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getUserRole } from '@/app/actions/admin'
import { getPricingConfig, getAllCoupons } from '@/app/actions/pricing'
import PricingManager from './PricingManager'
import { BadgePercent } from 'lucide-react'

export default async function AdminPricingPage() {
  const supabase = await createClient()
  const { role, user } = await getUserRole(supabase)
  if (!user) redirect('/login')
  if (role !== 'admin' && role !== 'moderator') redirect('/')

  const [pricing, coupons] = await Promise.all([getPricingConfig(), getAllCoupons()])

  return (
    <div className="max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <BadgePercent size={22} className="text-purple-500" />
          Pricing & Coupons
        </h1>
        <p className="text-gray-500 text-sm mt-1">
          Control listing prices and manage discount coupon codes.
        </p>
      </div>

      <PricingManager pricing={pricing} coupons={coupons} />
    </div>
  )
}
