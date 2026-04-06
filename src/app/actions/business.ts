'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

export async function updateListing(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const id = formData.get('id') as string
  if (!id) {
    return { error: 'Listing ID is required.' }
  }

  // Ownership check
  const { data: existing, error: fetchError } = await supabase
    .from('listings')
    .select('id, owner_id')
    .eq('id', id)
    .single()

  if (fetchError || !existing) {
    return { error: 'Listing not found.' }
  }

  if (existing.owner_id !== user.id) {
    return { error: 'You do not have permission to edit this listing.' }
  }

  const updates: Record<string, unknown> = {}
  const fields = ['name', 'description', 'category', 'phone', 'address', 'website', 'image_url']
  for (const field of fields) {
    const val = formData.get(field)
    if (val !== null) updates[field] = val as string
  }
  updates.updated_at = new Date().toISOString()

  const { error: updateError } = await supabase
    .from('listings')
    .update(updates)
    .eq('id', id)
    .eq('owner_id', user.id)

  if (updateError) {
    return { error: updateError.message }
  }

  revalidatePath('/my-business')
  revalidatePath('/listings/' + id)

  return { success: true }
}
