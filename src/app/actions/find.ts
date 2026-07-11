'use server'

import { createClient } from '@/lib/supabase/server'
import { isValidProfession } from '@/lib/find/professions'
import { rateLimit } from '@/lib/rate-limit'

export interface SubmitProfessionalInput {
  name: string
  phone: string
  whatsapp: boolean
  professions: string[]
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
  if (!name) return { error: 'Name is required.' }
  if (!phone || phone.replace(/\D/g, '').length < 7) return { error: 'A valid phone number is required.' }
  const professions = Array.isArray(input.professions)
    ? input.professions.map((p) => p.trim()).filter(Boolean)
    : []
  if (professions.length === 0) return { error: 'Please select at least one profession.' }
  if (professions.some((p) => !isValidProfession(p))) return { error: 'Please select valid professions.' }
  const professionOther = professions.includes('Other') ? (input.professionOther?.trim() || null) : null
  if (professions.includes('Other') && !professionOther) return { error: 'Please describe the profession.' }

  const { error } = await supabase.from('find_professionals').insert({
    name,
    phone,
    whatsapp: !!input.whatsapp,
    professions,
    profession_other: professionOther,
    locality: input.locality?.trim() || null,
    note: input.note?.trim() || null,
    status: 'pending',
    submitted_by: user.id,
  })
  if (error) return { error: error.message }
  return { ok: true }
}

export interface SubmitRatingInput {
  professionalId: string
  rating: number
  comment: string
  usedService: boolean
}

export async function submitRating(
  input: SubmitRatingInput,
): Promise<{ error?: string; ok?: boolean }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Please log in to rate.' }

  const limit = rateLimit(`find-rate:${user.id}`, 20, 60 * 60 * 1000)
  if (!limit.ok) return { error: 'Too many ratings. Please try again later.' }

  const rating = Number(input.rating)
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) return { error: 'Please choose 1–5 stars.' }
  const comment = input.comment?.trim()
  if (!comment) return { error: 'Please describe your experience.' }
  if (!input.usedService) return { error: 'Please confirm you have used this service.' }

  // Verify the professional exists and is live.
  const { data: pro } = await supabase
    .from('find_professionals')
    .select('id')
    .eq('id', input.professionalId)
    .eq('status', 'approved')
    .eq('is_active', true)
    .maybeSingle()
  if (!pro) return { error: 'Professional not found.' }

  // One rating per user per professional — upsert resets to pending.
  const { error } = await supabase.from('find_ratings').upsert(
    {
      professional_id: input.professionalId,
      user_id: user.id,
      rating,
      comment,
      used_service: true,
      status: 'pending',
    },
    { onConflict: 'professional_id,user_id' },
  )
  if (error) return { error: error.message }
  return { ok: true }
}
