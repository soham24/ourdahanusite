import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { notFound } from 'next/navigation'
import RenewForm from './RenewForm'
import { getPricingConfig } from '@/app/actions/pricing'

export default async function RenewListingPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?next=/my-business')

  // Fetch the listing — owner-only (RLS enforced via .eq owner_id)
  const { data: listing } = await supabase
    .from('listings')
    .select('id, name, expires_at, owner_id')
    .eq('id', id)
    .eq('owner_id', user.id)
    .single()

  if (!listing) notFound()

  const pricing = await getPricingConfig()

  return (
    <RenewForm
      listingId={listing.id as string}
      listingName={listing.name as string}
      currentExpiresAt={listing.expires_at as string | null}
      userEmail={user.email ?? ''}
      userName={
        (user.user_metadata?.full_name as string) ||
        user.email?.split('@')[0] ||
        ''
      }
      basePrice={pricing.current_price}
      originalPrice={pricing.base_price}
    />
  )
}
