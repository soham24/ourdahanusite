import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import SubmitProfessionalForm from './SubmitProfessionalForm'

export default async function SubmitPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  return (
    <div className="mx-auto max-w-lg">
      <h1 className="mb-1 text-2xl font-bold">Add a professional</h1>
      <p className="mb-5 text-sm text-gray-600">Suggest someone useful. A moderator reviews every submission before it goes live.</p>
      {user ? (
        <SubmitProfessionalForm />
      ) : (
        <div className="rounded-lg border border-gray-200 bg-white p-5 text-center">
          <p className="mb-3 text-sm text-gray-700">Please log in to add a professional.</p>
          <Link href="/login" className="rounded-md bg-[var(--od-brand,#c0582e)] px-4 py-2 text-sm font-semibold text-white">Log in</Link>
        </div>
      )}
    </div>
  )
}
