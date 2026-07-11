'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin-client'
import { requireAdmin } from '@/app/actions/admin'
import { isValidProfession } from '@/lib/find/professions'

export interface AdminProfessionalFields {
  name: string
  phone: string
  whatsapp: boolean
  professions: string[]
  professionOther?: string
  locality?: string
  note?: string
}

type Result = { error?: string; ok?: boolean }

function validateFields(f: AdminProfessionalFields): string | null {
  if (!f.name?.trim()) return 'Name is required.'
  if (!f.phone?.trim()) return 'Phone is required.'
  const professions = (f.professions ?? []).map((p) => p.trim()).filter(Boolean)
  if (professions.length === 0) return 'Select at least one profession.'
  if (professions.some((p) => !isValidProfession(p))) return 'Invalid profession.'
  if (professions.includes('Other') && !f.professionOther?.trim()) return 'Describe the profession.'
  return null
}

function toRow(f: AdminProfessionalFields) {
  const professions = (f.professions ?? []).map((p) => p.trim()).filter(Boolean)
  return {
    name: f.name.trim(),
    phone: f.phone.trim(),
    whatsapp: !!f.whatsapp,
    professions,
    profession_other: professions.includes('Other') ? (f.professionOther?.trim() || null) : null,
    locality: f.locality?.trim() || null,
    note: f.note?.trim() || null,
  }
}

async function admin() {
  const supabase = await createClient()
  await requireAdmin(supabase) // redirects if not admin
  const db = createAdminClient()
  if (!db) throw new Error('Service role not configured')
  return db
}

export async function setProfessionalStatus(id: string, status: 'approved' | 'rejected'): Promise<Result> {
  const db = await admin()
  const { error } = await db.from('find_professionals')
    .update({ status, updated_at: new Date().toISOString() }).eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/admin/find')
  return { ok: true }
}

export async function updateProfessional(id: string, fields: AdminProfessionalFields): Promise<Result> {
  const invalid = validateFields(fields)
  if (invalid) return { error: invalid }
  const db = await admin()
  const { error } = await db.from('find_professionals')
    .update({ ...toRow(fields), updated_at: new Date().toISOString() }).eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/admin/find')
  return { ok: true }
}

export async function createProfessionalAsAdmin(fields: AdminProfessionalFields): Promise<Result> {
  const invalid = validateFields(fields)
  if (invalid) return { error: invalid }
  const db = await admin()
  const { error } = await db.from('find_professionals')
    .insert({ ...toRow(fields), status: 'approved', is_active: true })
  if (error) return { error: error.message }
  revalidatePath('/admin/find')
  return { ok: true }
}

export async function setProfessionalActive(id: string, isActive: boolean): Promise<Result> {
  const db = await admin()
  const { error } = await db.from('find_professionals')
    .update({ is_active: isActive, updated_at: new Date().toISOString() }).eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/admin/find')
  return { ok: true }
}

export async function setRatingStatus(id: string, status: 'approved' | 'rejected'): Promise<Result> {
  const db = await admin()
  const { error } = await db.from('find_ratings')
    .update({ status, updated_at: new Date().toISOString() }).eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/admin/find')
  return { ok: true }
}
