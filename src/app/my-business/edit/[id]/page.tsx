import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import EditListingForm from './EditListingForm'

export default async function EditListingPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: listing } = await supabase
    .from('listings')
    .select('*')
    .eq('id', id)
    .eq('owner_id', user.id)
    .single()

  if (!listing) notFound()

  const { count: catalogItemCount } = await supabase
    .from('listing_products')
    .select('id', { count: 'exact', head: true })
    .eq('listing_id', id)

  return (
    <EditListingForm
      listing={listing}
      catalogItemCount={catalogItemCount ?? 0}
      manageHref={`/my-business/products/${id}`}
    />
  )
}
