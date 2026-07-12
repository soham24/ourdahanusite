import type { User } from '@supabase/supabase-js'
import type { NotificationPayload } from '@/lib/notifications'
import { completeFindWrite } from './find-notifications'

export interface FindActionDependencies {
  getUser(): Promise<User | null>
  rateLimit(key: string, limit: number, windowMs: number): { ok: boolean }
  isValidProfession(value: string): boolean
  insertProfessional(row: Record<string, unknown>): Promise<{ error: { message: string } | null }>
  findProfessional(id: string): Promise<{ id: string; name: string } | null>
  upsertRating(row: Record<string, unknown>): Promise<{ error: { message: string } | null }>
  notify(type: 'admin.new_submission', payload: NotificationPayload<'admin.new_submission'>): unknown
}

function displayName(user: User): string | null {
  const fullName = user.user_metadata.full_name
  return typeof fullName === 'string' && fullName.trim() ? fullName.trim() : user.email ?? null
}

export interface SubmitProfessionalInput { name: string; phone: string; whatsapp: boolean; professions: string[]; professionOther?: string; locality?: string; note?: string }
export interface SubmitRatingInput { professionalId: string; rating: number; comment: string; usedService: boolean }

export function createFindActions(deps: FindActionDependencies) {
  async function submitProfessional(input: SubmitProfessionalInput): Promise<{ error?: string; ok?: boolean }> {
    const user = await deps.getUser()
    if (!user) return { error: 'Please log in to add a professional.' }
    if (!deps.rateLimit(`find-submit:${user.id}`, 5, 60 * 60 * 1000).ok) return { error: 'Too many submissions. Please try again later.' }
    const name = input.name?.trim(); const phone = input.phone?.trim()
    if (!name) return { error: 'Name is required.' }
    if (!phone || phone.replace(/\D/g, '').length < 7) return { error: 'A valid phone number is required.' }
    const professions = Array.from(new Set((Array.isArray(input.professions) ? input.professions : []).map((p) => p.trim()).filter(Boolean)))
    if (!professions.length) return { error: 'Please select at least one profession.' }
    if (professions.some((p) => !deps.isValidProfession(p))) return { error: 'Please select valid professions.' }
    const professionOther = professions.includes('Other') ? input.professionOther?.trim() || null : null
    if (professions.includes('Other') && !professionOther) return { error: 'Please describe the profession.' }
    const { error } = await deps.insertProfessional({ name, phone, whatsapp: !!input.whatsapp, professions, profession_other: professionOther, locality: input.locality?.trim() || null, note: input.note?.trim() || null, status: 'pending', submitted_by: user.id })
    return completeFindWrite(error, { kind: 'professional', title: name, submitterName: displayName(user), reviewPath: '/admin/find' }, deps.notify, '[find:submitProfessional:notify]')
  }

  async function submitRating(input: SubmitRatingInput): Promise<{ error?: string; ok?: boolean }> {
    const user = await deps.getUser()
    if (!user) return { error: 'Please log in to rate.' }
    if (!deps.rateLimit(`find-rate:${user.id}`, 20, 60 * 60 * 1000).ok) return { error: 'Too many ratings. Please try again later.' }
    const rating = Number(input.rating); const comment = input.comment?.trim()
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) return { error: 'Please choose 1–5 stars.' }
    if (!comment) return { error: 'Please describe your experience.' }
    if (!input.usedService) return { error: 'Please confirm you have used this service.' }
    const pro = await deps.findProfessional(input.professionalId)
    if (!pro) return { error: 'Professional not found.' }
    const { error } = await deps.upsertRating({ professional_id: input.professionalId, user_id: user.id, rating, comment, used_service: true, status: 'pending' })
    return completeFindWrite(error, { kind: 'professional_review', title: `${pro.name} · ${rating}/5`, submitterName: displayName(user), reviewPath: '/admin/find' }, deps.notify, '[find:submitRating:notify]')
  }
  return { submitProfessional, submitRating }
}
