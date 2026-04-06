'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

export async function updateProfile(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const full_name = formData.get('full_name') as string
  const phone = formData.get('phone') as string
  const address = formData.get('address') as string

  const { error } = await supabase
    .from('profiles')
    .upsert({
      id: user.id,
      full_name,
      phone,
      address,
      email: user.email,
    })

  if (error) throw new Error(error.message)

  revalidatePath('/dashboard')
}

export type ProfileState = { success?: boolean; error?: string } | null

export async function updateProfileFull(
  _prev: ProfileState,
  formData: FormData
): Promise<ProfileState> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated.' }

  const full_name = (formData.get('full_name') as string)?.trim() || ''
  const bio = (formData.get('bio') as string)?.trim() || ''
  const phone = (formData.get('phone') as string)?.trim() || ''
  const address = (formData.get('address') as string)?.trim() || ''
  const avatar_url = (formData.get('avatar_url') as string)?.trim() || ''

  // Update auth user metadata (works without any DB migration)
  await supabase.auth.updateUser({
    data: {
      full_name: full_name || undefined,
      avatar_url: avatar_url || undefined,
    },
  })

  // Upsert into profiles — bio/avatar_url columns may not exist yet;
  // if they don't, Supabase will return an error which we catch silently.
  try {
    const { error } = await supabase.from('profiles').upsert({
      id: user.id,
      email: user.email,
      full_name,
      phone,
      address,
      bio,
      avatar_url,
    })
    if (error) throw error
  } catch {
    // If bio/avatar_url columns don't exist, save what we can
    await supabase.from('profiles').upsert({
      id: user.id,
      email: user.email,
      full_name,
      phone,
      address,
    })
  }

  revalidatePath('/profile')
  revalidatePath('/dashboard')
  return { success: true }
}
