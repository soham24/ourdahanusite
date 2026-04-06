import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, PlusCircle } from 'lucide-react'
import { getUserRole } from '@/app/actions/admin'
import AdminNewListingForm from './AdminNewListingForm'

export default async function AdminNewListingPage() {
  const supabase = await createClient()
  const { role, user } = await getUserRole(supabase)
  if (!user) redirect('/login')
  if (role !== 'admin' && role !== 'moderator') redirect('/')

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
          <PlusCircle size={22} className="text-blue-500" />
          Create New Listing
        </h1>
        <p className="text-gray-500 text-sm mt-1">Manually add a business and optionally link it to a user account.</p>
      </div>

      <AdminNewListingForm />
    </div>
  )
}
