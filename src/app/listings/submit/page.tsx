import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { CheckCircle, Star, Edit3, ImageIcon, Package, ArrowRight } from 'lucide-react'
import ListingSubmitForm from './ListingSubmitForm'
import { getPricingConfig, getActiveCoupons } from '@/app/actions/pricing'

export const metadata: Metadata = {
  title: 'Submit Listing',
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

export default async function SubmitListingPage({
  searchParams,
}: {
  searchParams: Promise<{ submitted?: string; name?: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?next=/listings/submit')

  const { submitted, name } = await searchParams

  if (submitted === '1') {
    const userName = user.user_metadata?.full_name || user.email?.split('@')[0] || 'there'
    const firstName = userName.split(' ')[0]
    const bizName = name ? decodeURIComponent(name) : 'your business'

    return (
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-14">

        {/* Hero card */}
        <div className="bg-gradient-to-br from-brand to-ink rounded-3xl p-8 text-bg text-center mb-8 relative overflow-hidden">
          <div className="absolute inset-0 opacity-5 text-8xl flex flex-wrap gap-6 p-6 pointer-events-none select-none">
            🎉🌴🏪🌟🎊🏡
          </div>
          <div className="relative">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gold/20 border-2 border-gold mb-5">
              <CheckCircle size={32} className="text-gold" />
            </div>
            <h1 className="text-2xl md:text-3xl font-bold mb-3 leading-snug">
              Welcome to the family, {firstName}! 🎉
            </h1>
            <p className="text-border text-base leading-relaxed max-w-lg mx-auto">
              Dear <strong className="text-bg">{firstName}</strong>, you are now part of the big <strong className="text-gold">OurDahanu</strong> online family.
              Together, we will give <strong className="text-bg">{bizName}</strong> the visibility it truly deserves — reaching thousands of people right here in Dahanu and beyond.
            </p>
          </div>
        </div>

        {/* What's next */}
        <div className="bg-amber-50 border border-amber-200 rounded-2xl px-6 py-5 mb-8 flex gap-4 items-start">
          <div className="text-2xl mt-0.5">⏳</div>
          <div>
            <p className="font-bold text-amber-800 mb-1">Approval in progress</p>
            <p className="text-amber-700 text-sm leading-relaxed">
              Our team will review and publish <strong>{bizName}</strong> within <strong>48 hours</strong>.
              Once live, thousands of people in Dahanu will be able to find you.
            </p>
          </div>
        </div>

        {/* Customise your listing */}
        <div className="bg-white border border-gray-100 rounded-2xl p-6 mb-8">
          <h2 className="font-bold text-gray-900 text-lg mb-1">Make it yours — customise your listing</h2>
          <p className="text-gray-500 text-sm mb-5">
            After approval, head to <strong>My Business</strong> to make your profile shine. Here&rsquo;s what you can add:
          </p>
          <div className="space-y-4">
            {[
              { icon: <Package size={18} className="text-brand" />, title: 'Products & Services', desc: 'List everything you offer — with names, descriptions and prices.' },
              { icon: <ImageIcon size={18} className="text-brand" />, title: 'Cover Photo & Logo', desc: 'A great photo makes customers trust you instantly.' },
              { icon: <Star size={18} className="text-brand" />, title: 'Your Tagline / Motto', desc: 'Tell people what makes you special in one line.' },
              { icon: <Edit3 size={18} className="text-brand" />, title: 'WhatsApp, Instagram & More', desc: 'Add your contact links so customers can reach you easily.' },
            ].map(item => (
              <div key={item.title} className="flex gap-3 items-start">
                <div className="w-8 h-8 rounded-lg bg-surface-soft flex items-center justify-center flex-shrink-0 mt-0.5">
                  {item.icon}
                </div>
                <div>
                  <p className="font-semibold text-gray-800 text-sm">{item.title}</p>
                  <p className="text-gray-500 text-xs">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Closing message */}
        <div className="text-center mb-8 px-4">
          <p className="text-gray-600 text-sm leading-relaxed italic">
            &ldquo;This is just the beginning, {firstName}. Let&rsquo;s start this growth journey together — OurDahanu is rooting for <strong>{bizName}</strong>.&rdquo; 🌱
          </p>
        </div>

        {/* CTAs */}
        <div className="flex flex-col sm:flex-row gap-3">
          <Link href="/my-business"
            className="flex-1 flex items-center justify-center gap-2 bg-brand hover:bg-brand-strong text-bg font-bold px-6 py-3.5 rounded-xl transition-colors text-sm">
            Go to My Business <ArrowRight size={15} />
          </Link>
          <Link href="/listings"
            className="flex-1 flex items-center justify-center gap-2 border border-gray-200 hover:bg-gray-50 text-gray-700 font-semibold px-6 py-3.5 rounded-xl transition-colors text-sm">
            Browse Listings
          </Link>
        </div>

      </div>
    )
  }

  const userName  = user.user_metadata?.full_name || user.email?.split('@')[0] || ''
  const userEmail = user.email || ''

  const [pricing, activeCoupons] = await Promise.all([getPricingConfig(), getActiveCoupons()])

  return (
    <ListingSubmitForm
      userEmail={userEmail}
      userName={userName}
      basePrice={pricing.current_price}
      originalPrice={pricing.base_price}
      activeCoupons={activeCoupons.map(c => ({
        code: c.code,
        label: c.label,
        finalPrice: c.final_price,
      }))}
    />
  )
}
