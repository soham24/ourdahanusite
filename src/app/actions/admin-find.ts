'use server'

import { revalidateFindCache } from '@/lib/cache-tags'
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
  businessListingId?: string | null
}

type Result = { error?: string; ok?: boolean }

function validateFields(f: AdminProfessionalFields): string | null {
  if (!f.name?.trim()) return 'Name is required.'
  if (!f.phone?.trim()) return 'Phone is required.'
  const professions = Array.from(new Set((f.professions ?? []).map((p) => p.trim()).filter(Boolean)))
  if (professions.length === 0) return 'Select at least one profession.'
  if (professions.some((p) => !isValidProfession(p))) return 'Invalid profession.'
  if (professions.includes('Other') && !f.professionOther?.trim()) return 'Describe the profession.'
  return null
}

function toRow(f: AdminProfessionalFields) {
  const professions = Array.from(new Set((f.professions ?? []).map((p) => p.trim()).filter(Boolean)))
  return {
    name: f.name.trim(),
    phone: f.phone.trim(),
    whatsapp: !!f.whatsapp,
    professions,
    profession_other: professions.includes('Other') ? (f.professionOther?.trim() || null) : null,
    locality: f.locality?.trim() || null,
    note: f.note?.trim() || null,
    business_listing_id: f.businessListingId ?? null,
  }
}

async function admin() {
  const supabase = await createClient()
  await requireAdmin(supabase) // redirects if not admin
  const db = createAdminClient()
  if (!db) throw new Error('Service role not configured')
  return db
}

// Returns an error string if the businessListingId is set but not a real,
// approved listing; null when valid or unset.
async function validateBusinessListing(
  db: NonNullable<ReturnType<typeof createAdminClient>>,
  businessListingId: string | null | undefined,
): Promise<string | null> {
  if (!businessListingId) return null
  const { data } = await db.from('listings').select('id, approved').eq('id', businessListingId).maybeSingle()
  if (!data) return 'The selected business page was not found.'
  if (!(data as { approved: boolean }).approved) return 'The selected business page is not approved yet.'
  return null
}

export async function setProfessionalStatus(id: string, status: 'approved' | 'rejected'): Promise<Result> {
  const db = await admin()
  const { error } = await db.from('find_professionals')
    .update({ status, updated_at: new Date().toISOString() }).eq('id', id)
  if (error) return { error: error.message }
  revalidateFindCache()
  return { ok: true }
}

export async function updateProfessional(id: string, fields: AdminProfessionalFields): Promise<Result> {
  const invalid = validateFields(fields)
  if (invalid) return { error: invalid }
  const db = await admin()
  const invalidBusiness = await validateBusinessListing(db, fields.businessListingId)
  if (invalidBusiness) return { error: invalidBusiness }
  const { error } = await db.from('find_professionals')
    .update({ ...toRow(fields), updated_at: new Date().toISOString() }).eq('id', id)
  if (error) return { error: error.message }
  revalidateFindCache()
  return { ok: true }
}

export async function createProfessionalAsAdmin(fields: AdminProfessionalFields): Promise<Result> {
  const invalid = validateFields(fields)
  if (invalid) return { error: invalid }
  const db = await admin()
  const invalidBusiness = await validateBusinessListing(db, fields.businessListingId)
  if (invalidBusiness) return { error: invalidBusiness }
  const { error } = await db.from('find_professionals')
    .insert({ ...toRow(fields), status: 'approved', is_active: true })
  if (error) return { error: error.message }
  revalidateFindCache()
  return { ok: true }
}

export async function searchBusinessListings(
  query: string,
): Promise<{ id: string; name: string; subdomain: string | null }[]> {
  const q = query.trim()
  if (q.length < 2) return []
  const db = await admin()
  const term = `%${q.replace(/[%_,()]/g, ' ').trim()}%`
  const { data } = await db
    .from('listings')
    .select('id, name, subdomain')
    .eq('approved', true)
    .ilike('name', term)
    .order('name', { ascending: true })
    .limit(10)
  return (data ?? []) as { id: string; name: string; subdomain: string | null }[]
}

export async function setProfessionalActive(id: string, isActive: boolean): Promise<Result> {
  const db = await admin()
  const { error } = await db.from('find_professionals')
    .update({ is_active: isActive, updated_at: new Date().toISOString() }).eq('id', id)
  if (error) return { error: error.message }
  revalidateFindCache()
  return { ok: true }
}

export async function setRatingStatus(id: string, status: 'approved' | 'rejected'): Promise<Result> {
  const db = await admin()
  const { error } = await db.from('find_ratings')
    .update({ status, updated_at: new Date().toISOString() }).eq('id', id)
  if (error) return { error: error.message }
  revalidateFindCache()
  return { ok: true }
}

// Permanently deletes a professional. find_ratings.professional_id has
// ON DELETE CASCADE, so their ratings are removed with them.
export async function deleteProfessional(id: string): Promise<Result> {
  const db = await admin()
  const { error } = await db.from('find_professionals').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidateFindCache()
  return { ok: true }
}

export async function deleteRating(id: string): Promise<Result> {
  const db = await admin()
  const { error } = await db.from('find_ratings').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidateFindCache()
  return { ok: true }
}
