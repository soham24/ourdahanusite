'use server'

import { requireListingAccess } from '@/lib/appointment-access'
import { revalidateAppointmentsCache } from '@/lib/cache-tags'
import {
  normalizeAppointmentSettings,
  type AppointmentSettings,
} from '@/lib/listing-content'
import { createAdminClient } from '@/lib/supabase/admin-client'

export async function saveAppointmentSettings(
  listingId: string,
  settings: AppointmentSettings,
): Promise<{ error?: string; saved?: boolean }> {
  const access = await requireListingAccess(listingId)
  if ('error' in access) return { error: access.error }

  // Normalise server-side. The client is never the validator: every slot
  // computation downstream assumes windows are sorted, non-overlapping and
  // capped, and this is the only place that guarantees it.
  const normalized = normalizeAppointmentSettings(settings)
  if (!normalized) return { error: 'Those settings could not be read. Please try again.' }

  const adminClient = createAdminClient()
  if (!adminClient) return { error: 'Server configuration error.' }

  const { error } = await adminClient
    .from('listings')
    .update({
      appointment_settings: normalized,
      updated_at: new Date().toISOString(),
    })
    .eq('id', listingId)

  if (error) return { error: error.message }

  revalidateAppointmentsCache(listingId)
  return { saved: true }
}
