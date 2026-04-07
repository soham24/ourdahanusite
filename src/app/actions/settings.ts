'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin-client'
import { getUserRole } from '@/app/actions/admin'
import { revalidateSettingsCache } from '@/lib/cache-tags'

export async function setFeaturedListing(subdomain: string): Promise<{ error?: string; success?: boolean }> {
  const supabase = await createClient()
  const { role } = await getUserRole(supabase)
  if (role !== 'admin') return { error: 'Admin access required' }

  const admin = createAdminClient()
  if (!admin) return { error: 'Server configuration error' }

  const clean = subdomain.trim().toLowerCase()
  if (!clean) return { error: 'Subdomain is required' }

  const { error } = await admin
    .from('site_settings')
    .upsert({ key: 'featured_listing_subdomain', value: clean, updated_at: new Date().toISOString() })

  if (error) return { error: error.message }

  revalidateSettingsCache()
  return { success: true }
}
