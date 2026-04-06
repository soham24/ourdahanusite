import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getPricingConfig, getActiveCoupons } from '@/app/actions/pricing'
import JobSubmitForm from './JobSubmitForm'

export const metadata: Metadata = {
  title: 'Post a Job',
  robots: {
    index: false,
    follow: false,
    googleBot: {
      index: false,
      follow: false,
    },
  },
}

export const unstable_instant = false

export default async function JobSubmitPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?next=/jobs/submit')

  const [pricing, coupons] = await Promise.all([
    getPricingConfig(),
    getActiveCoupons(),
  ])

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', user.id)
    .single()

  const activeCoupons = coupons.map(c => ({
    code: c.code,
    label: c.label,
    finalPrice: c.final_price,
  }))

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Post a Job</h1>
        <p className="text-gray-500 mt-2">
          Reach thousands of local job seekers in Dahanu and surrounding areas.
        </p>
      </div>
      <JobSubmitForm
        userEmail={user.email ?? ''}
        userName={profile?.full_name ?? ''}
        basePrice={pricing.job_base_price}
        currentPrice={pricing.job_current_price}
        activeCoupons={activeCoupons}
      />
    </div>
  )
}
