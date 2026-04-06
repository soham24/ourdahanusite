'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

export async function submitClassified(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Get seller name from profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', user.id)
    .single()

  const sellerName = profile?.full_name || user.email?.split('@')[0] || 'Member'

  const type = formData.get('type') as string
  const title = formData.get('title') as string
  const description = formData.get('description') as string
  const priceRaw = formData.get('price')
  const price = priceRaw ? Number(priceRaw) : null
  const location = formData.get('location') as string
  const urgent = formData.get('urgent') === 'on'

  const { error } = await supabase.from('classifieds').insert({
    seller_id: user.id,
    seller_name: sellerName,
    type,
    title,
    description,
    price,
    location,
    urgent,
    active: true,
    approved: true, // classifieds auto-publish
  })

  if (error) throw new Error(error.message)

  void import('@/lib/notify-admin').then(m =>
    m.notifyAdmin('classified', title, sellerName)
  )

  revalidatePath('/classifieds')
  redirect('/classifieds?submitted=1')
}

export async function deactivateClassified(id: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Ownership check
  const { data: classified } = await supabase
    .from('classifieds')
    .select('seller_id')
    .eq('id', id)
    .single()

  if (!classified || classified.seller_id !== user.id) {
    throw new Error('Unauthorized')
  }

  const { error } = await supabase
    .from('classifieds')
    .update({ active: false })
    .eq('id', id)

  if (error) throw new Error(error.message)

  revalidatePath('/classifieds')
}
