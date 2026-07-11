'use server'

import { createClient } from '@/lib/supabase/server'
import { isValidProfession } from '@/lib/find/professions'
import { rateLimit } from '@/lib/rate-limit'

export interface SubmitProfessionalInput {
  name: string
  phone: string
  whatsapp: boolean
  profession: string
  professionOther?: string
  locality?: string
  note?: string
}

export async function submitProfessional(
  input: SubmitProfessionalInput,
): Promise<{ error?: string; ok?: boolean }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Please log in to add a professional.' }

  const limit = rateLimit(`find-submit:${user.id}`, 5, 60 * 60 * 1000)
  if (!limit.ok) return { error: 'Too many submissions. Please try again later.' }

  const name = input.name?.trim()
  const phone = input.phone?.trim()
  const profession = input.profession?.trim()
  if (!name) return { error: 'Name is required.' }
  if (!phone || phone.replace(/\D/g, '').length < 7) return { error: 'A valid phone number is required.' }
  if (!profession || !isValidProfession(profession)) return { error: 'Please select a valid profession.' }
  const professionOther = profession === 'Other' ? (input.professionOther?.trim() || null) : null
  if (profession === 'Other' && !professionOther) return { error: 'Please describe the profession.' }

  const { error } = await supabase.from('find_professionals').insert({
    name,
    phone,
    whatsapp: !!input.whatsapp,
    profession,
    profession_other: professionOther,
    locality: input.locality?.trim() || null,
    note: input.note?.trim() || null,
    status: 'pending',
    submitted_by: user.id,
  })
  if (error) return { error: error.message }
  return { ok: true }
}
