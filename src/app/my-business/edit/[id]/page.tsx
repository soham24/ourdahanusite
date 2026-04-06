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

  return <EditListingForm listing={listing} />
}
