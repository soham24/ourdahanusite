import { createAdminClient } from '@/lib/supabase/admin-client'
import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, MapPin } from 'lucide-react'
import { getUserRole } from '@/app/actions/admin'
import EditListingForm from '@/app/my-business/edit/[id]/EditListingForm'
import AssignOwner from './AssignOwner'

export default async function AdminEditListingPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const supabase = await createClient()
  const { user, role } = await getUserRole(supabase)
  if (!user) redirect('/login')
  if (role !== 'admin' && role !== 'moderator') redirect('/')

  const adminClient = createAdminClient()
  if (!adminClient) return <p className="p-8 text-red-500">Admin client unavailable.</p>

  const { data: listing } = await adminClient
    .from('listings')
    .select('*')
    .eq('id', id)
    .single()

  if (!listing) notFound()

  // Fetch current owner email from auth.users
  let ownerEmail: string | null = null
  if (listing.owner_id) {
    try {
      const { data: { user: ownerUser } } = await adminClient.auth.admin.getUserById(listing.owner_id)
      ownerEmail = ownerUser?.email ?? null
    } catch { /* ignore */ }
  }

  return (
    <div className="max-w-3xl">
      <Link
        href="/admin/listings"
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-blue-600 mb-6 transition-colors"
      >
        <ArrowLeft size={14} /> Back to Listings
      </Link>

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <MapPin size={20} className="text-blue-500" />
          Edit Listing (Admin)
        </h1>
        <p className="text-gray-500 text-sm mt-1">{listing.name} · ID: {id}</p>
      </div>

      <EditListingForm listing={listing} />

      <AssignOwner
        listingId={id}
        currentOwnerEmail={ownerEmail}
      />
    </div>
  )
}
